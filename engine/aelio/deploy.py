"""Deployment management.

Stages: development -> automated_tests -> security_checks -> preview -> founder_review
        -> production_approval -> production -> health_monitoring (-> rollback)

Rules enforced in code:
  * Preview: dry-run plan unless a preview target and credentials are
    explicitly configured by the founder (not configured in v1).
  * Production: blocked unless a founder approves with an MFA code entered in
    the last few minutes. Agents and application API keys cannot reach the
    approval function (see server.py route guards and tests/test_security.py).
  * Agents never receive production credentials; none are stored in v1.
"""
from __future__ import annotations

from . import db

STAGES = ["development", "automated_tests", "security_checks", "preview", "founder_review",
          "production_approval", "production", "health_monitoring"]


def _stages(**over) -> list[dict]:
    return [{"stage": s, "status": over.get(s, "pending")} for s in STAGES]


def request(project_id: str | None, task_id: str | None, target: str, requested_by: str) -> str:
    if target not in ("preview", "production"):
        raise ValueError("target must be preview or production")
    run = db.q1("SELECT * FROM test_runs WHERE task_id=? ORDER BY created_at DESC LIMIT 1", (task_id,)) if task_id else None
    tests_ok = bool(run and run["status"] == "passed")
    security = db.q1("SELECT value FROM kv WHERE key='sandbox_selftest'")
    plan = {
        "mode": "dry-run",
        "reason": "No preview hosting target or deploy credentials are configured. AELIO holds no production credentials.",
        "would_do": ["build static assets from branch " + (db.q1("SELECT branch FROM tasks WHERE id=?", (task_id,)) or {}).get("branch", "?"),
                     "upload to an isolated preview environment (e.g. Cloudflare Pages preview branch)",
                     "post the preview URL to Founder Review"],
        "tests_passed": tests_ok, "test_run": run["id"] if run else None,
        "production": "BLOCKED: requires founder approval with fresh MFA",
    }
    stages = _stages(development="done", automated_tests="done" if tests_ok else "failed",
                     security_checks="done" if security else "pending",
                     preview="dry-run" if tests_ok else "blocked", founder_review="waiting" if tests_ok else "blocked",
                     production_approval="blocked", production="blocked")
    did = db.new_id("dep")
    db.insert("deployments", {"id": did, "project_id": project_id, "task_id": task_id, "target": target,
                              "status": "awaiting_founder_review" if tests_ok else "blocked_tests_failed",
                              "stages": db.dumps(stages), "plan": db.dumps(plan), "requested_by": requested_by,
                              "created_at": db.now(), "updated_at": db.now()})
    db.audit("agent" if requested_by != "founder" else "founder", requested_by, "deployment.requested", did, {"target": target})
    return did


def get(did: str) -> dict:
    d = db.q1("SELECT * FROM deployments WHERE id=?", (did,))
    if not d:
        raise FileNotFoundError(did)
    d["stages"] = db.loads(d["stages"]); d["plan"] = db.loads(d["plan"])
    return d


class ApprovalError(Exception):
    pass


def approve_production(did: str, founder_id: str, mfa_fresh: bool, actor_type: str) -> dict:
    """Only callable by a founder session with fresh MFA."""
    if actor_type != "founder":
        db.audit(actor_type, founder_id, "deployment.approval_denied", did, {"reason": "not founder"})
        raise ApprovalError("only the founder can approve production deployments")
    if not mfa_fresh:
        raise ApprovalError("re-enter your authenticator code to approve production")
    d = get(did)
    if d["status"] != "awaiting_founder_review":
        raise ApprovalError(f"deployment is {d['status']}; it cannot be approved")
    for s in d["stages"]:
        if s["stage"] in ("founder_review", "production_approval"):
            s["status"] = "approved"
        if s["stage"] == "production":
            s["status"] = "ready_not_executed"
    d["plan"]["production"] = ("APPROVED by founder. Execution still needs a configured production target; "
                               "v1 records approval and performs no production release.")
    db.update("deployments", "id", did, status="approved_pending_execution", stages=d["stages"], plan=d["plan"],
              approved_by=founder_id, approved_at=db.now(), updated_at=db.now())
    db.audit("founder", founder_id, "deployment.production_approved", did)
    return get(did)


def reject(did: str, founder_id: str) -> dict:
    db.update("deployments", "id", did, status="rejected", updated_at=db.now())
    db.audit("founder", founder_id, "deployment.rejected", did)
    return get(did)
