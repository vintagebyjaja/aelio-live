"""Firebase -> Supabase identity migration: dual-provider sign-in, one AELIO user per person, no takeovers."""
import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from aelio import db
from conftest import FOUNDER_EMAIL, FOUNDER_UID, PERSONAL_EMAIL, PERSONAL_UID, founder_mfa

SB_URL = "https://abcdefghijklmnop.supabase.co"
SB_FOUNDER, SB_PERSONAL = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"


@pytest.fixture()
def sb(fb, monkeypatch, tmp_path):
    """Offline Supabase: a local ES256 key published as the project's JWKS."""
    key = ec.generate_private_key(ec.SECP256R1())
    jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(key.public_key()))
    jwk.update(kid="sb-key-1", alg="ES256", use="sig")
    f = tmp_path / "jwks.json"
    f.write_text(json.dumps({"keys": [jwk]}))
    monkeypatch.setenv("SUPABASE_URL", SB_URL)
    monkeypatch.setenv("AELIO_SUPABASE_JWKS_FILE", str(f))
    monkeypatch.setenv("AELIO_FOUNDER_UIDS", f"{FOUNDER_UID},{SB_FOUNDER}")
    monkeypatch.setenv("AELIO_MEMBER_UIDS", f"{PERSONAL_UID},{SB_PERSONAL}")
    monkeypatch.setenv("AELIO_UNLIMITED_UIDS", f"{PERSONAL_UID},{SB_PERSONAL}")

    def token(sub=SB_FOUNDER, email=FOUNDER_EMAIL, **over):
        t = int(time.time())
        c = {"iss": f"{SB_URL}/auth/v1", "aud": "authenticated", "sub": sub, "iat": t, "exp": t + 600, "email": email,
             "role": "authenticated", "aal": "aal1", "is_anonymous": False, "app_metadata": {"products": ["aelio"]}, **over}
        alg = over.pop("_alg", "ES256") if "_alg" in over else "ES256"
        hdr = {"kid": over.get("_kid", "sb-key-1")}
        c.pop("_kid", None)
        return {"Authorization": "Bearer " + jwt.encode(c, key, algorithm=alg, headers=hdr)}
    return token


@pytest.fixture()
def c(fbclient, sb):
    fbclient.sb = sb
    return fbclient


def test_supabase_founder_is_the_same_aelio_user(c):
    me_fb = c.get("/api/me", headers=c.tok()).json()                     # founder signs in with Firebase first
    assert me_fb["role"] == "founder"
    me_sb = c.get("/api/me", headers=c.sb()).json()
    assert me_sb["role"] == "founder" and me_sb["level"] == "founder"
    links = db.q("SELECT provider, user_id FROM identities ORDER BY provider")
    assert {r["provider"] for r in links} == {"firebase", "supabase"}
    assert len({r["user_id"] for r in links}) == 1                       # one AELIO account, two sign-in methods


def test_studio_brain_security_carries_over(c, monkeypatch):
    from aelio import studio_security as ss
    h = founder_mfa(c)                                                    # Firebase founder with MFA
    uid = db.q1("SELECT user_id FROM identities WHERE provider='firebase'")["user_id"]
    monkeypatch.setenv("AELIO_STUDIO_GATE", "1")
    qs = [{"question": f"Question number {i}?", "answer": f"answer {i}"} for i in range(5)]
    assert c.post("/api/studio/security/enroll", headers=h, json={"questions": qs, "passphrase": "a long passphrase!"}).status_code == 200
    s = c.get("/api/studio/security", headers=c.sb()).json()              # now via Supabase: same setup, MFA already done
    assert s["enrolled"] is True and ss.status(uid)["enrolled"] is True


