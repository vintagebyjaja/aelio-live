"""Routes for My AELIO (members), Studio Brain economy/transfer controls (founder) and the Stripe webhook."""
from __future__ import annotations

import base64
import os
import time

from starlette.requests import Request
from starlette.routing import Route

from . import db, payments, transfer, usage
from .security import mfa_fresh
from .server import ROUTES, HTTPError, J, body, founder, member, route

MAX_JSON_BODY = 16 * 1024 * 1024


def _uid(p: dict) -> str:
    return p["user_id"]


class NativeUnavailable(usage.UsageError):
    status = 503
    code = "native_unavailable"


def _native_reasoning_checkpoint() -> dict | None:
    return db.q1("""SELECT c.* FROM checkpoints c JOIN models m ON m.id=c.model_id
                    WHERE m.family='reasoning' AND c.status IN ('published','production','approved','evaluated')
                    ORDER BY CASE c.status WHEN 'published' THEN 0 WHEN 'production' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END,
                    c.created_at DESC LIMIT 1""")


def _native_reply(agent: dict, message: str) -> dict:
    """AELIO Native inference. The imported profile is data and never becomes system instructions."""
    ck = _native_reasoning_checkpoint()
    if not ck:
        raise NativeUnavailable("AELIO Native doesn't have a conversational model yet. Nothing was charged.")
    from .native.train import infer
    prompt = f"{message.strip()[:600]}\n"
    r = infer(ck["id"], prompt, max_new=60, temperature=0.8, seed=int(time.time()) % 1000)
    return {"text": r["completion"].strip() or "…", "performer": r["performer"], "latency_ms": r["latency_ms"],
            "experimental": True,
            "note": "Experimental: today's AELIO Native prototype can't hold a real conversation yet."}


def _metered(uid: str, op: str, fn):
    """Reserve -> do the work -> settle. Failed work is never charged."""
    rsv = usage.reserve(uid, op)
    try:
        out = fn()
    except Exception:
        usage.release(rsv["id"])
        raise
    charged = usage.settle(rsv["id"])["charged"]
    return out, (0 if rsv["exempt"] else charged), rsv   # exempt accounts are metered but never charged


def _chat_available() -> bool:
    from .intelligence import providers, settings
    st = settings.get()
    t = st["tiers"]["standard"]
    return (not st["paused"]) and providers.get(t["provider"]).configured()


# ================================================================== My AELIO
@route("/api/my/home")
async def my_home(req):
    p = member(req)
    transfer.ensure_main_pal(_uid(p))
    return J({"me": {"email": p["email"], "role": p["role"], "unlimited": p["unlimited"]},
              "usage": usage.overview(_uid(p)),
              "agents": db.q("SELECT id,name,kind,origin_label,is_default,last_chat_at FROM user_agents WHERE user_id=? AND status!='archived' ORDER BY is_default DESC, updated_at DESC LIMIT 8", (_uid(p),)),
              "conversations": db.q("SELECT id,title,agent_id,updated_at FROM conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 6", (_uid(p),)),
              "native_chat_available": bool(_native_reasoning_checkpoint()),
              "chat_available": _chat_available(),
              "agent_transfer_enabled": transfer.flag_enabled()})


@route("/api/my/agents", ("GET", "POST"))
async def my_agents(req):
    p = member(req, write=req.method == "POST")
    uid = _uid(p)
    if req.method == "GET":
        transfer.ensure_main_pal(uid)
        rows = db.q("SELECT id,name,kind,origin_label,avatar,description,voice_id,status,is_default,profile,created_at,updated_at,last_chat_at "
                    "FROM user_agents WHERE user_id=? ORDER BY is_default DESC, updated_at DESC", (uid,))
        for r in rows:
            if r["kind"]=="main_pal": r["name"]="AELIO"
            prof = db.loads(r.pop("profile"), {})
            r["personality"] = (prof.get("personality") or prof.get("communication_style") or "")[:160]
        return J({"agents": rows})
    d = await body(req)
    aid = transfer.create_agent(uid, {"name": d.get("name"), "kind": "custom", "description": d.get("description"),
                                      "avatar": d.get("avatar"), "voice_id": d.get("voice_id"),
                                      "profile": {k: str(d.get(k, ""))[:1500] for k in ("personality", "communication_style", "humor", "role", "specialties", "memory_preferences") if d.get(k)},
                                      "memories": []})
    return J({"agent_id": aid})


