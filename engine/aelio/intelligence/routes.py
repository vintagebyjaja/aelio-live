"""HTTP routes for AELIO intelligence: member chat (streaming), AI disclosure/consent, founder dashboard."""
from __future__ import annotations

import json
import statistics
import time

from starlette.responses import StreamingResponse

from .. import db, transfer, usage
from ..security import mfa_fresh
from ..server import HTTPError, J, body, founder, member, route
from . import gateway, personalities, providers, settings
from .context import history, instructions
from .contracts import GenRequest, Message

DISCLOSURE = {
    "version": "2026-10-28",
    "title": "How AELIO answers you",
    "text": ("AELIO Live's chat is currently powered by OpenAI GPT models, reached through AELIO's own Intelligence Gateway. "
             "When you chat, your message, recent messages from that conversation, and the memories you approved for that "
             "agent are sent to OpenAI to generate the reply. AELIO asks OpenAI not to store the conversation (store=false) "
             "and keeps your history in AELIO's own database, where you can delete it. OpenAI's API data policies apply to "
             "what it processes. AELIO Native, Grooveville's independently trained model, is still in research and doesn't "
             "answer your chats. Your conversations are never used to train AELIO Native without your separate, explicit permission."),
}


def _refusal(e: gateway.GatewayRefused):
    message = e.message
    if e.code in {'not_configured','spend_cap','exempt_cap','paused'}:
        message = 'AI replies are temporarily unavailable. Your account and saved work remain available.'
    elif e.code == 'consent_required':
        message = 'Review and accept the AI disclosure before sending a message.'
    return J({"error": message, "code": e.code}, e.status)


def _member_event(event: dict) -> dict:
    allowed = {'type', 'request_id', 'text', 'message', 'code', 'credits_charged', 'estimate_credits', 'exempt', 'conversation_id', 'notice'}
    visible = {key: value for key, value in event.items() if key in allowed}
    if event.get('type') == 'error':
        visible['message'] = 'The reply could not be completed. Your conversation is still available to retry.'
    return visible


def _settings_row(uid: str) -> dict:
    return db.q1("SELECT * FROM user_settings WHERE user_id=?", (uid,)) or {"external_ai_consent_at": None, "personality_id": None}


# ================================================================== member
@route("/api/my/ai")
async def my_ai(req):
    p = member(req)
    st = settings.get()
    std = st["tiers"]["standard"]
    row = _settings_row(p["user_id"])
    return J({"disclosure": DISCLOSURE, "consent_at": row["external_ai_consent_at"], "personality_id": row["personality_id"],
              "personalities": personalities.listing(),
              "provider": {"external": providers.get(std["provider"]).external,
                           "configured": providers.get(std["provider"]).configured()},
              "paused": st["paused"]})


@route("/api/my/settings", ("PUT",))
async def my_settings(req):
    p = member(req, write=True)
    d = await body(req)
    uid = p["user_id"]
    row = _settings_row(uid)
    consent = row["external_ai_consent_at"]
    if "external_ai_consent" in d:
        consent = time.time() if d["external_ai_consent"] else None
        db.audit("user", uid, "ai.consent", uid, {"accepted": bool(d["external_ai_consent"]), "version": DISCLOSURE["version"]})
    pid = row["personality_id"]
    if "personality_id" in d:
        if d["personality_id"] not in personalities.PERSONALITIES:
            raise HTTPError(400, "unknown personality")
        pid = d["personality_id"]
    with db.tx() as c:
        c.execute("""INSERT INTO user_settings(user_id, external_ai_consent_at, personality_id, updated_at) VALUES(?,?,?,?)
                     ON CONFLICT(user_id) DO UPDATE SET external_ai_consent_at=excluded.external_ai_consent_at,
                     personality_id=excluded.personality_id, updated_at=excluded.updated_at""", (uid, consent, pid, time.time()))
    return J({"ok": True, "consent_at": consent, "personality_id": pid})


def _prepare(p: dict, aid: str, d: dict, purpose: str = "chat"):
    uid = p["user_id"]
    agent = transfer.get_agent(uid, aid)
    msg = str(d.get("message", "")).strip()[:16000]
    if not msg:
        raise HTTPError(400, "empty message")
    cid = d.get("conversation_id")
    conv = None
    if cid:
        conv = db.q1("SELECT * FROM conversations WHERE id=? AND user_id=?", (cid, uid))
        if not conv:
            raise HTTPError(404, "conversation not found")
    pid = d.get("personality_id") or (conv or {}).get("personality_id") or _settings_row(uid)["personality_id"]
    if agent.get("kind")=="main_pal": pid=None
    if pid and pid not in personalities.PERSONALITIES:
        raise HTTPError(400, "unknown personality")
    st = settings.get()
    msgs = history(cid, st["history_messages"]) + [Message("user", msg)]
    route_ = settings.choose(purpose, msg, p["role"], uid, st)
    req = GenRequest(user_id=uid, purpose=purpose, instructions=instructions(agent, pid, route_["provider"], purpose),
                     messages=msgs, conversation_id=cid)
    return agent, msg, cid, pid, req


