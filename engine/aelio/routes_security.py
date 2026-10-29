"""Routes: Studio Brain challenge + lockout (founder), emergency recovery (personal recovery account)."""
from __future__ import annotations

from . import studio_security as ss
from .security import mfa_fresh
from .server import HTTPError, J, body, founder, ip_of, member, principal, route


def _err(e: ss.SecurityError):
    return J({"error": e.msg, "code": e.code, **e.info}, e.status)


def _wrap(fn):
    async def inner(req):
        try:
            return await fn(req)
        except ss.SecurityError as e:
            return _err(e)
    inner.__name__ = fn.__name__
    return inner


def _who(p: dict) -> str:
    return p.get("email") or p.get("user_id") or "?"


# ================================================================== founder: Studio Brain challenge
@route("/api/studio/security")
@_wrap
async def studio_status(req):
    p = founder(req, studio=False)
    return J(ss.status(p["user_id"]))


@route("/api/studio/security/enroll", ("POST",))
@_wrap
async def studio_enroll(req):
    p = founder(req, write=True, studio=False)
    if not mfa_fresh(p):
        raise HTTPError(403, "Enter a fresh authenticator code first.", "mfa_fresh_required")
    d = await body(req)
    return J(ss.enroll(p["user_id"], d.get("questions"), d.get("passphrase"), _who(p)))


@route("/api/studio/security/challenge", ("POST",))
@_wrap
async def studio_challenge(req):
    p = founder(req, write=True, studio=False)
    return J(ss.challenge(p["user_id"]))


@route("/api/studio/security/unlock", ("POST",))
@_wrap
async def studio_unlock(req):
    p = founder(req, write=True, studio=False)
    d = await body(req)
    return J(ss.unlock(p["user_id"], d.get("challenge_id", ""), d.get("answers") or [], d.get("passphrase", ""), _who(p), ip_of(req)))


@route("/api/studio/security/lock", ("POST",))
@_wrap
async def studio_lock(req):
    p = founder(req, write=True, studio=False)
    ss.lock_now(p["user_id"], _who(p))
    return J(ss.status(p["user_id"]))


@route("/api/studio/security/recovery/link", ("POST",))
@_wrap
async def studio_link_recovery(req):
    p = founder(req, write=True)              # full Studio access + fresh MFA: changing recovery ownership is sensitive
    if not mfa_fresh(p):
        raise HTTPError(403, "Enter a fresh authenticator code first.", "mfa_fresh_required")
    return J(ss.link_recovery(p["user_id"], _who(p)))


@route("/api/studio/security/recovery/request", ("POST",))
@_wrap
async def studio_request_recovery(req):
    p = founder(req, write=True, studio=False)
    return J(ss.request_recovery(p["user_id"], _who(p), ip_of(req)))


@route("/api/studio/security/events")
@_wrap
async def studio_events(req):
    founder(req)
    from . import db
    return J({"chain": ss.verify_chain(),
              "events": db.q("SELECT id, ts, event, actor FROM security_events ORDER BY id DESC LIMIT 100"),
              "notifications": db.q("SELECT ts, to_email, subject, status FROM notifications_outbox ORDER BY id DESC LIMIT 30")})


# ================================================================== personal recovery account
@route("/api/my/recovery")
@_wrap
async def my_recovery(req):
    p = member(req)
    return J(ss.recovery_overview(p))


@route("/api/my/recovery/mfa", ("POST",))
@_wrap
async def my_recovery_mfa(req):
    p = member(req, write=True)
    return J(ss.recovery_enroll_mfa(p, (await body(req)).get("code", "")))


@route("/api/my/recovery/test", ("POST",))
@_wrap
async def my_recovery_test(req):
    p = member(req, write=True)
    return J(ss.recovery_test(p, (await body(req)).get("code", "")))


@route("/api/my/recovery/verify", ("POST",))
@_wrap
async def my_recovery_verify(req):
    p = member(req, write=True)
    d = await body(req)
    return J(ss.verify_recovery(p, d.get("request_id", ""), d.get("code", "")))


@route("/api/my/recovery/session", ("POST",))
@_wrap
async def my_recovery_session(req):
    p = member(req, write=True)
    return J(ss.open_session(p, (await body(req)).get("authorization", "")))


@route("/api/my/recovery/reset", ("POST",))
@_wrap
async def my_recovery_reset(req):
    p = member(req, write=True)
    d = await body(req)
    return J(ss.recovery_reset(p, req.headers.get("x-aelio-recovery-session", ""), d.get("questions"), d.get("passphrase")))


# ================================================================== account level + perks (used by /api/me)
PERKS = ["founder_badge", "unlimited_usage", "early_access", "preview_features"]


def account_level(p: dict | None) -> dict:
    if not p:
        return {"level": "signed_out", "perks": []}
    if p["role"] == "founder":
        return {"level": "founder", "perks": PERKS}
    if p["role"] == "member" and ss.is_recovery_account(p):
        return {"level": "personal_founder", "perks": PERKS, "recovery_account": True}
    if p["role"] == "member":
        return {"level": "member", "perks": ["unlimited_usage"] if p.get("unlimited") else []}
    return {"level": "visitor", "perks": []}