def test_lookalike_cannot_take_over_founder(c):
    c.get("/api/me", headers=c.tok())
    me = c.get("/api/me", headers=c.sb(sub="99999999-9999-4999-8999-999999999999")).json()   # founder's email, wrong UID
    assert me["role"] == "visitor"
    assert c.get("/api/brain/engine", headers=c.sb(sub="99999999-9999-4999-8999-999999999999")).status_code in (401, 403)
    founder_user = db.q1("SELECT user_id FROM identities WHERE provider='firebase'")["user_id"]
    assert not db.q1("SELECT 1 FROM identities WHERE provider='supabase' AND user_id=?", (founder_user,))


@pytest.mark.parametrize("bad", [
    {"role": "anon"}, {"role": "service_role"}, {"is_anonymous": True}, {"aud": "something-else"},
    {"iss": "https://evil.supabase.co/auth/v1"}, {"exp": int(time.time()) - 3600}, {"_kid": "unknown-key"},
])
def test_bad_supabase_tokens_rejected(c, bad):
    assert c.get("/api/me", headers=c.sb(**bad)).status_code == 401


def test_hs256_supabase_token_rejected(c):
    t = int(time.time())
    tok = jwt.encode({"iss": f"{SB_URL}/auth/v1", "aud": "authenticated", "sub": SB_FOUNDER, "exp": t + 600,
                      "email": FOUNDER_EMAIL, "role": "authenticated"}, "a-shared-secret-guess-that-is-32-bytes-long!", algorithm="HS256")
    assert c.get("/api/me", headers={"Authorization": "Bearer " + tok}).status_code == 401


def test_turning_firebase_off_is_the_cutover_switch(c, monkeypatch):
    monkeypatch.setenv("AELIO_AUTH_PROVIDERS", "supabase")
    assert c.get("/api/me", headers=c.tok()).status_code == 401
    assert c.get("/api/me", headers=c.sb()).json()["role"] == "founder"
    monkeypatch.setenv("AELIO_AUTH_PROVIDERS", "supabase,firebase")       # rollback: both again
    assert c.get("/api/me", headers=c.tok()).json()["role"] == "founder"


def test_recovery_account_works_across_providers(c, monkeypatch):
    from aelio import studio_security as ss
    monkeypatch.setenv("AELIO_RECOVERY_EMAIL", PERSONAL_EMAIL)
    monkeypatch.setenv("AELIO_RECOVERY_UID", f"{PERSONAL_UID},{SB_PERSONAL}")
    c.get("/api/me", headers=c.tok(PERSONAL_UID, PERSONAL_EMAIL))
    me = c.get("/api/me", headers=c.sb(SB_PERSONAL, PERSONAL_EMAIL)).json()
    assert me["level"] == "personal_founder" and me["recovery_account"] is True and me["role"] == "member"
    assert c.get("/api/brain/engine", headers=c.sb(SB_PERSONAL, PERSONAL_EMAIL)).status_code == 403


def test_plan_and_import_mapping(c):
    from aelio import identity
    c.get("/api/me", headers=c.tok())                                     # founder exists via Firebase
    export = {"users": [{"localId": FOUNDER_UID, "email": FOUNDER_EMAIL, "providerUserInfo": [{"providerId": "google.com"}]},
                        {"localId": "ghostUID", "email": "nobody@x.dev"}]}
    p = identity.plan(export, [{"id": SB_FOUNDER, "email": FOUNDER_EMAIL}])
    assert p["mapped"][0]["supabase_uid"] == SB_FOUNDER and p["mapped"][0]["aelio_user"] == "fb_" + FOUNDER_UID
    assert p["missing_in_supabase"][0]["email"] == "nobody@x.dev"
    r = identity.import_mapping([{"firebase_uid": FOUNDER_UID, "supabase_uid": SB_FOUNDER}], "founder")
    assert r["linked"] == 1
    assert identity.import_mapping([{"firebase_uid": FOUNDER_UID, "supabase_uid": SB_FOUNDER}], "founder")["skipped"]
    assert c.get("/api/me", headers=c.sb()).json()["role"] == "founder"
    assert len({r["user_id"] for r in db.q("SELECT user_id FROM identities")}) == 1