def _save_turn(uid, aid, cid, pid, msg, reply_text, final, meta):
    if not cid:
        cid = db.new_id("cnv")
        db.insert("conversations", {"id": cid, "user_id": uid, "agent_id": aid, "title": msg[:60], "created_at": db.now(),
                                    "updated_at": db.now(), "personality_id": pid})
    db.insert("messages", {"conversation_id": cid, "role": "user", "text": msg, "performer": None, "credits": 0, "ts": db.now(),
                           "status": "ok"})
    ok = final and final.get("type") == "done"
    prov = (final or {}).get("provider") or (meta or {}).get("provider")
    model = (final or {}).get("model") or (meta or {}).get("model")
    if reply_text or not ok:
        db.insert("messages", {"conversation_id": cid, "role": "assistant", "text": reply_text or "", "ts": db.now(),
                               "performer": f"{prov}:{model}" if prov else None, "provider": prov, "model": model,
                               "credits": (final or {}).get("credits_charged", 0) if ok else 0, "status": "ok" if ok else "error"})
    db.update("conversations", "id", cid, updated_at=db.now())
    db.update("user_agents", "id", aid, last_chat_at=db.now())
    return cid


@route("/api/my/agents/{aid}/chat/stream", ("POST",))
async def my_agent_chat_stream(req):
    p = member(req, write=True)
    d = await body(req)
    agent, msg, cid, pid, greq = _prepare(p, req.path_params["aid"], d)
    gen = gateway.run(greq, p)
    try:
        first = next(gen)                 # all refusals (pause, consent, limits, wallet) happen before this returns
    except gateway.GatewayRefused as e:
        return _refusal(e)

    def sse():
        text, final, meta = [], None, first
        try:
            yield f"data: {json.dumps(_member_event(first))}\n\n"
            for ev in gen:
                if ev["type"] == "delta":
                    text.append(ev["text"])
                elif ev["type"] in ("done", "error"):
                    final = ev
                    continue          # sent after saving, with the conversation id
                yield f"data: {json.dumps(_member_event(ev))}\n\n"
        finally:
            gen.close()               # if the browser left mid-reply, the gateway settles what was delivered
            saved = _save_turn(p["user_id"], agent["id"], cid, pid, msg, "".join(text), final, meta)
        out = _member_event(dict(final or {"type": "error", "code": "failed", "message": "No reply."}))
        out["conversation_id"] = saved
        out["usage"] = usage.overview(p["user_id"])
        yield f"data: {json.dumps(out)}\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream",
                             headers={"cache-control": "no-store", "x-accel-buffering": "no"})


def chat_once(p: dict, aid: str, d: dict) -> dict:
    """Non-streaming chat used by the original /chat route (same response shape as before)."""
    agent, msg, cid, pid, greq = _prepare(p, aid, d)
    try:
        r = gateway.collect(greq, p)
    except gateway.GatewayRefused as e:
        raise HTTPError(e.status, e.message)
    final = r["final"] or {}
    cid = _save_turn(p["user_id"], agent["id"], cid, pid, msg, r["text"], final, r["meta"])
    if final.get("type") == "error":
        raise HTTPError(502, final.get("message", "The AI provider failed. Nothing was charged."))
    return {"conversation_id": cid, "credits_charged": final.get("credits_charged", 0), "usage": usage.overview(p["user_id"]),
            "reply": {"text": r["text"], "experimental": False}}


# ================================================================== founder
def _pct(xs, q):
    if not xs:
        return None
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))]


def dashboard() -> dict:
    st = settings.get()
    now = time.time()
    windows = {}
    for label, secs in (("24h", 86400), ("7d", 7 * 86400), ("30d", 30 * 86400)):
        rows = db.q("SELECT status, input_tokens, cached_tokens, output_tokens, cost_usd, latency_ms, ttft_ms FROM ai_requests WHERE ts>?",
                    (now - secs,))
        ok = [r for r in rows if r["status"] == "ok"]
        windows[label] = {"requests": len(rows), "ok": len(ok), "errors": sum(r["status"] == "error" for r in rows),
                          "cancelled": sum(r["status"] == "cancelled" for r in rows),
                          "input_tokens": sum(r["input_tokens"] or 0 for r in rows), "output_tokens": sum(r["output_tokens"] or 0 for r in rows),
                          "cost_usd": round(sum(r["cost_usd"] or 0 for r in rows), 4),
                          "latency_p50_ms": _pct([r["latency_ms"] for r in ok if r["latency_ms"]], .5),
                          "latency_p95_ms": _pct([r["latency_ms"] for r in ok if r["latency_ms"]], .95),
                          "ttft_p50_ms": _pct([r["ttft_ms"] for r in ok if r["ttft_ms"]], .5)}
    by_model = db.q("""SELECT provider, model, COUNT(*) requests, SUM(status='error') errors, SUM(input_tokens) input_tokens,
                       SUM(output_tokens) output_tokens, ROUND(SUM(cost_usd),4) cost_usd, SUM(credits) credits
                       FROM ai_requests WHERE ts>? GROUP BY provider, model ORDER BY requests DESC""", (now - 30 * 86400,))
    errors = db.q("SELECT ts, provider, model, error_code, purpose FROM ai_requests WHERE status='error' ORDER BY ts DESC LIMIT 25")
    prov = {}
    for name in ("openai", "aelio-native", "test"):
        pr = providers.get(name)
        prov[name] = {"configured": pr.configured(), "external": pr.external,
                      "used_by": [t for t, v in st["tiers"].items() if v["provider"] == name]}
    native = db.q("""SELECT c.id, c.status, c.created_at, m.family, m.name FROM checkpoints c JOIN models m ON m.id=c.model_id
                     ORDER BY c.created_at DESC LIMIT 10""")
    return {"settings": st, "providers": prov, "windows": windows, "by_model": by_model, "recent_errors": errors,
            "spend_today_usd": round(gateway.spend_today(), 4),
            "models": db.q("SELECT * FROM ai_models ORDER BY provider, input_per_m"),
            "native": {"checkpoints": native,
                       "product_approved": [c["id"] for c in native if c["status"] == "product_approved"],
                       "rollout": st["native"],
                       "note": ("AELIO Native serves users only after a checkpoint passes the separately approved product gate. "
                                "None has. Native research continues independently in native/ (Rust) and Native Lab.")},
            "secrets": {"OPENAI_API_KEY": "set" if providers.get("openai").configured() else "missing"},
            "content_note": "This dashboard never shows message content."}


