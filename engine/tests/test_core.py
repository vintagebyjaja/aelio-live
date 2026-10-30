"""AELIO Core: PATHD (and other products) use AELIO's AI through one product API, with isolated data and no Brain access."""
import pytest

from aelio import core, db, gateway
from conftest import FOUNDER_EMAIL
from test_identity import SB_FOUNDER, sb  # noqa: F401  (offline Supabase fixture)

PAT = "33333333-3333-4333-8333-333333333333"


@pytest.fixture()
def c(fbclient, sb, monkeypatch):  # noqa: F811
    monkeypatch.setenv("AELIO_ALLOW_TEST_PROVIDER", "1")
    db.kv_set("intelligence_settings", {"tiers": {"standard": {"provider": "test", "model": "test-echo"},
                                                  "advanced": {"provider": "test", "model": "test-echo"}}})
    _, key = gateway.register_app("PATHD", "pathd", ["core:respond", "core:memory"])
    _, other = gateway.register_app("DrawUp", "drawup", ["core:respond"])
    _, noscope = gateway.register_app("Status board", "statusboard", ["status:read"])
    fbclient.app_key = {"Authorization": "Bearer " + key}
    fbclient.drawup_key = {"Authorization": "Bearer " + other}
    fbclient.noscope_key = {"Authorization": "Bearer " + noscope}

    def user(sub=PAT, email="pat@x.dev", products=("aelio", "pathd")):
        return {"X-AELIO-User-Token": sb(sub=sub, email=email, app_metadata={"products": list(products)})["Authorization"][7:]}
    fbclient.user = user
    fbclient.sb = sb
    return fbclient


def ask(c, text, **extra):
    return c.post("/v1/core/respond", headers={**c.app_key, **c.user()}, json={"input": text, **extra})


def test_pathd_user_gets_one_answer_and_an_aelio_identity(c):
    r = ask(c, "Plan my week")
    assert r.status_code == 200, r.text
    d = r.json()
    assert "You said: Plan my week" in d["output"] and d["services"] == ["reasoning"]
    u = db.q1("SELECT u.* FROM users u JOIN identities i ON i.user_id=u.id WHERE i.provider='supabase' AND i.subject=?", (PAT,))
    assert u["role"] == "user"
    # the same person signing in on aelio.live is the same AELIO user (and still has no Brain access)
    me = c.get("/api/me", headers=c.sb(sub=PAT, email="pat@x.dev")).json()
    assert me["role"] == "visitor"
    assert db.q1("SELECT COUNT(*) n FROM identities WHERE subject=?", (PAT,))["n"] == 1


def test_product_users_never_reach_brain_or_studio(c):
    ask(c, "hi")
    h = c.sb(sub=PAT, email="pat@x.dev")
    for path in ("/api/brain/engine", "/api/brain/core", "/api/studio/security", "/api/brain/intelligence"):
        assert c.get(path, headers=h).status_code in (401, 403), path


@pytest.mark.parametrize("case,status,code", [
    ("no_user", 401, "no_user"), ("not_member", 403, "not_a_member"), ("firebase", 401, "bad_user_token"),
    ("no_app_key", 401, None), ("wrong_scope", 403, None), ("not_a_product", 403, "not_a_product"),
])
def test_both_credentials_are_required(c, case, status, code):
    hdr = {**c.app_key, **c.user()}
    if case == "no_user":
        hdr.pop("X-AELIO-User-Token")
    if case == "not_member":
        hdr.update(c.user(products=("aelio",)))
    if case == "firebase":
        hdr["X-AELIO-User-Token"] = "legacy.firebase.token"
    if case == "no_app_key":
        hdr.pop("Authorization")
    if case == "wrong_scope":
        hdr.update(c.noscope_key)
    if case == "not_a_product":
        hdr.update(c.drawup_key)
    r = c.post("/v1/core/respond", headers=hdr, json={"input": "hi"})
    assert r.status_code == status, r.text
    if code:
        assert r.json()["code"] == code
    assert not db.q1("SELECT 1 FROM ai_requests")                         # nothing ran, nothing charged


def test_memory_is_per_person_and_per_product(c):
    r = ask(c, "Remember my goal", remember=["Pat is training for a half marathon in March"])
    assert r.json()["memories_saved"] == 1
    r = ask(c, "How should I train for my marathon?")
    assert r.json()["memories_used"] == 1 and "memory" in r.json()["services"]
    uid = db.q1("SELECT user_id FROM identities WHERE subject=?", (PAT,))["user_id"]
    assert core.recall(uid, "aelio", "marathon") == []                   # PATHD memories stay in PATHD
    other = c.post("/v1/core/respond", headers={**c.app_key, **c.user(sub="44444444-4444-4444-8444-444444444444", email="o@x.dev")},
                   json={"input": "marathon?"}).json()
    assert other["memories_used"] == 0                                     # and with this person
    m = c.get("/v1/core/memories", headers={**c.app_key, **c.user()}).json()["memories"]
    assert len(m) == 1
    assert c.delete("/v1/core/memories", headers={**c.app_key, **c.user()}).json()["deleted"] == 1


def test_code_requests_go_to_the_coding_service(c):
    q = "Why does this fail?\n```python\nprint(1/0)\n```"
    r = ask(c, q)
    assert r.status_code == 403 and r.json()["code"] == "feature_unavailable"     # plan rules apply to products too
    uid = db.q1("SELECT user_id FROM identities WHERE subject=?", (PAT,))["user_id"]
    db.run("UPDATE users SET plan='live' WHERE id=?", (uid,))
    assert ask(c, q).json()["services"] == ["coding"]
    assert ask(c, "write it", task="code").json()["services"] == ["coding"]
    assert ask(c, "What's a good breakfast?").json()["services"] == ["reasoning"]


def test_unconnected_services_are_refused_honestly(c):
    r = ask(c, "What's in this photo?", attachments=[{"kind": "image", "url": "https://example.com/x.png"}])
    assert r.status_code == 501 and r.json()["service"] == "vision"
    r = ask(c, "Read this aloud", output="speech")
    assert r.status_code == 501 and r.json()["service"] == "voice"
    assert ask(c, "do it", task="agent").status_code == 501
    assert not db.q1("SELECT 1 FROM ai_requests")


def test_founder_pause_stops_products_too(c):
    db.kv_set("intelligence_settings", {**db.kv_get("intelligence_settings"), "paused": True})
    r = ask(c, "hi")
    assert r.status_code == 503 and r.json()["code"] == "paused"
    assert c.get("/v1/core/services", headers=c.app_key).json()["services"]["reasoning"] == "not_connected"


def test_consent_endpoint_records_acceptance(c):
    h = {**c.app_key, **c.user()}
    assert c.get("/v1/core/consent", headers=h).json()["consent_at"] is None
    assert c.post("/v1/core/consent", headers=h, json={"accept": True}).json()["consent_at"]


def test_founder_core_overview(c):
    from conftest import founder_mfa
    ask(c, "hi")
    h = founder_mfa(c)
    d = c.get("/api/brain/core", headers=h).json()
    assert d["services"]["reasoning"]["status"] == "test_only" and d["services"]["vision"]["status"] == "not_available"
    assert d["requests_24h"] == {"pathd": 1}
