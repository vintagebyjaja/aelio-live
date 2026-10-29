"""Three access levels, Studio Brain challenge + lockout, and emergency recovery (spec section 8)."""
import json

import pytest

from aelio import db
from aelio.security import totp_at
from conftest import FOUNDER_EMAIL, PERSONAL_EMAIL, PERSONAL_UID, founder_mfa

Q = [{"question": "First concert you went to?", "answer": "Groove99"},
     {"question": "Street you grew up on?", "answer": "Maple Ave."},
     {"question": "First pet's name?", "answer": "Señor Waffles"},
     {"question": "Favourite record label?", "answer": "Motown"},
     {"question": "Dream city to live in?", "answer": "Lagos"}]
PASS = "correct horse battery staple!"


@pytest.fixture()
def c(fbclient, monkeypatch):
    monkeypatch.setenv("AELIO_STUDIO_GATE", "1")
    monkeypatch.setenv("AELIO_RECOVERY_EMAIL", PERSONAL_EMAIL)
    monkeypatch.setenv("AELIO_RECOVERY_UID", PERSONAL_UID)
    monkeypatch.setenv("AELIO_MEMBER_EMAILS", f"{PERSONAL_EMAIL},regular@user.dev")
    monkeypatch.setenv("AELIO_MEMBER_UIDS", f"{PERSONAL_UID},regularUID")
    fbclient.founder = founder_mfa(fbclient)
    fbclient.personal = fbclient.tok(PERSONAL_UID, PERSONAL_EMAIL)
    fbclient.regular = fbclient.tok("regularUID", "regular@user.dev")
    return fbclient


def answers_for(questions, mapping=None, **over):
    m = {q["question"]: q["answer"] for q in Q}
    m.update(mapping or {})
    return [over.get(q, m[q]) for q in questions]


def enroll(c):
    r = c.post("/api/studio/security/enroll", headers=c.founder, json={"questions": Q, "passphrase": PASS})
    assert r.status_code == 200, r.text
    return r.json()


def unlock(c, transform=lambda a: a, passphrase=PASS):
    ch = c.post("/api/studio/security/challenge", headers=c.founder).json()
    return c.post("/api/studio/security/unlock", headers=c.founder,
                  json={"challenge_id": ch["challenge_id"], "answers": [transform(a) for a in answers_for(ch["questions"])],
                        "passphrase": passphrase})


def lock_out(c):
    for _ in range(5):
        r = unlock(c, transform=lambda a: "wrong")
    assert r.status_code == 423 and r.json()["code"] == "studio_locked_out"


def setup_recovery(c):
    """Founder links the personal account; personal account enrolls its own MFA and tests recovery."""
    c.get("/api/me", headers=c.personal)                     # recovery account has signed in once
    assert c.post("/api/studio/security/recovery/link", headers=c.founder).status_code == 200
    info = c.get("/api/my/recovery", headers=c.personal).json()
    secret = info["mfa_setup"]["secret"]
    assert c.post("/api/my/recovery/mfa", headers=c.personal, json={"code": totp_at(secret)}).status_code == 200
    r = c.post("/api/my/recovery/test", headers=c.personal, json={"code": totp_at(secret)})
    assert r.status_code == 200 and r.json()["active"] is True
    return secret


# ---------------------------------------------------------------- access levels
def test_gate_is_on_by_default(monkeypatch):
    from aelio import studio_security
    monkeypatch.delenv("AELIO_STUDIO_GATE", raising=False)
    assert studio_security.gate_enabled() is True


def test_three_levels(c):
    f = c.get("/api/me", headers=c.founder).json()
    p = c.get("/api/me", headers=c.personal).json()
    r = c.get("/api/me", headers=c.regular).json()
    assert f["level"] == "founder" and f["destination"] == "studiobrain"
    assert p["level"] == "personal_founder" and p["destination"] == "my" and p["recovery_account"] is True
    assert set(p["perks"]) >= {"founder_badge", "unlimited_usage", "early_access", "preview_features"}
    assert r["level"] == "member" and r["perks"] == [] and r["destination"] == "my"


