import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture()
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("AELIO_DATABASE", "sqlite")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("AELIO_PORTAL_OPEN", "0")
    monkeypatch.setenv("AELIO_PAID_PLANS_OPEN", "1")
    monkeypatch.setenv("AELIO_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("AELIO_SECURE_COOKIES", "0")
    monkeypatch.setenv("AELIO_AUTH", "local")
    # Studio Brain's security challenge is ON by default in production. Tests of other features run with it
    # off; tests/test_studio_security.py turns it on and covers it (including that the default is on).
    monkeypatch.setenv("AELIO_STUDIO_GATE", "0")
    from aelio import config, db
    config.reset_settings()
    db.reset_connection_cache()
    import json
    from aelio.quality import suites
    db.kv_set("suite_locks", json.loads(suites.LOCKS.read_text()))
    yield tmp_path
    db.reset_connection_cache()


@pytest.fixture()
def client(env):
    from starlette.testclient import TestClient
    from aelio.server import create_app
    return TestClient(create_app(start_worker=False), base_url="http://localhost")


@pytest.fixture()
def founder(client):
    from aelio.security import create_founder, totp_at
    r = create_founder("founder@test.dev", "a-very-long-password")
    resp = client.post("/api/auth/login", json={"email": "founder@test.dev", "password": "a-very-long-password",
                                                "code": totp_at(r["totp_secret"])})
    assert resp.status_code == 200, resp.text
    client.headers["X-CSRF-Token"] = resp.json()["csrf"]
    client.totp_secret = r["totp_secret"]
    return client


FOUNDER_UID, FOUNDER_EMAIL = "0RcUhRBDI4hGWisgzuyezqGVVZC3", "jaja@vybr8.live"
PERSONAL_UID, PERSONAL_EMAIL = "cbW73QJYdmUg3lf4R5Cs4KSIPlt2", "vintagebyjaja@gmail.com"


@pytest.fixture()
def fb(env, monkeypatch):
    """Offline Firebase: a local RSA key stands in for Google's signing keys."""
    import time
    import json
    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    from aelio import identity as fa
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setenv("SUPABASE_URL", "https://abcdefghijklmnop.supabase.co")
    monkeypatch.setenv("AELIO_FOUNDER_EMAILS", FOUNDER_EMAIL)
    monkeypatch.setenv("AELIO_FOUNDER_UIDS", FOUNDER_UID)
    monkeypatch.setenv("AELIO_MEMBER_EMAILS", PERSONAL_EMAIL)
    monkeypatch.setenv("AELIO_MEMBER_UIDS", PERSONAL_UID)
    monkeypatch.setenv("AELIO_UNLIMITED_EMAILS", PERSONAL_EMAIL)
    monkeypatch.setenv("AELIO_UNLIMITED_UIDS", PERSONAL_UID)
    monkeypatch.setenv("AELIO_AUTH", "supabase")
    jwk=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update(kid="k",alg="RS256",use="sig")
    monkeypatch.setattr(fa,"_jwks",lambda:[jwk])

    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "offline-public")
    def token(uid=FOUNDER_UID, email=FOUNDER_EMAIL, verified=True, **over):
        t = int(time.time())
        c = {"iss": "https://abcdefghijklmnop.supabase.co/auth/v1", "aud": "authenticated", "sub": uid, "iat": t,
             "exp": t + 600, "email": email, "email_confirmed_at": "2026-01-01" if verified else False, "role":"authenticated", "app_metadata":{"products":["aelio","pathd"]}, **over}
        return {"Authorization": "Bearer " + jwt.encode(c, key, algorithm="RS256", headers={"kid": "k"})}
    return token


@pytest.fixture()
def fbclient(fb):
    from starlette.testclient import TestClient
    from aelio.server import create_app
    c = TestClient(create_app(start_worker=False), base_url="http://localhost")
    c.tok = fb
    return c


def founder_mfa(c):
    """Complete the founder's authenticator step for a Firebase session."""
    from aelio import db
    from aelio.security import totp_at
    h = c.tok()
    c.get("/api/me", headers=h)
    u = db.q1("SELECT * FROM users WHERE id=?", ("sb_" + FOUNDER_UID,))
    assert c.post("/api/auth/mfa", headers=h, json={"code": totp_at(u["totp_secret"])}).status_code == 200
    return h
