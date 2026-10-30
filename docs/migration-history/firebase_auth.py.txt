"""Firebase Authentication for the private studio.

The browser signs in with the Firebase JS SDK and sends the Firebase ID token
to POST /api/auth/firebase. The server verifies it independently:
  * RS256 signature against Google's published securetoken certificates
  * aud == FIREBASE_PROJECT_ID, iss == https://securetoken.google.com/<project>
  * not expired, issued in the past, subject present
  * email verified, and email or UID on the founder allow-list
Signing in through Firebase alone grants nothing; the allow-list decides.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.request

import jwt
from cryptography.x509 import load_pem_x509_certificate

CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_cache: dict = {"certs": None, "exp": 0.0}


class AuthError(Exception):
    pass


def project_id() -> str | None:
    return os.environ.get("FIREBASE_PROJECT_ID") or None


def _set(name: str, lower: bool = False) -> set[str]:
    return {(v.strip().lower() if lower else v.strip()) for v in os.environ.get(name, "").split(",") if v.strip()}


def member_allowlist() -> tuple[set[str], set[str]]:
    """Accounts allowed into My AELIO before public launch (e.g. the founder's personal account)."""
    return _set("AELIO_MEMBER_EMAILS", True), _set("AELIO_MEMBER_UIDS")


def unlimited_allowlist() -> tuple[set[str], set[str]]:
    """Accounts exempt from usage limits without Studio Brain access."""
    return _set("AELIO_UNLIMITED_EMAILS", True), _set("AELIO_UNLIMITED_UIDS")


def portal_open() -> bool:
    return os.environ.get("AELIO_PORTAL_OPEN", "0").lower() in {"1", "true", "yes"}


def identity(claims: dict) -> dict:
    """Resolve a verified token to a role.

    founder  -> Studio Brain + My AELIO, unlimited usage
    member   -> My AELIO only (allow-listed now; everyone once AELIO_PORTAL_OPEN=1)
    visitor  -> brain game only
    """
    founder = is_founder(claims)
    e, u = member_allowlist()
    member = founder or _matches(claims, e, u) or (portal_open() and claims.get("email_verified") is True)
    ue, uu = unlimited_allowlist()
    return {"uid": claims["sub"], "email": (claims.get("email") or "").lower(),
            "role": "founder" if founder else ("member" if member else "visitor"),
            "unlimited": founder or _matches(claims, ue, uu)}


def allowlist() -> tuple[set[str], set[str]]:
    emails = {e.strip().lower() for e in os.environ.get("AELIO_FOUNDER_EMAILS", "").split(",") if e.strip()}
    uids = {u.strip() for u in os.environ.get("AELIO_FOUNDER_UIDS", "").split(",") if u.strip()}
    return emails, uids


def web_config() -> dict | None:
    """Public Firebase web config (not secret) for the studio login page."""
    pid = project_id()
    if not pid:
        return None
    return {"apiKey": os.environ.get("FIREBASE_API_KEY", ""), "authDomain": os.environ.get(
        "FIREBASE_AUTH_DOMAIN", f"{pid}.firebaseapp.com"), "projectId": pid,
            "appId": os.environ.get("FIREBASE_APP_ID", "")}


def _certs() -> dict:
    local = os.environ.get("AELIO_FIREBASE_CERTS_FILE")  # tests / air-gapped verification only
    if local:
        return json.loads(open(local).read())
    if _cache["certs"] and time.time() < _cache["exp"]:
        return _cache["certs"]
    with urllib.request.urlopen(CERTS_URL, timeout=10) as r:
        certs = json.loads(r.read())
        m = re.search(r"max-age=(\d+)", r.headers.get("Cache-Control", ""))
        _cache.update(certs=certs, exp=time.time() + (int(m.group(1)) if m else 3600))
    return certs


def verify_token(token: str) -> dict:
    """Verify a Firebase ID token's signature and claims. Says nothing about permissions."""
    pid = project_id()
    if not pid:
        raise AuthError("Firebase is not configured (FIREBASE_PROJECT_ID missing)")
    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except jwt.PyJWTError as e:
        raise AuthError(f"malformed token: {e}") from e
    pem = _certs().get(kid)
    if not pem:
        raise AuthError("unknown signing key")
    key = load_pem_x509_certificate(pem.encode()).public_key()
    try:
        claims = jwt.decode(token, key, algorithms=["RS256"], audience=pid,
                            issuer=f"https://securetoken.google.com/{pid}", leeway=30,
                            options={"require": ["exp", "iat", "sub", "aud", "iss"]})
    except jwt.PyJWTError as e:
        raise AuthError(f"invalid token: {e}") from e
    if not claims.get("sub") or claims.get("iat", 0) > time.time() + 30:
        raise AuthError("invalid subject or issue time")
    return claims


def _matches(claims: dict, emails: set[str], uids: set[str]) -> bool:
    """When both lists are set, the account must match BOTH (UID and verified email)."""
    email = (claims.get("email") or "").lower()
    uid_ok = claims["sub"] in uids if uids else None
    email_ok = (email in emails and claims.get("email_verified") is True) if emails else None
    checks = [c for c in (uid_ok, email_ok) if c is not None]
    return bool(checks) and all(checks)


def is_founder(claims: dict) -> bool:
    emails, uids = allowlist()
    return _matches(claims, emails, uids)


def verify_id_token(token: str) -> dict:
    """Verify a token AND require the founder allow-list (Studio Brain)."""
    claims = verify_token(token)
    if not is_founder(claims):
        raise AuthError("this account is not authorised for AELIO Studio")
    return claims