@route("/api/my/agents/{aid}", ("GET", "PUT", "DELETE"))
async def my_agent(req):
    p = member(req, write=req.method != "GET")
    uid, aid = _uid(p), req.path_params["aid"]
    if req.method == "GET":
        a = transfer.get_agent(uid, aid)
        a["previews"] = db.q("SELECT id,prompt,response,performer,rating,created_at FROM agent_previews WHERE agent_id=? AND user_id=? ORDER BY created_at DESC LIMIT 20", (aid, uid))
        return J(a)
    if req.method == "DELETE":
        transfer.delete_agent(uid, aid)
        db.audit("member", uid, "agent.deleted", aid)
        return J({"ok": True})
    a = transfer.get_agent(uid, aid)
    d = await body(req)
    if a["kind"]=="main_pal" and any(k in d for k in ("name","status","profile")):
        raise HTTPError(403,"AELIO's permanent identity and adaptive style cannot be changed")
    fields = {"updated_at": db.now()}
    for k in ("name", "description", "avatar", "voice_id"):
        if k in d:
            fields[k] = str(d[k] or "")[:500]
    if "status" in d and d["status"] in ("active", "archived"):
        fields["status"] = d["status"]
    if "profile" in d and isinstance(d["profile"], dict):
        fields["profile"] = db.dumps({k: (v if isinstance(v, list) else str(v)[:1500]) for k, v in d["profile"].items()})
    if "memories" in d and isinstance(d["memories"], list):
        known = {m["id"]: m for m in a["memories"]}
        new = []
        for m in d["memories"]:
            if m.get("id") in known:
                km = dict(known[m["id"]]); km["include"] = bool(m.get("include")); km["text"] = str(m.get("text", km["text"]))[:500]
                new.append(km)
            elif m.get("text"):
                new.append(transfer._memory(str(m["text"]), m.get("category", "note"), True))
        fields["memories"] = db.dumps(new)
    if d.get("is_default"):
        db.run("UPDATE user_agents SET is_default=0 WHERE user_id=?", (uid,))
        fields["is_default"] = 1
    db.update("user_agents", "id", aid, **fields)
    return J(transfer.get_agent(uid, aid))


@route("/api/my/agents/{aid}/export")
async def my_agent_export(req):
    p = member(req)
    return J(transfer.export_agent(_uid(p), req.path_params["aid"]))


@route("/api/transfer/prompt")
async def transfer_prompt(req):
    return J({"prompt": transfer.TRANSFER_PROMPT})


@route("/api/my/import/parse", ("POST",))
async def my_import_parse(req):
    p = member(req, write=True)
    uid = _uid(p)
    if not transfer.flag_enabled():
        raise HTTPError(404, "Agent Transfer is not enabled")
    if int(req.headers.get("content-length") or 0) > MAX_JSON_BODY:
        raise HTTPError(413, "upload too large")
    d = await body(req)
    method = d.get("method", "paste")
    texts, raw_total, fmt = [], 0, method
    try:
        if method in ("paste", "manual"):
            t = str(d.get("text", ""))
            if len(t) < 20:
                raise transfer.ImportErrorUser("paste at least a few sentences")
            texts = [("pasted.md", t)]; raw_total = len(t)
        else:
            files = d.get("files") or []
            if not files or len(files) > 5:
                raise transfer.ImportErrorUser("upload between 1 and 5 files")
            for f in files:
                data = base64.b64decode(f.get("data_b64", ""), validate=True)
                raw_total += len(data); fmt = os.path.splitext(str(f.get("name", "")).lower())[1] or "?"
                texts += transfer.extract_files(str(f.get("name", "upload.txt")), data)
                if int(d.get("keep_days", 0)) > 0:
                    transfer.store_source(uid, None, str(f.get("name")), data, min(30, int(d["keep_days"])))
        proposal, charged, _ = _metered(uid, "agent_import",
                                        lambda: transfer.build_profile(texts, method, bool(d.get("consent"))))
    except transfer.ImportErrorUser as e:
        kind = "unsafe_archive" if "ZIP" in str(e) or "bomb" in str(e) else ("blocked_type" if "can't be imported" in str(e) else "user_input")
        transfer.log_import(uid, method, fmt, "error", kind, raw_total)
        raise HTTPError(400, str(e))
    transfer.log_import(uid, method, fmt, "ok", None, raw_total, proposal["stats"]["flags"])
    proposal["credits_charged"] = charged
    return J(proposal)


