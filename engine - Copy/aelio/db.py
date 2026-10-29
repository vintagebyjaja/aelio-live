"""Structured storage for AELIO Studio.

SQLite is used for the first build (single founder, single host). The schema
uses only portable SQL types so it can move to PostgreSQL later; see
docs/ARCHITECTURE.md. Every write goes through `tx()` so it is atomic.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from typing import Any, Iterator

from .config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw_hash TEXT NOT NULL,
  totp_secret TEXT, mfa_enabled INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'founder', created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL,
  created_at REAL NOT NULL, expires_at REAL NOT NULL, mfa_at REAL, ip TEXT, ua TEXT
);
CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT, ts REAL, ok INTEGER);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, actor_type TEXT NOT NULL,
  actor_id TEXT, action TEXT NOT NULL, target TEXT, detail TEXT, ip TEXT
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5, attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1, timeout_s INTEGER NOT NULL DEFAULT 600,
  created_at REAL NOT NULL, started_at REAL, finished_at REAL, lease_until REAL,
  cancel_requested INTEGER NOT NULL DEFAULT 0, critical INTEGER NOT NULL DEFAULT 0,
  postponed_until REAL, result TEXT, error TEXT, log TEXT NOT NULL DEFAULT '',
  created_by TEXT, resource_limits TEXT
);
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, family TEXT NOT NULL, engine TEXT NOT NULL,
  architecture TEXT NOT NULL, status TEXT NOT NULL, origin TEXT NOT NULL,
  created_at REAL NOT NULL, notes TEXT
);
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY, model_id TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL,
  step INTEGER, created_at REAL NOT NULL, metrics TEXT, status TEXT NOT NULL,
  job_id TEXT, dataset_id TEXT, approved_by TEXT, approved_at REAL
);
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL, modality TEXT NOT NULL,
  license TEXT NOT NULL, source TEXT NOT NULL, provenance TEXT NOT NULL, sha256 TEXT,
  path TEXT, size_bytes INTEGER, n_records INTEGER, status TEXT NOT NULL,
  training_eligible INTEGER NOT NULL DEFAULT 0, created_at REAL NOT NULL, validation TEXT
);
CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY, model_id TEXT, dataset_id TEXT, config TEXT, status TEXT,
  job_id TEXT, metrics TEXT, created_at REAL NOT NULL, proposal TEXT
);
CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY, checkpoint_id TEXT, suite TEXT NOT NULL, metrics TEXT,
  passed INTEGER, created_at REAL NOT NULL, job_id TEXT, details TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL, kind TEXT NOT NULL,
  remote_url TEXT, default_branch TEXT, is_production INTEGER NOT NULL DEFAULT 0,
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, project_id TEXT, title TEXT NOT NULL, instruction TEXT NOT NULL,
  status TEXT NOT NULL, stage TEXT NOT NULL, contract TEXT, branch TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0, max_retries INTEGER NOT NULL DEFAULT 2,
  result TEXT, created_at REAL NOT NULL, updated_at REAL NOT NULL, mode TEXT
);
CREATE TABLE IF NOT EXISTS task_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, stage TEXT NOT NULL,
  engine TEXT NOT NULL, performer TEXT NOT NULL, status TEXT NOT NULL,
  started_at REAL NOT NULL, finished_at REAL, detail TEXT
);
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY, task_id TEXT, suite TEXT NOT NULL, project_id TEXT, workspace TEXT,
  status TEXT NOT NULL, passed INTEGER, failed INTEGER, total INTEGER, log TEXT,
  sandbox TEXT, suite_sha256 TEXT, duration_s REAL, created_at REAL NOT NULL, results TEXT
);
CREATE TABLE IF NOT EXISTS voices (
  voice_id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, traits TEXT,
  use_cases TEXT, status TEXT NOT NULL, native_checkpoint_id TEXT, params TEXT,
  approved_by TEXT, approved_at REAL, updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS voice_synth (
  id TEXT PRIMARY KEY, voice_id TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL,
  performer TEXT, audio_path TEXT, latency_ms REAL, message TEXT, created_at REAL NOT NULL,
  job_id TEXT
);
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, source TEXT NOT NULL,
  metric TEXT NOT NULL, value REAL, unit TEXT, simulated INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_tel ON telemetry(metric, ts);
CREATE TABLE IF NOT EXISTS guardian_events (
  id TEXT PRIMARY KEY, ts REAL NOT NULL, agent TEXT NOT NULL, severity TEXT NOT NULL,
  kind TEXT NOT NULL, message TEXT NOT NULL, recommendation TEXT, simulated INTEGER NOT NULL,
  action_status TEXT NOT NULL, risk TEXT, conditions TEXT, before_state TEXT,
  after_state TEXT, result TEXT, rollback_status TEXT
);
CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY, project_id TEXT, task_id TEXT, target TEXT NOT NULL, status TEXT NOT NULL,
  stages TEXT NOT NULL, plan TEXT, requested_by TEXT, approved_by TEXT, approved_at REAL,
  created_at REAL NOT NULL, updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, scopes TEXT NOT NULL, quota_per_day INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT, ts REAL NOT NULL, route TEXT,
  status INTEGER, latency_ms REAL
);
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, division TEXT NOT NULL, engine TEXT NOT NULL,
  kind TEXT NOT NULL, capabilities TEXT, tools TEXT, permissions TEXT, status TEXT NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);

-- ---------- usage limits & credits ----------
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, window_hours REAL NOT NULL, allowance INTEGER NOT NULL,
  features TEXT NOT NULL, member_discount_pct REAL NOT NULL DEFAULT 0, updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS cost_config (
  op TEXT PRIMARY KEY, credits INTEGER NOT NULL, unit TEXT NOT NULL, note TEXT, est_cost_usd REAL,
  updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, ts REAL NOT NULL, op TEXT NOT NULL,
  credits INTEGER NOT NULL, source TEXT NOT NULL, reservation_id TEXT
);
CREATE INDEX IF NOT EXISTS ix_usage_user_ts ON usage_events(user_id, ts);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, ts REAL NOT NULL, type TEXT NOT NULL,
  bucket TEXT NOT NULL, amount INTEGER NOT NULL, ref TEXT, note TEXT, actor TEXT
);
CREATE INDEX IF NOT EXISTS ix_ledger_user ON credit_ledger(user_id);
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, op TEXT NOT NULL, created_at REAL NOT NULL, estimate INTEGER NOT NULL,
  allowance_part INTEGER NOT NULL, promo_part INTEGER NOT NULL, purchased_part INTEGER NOT NULL,
  exempt INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, final INTEGER
);
CREATE TABLE IF NOT EXISTS credit_packages (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, credits INTEGER NOT NULL, price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd', active INTEGER NOT NULL DEFAULT 0, approved INTEGER NOT NULL DEFAULT 0,
  promo INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0, starts_at REAL, ends_at REAL,
  updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, package_id TEXT NOT NULL, provider TEXT NOT NULL,
  session_id TEXT UNIQUE, payment_intent TEXT, status TEXT NOT NULL, amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL, credits INTEGER NOT NULL, credits_reversed INTEGER NOT NULL DEFAULT 0,
  return_to TEXT, created_at REAL NOT NULL, updated_at REAL NOT NULL, receipt TEXT
);
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY, type TEXT NOT NULL, received_at REAL NOT NULL, result TEXT
);

-- ---------- My AELIO: agents, conversations, Agent Transfer ----------
CREATE TABLE IF NOT EXISTS user_agents (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, origin_label TEXT,
  avatar TEXT, description TEXT, profile TEXT NOT NULL, memories TEXT NOT NULL, voice_id TEXT,
  status TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, created_at REAL NOT NULL, updated_at REAL NOT NULL,
  last_chat_at REAL
);
CREATE INDEX IF NOT EXISTS ix_user_agents_user ON user_agents(user_id);
CREATE TABLE IF NOT EXISTS agent_sources (
  id TEXT PRIMARY KEY, agent_id TEXT, user_id TEXT NOT NULL, filename TEXT, kind TEXT NOT NULL, size INTEGER,
  sha256 TEXT, stored_path TEXT, created_at REAL NOT NULL, expires_at REAL
);
CREATE TABLE IF NOT EXISTS agent_previews (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, user_id TEXT NOT NULL, prompt TEXT NOT NULL, response TEXT,
  performer TEXT, rating TEXT, created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS import_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, user_hash TEXT, method TEXT, format TEXT,
  status TEXT NOT NULL, error_kind TEXT, bytes INTEGER, flags TEXT
);
CREATE TABLE IF NOT EXISTS problem_reports (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, area TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL,
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, agent_id TEXT, title TEXT, created_at REAL NOT NULL,
  updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL,
  performer TEXT, credits INTEGER, ts REAL NOT NULL
);
-- AELIO Intelligence Gateway: one row per model request. Never stores message content.
CREATE TABLE IF NOT EXISTS ai_requests (
  id TEXT PRIMARY KEY, ts REAL NOT NULL, user_id TEXT, purpose TEXT NOT NULL, tier TEXT NOT NULL,
  provider TEXT, model TEXT, status TEXT NOT NULL, error_code TEXT, input_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, cost_usd REAL DEFAULT 0, credits INTEGER DEFAULT 0,
  latency_ms INTEGER, ttft_ms INTEGER, conversation_id TEXT, reservation_id TEXT, exempt INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_ai_requests_ts ON ai_requests(ts);
CREATE INDEX IF NOT EXISTS ix_ai_requests_user ON ai_requests(user_id, ts);
-- Code Studio: AI-proposed changes, stored until the founder applies or rejects them.
CREATE TABLE IF NOT EXISTS code_proposals (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL, instruction TEXT NOT NULL, summary TEXT,
  changes TEXT NOT NULL, base TEXT NOT NULL, status TEXT NOT NULL, request_id TEXT, created_at REAL NOT NULL, decided_at REAL
);
-- Per-user preferences, including consent to send messages to an external AI provider.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY, external_ai_consent_at REAL, personality_id TEXT, preferences TEXT, updated_at REAL NOT NULL
);
-- Model price list (USD per 1M tokens). Founder-editable; used for cost estimates and credit charges.
CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY, provider TEXT NOT NULL, label TEXT, input_per_m REAL NOT NULL, cached_input_per_m REAL,
  output_per_m REAL NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, price_source TEXT, updated_at REAL NOT NULL
);
"""

MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN mfa_at REAL",
    "ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN unlimited INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE users ADD COLUMN firebase_uid TEXT",
    "ALTER TABLE users ADD COLUMN last_seen REAL",
    # Intelligence Gateway: what produced each message (additive, nullable)
    "ALTER TABLE messages ADD COLUMN provider TEXT",
    "ALTER TABLE messages ADD COLUMN model TEXT",
    "ALTER TABLE messages ADD COLUMN status TEXT",
    "ALTER TABLE conversations ADD COLUMN personality_id TEXT",
]

_local = threading.local()
_init_lock = threading.Lock()
_initialized: set[str] = set()


def _connect() -> sqlite3.Connection:
    path = str(get_settings().db_path)
    conn = getattr(_local, "conn", None)
    if conn is not None and getattr(_local, "path", None) == path:
        return conn
    conn = sqlite3.connect(path, timeout=30, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    _local.conn, _local.path = conn, path
    with _init_lock:
        if path not in _initialized:
            conn.executescript(SCHEMA)
            for m in MIGRATIONS:   # additive only: ALTER TABLE <t> ADD COLUMN <c>
                table = m.split("ALTER TABLE ")[1].split()[0]
                col = m.split("ADD COLUMN ")[1].split()[0]
                if col not in {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}:
                    conn.execute(m)
            _initialized.add(path)
    return conn


def reset_connection_cache() -> None:
    _local.__dict__.clear()
    _initialized.clear()


@contextmanager
def tx() -> Iterator[sqlite3.Connection]:
    conn = _connect()
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise


def q(sql: str, params: tuple | dict = ()) -> list[dict[str, Any]]:
    return [dict(r) for r in _connect().execute(sql, params).fetchall()]


def q1(sql: str, params: tuple | dict = ()) -> dict[str, Any] | None:
    r = _connect().execute(sql, params).fetchone()
    return dict(r) if r else None


def run(sql: str, params: tuple | dict = ()) -> int:
    with tx() as c:
        return c.execute(sql, params).rowcount


def insert(table: str, row: dict[str, Any]) -> None:
    cols = ",".join(row)
    marks = ",".join("?" for _ in row)
    vals = tuple(dumps(v) if isinstance(v, (dict, list)) else v for v in row.values())
    with tx() as c:
        c.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", vals)


def update(table: str, key: str, key_val: Any, **fields: Any) -> None:
    sets = ",".join(f"{k}=?" for k in fields)
    vals = tuple(dumps(v) if isinstance(v, (dict, list)) else v for v in fields.values())
    with tx() as c:
        c.execute(f"UPDATE {table} SET {sets} WHERE {key}=?", vals + (key_val,))


def dumps(v: Any) -> str:
    return json.dumps(v, default=str)


def loads(v: str | None, default: Any = None) -> Any:
    if v is None or v == "":
        return default
    try:
        return json.loads(v)
    except (TypeError, ValueError):
        return default


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def now() -> float:
    return time.time()


def kv_get(key: str, default: Any = None) -> Any:
    r = q1("SELECT value FROM kv WHERE key=?", (key,))
    return loads(r["value"], default) if r else default


def kv_set(key: str, value: Any) -> None:
    with tx() as c:
        c.execute("INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                  (key, dumps(value)))


def audit(actor_type: str, actor_id: str | None, action: str, target: str | None = None,
          detail: dict | None = None, ip: str | None = None) -> None:
    """Append-only audit trail. There is no API that deletes or edits rows."""
    insert("audit_log", {"ts": now(), "actor_type": actor_type, "actor_id": actor_id, "action": action,
                         "target": target, "detail": dumps(detail or {}), "ip": ip})
