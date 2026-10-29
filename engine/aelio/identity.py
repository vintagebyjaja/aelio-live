"""Provider-neutral sign-in for AELIO: Supabase Auth (target) and Firebase Auth (during migration).

    browser signs in with Supabase (or Firebase) -> sends its access/ID token as Bearer
    -> verify(token): signature + issuer + audience + expiry, by the provider that issued it
    -> resolve(claims): roles from the allow-lists (founder needs UID AND verified email)
    -> link(): one AELIO user per person, whichever provider they used

Every AELIO user keeps ONE id. A person's Firebase and Supabase identities both point to it
(table `identities`), so Studio Brain security, the recovery link, wallet and history carry over.

Supabase tokens are verified with the project's asymmetric signing keys (JWKS, ES256/RS256):
    https://<project>.supabase.co/auth/v1/.well-known/jwks.json
Only end-user tokens (role "authenticated") are accepted; anon and service_role keys never sign anyone in.
"""
from __future__ import annotations

import json
import os
import time
import urllib.request

import jwt

from . import db, firebase_auth

_jwks_cache: dict = {"keys": None, "exp": 0.0, "url": None}
JWKS_TTL = 600            # Supabase caches its JWKS for 10 minutes; never cache longer


class AuthError(Exception):
    pass


SCHEMA = """
CREATE TABLE IF NOT EXISTS identities (
  provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL, email TEXT, linked_at REAL NOT NULL,
  linked_by TEXT NOT NULL, PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS ix_identities_user ON identities(user_id);
"""


def _ensure() -> None:
    db._connect().executescript(SCHEMA)


# ---------------------------------------------------------------- configuration
def supabase_url() -> str | None:
    u = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    return u or None


def supabase_issuer() -> str | None:
    u = supabase_url()
    return f"{u}/auth/v1" if u else None


def providers_enabled() -> list[str]:
    """AELIO_AUTH_PROVIDERS=supabase,firebase (default: whichever is configured)."""
    raw = os.environ.get("AELIO_AUTH_PROVIDERS", "")
    if raw.strip():
        return [p.strip() for p in raw.split(",") if p.strip()]
    out = []
    if supabase_url():
        out.append("supabase")
    if firebase_auth.project_id():
        out.append("firebase")
    return out


# ---------------------------------------------------------------- Supabase verification
def _jwks() -> list[dict]:
    local = os.environ.get("AELIO_SUPABASE_JWKS_FILE")          # tests / air-gapped verification only
    if local:
        return json.loads(open(local).read())["keys"]
    url = f"{supabase_issuer()}/.well-known/jwks.json"
    if _jwks_cache["keys"] is not None and _jwks_cache["url"] == url and time.time() < _jwks_cache["exp"]:
        return _jwks_cache["keys"]
    with urllib.request.urlopen(url, timeout=10) as r:
        keys = json.loads(r.read()).get("keys", [])
    _jwks_cache.update(keys=keys, exp=time.time() + JWKS_TTL, url=url)
    return keys


def purge_jwks_cache() -> None:
    _jwks_cache.update(keys=None, exp=0.0)


def _supabase_verify(token: str) -> dict:
    iss = supabase_issuer()
    if not iss:
        raise AuthError("Supabase is not configured (SUPABASE_URL missing)")
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as e:
        raise AuthError(f"malformed token: {e}") from e
    alg, kid = header.get("alg"), header.get("kid")
    if alg not in ("ES256", "RS256"):
        raise AuthError("Supabase tokens must be signed with the project's asymmetric keys (ES256/RS256)")
    keys = [k for k in _jwks() if k.get("kid") == kid]
    if not keys:
        purge_jwks_cache()                                      # a rotated key: refetch once
        keys = [k for k in _jwks() if k.get("kid") == kid]
    if not keys:
        raise AuthError("unknown signing key")
    key = jwt.PyJWK(keys[0]).key
    try:
        claims = jwt.decode(token, key, algorithms=[alg], audience="authenticated", issuer=iss, leeway=30,
                            options={"require": ["exp", "sub", "iss", "aud"]})
    except jwt.PyJWTError as e:
        raise AuthError(f"invalid token: {e}") from e
    if claims.get("role") != "authenticated" or claims.get("is_anonymous"):
        raise AuthError("only signed-in user tokens are accepted")
    return claims


# ---------------------------------------------------------------- unified verify
def verify(token: str) -> dict:
    """Returns normalized claims: provider, sub, email, email_verified, products, aal, raw."""
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
    except jwt.PyJWTError as e:
        raise AuthError(f"malformed token: {e}") from e
    iss = str(unverified.get("iss", ""))
    enabled = providers_enabled()
    if supabase_issuer() and iss == supabase_issuer():
        if "supabase" not in enabled:
            raise AuthError("Supabase sign-in is not enabled")
        c = _supabase_verify(token)
        app = c.get("app_metadata") or {}
        # Supabase only issues sessions for confirmed emails when "Confirm email" is on (required for AELIO),
        # and OAuth providers (Google) verify emails themselves.
        return {"provider": "supabase", "sub": c["sub"], "email": (c.get("email") or "").lower(),
                "email_verified": bool(c.get("email")), "products": list(app.get("products") or []),
                "aal": c.get("aal"), "raw": c}
    if iss.startswith("https://securetoken.google.com/"):
        if "firebase" not in enabled:
            raise AuthError("Firebase sign-in is no longer enabled")
        try:
            c = firebase_auth.verify_token(token)
        except firebase_auth.AuthError as e:
            raise AuthError(str(e)) from e
        return {"provider": "firebase", "sub": c["sub"], "email": (c.get("email") or "").lower(),
                "email_verified": c.get("email_verified") is True, "products": ["aelio"], "aal": None, "raw": c}
    raise AuthError("token from an unknown issuer")


