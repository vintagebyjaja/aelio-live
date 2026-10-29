"""Central quota & credit engine (server-side source of truth).

Rules
  * Every regular user has a plan (free | live) with a rolling-window allowance (default 5 hours).
  * Consumption order: included allowance -> promotional credits -> purchased credits.
  * Purchased and promotional credits live in an append-only ledger. Balances are always SUM(ledger);
    nothing is stored as a mutable balance, so a client can't edit one.
  * Work is metered through reservations: reserve an estimate before starting, settle the real cost
    after, release the rest. All of this runs in an IMMEDIATE transaction, which serialises concurrent
    requests and prevents double spending or a negative balance.
  * Founder and allow-listed unlimited accounts are exempt from limits but still metered (for cost reporting).
  * Emergency restrictions (Green Guardians / operations), suspensions and plan features apply to everyone.
    Purchased credits are an entitlement to eligible usage, not a guarantee that capacity is available.
"""
from __future__ import annotations

import time

from . import db

WINDOW_HOURS_DEFAULT = 5.0

DEFAULT_PLANS = {
    # Allowances are placeholders the founder edits in Studio Brain -> Usage & Access. Not final.
    "free": {"name": "AELIO Free", "window_hours": 5.0, "allowance": 50,
             "features": ["chat", "main_pal", "agent_transfer", "agent_preview"]},
    "live": {"name": "AELIO Live", "window_hours": 5.0, "allowance": 300,
             "features": ["chat", "main_pal", "agent_transfer", "agent_preview", "specialist_agents",
                          "agent_teams", "voice", "vision", "creation_tools"]},
}
DEFAULT_COSTS = {
    # credits per unit; est_cost_usd is an *estimate* of infrastructure cost, shown as such.
    "chat_message": (1, "message", "Text chat with an agent"),
    "agent_preview": (1, "message", "Personality preview reply"),
    "agent_import": (2, "import", "Parsing an uploaded profile or export"),
    "document_analysis": (5, "document", "Long document analysis"),
    "voice_minute": (4, "minute", "Voice conversation (when available)"),
    "image_generation": (10, "image", "Image generation (when available)"),
    "video_minute": (20, "minute", "Video analysis (when available)"),
    "code_task": (15, "task", "Code Studio task"),
}
OP_FEATURE = {"chat_message": "chat", "agent_preview": "agent_preview", "agent_import": "agent_transfer",
              "voice_minute": "voice", "image_generation": "creation_tools", "video_minute": "vision",
              "document_analysis": "chat", "code_task": "creation_tools"}
# Illustrative packages from the spec. Created INACTIVE and UNAPPROVED; the founder must approve prices.
DEFAULT_PACKAGES = [("pkg_quick", "Quick Boost", 100, 299), ("pkg_extra", "Extra Time", 300, 699),
                    ("pkg_power", "Power Pack", 750, 1499), ("pkg_creator", "Creator Pack", 1500, 2499)]


class UsageError(Exception):
    status = 402
    code = "usage_error"

    def __init__(self, msg: str, **info):
        super().__init__(msg)
        self.info = info


class LimitReached(UsageError):
    code = "limit_reached"


class Restricted(UsageError):
    status = 503
    code = "restricted"


class Suspended(UsageError):
    status = 403
    code = "suspended"


class FeatureUnavailable(UsageError):
    status = 403
    code = "feature_unavailable"


def seed() -> None:
    t = db.now()
    for pid, p in DEFAULT_PLANS.items():
        if not db.q1("SELECT id FROM plans WHERE id=?", (pid,)):
            db.insert("plans", {"id": pid, "name": p["name"], "window_hours": p["window_hours"],
                                "allowance": p["allowance"], "features": db.dumps(p["features"]), "updated_at": t})
    for op, (c, unit, note) in DEFAULT_COSTS.items():
        if not db.q1("SELECT op FROM cost_config WHERE op=?", (op,)):
            db.insert("cost_config", {"op": op, "credits": c, "unit": unit, "note": note, "updated_at": t})
    for i, (pid, name, credits, cents) in enumerate(DEFAULT_PACKAGES):
        if not db.q1("SELECT id FROM credit_packages WHERE id=?", (pid,)):
            db.insert("credit_packages", {"id": pid, "name": name, "credits": credits, "price_cents": cents,
                                          "active": 0, "approved": 0, "sort": i, "updated_at": t})


