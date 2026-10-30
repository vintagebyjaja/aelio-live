"""Same-origin architecture: the engine is reachable only through aelio.live's proxy; founder engine overview."""
import json

from conftest import PERSONAL_EMAIL, PERSONAL_UID, founder_mfa

SECRET = "proxy-secret-for-tests-0123456789abcdef"


def test_proxy_secret_required_when_configured(fbclient, monkeypatch):
    monkeypatch.setenv("AELIO_PROXY_SECRET", SECRET)
    c = fbclient
    assert c.get("/api/health").status_code == 404                                   # direct access: looks like nothing is there
    assert c.get("/api/health", headers={"x-aelio-proxy-secret": "wrong"}).status_code == 404
    assert c.post("/webhooks/stripe", content=b"{}").status_code == 404
    r = c.get("/api/health", headers={"x-aelio-proxy-secret": SECRET})
    assert r.status_code == 200 and r.json() == {"ok": True, "service": "aelio-engine"}


def test_no_secret_means_local_development_mode(fbclient, monkeypatch):
    monkeypatch.delenv("AELIO_PROXY_SECRET", raising=False)
    assert fbclient.get("/api/health").json()["ok"] is True


def test_client_ip_trusted_only_through_proxy(env, monkeypatch):
    from starlette.requests import Request
    from aelio.server import ip_of

    def req(headers, proxied):
        scope = {"type": "http", "headers": [(k.encode(), v.encode()) for k, v in headers.items()], "client": ("10.0.0.9", 1)}
        if proxied:
            scope["aelio_proxied"] = True
        return Request(scope)
    assert ip_of(req({"x-aelio-client-ip": "203.0.113.7"}, proxied=True)) == "203.0.113.7"
    assert ip_of(req({"x-aelio-client-ip": "203.0.113.7"}, proxied=False)) == "10.0.0.9"    # spoofed header ignored


def test_public_models_same_origin_path(fbclient):
    r = fbclient.get("/api/public/models")
    assert r.status_code == 200 and "models" in r.json()


def test_engine_overview_founder_only_and_secret_free(fbclient, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-proj-SHOULDNEVERAPPEAR000000000000000000")
    monkeypatch.setenv("AELIO_PROXY_SECRET", SECRET)
    c = fbclient
    p = {**c.tok(PERSONAL_UID, PERSONAL_EMAIL), "x-aelio-proxy-secret": SECRET}
    assert c.get("/api/brain/engine", headers=p).status_code == 403
    monkeypatch.delenv("AELIO_PROXY_SECRET")
    h = founder_mfa(c)
    monkeypatch.setenv("AELIO_PROXY_SECRET", SECRET)
    d = c.get("/api/brain/engine", headers={**h, "x-aelio-proxy-secret": SECRET}).json()
    names = {x["name"]: x for x in d["checks"]}
    assert {"Database", "Supabase sign-in", "OpenAI (GPT)", "Code sandbox", "Reached through aelio.live"} <= set(names)
    assert names["OpenAI (GPT)"]["status"] == "ok" and names["Reached through aelio.live"]["status"] == "ok"
    assert names["Supabase sign-in"]["detail"] == "SUPABASE_URL configured"
    blob = json.dumps(d)
    assert "SHOULDNEVERAPPEAR" not in blob and SECRET not in blob
