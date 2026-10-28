"""AELIO Native Orchestrator.

Coordinates engines through an explicit state machine:

    received -> inspect -> diagnose -> plan -> build -> test -> evaluate
             -> (repair -> test -> evaluate)* -> review -> deploy_request -> done | failed

Each step is recorded in `task_steps` with the engine involved and the exact
performer: `deterministic:<tool>`, `native:<model>/<checkpoint>` or
`external:<provider>`. AELIO never records an action that did not happen; when
a step cannot complete the task stops there and the reason is stored.
"""
from __future__ import annotations

import re
import time
import traceback
from pathlib import Path

from pydantic import BaseModel, Field

from . import db
from .codestudio import diagnose as diag
from .codestudio import projects
from .config import BENCHMARKS_DIR
from .jobs import JobContext, handler
from .quality import runner

STAGES = ["received", "inspect", "diagnose", "plan", "build", "test", "evaluate", "repair", "review",
          "deploy_request", "done", "failed"]
TRANSITIONS = {
    "received": {"inspect", "failed"}, "inspect": {"diagnose", "failed"}, "diagnose": {"plan", "failed"},
    "plan": {"build", "failed"}, "build": {"test", "failed"}, "test": {"evaluate", "failed"},
    "evaluate": {"repair", "review", "failed"}, "repair": {"test", "failed"},
    "review": {"deploy_request", "done", "failed"}, "deploy_request": {"done", "failed"},
}
MAX_RETRIES_CAP = 3


class TaskContract(BaseModel):
    """Structured contract every coding task must satisfy before work starts."""
    instruction: str = Field(min_length=5, max_length=4000)
    project_id: str
    acceptance_suite: str = "dashboard_benchmark_v1"
    allowed_files: list[str] = Field(default_factory=lambda: ["src/dashboard.js"])
    mode: str = Field(default="native", pattern="^(native|external-comparison)$")
    max_retries: int = Field(default=2, ge=0, le=MAX_RETRIES_CAP)


ROUTES = [
    (r"\b(code|component|function|bug|test|refactor|build|dashboard|api|page)\b", "code"),
    (r"\b(image|screenshot|drawing|diagram|photo|visual)\b", "vision"),
    (r"\b(voice|speech|audio|speak|tts)\b", "voice"),
    (r"\b(video|camera|screen ?share|live)\b", "live"),
    (r"\b(remember|memory|document|retriev)\w*", "memory"),
]


def route(instruction: str) -> list[str]:
    """Deterministic keyword router (performer: deterministic:router-v1)."""
    eng = [e for rx, e in ROUTES if re.search(rx, instruction, re.I)]
    return ["reasoning"] + sorted(set(eng))


class Task:
    def __init__(self, tid: str):
        self.id = tid
        self.row = db.q1("SELECT * FROM tasks WHERE id=?", (tid,))
        self.contract = TaskContract(**db.loads(self.row["contract"]))

    def to(self, stage: str) -> None:
        cur = db.q1("SELECT stage FROM tasks WHERE id=?", (self.id,))["stage"]
        if stage not in TRANSITIONS.get(cur, set()):
            raise RuntimeError(f"illegal transition {cur} -> {stage}")
        db.update("tasks", "id", self.id, stage=stage, updated_at=db.now(),
                  status="failed" if stage == "failed" else ("done" if stage == "done" else "running"))

    def step(self, stage: str, engine: str, performer: str, status: str, detail: dict, t0: float) -> None:
        db.insert("task_steps", {"task_id": self.id, "stage": stage, "engine": engine, "performer": performer,
                                 "status": status, "started_at": t0, "finished_at": db.now(),
                                 "detail": db.dumps(detail)})


def create_task(title: str, contract: TaskContract) -> str:
    projects.get(contract.project_id)
    p = projects.get(contract.project_id)
    if p["is_production"]:
        raise projects.PolicyError("Native 1.0 does not run autonomous tasks on production projects.")
    tid = db.new_id("task")
    db.insert("tasks", {"id": tid, "project_id": contract.project_id, "title": title,
                        "instruction": contract.instruction, "status": "queued", "stage": "received",
                        "contract": contract.model_dump_json(), "max_retries": contract.max_retries,
                        "created_at": db.now(), "updated_at": db.now(), "mode": contract.mode})
    db.audit("founder", None, "task.created", tid, {"mode": contract.mode})
    return tid


