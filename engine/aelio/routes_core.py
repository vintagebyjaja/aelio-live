"""AELIO Core HTTP routes.

  /v1/core/*        product servers (e.g. PATHD's mypathd.com backend). Two credentials on every call:
                      Authorization: Bearer <product app key>     (which product is calling; scope core:respond / core:memory)
                      X-AELIO-User-Token: <user's Supabase token> (who the person is; must be a member of that product)
                    Reached only through a Cloudflare service binding to the private engine Worker. aelio.live's public
                    proxy forwards /api and /webhooks only, so /v1 has no public address.
  /api/brain/core   founder overview of the Core services (Studio Brain gate applies).
"""
from __future__ import annotations

import time

from starlette.requests import Request

from . import core, db, identity
from .intelligence.routes import DISCLOSURE
from .server import HTTPError, J, body, ensure_user, founder, gw, route


def _product_user(req: Request, app: dict) -> tuple[dict, str]:
    product = app["slug"]
    if product not in core.PRODUCTS:
        raise HTTPError(403, "This application isn't an AELIO Core product.", code="not_a_product")
    tok = req.headers.get("x-aelio-user-token", "")
    if not tok:
        raise HTTPError(401, "Missing the signed-in user's token (X-AELIO-User-Token).", code="no_user")
    try:
        n = identity.verify(tok)
    except identity.AuthError as e:
        raise HTTPError(401, str(e), code="bad_user_token")
    if n["provider"] != "supabase":
        raise HTTPError(401, "Product sign-in must use the shared Supabase account.", code="bad_user_token")
    if product not in n["products"]:
        raise HTTPError(403, f"This account hasn't joined {core.PRODUCTS[product]}.", code="not_a_member")
    ident = identity.resolve(n)
    if ident["role"] == "visitor":
        ident = {**ident, "role": "user"}            # product user: AI, wallet, memory; never Brain or Studio
    u = ensure_user(ident)
    if u["status"] != "active":
        raise HTTPError(403, "This account is suspended.", code="suspended")
    return {"user_id": u["id"], "role": u["role"], "email": u["email"], "unlimited": bool(u["unlimited"]),
            "plan": u["plan"], "status": u["status"], "via": "product:" + product}, product


def _err(e: core.CoreError):
    return J({"error": e.message, "code": e.code, **e.info}, e.status)


@gw("/v1/core/services", "core:respond")
async def v1_core_services(req, app):
    return J({"services": {k: v["status"] for k, v in core.services().items()}})


@gw("/v1/core/respond", "core:respond", ("POST",))
async def v1_core_respond(req, app):
    caller, product = _product_user(req, app)
    try:
        return J(core.respond(await body(req), caller, product))
    except core.CoreError as e:
        if e.code == "consent_required":
            return J({"error": e.message, "code": e.code, "disclosure": DISCLOSURE}, e.status)
        return _err(e)


@gw("/v1/core/consent", "core:respond", ("GET", "POST"))
async def v1_core_consent(req, app):
    caller, product = _product_user(req, app)
    uid = caller["user_id"]
    if req.method == "POST":
        accepted = bool((await body(req)).get("accept"))
        c = db._connect()
        with c:
            c.execute("""INSERT INTO user_settings(user_id, external_ai_consent_at, personality_id, updated_at) VALUES(?,?,NULL,?)
                         ON CONFLICT(user_id) DO UPDATE SET external_ai_consent_at=excluded.external_ai_consent_at,
                         updated_at=excluded.updated_at""", (uid, time.time() if accepted else None, time.time()))
        db.audit("user", uid, "ai.consent", uid, {"accepted": accepted, "version": DISCLOSURE["version"], "via": product})
    row = db.q1("SELECT external_ai_consent_at FROM user_settings WHERE user_id=?", (uid,)) or {}
    return J({"disclosure": DISCLOSURE, "consent_at": row.get("external_ai_consent_at")})


@gw("/v1/core/memories", "core:memory", ("GET", "DELETE"))
async def v1_core_memories(req, app):
    caller, product = _product_user(req, app)
    if req.method == "DELETE":
        n = core.forget(caller["user_id"], product, req.query_params.get("id"))
        return J({"deleted": n})
    return J({"memories": core.memories(caller["user_id"], product)})


@route("/api/brain/core")
async def brain_core(req):
    founder(req)
    by_product = db.q("""SELECT json_extract(detail,'$.product') product, COUNT(*) n FROM audit_log
                         WHERE action='core.respond' AND ts > ? GROUP BY 1""", (time.time() - 86400,))
    apps = db.q("SELECT slug, name, active, scopes FROM apps WHERE slug IN (%s)" % ",".join("?" * len(core.PRODUCTS)),
                tuple(core.PRODUCTS))
    from . import backup
    identity._ensure()
    links = {r["provider"]: r["n"] for r in db.q("SELECT provider, COUNT(*) n FROM identities GROUP BY provider")}
    backups = backup.listing()
    return J({"services": core.services(), "products": core.PRODUCTS, "requests_24h": {r["product"]: r["n"] for r in by_product},
              "product_apps": [dict(a, scopes=db.loads(a["scopes"], [])) for a in apps],
              "identity": {"providers_enabled": identity.providers_enabled(), "supabase_configured": bool(identity.supabase_url()),
                           "linked": links, "product_users": db.q1("SELECT COUNT(*) n FROM users WHERE role='user'")["n"]},
              "backups": {"count": len(backups), "latest": ({k: backups[0][k] for k in ("file", "created_at", "integrity", "sha256")}
                                                             if backups else None)}})
