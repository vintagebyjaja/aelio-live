"""Engine health and the founder's engine overview (Studio Brain -> Engine)."""
from __future__ import annotations

import os
import platform
import shutil
import time

from . import db, identity
from .config import get_settings
from .server import J, founder, route

STARTED_AT = time.time()
VERSION = os.environ.get("AELIO_VERSION", "dev")


@route("/api/health")
async def health(req):
    """Public, minimal: is the engine up and is its database readable. No details."""
    try:
        db.q1("SELECT 1 AS ok")
        return J({"ok": True, "service": "aelio-engine"})
    except Exception:
        return J({"ok": False, "service": "aelio-engine"}, 503)


def _check(name: str, ok: bool | None, detail: str, area: str) -> dict:
    return {"name": name, "status": "ok" if ok else ("not_configured" if ok is None else "problem"), "detail": detail, "area": area}


def overview(req) -> dict:
    from .codestudio import sandbox
    from .intelligence import providers, settings as ai_settings
    from . import payments
    s = get_settings()
    db_path = s.db_path
    disk = shutil.disk_usage(s.data_dir)
    jobs = {r["status"]: r["n"] for r in db.q("SELECT status, COUNT(*) n FROM jobs GROUP BY status")}
    st = ai_settings.get()
    try:
        sb = sandbox.backend()
    except Exception:
        sb = "unavailable"
    openai_ok = providers.get("openai").configured()
    pay = payments.configured()
    checks = [
        _check("Database", True, f"SQLite, {db_path.stat().st_size / 1e6:.1f} MB" if db_path.exists() else "SQLite", "engine"),
        _check("Disk", disk.free > 2e9, f"{disk.free / 1e9:.1f} GB free of {disk.total / 1e9:.1f} GB", "engine"),
        _check("Reached through aelio.live", bool(req.scope.get("aelio_proxied")) or None,
               "requests arrive through the same-origin proxy" if req.scope.get("aelio_proxied")
               else "AELIO_PROXY_SECRET not set (fine for local development)", "engine"),
        _check("Supabase sign-in", bool(identity.supabase_url()) or None, "SUPABASE_URL configured" if identity.supabase_url() else "SUPABASE_URL missing", "accounts"),
        _check("OpenAI (GPT)", openai_ok or None, "key present on the engine" if openai_ok else "OPENAI_API_KEY not set", "intelligence"),
        _check("AI requests", not st["paused"], "paused by founder" if st["paused"] else "accepting requests", "intelligence"),
        _check("Code sandbox", sb not in ("none", "unavailable"), f"backend: {sb}", "code"),
        _check("Payments", bool(pay.get("configured")) or None,
               f"Stripe {pay.get('mode')} mode" if pay.get("configured") else "Stripe not configured (test mode keys go in the engine's settings)", "wallet"),
        _check("Background jobs", jobs.get("failed", 0) == 0 or None,
               ", ".join(f"{k}: {v}" for k, v in sorted(jobs.items())) or "no jobs yet", "engine"),
    ]
    counts = {k: db.q1(f"SELECT COUNT(*) n FROM {t}")["n"] for k, t in
              (("users", "users"), ("agents", "user_agents"), ("conversations", "conversations"),
               ("projects", "projects"), ("ai_requests_24h", "ai_requests WHERE ts > " + str(time.time() - 86400)))}
    return {"version": VERSION, "started_at": STARTED_AT, "uptime_s": int(time.time() - STARTED_AT),
            "python": platform.python_version(), "host": platform.node(), "checks": checks, "counts": counts,
            "recent_activity": db.q("SELECT ts, actor_type, action, target FROM audit_log ORDER BY id DESC LIMIT 12")}


@route("/api/brain/engine")
async def brain_engine(req):
    founder(req)
    return J(overview(req))