def _native_code_checkpoint() -> dict | None:
    return db.q1("""SELECT c.* FROM checkpoints c JOIN models m ON m.id=c.model_id
                    WHERE m.family='code' AND c.status IN ('evaluated','approved','production','published')
                    ORDER BY CASE c.status WHEN 'production' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                    c.created_at DESC LIMIT 1""")


def _native_generate(task: Task, attempt: int) -> tuple[str, str]:
    """Ask the native code model for the deliverable. Returns (content, performer)."""
    from .native.train import load_lm
    ck = _native_code_checkpoint()
    if not ck:
        raise LookupError("no evaluated AELIO Native code checkpoint exists; train one in Native Lab")
    model, tok, c = load_lm(ck["id"])
    prompt = ("// Task: " + task.contract.instruction.replace("\n", " ")[:300] + "\n"
              "// Contract: export function renderDashboard(data) returning an HTML string.\n"
              "export function renderDashboard(data) {\n    ")
    body = tok.decode(model.generate(tok.encode(prompt), max_new=220, temperature=0.7, seed=100 + attempt))
    return prompt + body + "\n}\n", f"native:{c['model_id']}/{c['id']}"


@handler("orchestrator.run_task")
def run_task(ctx: JobContext) -> dict:
    t = Task(ctx.payload["task_id"])
    repo = Path(projects.get(t.contract.project_id)["path"])
    summary: dict = {"task_id": t.id, "mode": t.contract.mode}
    try:
        # INSPECT
        t.to("inspect"); t0 = db.now()
        engines = route(t.contract.instruction)
        projects.reset_hard(repo)
        base_branch = projects.git(repo, "rev-parse", "--abbrev-ref", "HEAD").strip()
        if base_branch.startswith("aelio/"):
            projects.checkout(repo, projects.get(t.contract.project_id)["default_branch"])
        base = projects.git(repo, "rev-parse", "HEAD").strip()
        info = {"engines": engines, "files": len(projects.tree(repo)), "base_commit": base}
        t.step("inspect", "orchestrator", "deterministic:router-v1 + git", "ok", info, t0)
        ctx.log(f"inspect: engines={engines}")

        # DIAGNOSE
        t.to("diagnose"); t0 = db.now()
        d = diag.diagnose(repo)
        t.step("diagnose", "code", diag.PERFORMER, "ok", {"counts": d["counts"], "frameworks": d["frameworks"],
                                                          "findings": d["findings"][:20]}, t0)

        # PLAN (structured, deterministic in v1)
        t.to("plan"); t0 = db.now()
        branch = projects.create_branch(repo, f"aelio/{t.id}")
        db.update("tasks", "id", t.id, branch=branch)
        plan = {"branch": branch, "deliverables": t.contract.allowed_files, "acceptance": t.contract.acceptance_suite,
                "max_retries": t.contract.max_retries,
                "note": "Plan produced by deterministic template; the native reasoning model is not yet capable of planning."}
        t.step("plan", "reasoning", "deterministic:plan-template-v1", "ok", plan, t0)

        attempt, run = 0, None
        while True:
            # BUILD / REPAIR
            stage = "build" if attempt == 0 else "repair"
            if attempt > 0:
                t.to("repair")
            else:
                t.to("build")
            t0 = db.now()
            target = t.contract.allowed_files[0]
            try:
                if t.contract.mode == "native":
                    content, performer = _native_generate(t, attempt)
                else:
                    content = (BENCHMARKS_DIR / "external_reference" / "dashboard.js").read_text()
                    performer = "external:claude-reference (labelled, not AELIO Native)"
            except LookupError as e:
                t.step(stage, "code", "native:unavailable", "failed", {"reason": str(e)}, t0)
                t.to("failed")
                summary.update(stopped_at=stage, reason=str(e))
                return _finish(t, summary, "failed")
            projects.write_file(repo, target, content, allowed=t.contract.allowed_files)
            changed = projects.changed_files(repo)
            unrelated = [f for f in changed if f not in t.contract.allowed_files]
            if unrelated:
                projects.reset_hard(repo)
                t.step(stage, "code", performer, "failed", {"reason": "unrelated file changes rejected",
                                                            "files": unrelated}, t0)
                t.to("failed")
                return _finish(t, {**summary, "stopped_at": stage, "reason": "unrelated changes"}, "failed")
            sha = projects.commit_all(repo, f"{stage}: {t.contract.instruction[:60]}", performer)
            strategy = ("initial generation" if attempt == 0 else
                        "resample with a new seed (the native model cannot yet read test failures; "
                        "failure-conditioned repair is a future capability)")
            t.step(stage, "code", performer, "ok", {"attempt": attempt, "strategy": strategy, "commit": sha, "files": changed,
                                                    "diff": projects.diff(repo, base)[:12000]}, t0)
            ctx.check()

            # TEST
            t.to("test"); t0 = db.now()
            run = runner.run_suite(t.contract.acceptance_suite, repo, task_id=t.id,
                                   project_id=t.contract.project_id, log=ctx.log)
            t.step("test", "quality", "deterministic:quality-lab-v1", run["status"],
                   {"run_id": run["id"], "passed": run["passed"], "failed": run["failed"], "total": run["total"],
                    "failures": [c for c in run["results"] if not c["passed"]][:10]}, t0)

            # EVALUATE (criteria come from the protected suite, not from the code engine)
            t.to("evaluate"); t0 = db.now()
            ok = run["status"] == "passed"
            t.step("evaluate", "quality", "deterministic:acceptance-gate-v1", "ok" if ok else "failed",
                   {"criteria": f"all checks in protected suite {t.contract.acceptance_suite}",
                    "suite_sha256": run["suite_sha256"], "result": "pass" if ok else "fail"}, t0)
            if ok or attempt >= t.contract.max_retries:
                break
            attempt += 1
            db.update("tasks", "id", t.id, retry_count=attempt)
            ctx.log(f"tests failed; bounded repair attempt {attempt}/{t.contract.max_retries}")

        # REVIEW
        t.to("review"); t0 = db.now()
        review = {"attempts": attempt + 1, "final_run": run["id"], "passed": run["passed"], "failed": run["failed"],
                  "branch": branch, "diff": projects.diff(repo, base)[:20000]}
        t.step("review", "orchestrator", "deterministic:review-summary-v1", "ok" if run["status"] == "passed"
               else "failed", review, t0)
        summary.update(run_id=run["id"], passed=run["passed"], failed=run["failed"], attempts=attempt + 1,
                       branch=branch)
        if run["status"] != "passed":
            t.to("failed")
            summary.update(stopped_at="review", reason="acceptance tests failed after bounded retries")
            return _finish(t, summary, "failed")
        t.to("deploy_request"); t0 = db.now()
        from . import deploy
        dep = deploy.request(t.contract.project_id, t.id, "preview", requested_by="orchestrator")
        t.step("deploy_request", "operations", "deterministic:deploy-planner-v1", "ok", {"deployment_id": dep}, t0)
        summary["deployment_id"] = dep
        t.to("done")
        return _finish(t, summary, "done")
    except Exception as e:  # noqa: BLE001
        t.step("error", "orchestrator", "deterministic:orchestrator", "failed",
               {"error": str(e), "trace": traceback.format_exc()[-1500:]}, db.now())
        try:
            t.to("failed")
        except RuntimeError:
            db.update("tasks", "id", t.id, stage="failed", status="failed")
        return _finish(t, {**summary, "reason": str(e)}, "failed")
    finally:
        try:
            projects.checkout(repo, projects.get(t.contract.project_id)["default_branch"])
        except Exception:
            pass


def _finish(t: Task, summary: dict, status: str) -> dict:
    db.update("tasks", "id", t.id, result=summary, status=status, updated_at=db.now())
    db.audit("system", "orchestrator", f"task.{status}", t.id, {k: summary.get(k) for k in ("passed", "failed", "reason")})
    return summary


def task_detail(tid: str) -> dict:
    t = db.q1("SELECT * FROM tasks WHERE id=?", (tid,))
    if not t:
        raise FileNotFoundError(tid)
    t["contract"] = db.loads(t["contract"]); t["result"] = db.loads(t["result"])
    t["steps"] = [dict(s, detail=db.loads(s["detail"], {})) for s in
                  db.q("SELECT * FROM task_steps WHERE task_id=? ORDER BY id", (tid,))]
    return t