# ---------------------------------------------------------------- reads
def plan(pid: str) -> dict:
    p = db.q1("SELECT * FROM plans WHERE id=?", (pid,)) or db.q1("SELECT * FROM plans WHERE id='free'")
    p["features"] = db.loads(p["features"], [])
    return p


def user(uid: str) -> dict:
    u = db.q1("SELECT id,email,role,plan,unlimited,status FROM users WHERE id=?", (uid,))
    if not u:
        raise UsageError("unknown user")
    return u


def exempt(u: dict) -> bool:
    return u["role"] == "founder" or bool(u["unlimited"])


def balances(uid: str, conn=None) -> dict:
    ex = (conn.execute if conn else db._connect().execute)
    rows = ex("SELECT bucket, COALESCE(SUM(amount),0) FROM credit_ledger WHERE user_id=? GROUP BY bucket", (uid,)).fetchall()
    b = {"purchased": 0, "promo": 0}
    for bucket, amt in rows:
        b[bucket] = int(amt)
    return b


def window_state(uid: str, conn=None) -> dict:
    ex = (conn.execute if conn else db._connect().execute)
    u = dict(zip(("plan",), ex("SELECT plan FROM users WHERE id=?", (uid,)).fetchone() or ("free",)))
    p = plan(u["plan"])
    since = time.time() - p["window_hours"] * 3600
    used = ex("SELECT COALESCE(SUM(credits),0) FROM usage_events WHERE user_id=? AND ts>? AND source='allowance'",
              (uid, since)).fetchone()[0]
    held = ex("SELECT COALESCE(SUM(allowance_part),0) FROM reservations WHERE user_id=? AND status='open' AND created_at>?",
              (uid, since)).fetchone()[0]
    oldest = ex("SELECT MIN(ts) FROM usage_events WHERE user_id=? AND ts>? AND source='allowance'", (uid, since)).fetchone()[0]
    remaining = max(0, p["allowance"] - int(used) - int(held))
    return {"plan": p["id"], "plan_name": p["name"], "allowance": p["allowance"], "window_hours": p["window_hours"],
            "used": int(used), "held": int(held), "remaining": remaining,
            "resets_at": (oldest + p["window_hours"] * 3600) if oldest else None}


def restriction() -> dict | None:
    r = db.kv_get("usage_restriction")
    return r if r and r.get("active") else None


def cost(op: str, units: float = 1) -> int:
    c = db.q1("SELECT credits FROM cost_config WHERE op=?", (op,))
    if not c:
        raise UsageError(f"unknown operation {op}")
    return max(0, int(round(c["credits"] * units)))


def overview(uid: str) -> dict:
    u = user(uid)
    w = window_state(uid)
    b = balances(uid)
    low = (not exempt(u)) and (b["purchased"] + b["promo"]) > 0 and (b["purchased"] + b["promo"]) <= 25
    return {"plan": w["plan"], "plan_name": w["plan_name"], "exempt": exempt(u), "status": u["status"],
            "window": w, "balances": b, "total_available": None if exempt(u) else w["remaining"] + b["promo"] + b["purchased"],
            "low_credit_warning": low, "restriction": restriction()}


