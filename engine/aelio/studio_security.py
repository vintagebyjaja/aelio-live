"""Studio Brain security: founder challenge (security questions + passphrase), lockout, and emergency recovery.

Access levels
  1. Founder (jaja@vybr8.live, UID + email allow-list): the ONLY permanent Studio Brain owner.
     Studio Brain needs: Firebase sign-in + authenticator code + this module's challenge.
  2. Personal account (vintagebyjaja@gmail.com): a normal My AELIO account with founder perks, and the
     registered emergency-recovery account. Never gets Studio Brain permissions.
  3. Everyone else: normal My AELIO. This module never applies to them.

Emergency recovery (never by email link alone)
  founder locked out -> requests recovery (rate-limited, both emails notified)
  -> personal account signs in, verifies its OWN authenticator code -> single-use token (10 min)
  -> token opens a restricted recovery session (15 min) that can ONLY reset the security questions and
     passphrase and clear the lockout -> everything is revoked -> the founder must sign in as
     jaja@vybr8.live and pass the new challenge to unlock Studio Brain.

Every security event goes into `security_events`, a hash chain: editing or deleting a row breaks it.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import time
import unicodedata

from . import db

N_QUESTIONS = 5
ASK = 2                       # questions asked per unlock
MAX_FAILS = 5                 # wrong attempts before a lockout
LOCK_SECONDS = 3600
HARD_LOCK_AFTER = 3           # lockouts within 24 h before Studio stays locked until recovery
CHALLENGE_TTL = 300
TOKEN_TTL = 600               # recovery authorization lifetime
SESSION_TTL = 900             # recovery session lifetime
REQUESTS_PER_DAY = 3
VERIFY_ATTEMPTS = 3

SCHEMA = """
CREATE TABLE IF NOT EXISTS studio_security (
  user_id TEXT PRIMARY KEY, questions TEXT, pass_salt TEXT, pass_hash TEXT, enrolled_at REAL,
  unlocked_until REAL DEFAULT 0, fails INTEGER DEFAULT 0, locked_until REAL DEFAULT 0, lockouts TEXT DEFAULT '[]',
  hard_locked INTEGER DEFAULT 0, pending_challenge TEXT, recovery_user_id TEXT, recovery_linked_at REAL,
  recovery_mfa_at REAL, recovery_tested_at REAL, updated_at REAL
);
CREATE TABLE IF NOT EXISTS recovery_requests (
  id TEXT PRIMARY KEY, founder_id TEXT NOT NULL, created_at REAL NOT NULL, status TEXT NOT NULL, ip TEXT,
  token_hash TEXT, token_expires REAL, session_hash TEXT, session_expires REAL, verified_at REAL, used_at REAL,
  completed_at REAL, verify_fails INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, event TEXT NOT NULL, actor TEXT, detail TEXT NOT NULL,
  prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, to_email TEXT NOT NULL, subject TEXT NOT NULL,
  body TEXT NOT NULL, status TEXT NOT NULL, sent_at REAL, error TEXT
);
"""


class SecurityError(Exception):
    def __init__(self, status: int, code: str, msg: str, **info):
        super().__init__(msg)
        self.status, self.code, self.msg, self.info = status, code, msg, info


def _ensure() -> None:
    db._connect().executescript(SCHEMA)


def gate_enabled() -> bool:
    return os.environ.get("AELIO_STUDIO_GATE", "1") != "0"


def recovery_identity() -> tuple[str, str]:
    return (os.environ.get("AELIO_RECOVERY_EMAIL", "").strip().lower(), os.environ.get("AELIO_RECOVERY_UID", "").strip())


def _recovery_uids() -> set[str]:
    """AELIO_RECOVERY_UID may list several UIDs for the same person (Firebase and Supabase during migration)."""
    return {u.strip() for u in os.environ.get("AELIO_RECOVERY_UID", "").split(",") if u.strip()}


def _user_subjects(user_id: str) -> set[str]:
    db._connect().executescript("CREATE TABLE IF NOT EXISTS identities (provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL, "
                                "email TEXT, linked_at REAL NOT NULL, linked_by TEXT NOT NULL, PRIMARY KEY (provider, subject));")
    u = db.q1("SELECT firebase_uid FROM users WHERE id=?", (user_id,)) or {}
    subs = {r["subject"] for r in db.q("SELECT subject FROM identities WHERE user_id=?", (user_id,))}
    return subs | {s for s in (u.get("firebase_uid"), user_id, user_id[3:] if user_id[:3] in ("fb_", "sb_") else None) if s}


def founder_emails() -> list[str]:
    return [e.strip().lower() for e in os.environ.get("AELIO_FOUNDER_EMAILS", "").split(",") if e.strip()]


# ---------------------------------------------------------------- answers & hashing
def normalize_answer(a: str) -> str:
    """Case-insensitive, Unicode-normalized, whitespace-collapsed. Digits and symbols are kept exactly."""
    a = unicodedata.normalize("NFKC", str(a)).casefold().strip()
    return re.sub(r"\s+", " ", a)


def _hash(value: str, salt: bytes) -> str:
    return hashlib.scrypt(value.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32).hex()


def _make(value: str) -> dict:
    salt = secrets.token_bytes(16)
    return {"salt": salt.hex(), "hash": _hash(value, salt)}


def _check(value: str, rec: dict) -> bool:
    return hmac.compare_digest(_hash(value, bytes.fromhex(rec["salt"])), rec["hash"])


# ---------------------------------------------------------------- tamper-evident event log
def event(name: str, actor: str | None, **detail) -> None:
    _ensure()
    with db.tx() as c:
        prev = c.execute("SELECT hash FROM security_events ORDER BY id DESC LIMIT 1").fetchone()
        prev_hash = prev[0] if prev else "genesis"
        ts = time.time()
        d = json.dumps(detail, sort_keys=True, default=str)
        h = hashlib.sha256(f"{prev_hash}|{ts!r}|{name}|{actor}|{d}".encode()).hexdigest()
        c.execute("INSERT INTO security_events(ts,event,actor,detail,prev_hash,hash) VALUES(?,?,?,?,?,?)",
                  (ts, name, actor, d, prev_hash, h))
    db.audit("security", actor, name, None, detail)


def verify_chain() -> dict:
    _ensure()
    prev = "genesis"
    rows = db.q("SELECT * FROM security_events ORDER BY id")
    for r in rows:
        h = hashlib.sha256(f"{prev}|{r['ts']!r}|{r['event']}|{r['actor']}|{r['detail']}".encode()).hexdigest()
        if r["prev_hash"] != prev or r["hash"] != h:
            return {"ok": False, "broken_at": r["id"], "events": len(rows)}
        prev = r["hash"]
    return {"ok": True, "events": len(rows)}


# ---------------------------------------------------------------- notifications (both founder emails)
def notify(subject: str, body: str) -> None:
    """Queue an email to the founder account and the recovery account. Delivery needs an email provider:
    set AELIO_NOTIFY_WEBHOOK_URL (any HTTPS endpoint that sends email, e.g. a Cloudflare Email Worker).
    Without it, notifications are stored here and shown in the Brain, and marked not_configured."""
    _ensure()
    targets = founder_emails() + [recovery_identity()[0]]
    url = os.environ.get("AELIO_NOTIFY_WEBHOOK_URL", "")
    for to in [t for t in dict.fromkeys(targets) if t]:
        status, err = ("pending" if url else "not_configured"), None
        if url:
            try:
                import urllib.request
                req = urllib.request.Request(url, data=json.dumps({"to": to, "subject": subject, "text": body}).encode(),
                                             headers={"content-type": "application/json",
                                                      "authorization": "Bearer " + os.environ.get("AELIO_NOTIFY_WEBHOOK_TOKEN", "")})
                urllib.request.urlopen(req, timeout=10).read()
                status = "sent"
            except Exception as e:     # never block a security flow on email
                status, err = "failed", type(e).__name__
        db.insert("notifications_outbox", {"ts": time.time(), "to_email": to, "subject": subject, "body": body,
                                           "status": status, "sent_at": time.time() if status == "sent" else None, "error": err})


# ---------------------------------------------------------------- state
def _row(founder_id: str) -> dict:
    _ensure()
    r = db.q1("SELECT * FROM studio_security WHERE user_id=?", (founder_id,))
    if not r:
        db.insert("studio_security", {"user_id": founder_id, "updated_at": time.time()})
        r = db.q1("SELECT * FROM studio_security WHERE user_id=?", (founder_id,))
    return r


def _set(founder_id: str, **f) -> None:
    db.update("studio_security", "user_id", founder_id, **f, updated_at=time.time())


def _recent_lockouts(r: dict) -> list[float]:
    return [t for t in json.loads(r["lockouts"] or "[]") if time.time() - t < 86400]


def status(founder_id: str) -> dict:
    r = _row(founder_id)
    now = time.time()
    locked = bool(r["hard_locked"]) or (r["locked_until"] or 0) > now
    rec_user = db.q1("SELECT email FROM users WHERE id=?", (r["recovery_user_id"],)) if r["recovery_user_id"] else None
    email = rec_user["email"] if rec_user else recovery_identity()[0]
    masked = (email[:2] + "…@" + email.split("@")[1]) if email and "@" in email else None
    return {"gate_enabled": gate_enabled(), "enrolled": bool(r["enrolled_at"]),
            "unlocked": (r["unlocked_until"] or 0) > now and not locked, "unlocked_until": r["unlocked_until"] or None,
            "locked": locked, "hard_locked": bool(r["hard_locked"]), "locked_until": r["locked_until"] if locked and not r["hard_locked"] else None,
            "attempts_left": max(0, MAX_FAILS - (r["fails"] or 0)),
            "recovery": {"account": masked, "linked": bool(r["recovery_linked_at"]), "account_mfa": bool(r["recovery_mfa_at"]),
                         "tested": bool(r["recovery_tested_at"]), "active": recovery_active(r)}}


def recovery_active(r: dict) -> bool:
    return bool(r["enrolled_at"] and r["recovery_linked_at"] and r["recovery_mfa_at"] and r["recovery_tested_at"])


def require_unlocked(founder_id: str) -> None:
    """Called by every Studio Brain route (server.founder). Regular users never reach this."""
    if not gate_enabled():
        return
    s = status(founder_id)
    if not s["enrolled"]:
        raise SecurityError(428, "studio_enrollment_required", "Set up Studio Brain security first.")
    if s["locked"]:
        raise SecurityError(423, "studio_locked_out", "Studio Brain is locked after too many wrong answers.",
                            locked_until=s["locked_until"], hard_locked=s["hard_locked"])
    if not s["unlocked"]:
        raise SecurityError(423, "studio_challenge_required", "Answer your Studio Brain security challenge.")


# ---------------------------------------------------------------- enrollment
def _validate_setup(questions: list, passphrase: str) -> tuple[list[dict], dict]:
    if not isinstance(questions, list) or len(questions) != N_QUESTIONS:
        raise SecurityError(400, "invalid", f"Exactly {N_QUESTIONS} security questions are required.")
    seen, out = set(), []
    for q in questions:
        text = str((q or {}).get("question", "")).strip()
        ans = normalize_answer((q or {}).get("answer", ""))
        if not (5 <= len(text) <= 200):
            raise SecurityError(400, "invalid", "Each question needs 5–200 characters.")
        if len(ans) < 2:
            raise SecurityError(400, "invalid", "Each answer needs at least 2 characters.")
        if text.casefold() in seen:
            raise SecurityError(400, "invalid", "Questions must be different.")
        seen.add(text.casefold())
        out.append({"question": text, **_make(ans)})
    p = unicodedata.normalize("NFKC", str(passphrase or ""))
    if len(p) < 12:
        raise SecurityError(400, "invalid", "The Studio Brain passphrase needs at least 12 characters.")
    return out, _make(p)


def enroll(founder_id: str, questions: list, passphrase: str, actor: str) -> dict:
    r = _row(founder_id)
    if r["enrolled_at"]:
        if not status(founder_id)["unlocked"]:
            raise SecurityError(423, "studio_challenge_required", "Unlock Studio Brain before changing its security setup.")
    qs, pw = _validate_setup(questions, passphrase)
    _set(founder_id, questions=json.dumps(qs), pass_salt=pw["salt"], pass_hash=pw["hash"],
         enrolled_at=r["enrolled_at"] or time.time(), unlocked_until=time.time() + _unlock_seconds(), fails=0)
    event("studio.security_enrolled" if not r["enrolled_at"] else "studio.security_changed", actor)
    return status(founder_id)


def _unlock_seconds() -> int:
    return int(float(os.environ.get("AELIO_STUDIO_UNLOCK_HOURS", "12")) * 3600)


# ---------------------------------------------------------------- challenge / unlock / lockout
def challenge(founder_id: str) -> dict:
    s = status(founder_id)
    if not s["enrolled"]:
        raise SecurityError(428, "studio_enrollment_required", "Set up Studio Brain security first.")
    if s["locked"]:
        raise SecurityError(423, "studio_locked_out", "Studio Brain is locked.", locked_until=s["locked_until"], hard_locked=s["hard_locked"])
    qs = json.loads(_row(founder_id)["questions"])
    idx = sorted(secrets.SystemRandom().sample(range(len(qs)), ASK))
    cid = secrets.token_urlsafe(12)
    _set(founder_id, pending_challenge=json.dumps({"id": cid, "idx": idx, "expires": time.time() + CHALLENGE_TTL}))
    return {"challenge_id": cid, "questions": [qs[i]["question"] for i in idx]}


def unlock(founder_id: str, challenge_id: str, answers: list, passphrase: str, actor: str, ip: str | None = None) -> dict:
    r = _row(founder_id)
    s = status(founder_id)
    if s["locked"]:
        raise SecurityError(423, "studio_locked_out", "Studio Brain is locked.", locked_until=s["locked_until"], hard_locked=s["hard_locked"])
    ch = json.loads(r["pending_challenge"] or "null")
    if not ch or not hmac.compare_digest(ch["id"], str(challenge_id)) or ch["expires"] < time.time():
        raise SecurityError(400, "challenge_expired", "That challenge expired. Ask for a new one.")
    qs = json.loads(r["questions"])
    answers = list(answers or [])
    ok = len(answers) == len(ch["idx"])
    if ok:
        ok = all(_check(normalize_answer(a), qs[i]) for a, i in zip(answers, ch["idx"]))   # check all, no early exit
    ok = _check(unicodedata.normalize("NFKC", str(passphrase or "")), {"salt": r["pass_salt"], "hash": r["pass_hash"]}) and ok
    _set(founder_id, pending_challenge=None)
    if ok:
        _set(founder_id, unlocked_until=time.time() + _unlock_seconds(), fails=0)
        event("studio.unlocked", actor, ip=ip)
        return status(founder_id)
    fails = (r["fails"] or 0) + 1
    if fails >= MAX_FAILS:
        lockouts = _recent_lockouts(r) + [time.time()]
        hard = len(lockouts) >= HARD_LOCK_AFTER
        _set(founder_id, fails=0, locked_until=time.time() + LOCK_SECONDS, lockouts=json.dumps(lockouts),
             hard_locked=int(hard), unlocked_until=0)
        event("studio.locked_out", actor, ip=ip, hard_locked=hard)
        notify("AELIO Studio Brain locked", f"Studio Brain was locked after {MAX_FAILS} wrong security answers"
               + (" and stays locked until emergency recovery." if hard else " for 1 hour.") + " If this wasn't you, review your accounts.")
        raise SecurityError(423, "studio_locked_out", "Too many wrong answers. Studio Brain is locked.", hard_locked=hard,
                            locked_until=None if hard else time.time() + LOCK_SECONDS)
    _set(founder_id, fails=fails)
    event("studio.unlock_failed", actor, ip=ip, attempts_left=MAX_FAILS - fails)
    raise SecurityError(401, "wrong_answers", "That doesn't match.", attempts_left=MAX_FAILS - fails)


def lock_now(founder_id: str, actor: str) -> None:
    _set(founder_id, unlocked_until=0)
    event("studio.locked_by_founder", actor)


# ---------------------------------------------------------------- recovery linking (founder side)
def is_recovery_account(principal: dict) -> bool:
    email, uids = recovery_identity()[0], _recovery_uids()
    if not email or not uids or principal.get("role") != "member":
        return False
    return (principal.get("email") or "").lower() == email and bool(_user_subjects(principal["user_id"]) & uids)


def link_recovery(founder_id: str, actor: str) -> dict:
    email, uids = recovery_identity()[0], _recovery_uids()
    if not email or not uids:
        raise SecurityError(400, "not_configured", "Set AELIO_RECOVERY_EMAIL and AELIO_RECOVERY_UID on the engine first.")
    u = None
    for cand in db.q("SELECT id FROM users WHERE lower(email)=?", (email,)):
        if _user_subjects(cand["id"]) & uids:
            u = cand
            break
    if not u:
        raise SecurityError(409, "recovery_account_missing", "Sign in once with the recovery account, then link it.")
    r = _row(founder_id)
    if r["recovery_user_id"] and r["recovery_user_id"] != u["id"]:
        raise SecurityError(409, "already_linked", "A different recovery account is linked.")
    _set(founder_id, recovery_user_id=u["id"], recovery_linked_at=time.time())
    event("recovery.linked", actor, recovery_user=u["id"])
    return status(founder_id)


def _founder_for_recovery_user(user_id: str) -> dict | None:
    _ensure()
    return db.q1("SELECT * FROM studio_security WHERE recovery_user_id=?", (user_id,))


# ---------------------------------------------------------------- recovery account side
def recovery_overview(principal: dict) -> dict:
    if not is_recovery_account(principal):
        return {"is_recovery_account": False}
    r = _founder_for_recovery_user(principal["user_id"])
    pending = None
    if r:
        q = db.q1("SELECT id, created_at, status FROM recovery_requests WHERE founder_id=? AND status IN ('requested','verified','session') "
                  "ORDER BY created_at DESC LIMIT 1", (r["user_id"],))
        if q and time.time() - q["created_at"] < 86400:
            pending = q
    u = db.q1("SELECT mfa_enabled, totp_secret, email FROM users WHERE id=?", (principal["user_id"],))
    out = {"is_recovery_account": True, "linked": bool(r), "account_mfa": bool(r and r["recovery_mfa_at"]),
           "tested": bool(r and r["recovery_tested_at"]), "active": bool(r and recovery_active(r)), "pending_request": pending}
    if r and not r["recovery_mfa_at"]:
        from .security import totp_uri
        out["mfa_setup"] = {"secret": u["totp_secret"], "uri": totp_uri(u["totp_secret"], u["email"] + " (AELIO recovery)")}
    return out


def _verify_own_totp(principal: dict, code: str) -> bool:
    from .security import verify_totp
    u = db.q1("SELECT totp_secret FROM users WHERE id=?", (principal["user_id"],))
    return bool(u) and verify_totp(u["totp_secret"], str(code or ""))


def recovery_enroll_mfa(principal: dict, code: str) -> dict:
    r = _require_linked(principal)
    if not _verify_own_totp(principal, code):
        raise SecurityError(401, "invalid_code", "That code doesn't match your recovery authenticator.")
    db.update("users", "id", principal["user_id"], mfa_enabled=1)
    _set(r["user_id"], recovery_mfa_at=time.time())
    event("recovery.account_mfa_enrolled", principal["user_id"])
    return recovery_overview(principal)


def recovery_test(principal: dict, code: str) -> dict:
    r = _require_linked(principal)
    if not r["recovery_mfa_at"]:
        raise SecurityError(409, "mfa_required", "Enroll the recovery authenticator first.")
    if not _verify_own_totp(principal, code):
        raise SecurityError(401, "invalid_code", "That code doesn't match.")
    _set(r["user_id"], recovery_tested_at=time.time())
    event("recovery.tested", principal["user_id"])
    notify("AELIO emergency recovery is active", "Your personal account passed the recovery test and can now restore Studio Brain access.")
    return recovery_overview(principal)


def _require_linked(principal: dict) -> dict:
    if not is_recovery_account(principal):
        raise SecurityError(403, "not_recovery_account", "This account isn't the registered recovery account.")
    r = _founder_for_recovery_user(principal["user_id"])
    if not r:
        raise SecurityError(409, "not_linked", "The founder hasn't linked this account for recovery yet.")
    return r


# ---------------------------------------------------------------- the recovery flow
def request_recovery(founder_id: str, actor: str, ip: str | None = None) -> dict:
    r = _row(founder_id)
    s = status(founder_id)
    if not s["locked"]:
        raise SecurityError(409, "not_locked", "Emergency recovery is only for a locked Studio Brain.")
    if not recovery_active(r):
        event("recovery.denied", actor, reason="recovery_not_active", ip=ip)
        raise SecurityError(409, "recovery_not_active", "Emergency recovery wasn't set up and tested, so it can't be used.")
    n = db.q1("SELECT COUNT(*) n FROM recovery_requests WHERE founder_id=? AND created_at>?", (founder_id, time.time() - 86400))["n"]
    if n >= REQUESTS_PER_DAY:
        event("recovery.denied", actor, reason="rate_limited", ip=ip)
        raise SecurityError(429, "rate_limited", "Too many recovery requests today. Try again tomorrow.")
    db.run("UPDATE recovery_requests SET status='cancelled' WHERE founder_id=? AND status IN ('requested','verified','session')", (founder_id,))
    rid = "rcv_" + secrets.token_hex(8)
    db.insert("recovery_requests", {"id": rid, "founder_id": founder_id, "created_at": time.time(), "status": "requested", "ip": ip})
    event("recovery.requested", actor, request=rid, ip=ip)
    notify("AELIO emergency recovery requested",
           "Someone requested Studio Brain emergency recovery. To continue, sign in to your personal AELIO account and "
           "verify with its authenticator. If this wasn't you, do nothing: the request expires in 24 hours.")
    return {"request_id": rid}


def verify_recovery(principal: dict, request_id: str, code: str) -> dict:
    """Recovery account proves itself with its own MFA; returns a single-use, short-lived authorization (shown once)."""
    r = _require_linked(principal)
    if not recovery_active(r):
        raise SecurityError(409, "recovery_not_active", "Emergency recovery isn't active.")
    q = db.q1("SELECT * FROM recovery_requests WHERE id=? AND founder_id=?", (request_id, r["user_id"]))
    if not q or q["status"] != "requested" or time.time() - q["created_at"] > 86400:
        raise SecurityError(404, "no_request", "There's no open recovery request.")
    if not _verify_own_totp(principal, code):
        fails = (q["verify_fails"] or 0) + 1
        st = "denied" if fails >= VERIFY_ATTEMPTS else "requested"
        db.update("recovery_requests", "id", request_id, verify_fails=fails, status=st)
        event("recovery.verify_failed", principal["user_id"], request=request_id, denied=st == "denied")
        if st == "denied":
            notify("AELIO emergency recovery denied", "Recovery was denied after repeated wrong authenticator codes.")
            raise SecurityError(403, "denied", "Recovery denied after too many wrong codes.")
        raise SecurityError(401, "invalid_code", "That code doesn't match.", attempts_left=VERIFY_ATTEMPTS - fails)
    token = secrets.token_urlsafe(32)
    db.update("recovery_requests", "id", request_id, status="verified", verified_at=time.time(),
              token_hash=hashlib.sha256(token.encode()).hexdigest(), token_expires=time.time() + TOKEN_TTL)
    event("recovery.verified", principal["user_id"], request=request_id)
    return {"authorization": token, "expires_in": TOKEN_TTL}


def open_session(principal: dict, token: str) -> dict:
    """Exchange the single-use authorization for a restricted recovery session."""
    r = _require_linked(principal)
    th = hashlib.sha256(str(token or "").encode()).hexdigest()
    q = db.q1("SELECT * FROM recovery_requests WHERE founder_id=? AND token_hash=?", (r["user_id"], th))
    if not q or q["status"] != "verified" or (q["token_expires"] or 0) < time.time():
        event("recovery.token_rejected", principal["user_id"])
        raise SecurityError(403, "invalid_authorization", "That recovery authorization is invalid, used or expired.")
    sess = secrets.token_urlsafe(32)
    db.update("recovery_requests", "id", q["id"], status="session", used_at=time.time(), token_hash=None,
              session_hash=hashlib.sha256(sess.encode()).hexdigest(), session_expires=time.time() + SESSION_TTL)
    event("recovery.session_opened", principal["user_id"], request=q["id"])
    return {"recovery_session": sess, "expires_in": SESSION_TTL,
            "allowed": ["reset Studio Brain security questions and passphrase", "clear the lockout"]}


def _session(principal: dict, session: str) -> tuple[dict, dict]:
    r = _require_linked(principal)
    sh = hashlib.sha256(str(session or "").encode()).hexdigest()
    q = db.q1("SELECT * FROM recovery_requests WHERE founder_id=? AND session_hash=?", (r["user_id"], sh))
    if not q or q["status"] != "session" or (q["session_expires"] or 0) < time.time():
        raise SecurityError(403, "invalid_session", "The recovery session is invalid or expired.")
    return r, q


def recovery_reset(principal: dict, session: str, questions: list, passphrase: str) -> dict:
    """The ONLY operation a recovery session can do. Studio Brain stays locked until the founder account signs in."""
    r, q = _session(principal, session)
    qs, pw = _validate_setup(questions, passphrase)
    _set(r["user_id"], questions=json.dumps(qs), pass_salt=pw["salt"], pass_hash=pw["hash"], fails=0, locked_until=0,
         hard_locked=0, lockouts="[]", unlocked_until=0, pending_challenge=None)
    db.update("recovery_requests", "id", q["id"], status="completed", completed_at=time.time(), session_hash=None)
    db.run("UPDATE recovery_requests SET status='cancelled', token_hash=NULL, session_hash=NULL "
           "WHERE founder_id=? AND status IN ('requested','verified','session')", (r["user_id"],))
    event("recovery.completed", principal["user_id"], request=q["id"])
    notify("AELIO emergency recovery completed",
           "Studio Brain security was reset through emergency recovery. Sign in as the founder account and answer the "
           "new challenge to unlock Studio Brain. If this wasn't you, contact support immediately.")
    return {"ok": True, "next": "Sign in with the founder account and answer your new challenge."}