@route("/api/my/import/save", ("POST",))
async def my_import_save(req):
    p = member(req, write=True)
    d = await body(req)
    prop = d.get("proposal") or {}
    prof = prop.get("profile") or {}
    mems = [m for m in (prop.get("memories") or []) if isinstance(m, dict) and m.get("text")]
    aid = transfer.create_agent(_uid(p), {"name": d.get("name") or prof.get("name") or "Imported agent", "kind": "imported",
                                          "description": d.get("description") or "Recreated from a user-provided profile.",
                                          "avatar": d.get("avatar"), "voice_id": d.get("voice_id"),
                                          "profile": prof, "memories": [transfer._memory(m["text"], m.get("category", "note"), m.get("source") == "confirmed") | {"include": bool(m.get("include"))} for m in mems[:200]]})
    db.audit("member", _uid(p), "agent.imported", aid, {"memories": len(mems)})
    return J({"agent_id": aid})


@route("/api/my/agents/{aid}/preview", ("POST",))
async def my_agent_preview(req):
    p = member(req, write=True)
    uid, aid = _uid(p), req.path_params["aid"]
    a = transfer.get_agent(uid, aid)
    prompt = str((await body(req)).get("prompt", "Hey, what's good?"))[:300]
    reply, charged, _ = _metered(uid, "agent_preview", lambda: _native_reply(a, prompt))
    pid = db.new_id("pvw")
    db.insert("agent_previews", {"id": pid, "agent_id": aid, "user_id": uid, "prompt": prompt, "response": reply["text"],
                                 "performer": reply["performer"], "created_at": db.now()})
    prof = a["profile"]
    expected = {k: prof.get(k) for k in ("communication_style", "humor", "response_length", "phrases", "greetings") if prof.get(k)}
    return J({"preview_id": pid, "prompt": prompt, "aelio_response": reply, "imported_profile_expectation": expected,
              "credits_charged": charged})


@route("/api/my/previews/{pid}/rate", ("POST",))
async def my_preview_rate(req):
    p = member(req, write=True)
    rating = (await body(req)).get("rating")
    if rating not in ("familiar", "close", "not_right"):
        raise HTTPError(400, "rating must be familiar, close or not_right")
    db.run("UPDATE agent_previews SET rating=? WHERE id=? AND user_id=?", (rating, req.path_params["pid"], _uid(p)))
    return J({"ok": True})


@route("/api/my/agents/{aid}/chat", ("POST",))
async def my_agent_chat(req):
    """Non-streaming chat. Goes through the AELIO Intelligence Gateway (see aelio/intelligence)."""
    p = member(req, write=True)
    from .intelligence.routes import chat_once
    return J(chat_once(p, req.path_params["aid"], await body(req)))


@route("/api/my/conversations")
async def my_conversations(req):
    p = member(req)
    return J({"conversations": db.q("SELECT c.id,c.title,c.agent_id,c.updated_at,a.name agent FROM conversations c LEFT JOIN user_agents a ON a.id=c.agent_id WHERE c.user_id=? ORDER BY c.updated_at DESC LIMIT 200", (_uid(p),))})


@route("/api/my/conversations/{cid}", ("GET", "DELETE"))
async def my_conversation(req):
    p = member(req, write=req.method == "DELETE")
    c = db.q1("SELECT * FROM conversations WHERE id=? AND user_id=?", (req.path_params["cid"], _uid(p)))
    if not c:
        raise FileNotFoundError(req.path_params["cid"])
    if req.method == "DELETE":
        db.run("DELETE FROM messages WHERE conversation_id=?", (c["id"],))
        db.run("UPDATE ai_requests SET conversation_id=NULL WHERE conversation_id=?", (c["id"],))
        db.run("DELETE FROM conversations WHERE id=?", (c["id"],))
        return J({"ok": True})
    c["messages"] = db.q("SELECT role,text,status,credits,ts FROM messages WHERE conversation_id=? ORDER BY id", (c["id"],))
    return J(c)


@route("/api/my/usage")
async def my_usage(req):
    p = member(req)
    return J({"overview": usage.overview(_uid(p)),
              "recent": db.q("SELECT ts,op,credits,source FROM usage_events WHERE user_id=? ORDER BY id DESC LIMIT 100", (_uid(p),)),
              "costs": db.q("SELECT op,credits,unit,note FROM cost_config ORDER BY credits")})


