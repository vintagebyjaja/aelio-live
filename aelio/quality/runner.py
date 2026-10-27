"""Quality Lab test runner.

Results are parsed by the Quality Lab from raw tool output (TAP, JUnit XML,
JSON lines, exit codes). The code under test has no influence on the scoring
rules, which live in protected suite definitions.
"""
from __future__ import annotations

import json
import re
import shutil
import time
import xml.etree.ElementTree as ET
from pathlib import Path

from .. import db
from ..codestudio import sandbox
from ..jobs import JobContext, handler
from . import suites


def _parse(parser: str, res: dict, ws: Path, name: str) -> list[dict]:
    out, err = res["stdout"], res["stderr"]
    if res.get("refused"):
        return [{"name": name, "passed": False, "detail": err}]
    if res["timed_out"]:
        return [{"name": name, "passed": False, "detail": "timed out"}]
    if parser == "exit":
        return [{"name": name, "passed": res["returncode"] == 0, "detail": (err or out)[-600:]}]
    if parser == "tap":
        cases = []
        for m in re.finditer(r"^(not ok|ok) \d+ - (.+)$", out, re.M):
            cases.append({"name": m.group(2).strip(), "passed": m.group(1) == "ok", "detail": ""})
        if not cases:
            cases = [{"name": name, "passed": False, "detail": (err or out)[-800:] or "no TAP output"}]
        else:
            # attach failure detail blocks
            for c in cases:
                if not c["passed"]:
                    i = out.find(c["name"])
                    c["detail"] = out[i:i + 600]
        return cases
    if parser == "junit":
        f = ws / ".aelio_junit.xml"
        if not f.exists():
            return [{"name": name, "passed": False, "detail": (err or out)[-800:]}]
        cases = []
        for tc in ET.parse(f).getroot().iter("testcase"):
            fail = tc.find("failure") if tc.find("failure") is not None else tc.find("error")
            cases.append({"name": tc.get("name"), "passed": fail is None,
                          "detail": (fail.get("message") or "")[:600] if fail is not None else ""})
        f.unlink()
        return cases
    if parser == "jsonl":
        cases = []
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("{"):
                try:
                    d = json.loads(line)
                    cases.append({"name": d["name"], "passed": bool(d["passed"]), "detail": d.get("detail", "")})
                except (ValueError, KeyError):
                    pass
        if not cases or res["returncode"] not in (0, None):
            cases.append({"name": name + " (runner)", "passed": res["returncode"] == 0 and bool(cases),
                          "detail": err[-800:]})
        return cases
    raise ValueError(parser)


def run_suite(suite_id: str, workspace: Path, *, task_id: str | None = None, project_id: str | None = None,
              log=lambda m: None) -> dict:
    t0 = time.time()
    sha = suites.verify_suite(suite_id)
    suites.install_into(suite_id, workspace)
    spec = json.loads((workspace / ".aelio_protected" / suite_id / "suite.json").read_text())
    all_cases, logs, iso = [], [], None
    for step in spec["steps"]:
        log(f"[{suite_id}] {step['name']}: {' '.join(step['cmd'])}")
        res = sandbox.run(step["cmd"], workspace, timeout=step.get("timeout", 60), cpu_s=step.get("timeout", 60))
        iso = res["isolation"]
        cases = _parse(step["parser"], res, workspace, step["name"])
        for c in cases:
            c["step"], c["category"] = step["name"], step.get("category", "unit")
        all_cases += cases
        logs.append(f"$ {' '.join(step['cmd'])}\n{res['stdout'][-4000:]}\n{res['stderr'][-4000:]}")
        log(f"  -> {sum(c['passed'] for c in cases)}/{len(cases)} passed in {res['duration_s']}s")
    shutil.rmtree(workspace / ".aelio_protected", ignore_errors=True)
    passed = sum(c["passed"] for c in all_cases)
    failed = len(all_cases) - passed
    rid = db.new_id("run")
    row = {"id": rid, "task_id": task_id, "suite": suite_id, "project_id": project_id, "workspace": str(workspace),
           "status": "passed" if failed == 0 and all_cases else "failed", "passed": passed, "failed": failed,
           "total": len(all_cases), "log": "\n".join(logs)[-60_000:], "sandbox": db.dumps(iso),
           "suite_sha256": sha, "duration_s": round(time.time() - t0, 2), "created_at": db.now(),
           "results": db.dumps(all_cases)}
    db.insert("test_runs", row)
    row["results"] = all_cases
    row["expected"] = spec.get("expected")
    return row


@handler("quality.run_suite")
def run_suite_job(ctx: JobContext) -> dict:
    p = ctx.payload
    ws = Path(p["workspace"])
    r = run_suite(p["suite"], ws, task_id=p.get("task_id"), project_id=p.get("project_id"), log=ctx.log)
    return {"run_id": r["id"], "status": r["status"], "passed": r["passed"], "failed": r["failed"],
            "expected": r.get("expected")}
