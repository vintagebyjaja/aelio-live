import time
from pathlib import Path

import pytest

from aelio import jobs


def test_job_retry_then_fail_and_cancel(env):
    calls = []

    @jobs.handler("test.flaky")
    def flaky(ctx):
        calls.append(1)
        raise RuntimeError("boom")

    jid = jobs.enqueue("test.flaky", {}, max_attempts=2)
    jobs.drain()
    j = jobs.get(jid)
    assert j["status"] == "failed" and j["attempts"] == 2 and len(calls) == 2
    jid2 = jobs.enqueue("test.flaky", {})
    jobs.cancel(jid2)
    assert jobs.get(jid2)["status"] == "cancelled"


def test_job_timeout(env):
    @jobs.handler("test.slow")
    def slow(ctx):
        while True:
            ctx.check(); time.sleep(0.05)

    jid = jobs.enqueue("test.slow", {}, timeout_s=1)
    jobs.drain()
    assert jobs.get(jid)["status"] == "timed_out"


def test_write_policy(env):
    from aelio.codestudio import projects
    p = projects.create_from_sample()
    repo = Path(p["path"])
    with pytest.raises(projects.PolicyError):
        projects.write_file(repo, "../escape.txt", "x")
    with pytest.raises(projects.PolicyError):
        projects.write_file(repo, ".aelio_protected/x/test.py", "x")
    with pytest.raises(projects.PolicyError):
        projects.write_file(repo, "src/other.js", "x", allowed=["src/dashboard.js"])
    with pytest.raises(projects.PolicyError):
        projects.create_branch(repo, "main2")


def test_quality_reports_pass_and_fail(env):
    from aelio.codestudio import projects
    from aelio.quality import runner
    p = projects.create_from_sample()
    r = runner.run_suite("quality_demo_v1", Path(p["path"]))
    assert (r["passed"], r["failed"], r["status"]) == (1, 1, "failed")


def test_native_task_without_model_stops_honestly(env):
    from aelio import orchestrator
    from aelio.codestudio import projects
    p = projects.create_from_sample()
    tid = orchestrator.create_task("t", orchestrator.TaskContract(
        instruction="Create a dashboard component", project_id=p["id"]))
    jobs.enqueue("orchestrator.run_task", {"task_id": tid}); jobs.drain()
    d = orchestrator.task_detail(tid)
    assert d["status"] == "failed" and d["result"]["stopped_at"] == "build"
    assert not any(s["performer"].startswith("external") for s in d["steps"])


def test_external_comparison_passes_and_is_labelled(env):
    from aelio import orchestrator
    from aelio.codestudio import projects
    p = projects.create_from_sample()
    tid = orchestrator.create_task("t", orchestrator.TaskContract(
        instruction="Create a dashboard component", project_id=p["id"], mode="external-comparison", max_retries=0))
    jobs.enqueue("orchestrator.run_task", {"task_id": tid}); jobs.drain()
    d = orchestrator.task_detail(tid)
    assert d["status"] == "done", d["result"]
    build = [s for s in d["steps"] if s["stage"] == "build"][0]
    assert build["performer"].startswith("external:")


def test_illegal_transition_rejected(env):
    from aelio import orchestrator
    from aelio.codestudio import projects
    p = projects.create_from_sample()
    tid = orchestrator.create_task("t", orchestrator.TaskContract(instruction="Create a thing", project_id=p["id"]))
    with pytest.raises(RuntimeError):
        orchestrator.Task(tid).to("review")


def test_guardians_never_change_hardware(env):
    from aelio import guardians
    r = guardians.synthetic_thermal_scenario()
    assert r["hardware_settings_changed"] is False
    assert all(e["simulated"] == 1 for e in r["events"])


def test_voice_untrained_produces_no_audio(env):
    from aelio import db, voice
    voice.seed()
    s = voice.submit_synthesis("aelio-voice-echo", "hello", "t"); jobs.drain()
    row = db.q1("SELECT * FROM voice_synth WHERE id=?", (s["synth_id"],))
    assert row["status"] == "awaiting_training" and row["audio_path"] is None
    with pytest.raises(ValueError):
        voice.approve("aelio-voice-echo", "f")