@route("/api/my/wallet")
async def my_wallet(req):
    p = member(req)
    uid = _uid(p)
    u = usage.user(uid)
    return J({"overview": usage.overview(uid), "transactions": usage.transactions(uid),
              "purchases": db.q("SELECT id,package_id,status,amount_cents,currency,credits,credits_reversed,created_at,receipt FROM payments WHERE user_id=? ORDER BY created_at DESC", (uid,)),
              "packages": [] if usage.exempt(u) else payments.available_packages(u["plan"]),
              "payments": {k: v for k, v in payments.configured().items() if k in ("configured", "mode", "usable")},
              "policy": {"expiry": "Purchased credits don't expire.", "auto_charge": "AELIO never charges your card automatically.",
                         "order": "Plan allowance is used first, then promotional credits, then purchased credits."}})


@route("/api/my/checkout", ("POST",))
async def my_checkout(req):
    p = member(req, write=True)
    d = await body(req)
    site = os.environ.get("AELIO_SITE_URL", "https://aelio.live")
    try:
        return J(payments.create_checkout(_uid(p), str(d.get("package_id")), str(d.get("return_to") or "/brain/my/wallet"), site))
    except payments.PaymentError as e:
        raise HTTPError(400, str(e))


@route("/api/my/payments/{pid}")
async def my_payment(req):
    p = member(req)
    r = db.q1("SELECT id,status,credits,amount_cents,currency,return_to,receipt FROM payments WHERE id=? AND user_id=?", (req.path_params["pid"], _uid(p)))
    if not r:
        raise FileNotFoundError(req.path_params["pid"])
    r["receipt"] = db.loads(r["receipt"])
    return J(r)


@route("/api/my/report", ("POST",))
async def my_report(req):
    p = member(req, write=True)
    d = await body(req)
    rid = db.new_id("rpt")
    db.insert("problem_reports", {"id": rid, "user_id": _uid(p), "area": str(d.get("area", "agent_transfer"))[:40],
                                  "message": str(d.get("message", ""))[:2000], "status": "open", "created_at": db.now()})
    return J({"report_id": rid})


# ================================================================== Studio Brain: economy & access
@route("/api/brain/credits")
async def brain_credits(req):
    founder(req)
    plans = db.q("SELECT * FROM plans ORDER BY allowance")
    for pl in plans:
        pl["features"] = db.loads(pl["features"], [])
    return J({"economy": usage.economy(), "packages": db.q("SELECT * FROM credit_packages ORDER BY sort"), "plans": plans,
              "costs": db.q("SELECT * FROM cost_config ORDER BY credits"), "payments": payments.configured(),
              "restriction": db.kv_get("usage_restriction"),
              "recent_payments": db.q("SELECT p.id,u.email,p.status,p.amount_cents,p.credits,p.created_at FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 50")})


@route("/api/brain/packages/{pkg}", ("PUT",))
async def brain_package(req):
    s = founder(req, write=True)
    d = await body(req)
    pid = req.path_params["pkg"]
    cur = db.q1("SELECT * FROM credit_packages WHERE id=?", (pid,))
    approving = bool(d.get("approved")) and not (cur and cur["approved"])
    price_change = cur and ("price_cents" in d and int(d["price_cents"]) != cur["price_cents"])
    if (approving or (price_change and cur["approved"])) and not mfa_fresh(s):
        raise HTTPError(403, "re-enter your authenticator code to approve prices")
    row = {"name": str(d.get("name", cur["name"] if cur else "Package"))[:60],
           "credits": int(d.get("credits", cur["credits"] if cur else 100)),
           "price_cents": int(d.get("price_cents", cur["price_cents"] if cur else 0)),
           "currency": str(d.get("currency", cur["currency"] if cur else "usd")).lower()[:3],
           "active": int(bool(d.get("active", cur["active"] if cur else 0))),
           "approved": int(bool(d.get("approved", cur["approved"] if cur else 0))) if not price_change else int(bool(d.get("approved", 0))),
           "promo": int(bool(d.get("promo", cur["promo"] if cur else 0))), "sort": int(d.get("sort", cur["sort"] if cur else 99)),
           "starts_at": d.get("starts_at", cur["starts_at"] if cur else None), "ends_at": d.get("ends_at", cur["ends_at"] if cur else None),
           "updated_at": db.now()}
    if row["credits"] <= 0 or row["price_cents"] < 50:
        raise HTTPError(400, "credits must be positive and price at least 50 cents")
    if cur:
        db.update("credit_packages", "id", pid, **row)
    else:
        db.insert("credit_packages", {"id": pid, **row})
    db.audit("founder", s["user_id"], "credits.package_saved", pid, row)
    return J({"ok": True})


