"""Durable background job queue backed by the database.

Jobs survive restarts (state is in SQLite), support priorities, bounded retries,
timeouts, cooperative cancellation, postponement (used by the Workload
Guardian) and per-job resource limits. Handlers register by `kind`.
"""
from __future__ import annotations

import threading
import time
import traceback
from typing import Any, Callable

from . import db
from .security import redact

Handler = Callable[["JobContext"], dict]
_handlers: dict[str, Handler] = {}
TERMINAL = {"succeeded", "failed", "cancelled", "timed_out"}


def handler(kind: str):
    def deco(fn: Handler) -> Handler:
        _handlers[kind] = fn
        return fn
    return deco


class Cancelled(Exception):
    pass


class JobContext:
    def __init__(self, job: dict[str, Any]):
        self.job = job
        self.id = job["id"]
        self.payload = db.loads(job["payload"], {})
        self.limits = db.loads(job.get("resource_limits"), {}) or {}
        self.deadline = time.time() + job["timeout_s"]

    def log(self, msg: str) -> None:
        line = time.strftime("%H:%M:%S") + " " + redact(str(msg)) + "\n"
        with db.tx() as c:
            c.execute("UPDATE jobs SET log = log || ?, lease_until=? WHERE id=?",
                      (line, time.time() + 120, self.id))

    def check(self) -> None:
        """Raise if the job was cancelled or ran past its timeout."""
        r = db.q1("SELECT cancel_requested FROM jobs WHERE id=?", (self.id,))
        if r and r["cancel_requested"]:
            raise Cancelled("cancel requested")
        if time.time() > self.deadline:
            raise TimeoutError(f"job exceeded timeout of {self.job['timeout_s']}s")

    @property
    def remaining_s(self) -> float:
        return max(1.0, self.deadline - time.time())


def enqueue(kind: str, payload: dict, *, priority: int = 5, max_attempts: int = 1, timeout_s: int = 600,
            created_by: str = "founder", critical: bool = False, limits: dict | None = None) -> str:
    if kind not in _handlers:
        raise ValueError(f"unknown job kind {kind}")
    jid = db.new_id("job")
    db.insert("jobs", {"id": jid, "kind": kind, "payload": db.dumps(payload), "status": "queued",
                       "priority": priority, "max_attempts": max(1, min(max_attempts, 5)),
                       "timeout_s": timeout_s, "created_at": db.now(), "created_by": created_by,
                       "critical": int(critical), "resource_limits": db.dumps(limits or {})})
    db.audit("system" if created_by.startswith("system") else "founder", created_by, "job.enqueued", jid, {"kind": kind})
    return jid


def cancel(job_id: str) -> None:
    db.run("UPDATE jobs SET cancel_requested=1 WHERE id=?", (job_id,))
    db.run("UPDATE jobs SET status='cancelled', finished_at=? WHERE id=? AND status='queued'", (db.now(), job_id))


def postpone(job_id: str, seconds: int) -> bool:
    n = db.run("UPDATE jobs SET postponed_until=? WHERE id=? AND status='queued' AND critical=0",
               (db.now() + seconds, job_id))
    return n > 0


def claim() -> dict | None:
    t = db.now()
    with db.tx() as c:
        r = c.execute("""SELECT * FROM jobs WHERE status='queued' AND cancel_requested=0
                         AND (postponed_until IS NULL OR postponed_until<=?)
                         ORDER BY priority ASC, created_at ASC LIMIT 1""", (t,)).fetchone()
        if not r:
            return None
        c.execute("UPDATE jobs SET status='running', started_at=?, attempts=attempts+1, lease_until=? WHERE id=?",
                  (t, t + 120, r["id"]))
    return db.q1("SELECT * FROM jobs WHERE id=?", (r["id"],))


def run_job(job: dict) -> None:
    ctx = JobContext(job)
    fn = _handlers.get(job["kind"])
    try:
        if fn is None:
            raise RuntimeError(f"no handler for {job['kind']}")
        result = fn(ctx) or {}
        db.update("jobs", "id", job["id"], status="succeeded", finished_at=db.now(), result=result)
    except Cancelled as e:
        ctx.log(f"cancelled: {e}")
        db.update("jobs", "id", job["id"], status="cancelled", finished_at=db.now(), error=str(e))
    except TimeoutError as e:
        ctx.log(str(e))
        db.update("jobs", "id", job["id"], status="timed_out", finished_at=db.now(), error=str(e))
    except Exception as e:  # noqa: BLE001 - record any failure
        ctx.log(redact(traceback.format_exc()[-3000:]))
        cur = db.q1("SELECT attempts,max_attempts FROM jobs WHERE id=?", (job["id"],))
        if cur and cur["attempts"] < cur["max_attempts"]:
            db.update("jobs", "id", job["id"], status="queued", error=redact(str(e)))
        else:
            db.update("jobs", "id", job["id"], status="failed", finished_at=db.now(), error=redact(str(e)))


def recover_stale() -> int:
    """Re-queue jobs whose worker died (lease expired)."""
    t = db.now()
    stale = db.q("SELECT id,attempts,max_attempts FROM jobs WHERE status='running' AND lease_until<?", (t,))
    for j in stale:
        status = "queued" if j["attempts"] < j["max_attempts"] else "failed"
        db.update("jobs", "id", j["id"], status=status, error="worker lease expired")
    return len(stale)


def drain(max_jobs: int = 100) -> int:
    """Run queued jobs synchronously (used by CLI first-run and tests)."""
    n = 0
    while n < max_jobs:
        j = claim()
        if not j:
            break
        run_job(j)
        n += 1
    return n


class Worker(threading.Thread):
    def __init__(self) -> None:
        super().__init__(daemon=True, name="aelio-worker")
        self.stop = threading.Event()

    def run(self) -> None:
        recover_stale()
        while not self.stop.is_set():
            j = claim()
            if j:
                run_job(j)
            else:
                self.stop.wait(1.0)


def get(job_id: str) -> dict | None:
    j = db.q1("SELECT * FROM jobs WHERE id=?", (job_id,))
    if j:
        j["payload"] = db.loads(j["payload"], {})
        j["result"] = db.loads(j["result"], None)
    return j


def wait(job_id: str, timeout: float = 600) -> dict:
    end = time.time() + timeout
    while time.time() < end:
        j = get(job_id)
        if j and j["status"] in TERMINAL:
            return j
        time.sleep(0.2)
    raise TimeoutError(job_id)