# ---------------------------------------------------------------- reserve / settle / release
def reserve(uid: str, op: str, units: float = 1, estimate: int | None = None) -> dict:
    """Hold credits before doing work. Raises LimitReached with reset time and balances."""
    est = cost(op, units) if estimate is None else int(estimate)
    with db.tx() as c:
        row = c.execute("SELECT role, plan, unlimited, status FROM users WHERE id=?", (uid,)).fetchone()
        if not row:
            raise UsageError("unknown user")
        u = {"role": row[0], "plan": row[1], "unlimited": row[2], "status": row[3]}
        r = restriction()
        if r:
            raise Restricted("AELIO is temporarily limiting workloads to protect infrastructure.", reason=r.get("reason"))
        if u["status"] == "suspended":
            raise Suspended("This account is suspended.")
        feature = OP_FEATURE.get(op)
        if not exempt(u) and feature and feature not in plan(u["plan"])["features"]:
            raise FeatureUnavailable(f"{op} is not included in {plan(u['plan'])['name']}. Credits don't unlock plan features.")
        rid = db.new_id("rsv")
        parts = {"allowance_part": 0, "promo_part": 0, "purchased_part": 0}
        if not exempt(u):
            w = window_state(uid, c)
            b = balances(uid, c)
            need = est
            parts["allowance_part"] = min(need, w["remaining"]); need -= parts["allowance_part"]
            parts["promo_part"] = min(need, max(0, b["promo"])); need -= parts["promo_part"]
            parts["purchased_part"] = min(need, max(0, b["purchased"])); need -= parts["purchased_part"]
            if need > 0:
                raise LimitReached("You've reached your AELIO usage limit.", needed=est,
                                   available=est - need, resets_at=w["resets_at"], balances=b)
            for bucket in ("promo", "purchased"):
                if parts[f"{bucket}_part"]:
                    c.execute("INSERT INTO credit_ledger(user_id,ts,type,bucket,amount,ref,note,actor) VALUES(?,?,?,?,?,?,?,?)",
                              (uid, time.time(), "hold", bucket, -parts[f"{bucket}_part"], rid, op, "system"))
        c.execute("""INSERT INTO reservations(id,user_id,op,created_at,estimate,allowance_part,promo_part,purchased_part,
                     exempt,status) VALUES(?,?,?,?,?,?,?,?,?, 'open')""",
                  (rid, uid, op, time.time(), est, parts["allowance_part"], parts["promo_part"], parts["purchased_part"],
                   int(exempt(u))))
    return {"id": rid, "estimate": est, **parts, "exempt": exempt(u)}


def settle(rid: str, actual: int | None = None) -> dict:
    """Charge the real cost (never more than reserved) and return the rest."""
    with db.tx() as c:
        r = c.execute("SELECT * FROM reservations WHERE id=?", (rid,)).fetchone()
        if not r or r["status"] != "open":
            raise UsageError("reservation is not open")
        final = r["estimate"] if actual is None else max(0, min(int(actual), r["estimate"]))
        t = time.time()
        if r["exempt"]:
            c.execute("INSERT INTO usage_events(user_id,ts,op,credits,source,reservation_id) VALUES(?,?,?,?,?,?)",
                      (r["user_id"], t, r["op"], final, "exempt", rid))
        else:
            left = final
            for src in ("allowance", "promo", "purchased"):
                take = min(left, r[f"{src}_part"]); left -= take
                if src != "allowance" and r[f"{src}_part"]:
                    c.execute("INSERT INTO credit_ledger(user_id,ts,type,bucket,amount,ref,note,actor) VALUES(?,?,?,?,?,?,?,?)",
                              (r["user_id"], t, "release", src, r[f"{src}_part"], rid, r["op"], "system"))
                    if take:
                        c.execute("INSERT INTO credit_ledger(user_id,ts,type,bucket,amount,ref,note,actor) VALUES(?,?,?,?,?,?,?,?)",
                                  (r["user_id"], t, "consume", src, -take, rid, r["op"], "system"))
                if take:
                    c.execute("INSERT INTO usage_events(user_id,ts,op,credits,source,reservation_id) VALUES(?,?,?,?,?,?)",
                              (r["user_id"], t, r["op"], take, src, rid))
        c.execute("UPDATE reservations SET status='settled', final=? WHERE id=?", (final, rid))
    return {"id": rid, "charged": final}


def release(rid: str) -> None:
    """Cancel a reservation (failed or refused work): nothing is charged."""
    with db.tx() as c:
        r = c.execute("SELECT * FROM reservations WHERE id=?", (rid,)).fetchone()
        if not r or r["status"] != "open":
            return
        for bucket in ("promo", "purchased"):
            if r[f"{bucket}_part"]:
                c.execute("INSERT INTO credit_ledger(user_id,ts,type,bucket,amount,ref,note,actor) VALUES(?,?,?,?,?,?,?,?)",
                          (r["user_id"], time.time(), "release", bucket, r[f"{bucket}_part"], rid, r["op"], "system"))
        c.execute("UPDATE reservations SET status='released', final=0 WHERE id=?", (rid,))


