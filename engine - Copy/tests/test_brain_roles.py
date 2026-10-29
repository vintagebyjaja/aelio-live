from conftest import FOUNDER_UID, PERSONAL_EMAIL, PERSONAL_UID, founder_mfa


def test_brain_destinations(fbclient):
    c = fbclient
    assert c.get("/api/me").json()["destination"] == "game"                       # not signed in
    f = c.get("/api/me", headers=c.tok()).json()
    assert f["role"] == "founder" and f["destination"] == "studiobrain" and f["mfa"] == "enroll"
    p = c.get("/api/me", headers=c.tok(PERSONAL_UID, PERSONAL_EMAIL)).json()
    assert p["role"] == "member" and p["destination"] == "my" and p["unlimited"] is True
    o = c.get("/api/me", headers=c.tok("someoneElse123", "fan@example.com")).json()
    assert o["role"] == "visitor" and o["destination"] == "game"


def test_founder_needs_both_uid_and_email(fbclient):
    c = fbclient
    assert c.get("/api/me", headers=c.tok(FOUNDER_UID, "other@vybr8.live")).json()["role"] == "visitor"
    assert c.get("/api/me", headers=c.tok("impostor", "jaja@vybr8.live")).json()["role"] == "visitor"
    assert c.get("/api/me", headers=c.tok(verified=False)).json()["role"] != "founder"


def test_personal_account_has_no_studio_brain(fbclient):
    c = fbclient
    h = c.tok(PERSONAL_UID, PERSONAL_EMAIL)
    assert c.get("/api/overview", headers=h).status_code == 403
    assert c.get("/api/settings", headers=h).status_code == 403
    assert c.get("/api/my/home", headers=h).status_code == 200


def test_visitor_gets_nothing(fbclient):
    c = fbclient
    h = c.tok("x1", "fan@example.com")
    assert c.get("/api/overview", headers=h).status_code == 403
    assert c.get("/api/my/home", headers=h).status_code == 403


def test_founder_studio_requires_mfa(fbclient):
    c = fbclient
    assert c.get("/api/overview", headers=c.tok()).status_code == 401
    h = founder_mfa(c)
    assert c.get("/api/overview", headers=h).status_code == 200


def test_forged_and_expired_tokens_rejected(fbclient):
    import time
    c = fbclient
    assert c.get("/api/overview", headers={"Authorization": "Bearer a.b.c"}).status_code == 401
    assert c.get("/api/me", headers=c.tok(exp=int(time.time()) - 100, iat=int(time.time()) - 900)).status_code == 401


def test_cors_only_for_aelio_live(fbclient):
    c = fbclient
    ok = c.options("/api/me", headers={"Origin": "https://aelio.live", "Access-Control-Request-Method": "GET"})
    assert ok.status_code == 204 and ok.headers["access-control-allow-origin"] == "https://aelio.live"
    bad = c.options("/api/me", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert bad.status_code == 403
    r = c.get("/api/me", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers
