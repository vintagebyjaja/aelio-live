"""Central API gateway and application registry for the Grooveville ecosystem.

Each app gets its own key (stored hashed), scopes, daily quota and audit
history. App keys can only reach /v1/* gateway routes. They can never reach
studio, training, code execution, secrets or deployment routes.
"""
from __future__ import annotations

import time

from . import db
from .security import hash_key, new_api_key

SCOPES = {"voices:read", "voices:synthesize", "models:read", "models:infer", "status:read"}
ECOSYSTEM = ["Grooveville", "Groove Guide", "DrawUp", "VYBR8", "PATHD", "Shadow Crown", "Grooveville Entertainment",
             "Grooveville Music", "Grooveville TV", "Grooveville Live"]


def register_app(name: str, slug: str, scopes: list[str], quota_per_day: int = 1000) -> tuple[dict, str]:
    bad = set(scopes) - SCOPES
    if bad:
        raise ValueError(f"unknown scopes {bad}")
    raw, h, prefix = new_api_key()
    aid = db.new_id("app")
    row = {"id": aid, "name": name, "slug": slug, "key_hash": h, "key_prefix": prefix, "scopes": db.dumps(sorted(scopes)),
           "quota_per_day": quota_per_day, "active": 1, "created_at": db.now()}
    db.insert("apps", row)
    db.audit("founder", None, "app.registered", aid, {"slug": slug, "scopes": scopes})
    return row, raw  # raw key shown once


def authenticate(raw: str | None) -> dict | None:
    if not raw:
        return None
    a = db.q1("SELECT * FROM apps WHERE key_hash=? AND active=1", (hash_key(raw),))
    if a:
        a["scopes"] = db.loads(a["scopes"], [])
    return a


def within_quota(app: dict) -> bool:
    since = time.time() - 86400
    n = db.q1("SELECT COUNT(*) n FROM api_usage WHERE app_id=? AND ts>?", (app["id"], since))["n"]
    return n < app["quota_per_day"]


def record(app_id: str | None, route: str, status: int, latency_ms: float) -> None:
    db.insert("api_usage", {"app_id": app_id, "ts": db.now(), "route": route, "status": status,
                            "latency_ms": round(latency_ms, 2)})


def list_apps() -> list[dict]:
    rows = db.q("SELECT id,name,slug,key_prefix,scopes,quota_per_day,active,created_at FROM apps ORDER BY created_at")
    for r in rows:
        r["scopes"] = db.loads(r["scopes"], [])
        r["requests_24h"] = db.q1("SELECT COUNT(*) n FROM api_usage WHERE app_id=? AND ts>?",
                                  (r["id"], time.time() - 86400))["n"]
    return rows
