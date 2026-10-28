"""Authentication, sessions, MFA, rate limiting and secret handling.

Only the Python standard library is used for cryptographic primitives:
scrypt for password hashing, HMAC-SHA1 TOTP (RFC 6238, compatible with
authenticator apps), and SHA-256 for token-at-rest hashing.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
import struct
import time
from typing import Any

from . import db
from .config import get_settings

# ---------- passwords ----------
_SCRYPT = dict(n=2 ** 15, r=8, p=1, maxmem=64 * 1024 * 1024, dklen=32)


def hash_password(pw: str) -> str:
    if len(pw) < 12:
        raise ValueError("Password must be at least 12 characters.")
    salt = os.urandom(16)
    dk = hashlib.scrypt(pw.encode(), salt=salt, **_SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, s, h = stored.split("$")
        dk = hashlib.scrypt(pw.encode(), salt=base64.b64decode(s), **_SCRYPT)
        return hmac.compare_digest(dk, base64.b64decode(h))
    except Exception:
        return False


# ---------- TOTP (RFC 6238) ----------
def new_totp_secret() -> str:
    return base64.b32encode(os.urandom(20)).decode().rstrip("=")


def totp_at(secret: str, t: float | None = None, step: int = 30, digits: int = 6) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    counter = int((t if t is not None else time.time()) // step)
    mac = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    o = mac[-1] & 0x0F
    code = (struct.unpack(">I", mac[o:o + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    code = (code or "").strip().replace(" ", "")
    if not re.fullmatch(r"\d{6}", code):
        return False
    t = time.time()
    return any(hmac.compare_digest(totp_at(secret, t + i * 30), code) for i in range(-window, window + 1))


def totp_uri(secret: str, email: str) -> str:
    return f"otpauth://totp/AELIO%20Studio:{email}?secret={secret}&issuer=AELIO%20Studio"


# ---------- users ----------
def create_founder(email: str, password: str) -> dict[str, Any]:
    if db.q1("SELECT id FROM users WHERE role='founder'"):
        raise ValueError("A founder account already exists.")
    secret = new_totp_secret()
    uid = db.new_id("usr")
    db.insert("users", {"id": uid, "email": email.lower().strip(), "pw_hash": hash_password(password),
                        "totp_secret": secret, "mfa_enabled": 1, "role": "founder", "created_at": db.now()})
    db.audit("system", None, "founder.created", uid, {"email": email})
    return {"id": uid, "email": email, "totp_secret": secret, "totp_uri": totp_uri(secret, email)}


# ---------- rate limiting ----------
LOGIN_WINDOW_S = 15 * 60
LOGIN_MAX_FAILS = 8


def login_blocked(ip: str) -> bool:
    since = time.time() - LOGIN_WINDOW_S
    r = db.q1("SELECT COUNT(*) n FROM login_attempts WHERE ip=? AND ts>? AND ok=0", (ip, since))
    return bool(r and r["n"] >= LOGIN_MAX_FAILS)


def record_login(ip: str, ok: bool) -> None:
    db.insert("login_attempts", {"ip": ip, "ts": time.time(), "ok": int(ok)})


class RateLimiter:
    """Simple in-memory token bucket keyed by client (per-process)."""

    def __init__(self, rate_per_min: int):
        self.rate = rate_per_min
        self.buckets: dict[str, tuple[float, float]] = {}

    def allow(self, key: str) -> bool:
        now = time.time()
        tokens, last = self.buckets.get(key, (float(self.rate), now))
        tokens = min(float(self.rate), tokens + (now - last) * self.rate / 60.0)
        if tokens < 1:
            self.buckets[key] = (tokens, now)
            return False
        self.buckets[key] = (tokens - 1, now)
        return True


# ---------- sessions ----------
def _h(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user_id: str, ip: str, ua: str, mfa_verified: bool) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    t = time.time()
    db.insert("sessions", {"id_hash": _h(token), "user_id": user_id, "csrf": csrf, "created_at": t,
                           "expires_at": t + get_settings().session_hours * 3600,
                           "mfa_at": t if mfa_verified else None, "ip": ip, "ua": ua[:200]})
    return token, csrf


def get_session(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    s = db.q1("SELECT s.*, u.email, u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=?",
              (_h(token),))
    if not s or s["expires_at"] < time.time():
        return None
    return s


def touch_mfa(token: str) -> None:
    db.update("sessions", "id_hash", _h(token), mfa_at=time.time())


def mfa_fresh(sess: dict[str, Any]) -> bool:
    return bool(sess.get("mfa_at")) and time.time() - sess["mfa_at"] < get_settings().mfa_fresh_minutes * 60


def end_session(token: str) -> None:
    db.run("DELETE FROM sessions WHERE id_hash=?", (_h(token),))


# ---------- application API keys ----------
def new_api_key() -> tuple[str, str, str]:
    raw = "aelio_" + secrets.token_urlsafe(32)
    return raw, _h(raw), raw[:12]


def hash_key(raw: str) -> str:
    return _h(raw)


# ---------- secret store (server-side only, never sent to clients or agents) ----------
def put_secret(name: str, value: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", name):
        raise ValueError("invalid secret name")
    p = get_settings().secrets_dir / name
    p.write_text(value)
    os.chmod(p, 0o600)


def get_secret(name: str) -> str | None:
    p = get_settings().secrets_dir / name
    return p.read_text() if p.exists() else None


def list_secret_names() -> list[str]:
    return sorted(p.name for p in get_settings().secrets_dir.iterdir() if p.is_file())


_REDACT = [re.compile(p) for p in (
    r"aelio_[A-Za-z0-9_\-]{20,}", r"gh[pousr]_[A-Za-z0-9]{20,}", r"github_pat_[A-Za-z0-9_]{20,}",
    r"sk-[A-Za-z0-9\-_]{20,}", r"AKIA[0-9A-Z]{16}", r"(?i)(password|secret|token)\s*[:=]\s*\S+",
)]


def redact(text: str) -> str:
    """Scrub credential-shaped strings from anything an agent or log might see."""
    for rx in _REDACT:
        text = rx.sub("[REDACTED]", text)
    for name in list_secret_names() if get_settings().secrets_dir.exists() else []:
        v = get_secret(name)
        if v and len(v) >= 8:
            text = text.replace(v, f"[SECRET:{name}]")
    return text
