"""Protected evaluation suites.

Suites live in ./protected_suites and are hash-locked in protected_suites/LOCKS.json
(committed to git) and in the database. Before every evaluation the suite is
re-hashed; any change aborts the run and is written to the audit log. Only a
founder, using the `relock-suites` CLI command on the server, can change a lock.
No HTTP route or agent tool can write to these files.
"""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from .. import db
from ..config import PROTECTED_SUITES_DIR

LOCKS = PROTECTED_SUITES_DIR / "LOCKS.json"


class SuiteTampered(Exception):
    pass


def suite_hash(suite_id: str) -> str:
    d = PROTECTED_SUITES_DIR / suite_id
    if not d.is_dir():
        raise FileNotFoundError(suite_id)
    h = hashlib.sha256()
    for f in sorted(p for p in d.rglob("*") if p.is_file() and "__pycache__" not in p.parts):
        h.update(str(f.relative_to(d)).encode())
        h.update(f.read_bytes())
    return h.hexdigest()


def list_suites() -> list[dict]:
    locks = json.loads(LOCKS.read_text()) if LOCKS.exists() else {}
    out = []
    for d in sorted(p for p in PROTECTED_SUITES_DIR.iterdir() if p.is_dir()):
        meta = json.loads((d / "suite.json").read_text())
        cur = suite_hash(d.name)
        out.append({"id": d.name, "description": meta.get("description", ""), "steps": meta.get("steps", []),
                    "sha256": cur, "locked_sha256": locks.get(d.name), "intact": locks.get(d.name) == cur,
                    "files": sorted(str(p.relative_to(d)) for p in d.rglob("*") if p.is_file()
                                    and "__pycache__" not in p.parts)})
    return out


def relock(actor: str) -> dict:
    """Founder-only (CLI). Records new hashes for every suite."""
    locks = {d.name: suite_hash(d.name) for d in PROTECTED_SUITES_DIR.iterdir() if d.is_dir()}
    LOCKS.write_text(json.dumps(locks, indent=2) + "\n")
    db.kv_set("suite_locks", locks)
    db.audit("founder", actor, "suites.relocked", None, locks)
    return locks


def verify_suite(suite_id: str) -> str:
    cur = suite_hash(suite_id)
    file_locks = json.loads(LOCKS.read_text()) if LOCKS.exists() else {}
    db_locks = db.kv_get("suite_locks") or file_locks
    if file_locks.get(suite_id) != cur or db_locks.get(suite_id) != cur:
        db.audit("system", "quality-lab", "suite.tamper_detected", suite_id,
                 {"current": cur, "file_lock": file_locks.get(suite_id), "db_lock": db_locks.get(suite_id)})
        raise SuiteTampered(f"protected suite {suite_id} does not match its lock; evaluation refused")
    return cur


def install_into(suite_id: str, workspace: Path) -> Path:
    """Copy a fresh, verified copy of the suite into the workspace just before running.

    Anything a coding agent wrote at that location is discarded first.
    """
    verify_suite(suite_id)
    dest = Path(workspace) / ".aelio_protected" / suite_id
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(PROTECTED_SUITES_DIR / suite_id, dest)
    return dest
