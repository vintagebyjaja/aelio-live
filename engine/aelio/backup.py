"""Verified backups of the engine database, taken before any migration step.

A backup is a consistent SQLite snapshot (online backup API, safe while the engine runs) plus a manifest:
SHA-256 of the file, row counts per table, and an integrity check of the copy. `verify()` re-checks a backup;
`restore()` swaps it in only after the current database is itself backed up.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
import sqlite3
import time
from pathlib import Path

from . import db
from .config import get_settings


def _dir() -> Path:
    d = get_settings().data_dir / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _counts(conn: sqlite3.Connection) -> dict:
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    return {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in tables}


def create(label: str = "manual") -> dict:
    if os.environ.get("DATABASE_URL"):
        from . import postgres_backup
        return postgres_backup.create(label,_dir(),_sha)
    src = db._connect()
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    safe = "".join(ch for ch in label if ch.isalnum() or ch in "-_")[:40] or "backup"
    out = _dir() / f"aelio-{stamp}-{safe}-{uuid.uuid4().hex[:8]}.sqlite3"
    dst = sqlite3.connect(out)
    with dst:
        src.backup(dst)
    integrity = dst.execute("PRAGMA integrity_check").fetchone()[0]
    counts = _counts(dst)
    dst.close()
    manifest = {"file": out.name, "created_at": time.time(), "label": label, "sha256": _sha(out),
                "bytes": out.stat().st_size, "integrity": integrity, "row_counts": counts}
    out.with_suffix(".json").write_text(json.dumps(manifest, indent=1))
    db.audit("system", "backup", "backup.created", out.name, {"label": label, "sha256": manifest["sha256"]})
    if integrity != "ok":
        raise RuntimeError(f"backup integrity check failed: {integrity}")
    return manifest


def verify(name: str) -> dict:
    if not re.fullmatch(r"aelio-[A-Za-z0-9_.-]+",name): raise ValueError("Invalid backup name")
    p = _dir() / name
    if name.endswith(".pg.json"):
        from . import postgres_backup
        return postgres_backup.verify(p,_sha)
    m = json.loads(p.with_suffix(".json").read_text())
    conn = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
    ok = _sha(p) == m["sha256"] and conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok" and _counts(conn) == m["row_counts"]
    conn.close()
    return {"file": name, "ok": ok}


def listing() -> list[dict]:
    return [json.loads(p.read_text()) for p in sorted(_dir().glob("aelio-*.json"), reverse=True) if not p.name.endswith(".pg.json")]


def restore(name: str) -> dict:
    """Roll back to a backup. Takes a safety backup of the current database first."""
    if name.endswith(".pg.json"):
        if not re.fullmatch(r"aelio-[A-Za-z0-9_.-]+",name): raise ValueError("Invalid backup name")
        from . import postgres_backup
        return postgres_backup.restore(_dir()/name,_dir(),_sha)
    v = verify(name)
    if not v["ok"]:
        raise RuntimeError("backup failed verification; not restoring")
    safety = create("before-restore")
    # Copy the backup INTO the live database with SQLite's backup API: it takes the write lock, replaces every
    # page and keeps WAL consistent, so other open connections see the restored data (no file swapping).
    src = sqlite3.connect(f"file:{_dir() / name}?mode=ro", uri=True)
    src.backup(db._connect())
    src.close()
    db.audit("system", "backup", "backup.restored", name, {"safety_backup": safety["file"]})
    return {"restored": name, "safety_backup": safety["file"]}