def resolve(n: dict) -> dict:
    """Roles from the allow-lists. UID lists may hold both Firebase and Supabase UIDs for the same person."""
    claims = {"sub": n["sub"], "email": n["email"], "email_verified": n["email_verified"]}
    ident = firebase_auth.identity(claims)      # same rules for every provider
    return {**ident, "provider": n["provider"], "products": n.get("products") or [], "email_verified": n["email_verified"]}


# ---------------------------------------------------------------- one AELIO user per person
def _allowlisted(ident: dict) -> bool:
    return ident["role"] in ("founder", "member") or ident.get("unlimited")


def link(ident: dict, new_user) -> dict:
    """Find or create the AELIO user for this identity. `new_user(uid_prefix, ident)` creates one."""
    _ensure()
    prov, sub = ident["provider"], ident["uid"]
    row = db.q1("SELECT user_id FROM identities WHERE provider=? AND subject=?", (prov, sub))
    if row:
        return db.q1("SELECT * FROM users WHERE id=?", (row["user_id"],))
    target = None
    if prov == "firebase":                                       # accounts created before the identities table
        target = db.q1("SELECT * FROM users WHERE id=?", ("fb_" + sub,))
    if not target and ident["email"]:
        same = db.q1("SELECT * FROM users WHERE lower(email)=?", (ident["email"],))
        # Carry an existing account over to the new provider only when the email is verified and the person
        # has no identity with this provider yet. Allow-listed accounts must also match their UID list
        # (already enforced by resolve()), so the founder account can't be claimed by email alone.
        if same and not db.q1("SELECT 1 FROM identities WHERE user_id=? AND provider=?", (same["id"], prov)):
            if ident.get("email_verified") and (_allowlisted(ident) or same["role"] not in ("founder",)):
                target = same
    how = "existing"
    if not target:
        target = new_user({"firebase": "fb_", "supabase": "sb_"}.get(prov, "id_"), ident)
        how = "created"
    db.insert("identities", {"provider": prov, "subject": sub, "user_id": target["id"], "email": ident["email"],
                             "linked_at": time.time(), "linked_by": "sign-in"})
    db.audit("system", target["id"], "identity.linked", target["id"], {"provider": prov, "how": how})
    return target


def import_mapping(rows: list[dict], actor: str) -> dict:
    """Pre-link identities from a reviewed mapping (Firebase UID -> Supabase UID). Dry-run first via plan()."""
    _ensure()
    done, skipped = 0, []
    for r in rows:
        fb, sb = r.get("firebase_uid"), r.get("supabase_uid")
        link_row = db.q1("SELECT user_id FROM identities WHERE provider='firebase' AND subject=?", (fb,))
        user = db.q1("SELECT * FROM users WHERE id=?", (link_row["user_id"] if link_row else "fb_" + str(fb),))
        if not user or not sb:
            skipped.append({"firebase_uid": fb, "reason": "no AELIO user for this Firebase UID" if not user else "no Supabase UID"})
            continue
        if db.q1("SELECT 1 FROM identities WHERE provider='supabase' AND subject=?", (sb,)):
            skipped.append({"firebase_uid": fb, "reason": "Supabase UID already linked"})
            continue
        for prov, sub in (("firebase", fb), ("supabase", sb)):
            if not db.q1("SELECT 1 FROM identities WHERE provider=? AND subject=?", (prov, sub)):
                db.insert("identities", {"provider": prov, "subject": sub, "user_id": user["id"], "email": user["email"],
                                         "linked_at": time.time(), "linked_by": f"import:{actor}"})
        db.audit("founder", actor, "identity.mapping_imported", user["id"], {"firebase_uid": fb, "supabase_uid": sb})
        done += 1
    return {"linked": done, "skipped": skipped}


def plan(firebase_export: dict, supabase_users: list[dict]) -> dict:
    """Map Firebase users (from `firebase auth:export`) to Supabase users by email. No changes made."""
    sb_by_email = {(u.get("email") or "").lower(): u for u in supabase_users}
    out = {"mapped": [], "missing_in_supabase": [], "no_email": []}
    for u in firebase_export.get("users", []):
        email = (u.get("email") or "").lower()
        if not email:
            out["no_email"].append({"firebase_uid": u.get("localId")})
            continue
        s = sb_by_email.get(email)
        providers = sorted({p.get("providerId") for p in u.get("providerUserInfo", []) if p.get("providerId")} or {"password"})
        aelio = db.q1("SELECT id FROM users WHERE id=?", ("fb_" + u.get("localId", ""),))
        entry = {"email": email, "firebase_uid": u.get("localId"), "providers": providers,
                 "aelio_user": aelio["id"] if aelio else None}
        if s:
            out["mapped"].append({**entry, "supabase_uid": s.get("id")})
        else:
            out["missing_in_supabase"].append(entry)
    return out


def identities_of(user_id: str) -> list[dict]:
    _ensure()
    return db.q("SELECT provider, subject, email, linked_at, linked_by FROM identities WHERE user_id=? ORDER BY provider", (user_id,))