@route("/api/brain/intelligence")
async def brain_intelligence(req):
    founder(req)
    return J(dashboard())


@route("/api/brain/intelligence/settings", ("PUT",))
async def brain_intelligence_settings(req):
    p = founder(req, write=True)
    if not mfa_fresh(p):
        raise HTTPError(403, "re-enter your authenticator code to change AI settings")
    d = await body(req)
    return J({"settings": settings.update(d, p["email"] or p["user_id"])})


@route("/api/brain/intelligence/pause", ("POST",))
async def brain_intelligence_pause(req):
    """Kill switch. Pausing needs no fresh MFA (safety first); resuming does."""
    p = founder(req, write=True)
    d = await body(req)
    paused = bool(d.get("paused", True))
    if not paused and not mfa_fresh(p):
        raise HTTPError(403, "re-enter your authenticator code to resume AI requests")
    cur = db.kv_get("intelligence_settings", {}) or {}
    cur["paused"] = paused
    db.kv_set("intelligence_settings", cur)
    db.audit("founder", p["email"] or p["user_id"], "intelligence.pause", None, {"paused": paused})
    return J({"paused": paused})


@route("/api/brain/intelligence/models/{mid}", ("PUT",))
async def brain_intelligence_model(req):
    p = founder(req, write=True)
    if not mfa_fresh(p):
        raise HTTPError(403, "re-enter your authenticator code to change model prices")
    d = await body(req)
    mid = req.path_params["mid"]
    fields = {k: d[k] for k in ("label", "input_per_m", "cached_input_per_m", "output_per_m", "enabled", "price_source") if k in d}
    for k in ("input_per_m", "cached_input_per_m", "output_per_m"):
        if k in fields and (not isinstance(fields[k], (int, float)) or fields[k] < 0):
            raise HTTPError(400, f"{k} must be a non-negative number")
    if db.q1("SELECT id FROM ai_models WHERE id=?", (mid,)):
        db.update("ai_models", "id", mid, **fields, updated_at=time.time())
    else:
        if "provider" not in d or d["provider"] not in ("openai",):
            raise HTTPError(400, "new models need provider 'openai'")
        db.insert("ai_models", {"id": mid[:80], "provider": d["provider"], "label": fields.get("label", mid),
                                "input_per_m": fields.get("input_per_m", 0), "cached_input_per_m": fields.get("cached_input_per_m"),
                                "output_per_m": fields.get("output_per_m", 0), "enabled": int(fields.get("enabled", 1)),
                                "price_source": fields.get("price_source", "founder"), "updated_at": time.time()})
    db.audit("founder", p["email"] or p["user_id"], "intelligence.model", mid, fields)
    return J({"model": db.q1("SELECT * FROM ai_models WHERE id=?", (mid,))})


@route("/api/brain/intelligence/test", ("POST",))
async def brain_intelligence_test(req):
    """Internal testing: send one prompt through the gateway exactly as users would (metered, logged)."""
    p = founder(req, write=True)
    d = await body(req)
    prompt = str(d.get("prompt", "")).strip()[:4000] or "Say hello in one sentence."
    tier = d.get("tier", "standard")
    if tier not in ("standard", "advanced"):
        raise HTTPError(400, "tier must be standard or advanced")
    greq = GenRequest(user_id=p["user_id"], purpose="code" if tier == "advanced" else "test",
                      instructions="You are AELIO's gateway self-test. Answer briefly.", messages=[Message("user", prompt)],
                      max_output_tokens=200)
    try:
        r = gateway.collect(greq, p)
    except gateway.GatewayRefused as e:
        return _refusal(e)
    return J({"text": r["text"], "meta": r["meta"], "final": r["final"]})