def test_personal_account_never_gets_studio(c):
    enroll(c)
    for path in ("/api/brain/engine", "/api/brain/intelligence", "/api/projects", "/api/studio/security"):
        assert c.get(path, headers=c.personal).status_code == 403, path


def test_regular_users_have_no_studio_questions(c):
    assert c.get("/api/my/home", headers=c.regular).status_code == 200          # straight into My AELIO
    assert c.get("/api/my/home", headers=c.personal).status_code == 200
    assert c.get("/api/studio/security", headers=c.regular).status_code == 403  # the challenge doesn't exist for them
    assert c.get("/api/my/recovery", headers=c.regular).json() == {"is_recovery_account": False}


# ---------------------------------------------------------------- enrollment, challenge, lockout
def test_first_login_requires_enrollment(c):
    r = c.get("/api/brain/engine", headers=c.founder)
    assert r.status_code == 428 and r.json()["code"] == "studio_enrollment_required"
    bad = c.post("/api/studio/security/enroll", headers=c.founder, json={"questions": Q[:4], "passphrase": PASS})
    assert bad.status_code == 400
    enroll(c)
    assert c.get("/api/brain/engine", headers=c.founder).status_code == 200


def test_answers_are_case_insensitive_but_numbers_exact(c):
    enroll(c)
    c.post("/api/studio/security/lock", headers=c.founder)
    assert c.get("/api/brain/engine", headers=c.founder).json()["code"] == "studio_challenge_required"
    assert unlock(c, transform=lambda a: "  " + a.upper() + " ").status_code == 200      # GROOVE99 == Groove99
    c.post("/api/studio/security/lock", headers=c.founder)
    r = unlock(c, transform=lambda a: a.replace("99", "98").replace("Ave.", "Ave") + ("x" if "99" not in a and "Ave." not in a else ""))
    assert r.status_code == 401 and r.json()["code"] == "wrong_answers"
    assert unlock(c, passphrase=PASS.upper()).status_code == 401                        # passphrase is case-sensitive


def test_answers_never_stored_or_returned_in_plaintext(c):
    out = json.dumps(enroll(c))
    row = json.dumps(db.q1("SELECT * FROM studio_security"))
    for q in Q:
        assert q["answer"].lower() not in row.lower() and q["answer"] not in out
    assert PASS not in row


def test_lockout_after_wrong_answers(c):
    enroll(c)
    c.post("/api/studio/security/lock", headers=c.founder)
    lock_out(c)
    assert c.get("/api/brain/engine", headers=c.founder).json()["code"] == "studio_locked_out"
    assert c.post("/api/studio/security/challenge", headers=c.founder).status_code == 423
    r = c.post("/api/studio/security/unlock", headers=c.founder, json={"challenge_id": "x", "answers": [], "passphrase": PASS})
    assert r.status_code == 423                                           # nothing gets past the lock
    n = db.q("SELECT to_email, status FROM notifications_outbox WHERE subject LIKE '%locked%'")
    assert {x["to_email"] for x in n} == {FOUNDER_EMAIL, PERSONAL_EMAIL}