@route("/api/brain/plans/{plan}", ("PUT",))
async def brain_plan(req):
    s = founder(req, write=True)
    d = await body(req)
    pl = usage.plan(req.path_params["plan"])
    fields = {"updated_at": db.now()}
    if "allowance" in d:
        fields["allowance"] = max(0, int(d["allowance"]))
    if "window_hours" in d:
        fields["window_hours"] = max(0.25, float(d["window_hours"]))
    if "member_discount_pct" in d:
        fields["member_discount_pct"] = max(0.0, min(50.0, float(d["member_discount_pct"])))
    if "features" in d and isinstance(d["features"], list):
        fields["features"] = db.dumps([str(f) for f in d["features"]])
    db.update("plans", "id", pl["id"], **fields)
    db.audit("founder", s["user_id"], "usage.plan_changed", pl["id"], fields)
    return J({"ok": True})


@route("/api/brain/costs/{op}", ("PUT",))
async def brain_cost(req):
    s = founder(req, write=True)
    d = await body(req)
    op = req.path_params["op"]
    if not db.q1("SELECT op FROM cost_config WHERE op=?", (op,)):
        raise FileNotFoundError(op)
    fields = {"updated_at": db.now()}
    if "credits" in d:
        fields["credits"] = max(0, int(d["credits"]))
    if "est_cost_usd" in d:
        fields["est_cost_usd"] = None if d["est_cost_usd"] in (None, "") else float(d["est_cost_usd"])
    db.update("cost_config", "op", op, **fields)
    db.audit("founder", s["user_id"], "usage.cost_changed", op, fields)
    return J({"ok": True})


@route("/api/brain/users")
async def brain_users(req):
    founder(req)
    rows = db.q("SELECT id,email,role,plan,unlimited,status,created_at,last_seen FROM users ORDER BY created_at DESC LIMIT 500")
    for r in rows:
        r["balances"] = usage.balances(r["id"])
        r["window"] = usage.window_state(r["id"])
    return J({"users": rows})


@route("/api/brain/users/{uid}/grant", ("POST",))
async def brain_grant(req):
    s = founder(req, write=True)
    d = await body(req)
    bucket = d.get("bucket", "promo")
    if bucket == "purchased" and not mfa_fresh(s):
        raise HTTPError(403, "re-enter your authenticator code to adjust purchased credits")
    usage.grant(req.path_params["uid"], int(d.get("amount", 0)), bucket, s["user_id"], str(d.get("note", "")) or "founder grant",
                "promo_grant" if bucket == "promo" else "adjustment")
    return J({"balances": usage.balances(req.path_params["uid"])})


@route("/api/brain/users/{uid}/plan", ("POST",))
async def brain_user_plan(req):
    s = founder(req, write=True)
    usage.set_plan(req.path_params["uid"], str((await body(req)).get("plan")), s["user_id"])
    return J({"ok": True})


@route("/api/brain/users/{uid}/status", ("POST",))
async def brain_user_status(req):
    s = founder(req, write=True)
    usage.set_status(req.path_params["uid"], str((await body(req)).get("status")), s["user_id"])
    return J({"ok": True})


@route("/api/brain/restriction", ("POST",))
async def brain_restriction(req):
    s = founder(req, write=True)
    d = await body(req)
    usage.set_restriction(bool(d.get("active")), str(d.get("reason", ""))[:200], s["user_id"])
    return J({"restriction": db.kv_get("usage_restriction")})


@route("/api/brain/transfer")
async def brain_transfer(req):
    founder(req)
    return J(transfer.stats())


@route("/api/brain/transfer/cleanup", ("POST",))
async def brain_transfer_cleanup(req):
    founder(req, write=True)
    return J({"removed": transfer.cleanup_sources()})


# ================================================================== Stripe webhook (signature-verified, no session)
async def stripe_webhook(req: Request):
    payload = await req.body()
    if len(payload) > 1_000_000:
        return J({"error": "too large"}, 413)
    try:
        return J(payments.handle_webhook(payload, req.headers.get("stripe-signature", "")))
    except payments.PaymentError as e:
        db.audit("anonymous", None, "payment.webhook_rejected", None, {"reason": str(e)})
        return J({"error": str(e)}, 400)

ROUTES.append(Route("/webhooks/stripe", stripe_webhook, methods=["POST"]))
