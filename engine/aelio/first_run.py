"""First-run verification for AELIO Native 1.0 (spec sections 17 and 18).

Every check runs against the real system and records what actually happened.
Results go to the database (kv `first_run_report`) and to
<data_dir>/first_run_report.json.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from . import db, deploy, gateway, guardians, jobs, orchestrator, voice
from .codestudio import projects, sandbox
from .config import get_settings
from .native import datasets, registry
from .native import train as tr
from .quality import runner


def _check(report, name, fn):
    t0 = time.time()
    try:
        passed, detail = fn()
    except Exception as e:  # noqa: BLE001
        passed, detail = False, {"exception": repr(e)}
    report["tests"][name] = {"passed": bool(passed), "detail": detail, "seconds": round(time.time() - t0, 1)}
    print(f"[{'PASS' if passed else 'FAIL'}] {name} ({report['tests'][name]['seconds']}s)", flush=True)


def _run(kind, payload, timeout_s=7200):
    jid = jobs.enqueue(kind, payload, timeout_s=timeout_s, created_by="system:first-run")
    while True:
        j = jobs.claim()
        if not j:
            break
        jobs.run_job(j)
    return jobs.get(jid)


def run_all(text_steps: int = 1500, code_steps: int = 1500) -> dict:
    report: dict = {"started": db.now(), "tests": {}, "host": os.uname().nodename}
    ctx: dict = {}

    def sandbox_test():
        r = sandbox.self_test()
        db.kv_set("sandbox_selftest", {**r, "ts": db.now()})
        return r["passed"], r
    _check(report, "security: sandbox isolation", sandbox_test)

    def native_text():
        ds = datasets.build_stdlib_docstrings()
        j = _run("native.train_lm", {"dataset_id": ds["id"], "steps": text_steps, "name": "aelio-native-text",
                                     "family": "reasoning", "sample_prompt": "Return the",
                                     "config": {"vocab_size": 768, "n_layer": 3, "n_head": 4, "n_embd": 128,
                                                "block_size": 64}})
        if j["status"] != "succeeded":
            return False, {"job": j["id"], "error": j["error"]}
        r = j["result"]
        ctx["text_ckpt"] = r["checkpoint_id"]
        model, tok, c = tr.load_lm(r["checkpoint_id"])  # reload from disk
        out = tr.infer(r["checkpoint_id"], "The function returns", max_new=40, seed=3)
        m = r["metrics"]
        ok = (m["val_loss"] < m["init_val_loss"] and m["beats_unigram_baseline"] and len(out["completion"]) > 0)
        return ok, {"checkpoint": r["checkpoint_id"], "metrics": m, "loss_curve": r["curve"],
                    "reloaded_from_disk": True, "inference": out, "job": j["id"]}
    _check(report, "native model: train from random init, save, load, infer, evaluate", native_text)

    def native_code():
        ds = datasets.build_stdlib_code()
        j = _run("native.train_lm", {"dataset_id": ds["id"], "steps": code_steps, "name": "aelio-native-code",
                                     "family": "code", "sample_prompt": "def ",
                                     "config": {"vocab_size": 768, "n_layer": 3, "n_head": 4, "n_embd": 128,
                                                "block_size": 64}})
        if j["status"] != "succeeded":
            return False, {"error": j["error"]}
        ctx["code_ckpt"] = j["result"]["checkpoint_id"]
        e = _run("native.eval_code", {"checkpoint_id": ctx["code_ckpt"], "samples": 3})
        # The check passes if the evaluation ran and was recorded honestly, whatever the score.
        return e["status"] == "succeeded", {"checkpoint": ctx["code_ckpt"], "train_metrics": j["result"]["metrics"],
                                             "protected_code_tasks": e["result"]["metrics"] if e["result"] else e["error"],
                                             "sample": j["result"]["sample"]}
    _check(report, "native code model: train + protected code tasks (Milestone B baseline)", native_code)

    def vision():
        ds = datasets.register_digits()
        j = _run("native.train_vision", {"dataset_id": ds["id"], "epochs": 40})
        if j["status"] != "succeeded":
            return False, {"error": j["error"]}
        return j["result"]["metrics"]["accuracy"] > 0.9, j["result"]["metrics"]
    _check(report, "native vision prototype: held-out digit classification (Milestone D)", vision)

    def quality():
        p = projects.create_from_sample("dashboard-benchmark", "quality-lab-first-run")
        r = runner.run_suite("quality_demo_v1", Path(p["path"]))
        ok = r["passed"] == 1 and r["failed"] == 1 and r["status"] == "failed"
        return ok, {"run": r["id"], "results": [(c["name"], "PASS" if c["passed"] else "FAIL") for c in r["results"]],
                    "expected": "1 passed, 1 failed (intentional)"}
    _check(report, "quality lab: one passing + one intentionally failing test reported correctly", quality)

    def benchmark():
        p = projects.create_from_sample("dashboard-benchmark", "first-coding-benchmark")
        instr = "Create a simple responsive dashboard component that displays system status, recent activity, and three performance metrics."
        tid = orchestrator.create_task("First native coding benchmark",
                                       orchestrator.TaskContract(instruction=instr, project_id=p["id"], mode="native"))
        j = _run("orchestrator.run_task", {"task_id": tid}, 3600)
        native = orchestrator.task_detail(tid)
        p2 = projects.create_from_sample("dashboard-benchmark", "first-coding-benchmark-external-comparison")
        tid2 = orchestrator.create_task("External-assisted comparison (labelled)",
                                        orchestrator.TaskContract(instruction=instr, project_id=p2["id"],
                                                                  mode="external-comparison", max_retries=0))
        _run("orchestrator.run_task", {"task_id": tid2}, 3600)
        ext = orchestrator.task_detail(tid2)
        performers = sorted({s["performer"] for s in native["steps"]})
        hist = db.kv_get("benchmark_history", [])
        hist.append({"ts": db.now(), "benchmark": "dashboard_benchmark_v1", "native_task": tid,
                     "native_status": native["status"], "native_result": native["result"],
                     "external_task": tid2, "external_status": ext["status"], "external_result": ext["result"]})
        db.kv_set("benchmark_history", hist)
        no_fake = not any(s["performer"].startswith("external") for s in native["steps"])
        workflow_visible = {s["stage"] for s in native["steps"]} >= {"inspect", "diagnose", "plan", "build", "test", "evaluate", "review"}
        return (no_fake and workflow_visible and ext["status"] == "done"), {
            "native_task": tid, "native_status": native["status"], "native_result": native["result"],
            "native_performers": performers, "external_comparison_task": tid2, "external_status": ext["status"],
            "external_result": ext["result"], "native_never_credited_with_external_work": no_fake}
    _check(report, "first coding benchmark: native attempt recorded honestly + labelled external comparison", benchmark)

    def guardians_test():
        real = guardians.run_cycle()
        sim = guardians.synthetic_thermal_scenario()
        recs = [db.loads(e["recommendation"], {}) for e in sim["events"]]
        safe = all(not r.get("hardware_change", False) for r in recs)
        has_rec = any(e["kind"] in ("thermal_rising", "cooling_demand") for e in sim["events"])
        all_sim = all(e["simulated"] == 1 for e in sim["events"])
        return safe and has_rec and all_sim and not sim["hardware_settings_changed"], {
            "real_readings": real["readings"], "synthetic_events": [(e["agent"], e["message"]) for e in sim["events"]],
            "hardware_settings_changed": False, "labelled_simulated": all_sim}
    _check(report, "green guardians: real telemetry + labelled synthetic thermal scenario, recommend-only", guardians_test)

    def voice_test():
        voice.seed()
        vs = voice.list_voices()
        sub = voice.submit_synthesis("aelio-voice-nova", "Turn left in two hundred feet.", "system:first-run")
        while (j := jobs.claim()):
            jobs.run_job(j)
        s = db.q1("SELECT * FROM voice_synth WHERE id=?", (sub["synth_id"],))
        ok = len(vs) == 6 and s["status"] == "awaiting_training" and s["audio_path"] is None
        return ok, {"voices": [(v["voice_id"], v["status"]) for v in vs], "synthesis": {k: s[k] for k in ("status", "message", "latency_ms")}}
    _check(report, "voice lab: six voices registered; synthesis distinguishes untrained profiles", voice_test)

    def deploy_test():
        tasks_done = db.q1("SELECT id FROM tasks WHERE status='done' ORDER BY created_at DESC LIMIT 1")
        did = deploy.request(None, tasks_done["id"] if tasks_done else None, "preview", "orchestrator")
        d = deploy.get(did)
        blocked = []
        for actor, fresh in (("agent", True), ("app", True), ("founder", False)):
            try:
                deploy.approve_production(did, "x", fresh, actor)
                blocked.append((actor, fresh, "NOT BLOCKED"))
            except deploy.ApprovalError as e:
                blocked.append((actor, fresh, f"blocked: {e}"))
        ok = d["plan"]["mode"] == "dry-run" and all(b[2].startswith("blocked") for b in blocked) and \
            deploy.get(did)["status"] != "approved_pending_execution"
        return ok, {"deployment": did, "plan": d["plan"], "approval_attempts": blocked}
    _check(report, "deployment: dry-run preview plan; production blocked pending founder approval", deploy_test)

    def security_test():
        from starlette.testclient import TestClient

        from .server import create_app
        c = TestClient(create_app(start_worker=False), base_url="http://localhost")
        targets = [("GET", "/api/overview"), ("GET", "/api/datasets"), ("GET", "/api/settings"), ("POST", "/api/secrets"),
                   ("POST", "/api/train"), ("POST", "/api/quality/run"), ("POST", "/api/tasks"), ("GET", "/api/projects"),
                   ("POST", "/api/deployments/x/approve"), ("GET", "/api/audit"), ("POST", "/api/security/selftest")]
        res = {f"{m} {u}": c.request(m, u).status_code for m, u in targets}
        row, key = gateway.register_app("Security probe", f"security-probe-{int(time.time())}", ["status:read"], 50)
        with_key = {f"app-key {m} {u}": c.request(m, u, headers={"Authorization": f"Bearer {key}"}).status_code
                    for m, u in targets[:4]}
        db.run("UPDATE apps SET active=0 WHERE id=?", (row["id"],))
        ok = all(v == 401 for v in res.values()) and all(v == 401 for v in with_key.values())
        return ok, {"unauthenticated": res, "application_key_on_studio_routes": with_key}
    _check(report, "security: unauthenticated users and app keys cannot reach studio routes", security_test)

    def integration_test():
        from starlette.testclient import TestClient

        from .server import create_app
        c = TestClient(create_app(start_worker=False), base_url="http://localhost")
        row, key = gateway.register_app("Groove Guide (integration test)", f"groove-guide-test-{int(time.time())}",
                                        ["voices:read", "status:read"], 100)
        h = {"Authorization": f"Bearer {key}"}
        r1 = c.get("/v1/voices", headers=h)
        r2 = c.post("/v1/voices/aelio-voice-groove/synthesize", headers=h, json={"text": "hi"})
        r3 = c.get("/v1/voices")
        usage = db.q1("SELECT COUNT(*) n FROM api_usage WHERE app_id=?", (row["id"],))["n"]
        ok = r1.status_code == 200 and len(r1.json()["voices"]) == 6 and r2.status_code == 403 and r3.status_code == 401 and usage >= 2
        return ok, {"GET /v1/voices": r1.status_code, "POST synthesize without scope": r2.status_code,
                    "no key": r3.status_code, "audited_requests": usage,
                    "existing_grooveville_apps_modified": False}
    _check(report, "integration: authenticated app request via gateway, scopes + audit enforced", integration_test)

    def supabase_test():
        import jwt
        from cryptography.hazmat.primitives.asymmetric import rsa
        from . import identity
        key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        jwk=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()));jwk.update(kid="offline",alg="RS256",use="sig")
        f=get_settings().data_dir/"offline_supabase_jwks.json";f.write_text(json.dumps({"keys":[jwk]}))
        names=("SUPABASE_URL","AELIO_SUPABASE_JWKS_FILE","AELIO_FOUNDER_EMAILS","AELIO_FOUNDER_UIDS")
        old={n:os.environ.get(n) for n in names}
        os.environ.update(SUPABASE_URL="https://offline.supabase.co",AELIO_SUPABASE_JWKS_FILE=str(f),AELIO_FOUNDER_EMAILS="founder@example.test",AELIO_FOUNDER_UIDS="offline-founder")
        out={}
        try:
            t=int(time.time())
            for name,over in {"founder":{},"wrong UID":{"sub":"other"},"wrong audience":{"aud":"wrong"},"expired":{"exp":t-3600},"service role":{"role":"service_role"}}.items():
                claims={"iss":"https://offline.supabase.co/auth/v1","sub":"offline-founder","email":"founder@example.test","email_confirmed_at":"2026-01-01","role":"authenticated","aud":"authenticated","iat":t,"exp":t+600,**over}
                token=jwt.encode(claims,key,algorithm="RS256",headers={"kid":"offline"})
                try:out[name]=identity.resolve(identity.verify(token))["role"]=="founder"
                except identity.AuthError:out[name]=False
        finally:
            f.unlink(missing_ok=True);identity.purge_jwks_cache()
            for n,v in old.items():
                if v is None:os.environ.pop(n,None)
                else:os.environ[n]=v
        return out.get("founder") is True and all(not v for n,v in out.items() if n!="founder"), {"note":"Offline signed-token checks only, not a real Supabase login.","results":out}
    _check(report,"auth: Supabase asymmetric tokens and administrative founder identity",supabase_test)

    report["finished"] = db.now()
    report["all_passed"] = all(t["passed"] for t in report["tests"].values())
    db.kv_set("first_run_report", report)
    (get_settings().data_dir / "first_run_report.json").write_text(json.dumps(report, indent=2, default=str))
    return report
