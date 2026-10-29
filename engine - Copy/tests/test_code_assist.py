"""Code Studio AI edits: propose (gateway) -> review diff -> apply/reject. Uses the offline test provider (not AI)."""
from pathlib import Path

import pytest

from aelio import db


@pytest.fixture()
def studio(founder, monkeypatch):
    monkeypatch.setenv("AELIO_ALLOW_TEST_PROVIDER", "1")
    from aelio.intelligence import gateway, settings
    settings.seed_models(); gateway.reset_limits()
    db.kv_set("intelligence_settings", {"tiers": {"standard": {"provider": "test", "model": "test-echo"},
                                                  "advanced": {"provider": "test", "model": "test-echo"}}})
    c = founder
    pid = c.post("/api/projects", json={"sample": "dashboard-benchmark"}).json()["project"]["id"]
    files = [f["path"] for f in c.get(f"/api/projects/{pid}/tree").json()["files"]]
    target = next(f for f in files if f.endswith((".js", ".md", ".json", ".html")))
    repo = Path(db.q1("SELECT path FROM projects WHERE id=?", (pid,))["path"])
    return c, pid, target, repo


def test_propose_shows_diff_and_writes_nothing(studio):
    c, pid, target, repo = studio
    before = (repo / target).read_text()
    r = c.post(f"/api/projects/{pid}/ai/propose", json={"instruction": "add a marker", "paths": [target]})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["files"][0]["path"] == target and "+// edited by AELIO test provider" in d["diff"]
    assert (repo / target).read_text() == before                      # nothing written yet
    assert db.q1("SELECT purpose, status FROM ai_requests ORDER BY ts DESC")["purpose"] == "code"


def test_apply_writes_files_and_audits(studio):
    c, pid, target, repo = studio
    prop = c.post(f"/api/projects/{pid}/ai/propose", json={"instruction": "add a marker", "paths": [target]}).json()
    r = c.post(f"/api/projects/{pid}/ai/proposals/{prop['id']}/apply")
    assert r.status_code == 200 and r.json()["applied"] == [target]
    assert "edited by AELIO test provider" in (repo / target).read_text()
    assert db.q1("SELECT status FROM code_proposals WHERE id=?", (prop["id"],))["status"] == "applied"
    assert db.q1("SELECT COUNT(*) n FROM audit_log WHERE action='code.ai_applied'")["n"] == 1
    assert c.post(f"/api/projects/{pid}/ai/proposals/{prop['id']}/apply").status_code == 409     # can't apply twice


def test_stale_proposal_refused(studio):
    c, pid, target, repo = studio
    prop = c.post(f"/api/projects/{pid}/ai/propose", json={"instruction": "add a marker", "paths": [target]}).json()
    (repo / target).write_text("someone edited this meanwhile\n")
    r = c.post(f"/api/projects/{pid}/ai/proposals/{prop['id']}/apply")
    assert r.status_code == 409 and "changed after this proposal" in r.json()["error"]
    assert (repo / target).read_text() == "someone edited this meanwhile\n"


def test_reject(studio):
    c, pid, target, repo = studio
    prop = c.post(f"/api/projects/{pid}/ai/propose", json={"instruction": "x", "paths": [target]}).json()
    assert c.post(f"/api/projects/{pid}/ai/proposals/{prop['id']}/reject").status_code == 200
    assert c.post(f"/api/projects/{pid}/ai/proposals/{prop['id']}/apply").status_code == 409


def test_secrets_and_escapes_are_blocked(studio):
    c, pid, target, repo = studio
    assert c.post(f"/api/projects/{pid}/ai/propose", json={"instruction": "x", "paths": [".env"]}).status_code == 422
    r = c.post(f"/api/projects/{pid}/ai/propose", json={"instruction": "!secret", "paths": []})
    assert r.status_code == 422 and "protected" in r.json()["error"]
    r = c.post(f"/api/projects/{pid}/ai/propose", json={"instruction": "!escape", "paths": []})
    assert r.status_code in (403, 422)
    assert not (repo.parent / "outside.txt").exists()
    assert db.q1("SELECT COUNT(*) n FROM code_proposals")["n"] == 0


def test_code_studio_ai_is_founder_only(fbclient):
    from conftest import PERSONAL_EMAIL, PERSONAL_UID
    h = fbclient.tok(PERSONAL_UID, PERSONAL_EMAIL)
    assert fbclient.post("/api/projects/prj_x/ai/propose", headers=h, json={"instruction": "x"}).status_code == 403
