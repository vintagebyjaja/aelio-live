import json

import pytest


def test_unauthenticated_cannot_reach_studio(client):
    for m, u in [("GET", "/api/overview"), ("GET", "/api/settings"), ("POST", "/api/secrets"), ("POST", "/api/train"),
                 ("POST", "/api/tasks"), ("POST", "/api/quality/run"), ("POST", "/api/deployments/x/approve"),
                 ("GET", "/api/datasets"), ("GET", "/api/audit")]:
        assert client.request(m, u).status_code == 401, u


def test_login_requires_totp_and_rate_limits(client):
    from aelio.security import create_founder
    create_founder("f@test.dev", "a-very-long-password")
    r = client.post("/api/auth/login", json={"email": "f@test.dev", "password": "a-very-long-password", "code": "000000"})
    assert r.status_code == 401
    for _ in range(8):
        client.post("/api/auth/login", json={"email": "f@test.dev", "password": "wrong", "code": "1"})
    assert client.post("/api/auth/login", json={"email": "f@test.dev", "password": "x", "code": "1"}).status_code == 429


def test_csrf_required_for_writes(founder):
    tok = founder.headers.pop("X-CSRF-Token")
    assert founder.post("/api/guardians/cycle").status_code == 403
    founder.headers["X-CSRF-Token"] = tok
    assert founder.post("/api/guardians/cycle").status_code == 200


def test_security_headers(client):
    r = client.get("/api/auth/me")
    assert r.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert r.headers["cache-control"] == "no-store"


def test_app_keys_scoped_and_cannot_reach_studio(client):
    from aelio import gateway, voice
    voice.seed()
    _, key = gateway.register_app("Groove Guide", "gg", ["voices:read"])
    h = {"Authorization": f"Bearer {key}"}
    assert client.get("/v1/voices", headers=h).status_code == 200
    assert len(client.get("/v1/voices", headers=h).json()["voices"]) == 6
    assert client.post("/v1/voices/aelio-voice-nova/synthesize", headers=h, json={"text": "x"}).status_code == 403
    assert client.get("/api/overview", headers=h).status_code == 401
    assert client.get("/v1/voices").status_code == 401


def test_production_approval_needs_founder_and_fresh_mfa(founder):
    from aelio import db, deploy
    from aelio.security import totp_at
    did = deploy.request(None, None, "preview", "orchestrator")
    db.update("deployments", "id", did, status="awaiting_founder_review")
    with pytest.raises(deploy.ApprovalError):
        deploy.approve_production(did, "agent", True, "agent")
    db.run("UPDATE sessions SET mfa_at=1")  # make MFA stale
    assert founder.post(f"/api/deployments/{did}/approve", json={}).status_code == 403
    r = founder.post(f"/api/deployments/{did}/approve", json={"code": totp_at(founder.totp_secret)})
    assert r.status_code == 200 and r.json()["status"] == "approved_pending_execution"


def test_publish_requires_fresh_mfa(founder):
    from aelio import db
    db.insert("models", {"id": "m1", "name": "m", "family": "reasoning", "engine": "e", "architecture": "{}",
                         "status": "trained", "origin": "x", "created_at": 0})
    db.insert("checkpoints", {"id": "c1", "model_id": "m1", "path": "p", "sha256": "s", "created_at": 0, "status": "evaluated"})
    db.run("UPDATE sessions SET mfa_at=1")
    assert founder.post("/api/checkpoints/c1/status", json={"status": "published"}).status_code == 403


def test_protected_suite_tamper_detected(env, tmp_path):
    from aelio.quality import suites
    suites.verify_suite("quality_demo_v1")
    from aelio import db
    locks = db.kv_get("suite_locks"); locks["quality_demo_v1"] = "0" * 64; db.kv_set("suite_locks", locks)
    with pytest.raises(suites.SuiteTampered):
        suites.verify_suite("quality_demo_v1")


def test_sandbox_isolation(env):
    from aelio.codestudio import sandbox
    r = sandbox.self_test()
    assert r["passed"], r


def test_secrets_redacted(env):
    from aelio.security import put_secret, redact
    put_secret("GITHUB_TOKEN", "supersecretvalue123")
    assert "supersecretvalue123" not in redact("token is supersecretvalue123")


def test_public_endpoint_lists_only_published(client):
    from aelio import db
    db.insert("models", {"id": "m1", "name": "m", "family": "reasoning", "engine": "e", "architecture": "{}",
                         "status": "trained", "origin": "x", "created_at": 0})
    db.insert("checkpoints", {"id": "c1", "model_id": "m1", "path": "p", "sha256": "s", "created_at": 0, "status": "evaluated"})
    assert client.get("/public/v1/models").json()["models"] == []
    db.run("UPDATE checkpoints SET status='published'")
    r = client.get("/public/v1/models", headers={"Origin": "https://aelio.live"})
    assert len(r.json()["models"]) == 1 and r.headers["access-control-allow-origin"] == "https://aelio.live"


def test_founder_allowlist_requires_uid_and_email(env, monkeypatch):
    import time
    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    from aelio import firebase_auth as fa
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "p")
    monkeypatch.setenv("AELIO_FOUNDER_EMAILS", "jaja@vybr8.live")
    monkeypatch.setenv("AELIO_FOUNDER_UIDS", "0RcUhRBDI4hGWisgzuyezqGVVZC3")
    monkeypatch.setattr(fa, "_certs", lambda: {"k": "x"})
    monkeypatch.setattr(fa, "load_pem_x509_certificate", lambda b: type("C", (), {"public_key": lambda s: key.public_key()})())
    t = int(time.time())

    def tok(**o):
        c = {"iss": "https://securetoken.google.com/p", "aud": "p", "sub": "0RcUhRBDI4hGWisgzuyezqGVVZC3", "iat": t,
             "exp": t + 600, "email": "jaja@vybr8.live", "email_verified": True, **o}
        return jwt.encode(c, key, algorithm="RS256", headers={"kid": "k"})
    assert fa.verify_id_token(tok())["sub"] == "0RcUhRBDI4hGWisgzuyezqGVVZC3"
    for bad in (tok(sub="someone-else"), tok(email="other@vybr8.live"), tok(email_verified=False)):
        with pytest.raises(fa.AuthError):
            fa.verify_id_token(bad)