# ---------------------------------------------------------------- founder controls
def grant(uid: str, amount: int, bucket: str, actor: str, note: str, kind: str = "promo_grant") -> None:
    if bucket not in ("promo", "purchased") or amount == 0:
        raise UsageError("invalid grant")
    with db.tx() as c:
        if amount < 0:
            bal = balances(uid, c)[bucket]
            if bal + amount < 0:
                raise UsageError("adjustment would make the balance negative")
        c.execute("INSERT INTO credit_ledger(user_id,ts,type,bucket,amount,ref,note,actor) VALUES(?,?,?,?,?,?,?,?)",
                  (uid, time.time(), kind, bucket, int(amount), None, note[:300], actor))
    db.audit("founder", actor, f"credits.{kind}", uid, {"amount": amount, "bucket": bucket, "note": note})


def set_plan(uid: str, plan_id: str, actor: str) -> None:
    if not db.q1("SELECT id FROM plans WHERE id=?", (plan_id,)):
        raise UsageError("unknown plan")
    db.update("users", "id", uid, plan=plan_id)
    db.audit("founder", actor, "user.plan_changed", uid, {"plan": plan_id})


def set_status(uid: str, status: str, actor: str) -> None:
    if status not in ("active", "suspended", "review"):
        raise UsageError("invalid status")
    db.update("users", "id", uid, status=status)
    db.audit("founder", actor, "user.status_changed", uid, {"status": status})


def set_restriction(active: bool, reason: str, actor: str) -> None:
    db.kv_set("usage_restriction", {"active": active, "reason": reason, "set_by": actor, "ts": time.time()})
    db.audit("system" if actor.startswith("guardian") else "founder", actor, "usage.restriction", None,
             {"active": active, "reason": reason})


def transactions(uid: str, limit: int = 200) -> list[dict]:
    return db.q("SELECT id,ts,type,bucket,amount,ref,note FROM credit_ledger WHERE user_id=? AND type NOT IN ('hold','release') "
                "ORDER BY id DESC LIMIT ?", (uid, limit))


def economy() -> dict:
    paid = db.q1("SELECT COUNT(*) n, COALESCE(SUM(amount_cents),0) cents, COALESCE(SUM(credits),0) credits FROM payments WHERE status IN ('paid','partially_refunded','refunded')")
    refunds = db.q1("SELECT COALESCE(SUM(amount),0) a FROM credit_ledger WHERE type='refund_reversal'")["a"]
    refunded_cents = db.q1("SELECT COALESCE(SUM(json_extract(receipt,'$.amount_refunded')),0) c FROM payments")["c"]
    consumed = db.q1("SELECT COALESCE(SUM(credits),0) c FROM usage_events")["c"]
    by_source = {r["source"]: r["c"] for r in db.q("SELECT source, SUM(credits) c FROM usage_events GROUP BY source")}
    outstanding = db.q1("SELECT COALESCE(SUM(amount),0) a FROM credit_ledger WHERE bucket='purchased'")["a"]
    customers = db.q1("SELECT COUNT(DISTINCT user_id) n FROM usage_events WHERE source!='exempt'")["n"]
    est = 0.0
    for r in db.q("SELECT u.op, SUM(u.credits) c, cc.credits per, cc.est_cost_usd e FROM usage_events u JOIN cost_config cc ON cc.op=u.op GROUP BY u.op"):
        if r["e"] is not None and r["per"]:
            est += (r["c"] / r["per"]) * r["e"]
    return {"credits_sold": paid["credits"], "payments": paid["n"], "gross_revenue_usd": paid["cents"] / 100,
            "refunds_usd": (refunded_cents or 0) / 100, "credits_reversed_by_refunds": -refunds,
            "payment_fees_usd": None, "payment_fees_note": "Data unavailable: read processor fees from the Stripe dashboard.",
            "estimated_compute_cost_usd": round(est, 2) if est else None,
            "estimated_compute_note": "Estimate only. Uses est_cost_usd per operation where the founder has set one.",
            "outstanding_purchased_credits": outstanding, "credits_consumed": consumed, "consumed_by_source": by_source,
            "average_usage_per_customer": round(consumed / customers, 1) if customers else 0,
            "estimated_gross_margin_usd": round(paid["cents"] / 100 - (refunded_cents or 0) / 100 - est, 2) if est else None}