# ---------------------------------------------------------------- emergency recovery
def test_recovery_full_flow_single_use_and_restricted(c):
    enroll(c)
    secret = setup_recovery(c)
    c.post("/api/studio/security/lock", headers=c.founder)
    lock_out(c)
    rid = c.post("/api/studio/security/recovery/request", headers=c.founder).json()["request_id"]
    pending = c.get("/api/my/recovery", headers=c.personal).json()["pending_request"]
    assert pending["id"] == rid
    tok = c.post("/api/my/recovery/verify", headers=c.personal, json={"request_id": rid, "code": totp_at(secret)}).json()["authorization"]
    s1 = c.post("/api/my/recovery/session", headers=c.personal, json={"authorization": tok})
    assert s1.status_code == 200
    assert c.post("/api/my/recovery/session", headers=c.personal, json={"authorization": tok}).status_code == 403   # single use
    sess = s1.json()["recovery_session"]
    # the recovery session grants nothing else: still no Studio, no keys, no wallet admin
    for path in ("/api/brain/engine", "/api/brain/credits", "/api/brain/intelligence"):
        assert c.get(path, headers={**c.personal, "x-aelio-recovery-session": sess}).status_code == 403
    new_q = [{**q, "answer": q["answer"] + " new"} for q in Q]
    r = c.post("/api/my/recovery/reset", headers={**c.personal, "x-aelio-recovery-session": sess},
               json={"questions": new_q, "passphrase": "a brand new passphrase"})
    assert r.status_code == 200
    # session is gone; Studio is NOT unlocked; the founder must sign in and answer the new challenge
    assert c.post("/api/my/recovery/reset", headers={**c.personal, "x-aelio-recovery-session": sess},
                  json={"questions": new_q, "passphrase": "another passphrase!"}).status_code == 403
    assert c.get("/api/brain/engine", headers=c.founder).json()["code"] == "studio_challenge_required"
    assert c.get("/api/me", headers=c.personal).json()["role"] == "member"
    ch = c.post("/api/studio/security/challenge", headers=c.founder).json()
    m = {q["question"]: q["answer"] for q in new_q}
    assert c.post("/api/studio/security/unlock", headers=c.founder, json={"challenge_id": ch["challenge_id"],
                  "answers": [m[q] for q in ch["questions"]], "passphrase": "a brand new passphrase"}).status_code == 200
    assert c.get("/api/brain/engine", headers=c.founder).status_code == 200
    events = [e["event"] for e in db.q("SELECT event FROM security_events ORDER BY id")]
    for e in ("recovery.requested", "recovery.verified", "recovery.session_opened", "recovery.completed"):
        assert e in events


def test_recovery_authorization_expires(c):
    enroll(c); secret = setup_recovery(c); c.post("/api/studio/security/lock", headers=c.founder); lock_out(c)
    rid = c.post("/api/studio/security/recovery/request", headers=c.founder).json()["request_id"]
    tok = c.post("/api/my/recovery/verify", headers=c.personal, json={"request_id": rid, "code": totp_at(secret)}).json()["authorization"]
    db.run("UPDATE recovery_requests SET token_expires=1 WHERE id=?", (rid,))
    assert c.post("/api/my/recovery/session", headers=c.personal, json={"authorization": tok}).status_code == 403


def test_recovery_needs_setup_tested_and_a_lockout(c):
    enroll(c)
    assert c.post("/api/studio/security/recovery/request", headers=c.founder).json()["code"] == "not_locked"
    c.post("/api/studio/security/lock", headers=c.founder); lock_out(c)
    assert c.post("/api/studio/security/recovery/request", headers=c.founder).json()["code"] == "recovery_not_active"


def test_wrong_recovery_codes_deny_and_requests_are_rate_limited(c):
    enroll(c); setup_recovery(c); c.post("/api/studio/security/lock", headers=c.founder); lock_out(c)
    rid = c.post("/api/studio/security/recovery/request", headers=c.founder).json()["request_id"]
    for _ in range(3):
        r = c.post("/api/my/recovery/verify", headers=c.personal, json={"request_id": rid, "code": "000000"})
    assert r.status_code == 403 and r.json()["code"] == "denied"
    assert db.q1("SELECT status FROM recovery_requests WHERE id=?", (rid,))["status"] == "denied"
    c.post("/api/studio/security/recovery/request", headers=c.founder)
    c.post("/api/studio/security/recovery/request", headers=c.founder)
    assert c.post("/api/studio/security/recovery/request", headers=c.founder).status_code == 429


def test_regular_user_cannot_use_recovery(c):
    enroll(c); setup_recovery(c)
    assert c.post("/api/my/recovery/verify", headers=c.regular, json={"request_id": "x", "code": "123456"}).status_code == 403


def test_security_log_is_tamper_evident(c):
    from aelio import studio_security as ss
    enroll(c); c.post("/api/studio/security/lock", headers=c.founder); unlock(c)
    assert ss.verify_chain()["ok"] is True
    db.run("UPDATE security_events SET actor='someone-else' WHERE id=(SELECT MIN(id) FROM security_events)")
    assert ss.verify_chain()["ok"] is False
