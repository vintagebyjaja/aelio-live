import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture()
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("AELIO_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("AELIO_SECURE_COOKIES", "0")
    monkeypatch.setenv("AELIO_AUTH", "local")
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
