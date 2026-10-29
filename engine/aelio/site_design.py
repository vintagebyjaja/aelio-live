"""Web Designer: founder-controlled look of the public site (aelio.live), changed without a redeploy.

The founder edits a DRAFT in Studio Brain -> previews it privately -> PUBLISHES it. The public site reads the
published design from /api/public/site-design and applies it on top of the built pages. Every publish is kept in
history and can be restored.

Only safe, structured settings exist (colours as #hex, bounded numbers, a few named options, and images the founder
uploaded). There is no free-form CSS or HTML, so a design can never inject script or break page structure.
If the engine is unreachable the site simply shows its built-in design.
"""
from __future__ import annotations

import copy
import hashlib
import re
import secrets
import time
from pathlib import Path

from . import db
from .config import get_settings

SECTIONS = {"home": "Home", "aelio": "Meet AELIO", "dream": "Dream Beyond", "tech": "Technology", "create": "Create",
            "values": "Our Values", "campus": "Agent Campus", "live": "AELIO Live", "green": "Green Guardians"}
DEFAULT = {
    "theme": {"gold": "#ffb83e", "copper": "#c9742c", "bg": "#05070b", "text": "#f4f1ea", "radius": 16,
              "heading_scale": 1.0, "button": "rounded"},
    "intro": {"enabled": True},
    "heroes": {k: {"image": None, "focus_x": 50, "focus_y": 50, "shade": 60, "motion": True, "subpages": False} for k in SECTIONS},
}
MAX_ASSET_BYTES = 10 * 1024 * 1024
MAX_ASSETS = 200
PREVIEW_TTL = 30 * 60
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

SCHEMA = """
CREATE TABLE IF NOT EXISTS site_design_history (
  version INTEGER PRIMARY KEY, data TEXT NOT NULL, published_at REAL NOT NULL, actor TEXT NOT NULL, note TEXT
);
CREATE TABLE IF NOT EXISTS site_assets (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
  created_at REAL NOT NULL, actor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS site_preview_tokens (token_hash TEXT PRIMARY KEY, expires_at REAL NOT NULL);
"""


class DesignError(ValueError):
    pass


def _ensure() -> None:
    db._connect().executescript(SCHEMA)


def _dir() -> Path:
    d = get_settings().data_dir / "site_assets"
    d.mkdir(parents=True, exist_ok=True)
    return d


# ------------------------------------------------------------------ validation
def _num(v, lo, hi, name, integer=True):
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise DesignError(f"{name} must be a number")
    if not lo <= x <= hi:
        raise DesignError(f"{name} must be between {lo} and {hi}")
    return int(round(x)) if integer else round(x, 2)


def validate(d: dict) -> dict:
    """Returns a clean, complete design or raises DesignError. Unknown keys are rejected, not ignored."""
    if not isinstance(d, dict):
        raise DesignError("design must be an object")
    extra = set(d) - set(DEFAULT)
    if extra:
        raise DesignError(f"unknown settings: {', '.join(sorted(extra))}")
    out = copy.deepcopy(DEFAULT)
    th = d.get("theme") or {}
    if set(th) - set(DEFAULT["theme"]):
        raise DesignError("unknown theme settings: " + ", ".join(sorted(set(th) - set(DEFAULT["theme"]))))
    for k in ("gold", "copper", "bg", "text"):
        if k in th:
            if not isinstance(th[k], str) or not _HEX.match(th[k]):
                raise DesignError(f"theme.{k} must be a colour like #ffb83e")
            out["theme"][k] = th[k].lower()
    if "radius" in th:
        out["theme"]["radius"] = _num(th["radius"], 0, 32, "theme.radius")
    if "heading_scale" in th:
        out["theme"]["heading_scale"] = _num(th["heading_scale"], 0.7, 1.3, "theme.heading_scale", integer=False)
    if "button" in th:
        if th["button"] not in ("rounded", "pill", "square"):
            raise DesignError("theme.button must be rounded, pill or square")
        out["theme"]["button"] = th["button"]
    it = d.get("intro") or {}
    if "enabled" in it:
        out["intro"]["enabled"] = bool(it["enabled"])
    he = d.get("heroes") or {}
    if set(he) - set(SECTIONS):
        raise DesignError("unknown page sections: " + ", ".join(sorted(set(he) - set(SECTIONS))))
    _ensure()
    for k, h in he.items():
        h = h or {}
        if set(h) - set(DEFAULT["heroes"][k]):
            raise DesignError(f"unknown settings for {k}")
        o = out["heroes"][k]
        if h.get("image"):
            if not isinstance(h["image"], str) or not db.q1("SELECT 1 FROM site_assets WHERE id=?", (h["image"],)):
                raise DesignError(f"{SECTIONS[k]}: image not found (upload it first)")
            o["image"] = h["image"]
        for key in ("focus_x", "focus_y"):
            if key in h:
                o[key] = _num(h[key], 0, 100, f"{k}.{key}")
        if "shade" in h:
            o["shade"] = _num(h["shade"], 0, 95, f"{k}.shade")
        for key in ("motion", "subpages"):
            if key in h:
                o[key] = bool(h[key])
    return out


# ------------------------------------------------------------------ draft / publish / history
def draft() -> dict:
    return db.kv_get("site_design_draft") or published()["design"]


def published() -> dict:
    return db.kv_get("site_design_published") or {"version": 0, "design": copy.deepcopy(DEFAULT), "published_at": None}


def save_draft(d: dict, actor: str) -> dict:
    clean = validate(d)
    db.kv_set("site_design_draft", clean)
    db.audit("founder", actor, "site_design.draft_saved", None, {})
    return clean


def publish(actor: str, note: str | None = None) -> dict:
    _ensure()
    clean = validate(draft())
    v = (db.q1("SELECT MAX(version) v FROM site_design_history")["v"] or 0) + 1
    now = time.time()
    db.insert("site_design_history", {"version": v, "data": db.dumps(clean), "published_at": now, "actor": actor, "note": (note or "")[:200]})
    rec = {"version": v, "design": clean, "published_at": now}
    db.kv_set("site_design_published", rec)
    db.audit("founder", actor, "site_design.published", str(v), {"note": note})
    return rec


def restore(version: int, actor: str) -> dict:
    """Copies an old published version into the draft (publish it to make it live again)."""
    _ensure()
    row = db.q1("SELECT data FROM site_design_history WHERE version=?", (int(version),))
    if not row:
        raise DesignError("no such version")
    d = validate(db.loads(row["data"], {}))
    db.kv_set("site_design_draft", d)
    db.audit("founder", actor, "site_design.restored_to_draft", str(version), {})
    return d


def reset_draft(actor: str) -> dict:
    db.kv_set("site_design_draft", copy.deepcopy(DEFAULT))
    db.audit("founder", actor, "site_design.draft_reset", None, {})
    return copy.deepcopy(DEFAULT)


def history() -> list[dict]:
    _ensure()
    return db.q("SELECT version, published_at, actor, note FROM site_design_history ORDER BY version DESC LIMIT 50")


# ------------------------------------------------------------------ preview links
def preview_token() -> str:
    _ensure()
    tok = secrets.token_urlsafe(24)
    db.run("DELETE FROM site_preview_tokens WHERE expires_at < ?", (time.time(),))
    db.insert("site_preview_tokens", {"token_hash": hashlib.sha256(tok.encode()).hexdigest(), "expires_at": time.time() + PREVIEW_TTL})
    return tok


def preview_valid(tok: str | None) -> bool:
    if not tok:
        return False
    _ensure()
    r = db.q1("SELECT expires_at FROM site_preview_tokens WHERE token_hash=?", (hashlib.sha256(tok.encode()).hexdigest(),))
    return bool(r and r["expires_at"] > time.time())


def public(preview: str | None = None) -> dict:
    if preview_valid(preview):
        return {"version": "draft", "preview": True, "design": draft()}
    p = published()
    return {"version": p["version"], "preview": False, "design": p["design"]}


# ------------------------------------------------------------------ images
def _sniff(data: bytes) -> str | None:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


def add_asset(name: str, data: bytes, actor: str) -> dict:
    _ensure()
    if not data:
        raise DesignError("empty file")
    if len(data) > MAX_ASSET_BYTES:
        raise DesignError("images must be 10 MB or smaller")
    mime = _sniff(data)
    if not mime:
        raise DesignError("only PNG, JPEG or WebP images can be uploaded")
    if db.q1("SELECT COUNT(*) n FROM site_assets")["n"] >= MAX_ASSETS:
        raise DesignError("image library is full; remove unused images first")
    sha = hashlib.sha256(data).hexdigest()
    dup = db.q1("SELECT * FROM site_assets WHERE sha256=?", (sha,))
    if dup:
        return dup
    aid = "img_" + secrets.token_hex(8)
    (_dir() / (aid + EXT[mime])).write_bytes(data)
    row = {"id": aid, "name": re.sub(r"[^\w .()-]", "", str(name))[:80] or "image", "mime": mime, "bytes": len(data),
           "sha256": sha, "created_at": time.time(), "actor": actor}
    db.insert("site_assets", row)
    db.audit("founder", actor, "site_design.image_uploaded", aid, {"bytes": len(data), "mime": mime})
    return row


def assets() -> list[dict]:
    _ensure()
    return db.q("SELECT id, name, mime, bytes, created_at FROM site_assets ORDER BY created_at DESC")


def asset_file(aid: str) -> tuple[Path, str] | None:
    if not re.fullmatch(r"img_[0-9a-f]{16}", aid or ""):
        return None
    _ensure()
    r = db.q1("SELECT mime FROM site_assets WHERE id=?", (aid,))
    if not r:
        return None
    p = _dir() / (aid + EXT[r["mime"]])
    return (p, r["mime"]) if p.exists() else None


def in_use(aid: str) -> list[str]:
    used = []
    for label, d in (("draft", draft()), ("live site", published()["design"])):
        for k, h in d["heroes"].items():
            if h.get("image") == aid:
                used.append(f"{SECTIONS[k]} ({label})")
    return used


def remove_asset(aid: str, actor: str) -> None:
    f = asset_file(aid)
    if not f:
        raise DesignError("no such image")
    used = in_use(aid)
    if used:
        raise DesignError("this image is still used by: " + ", ".join(used))
    f[0].unlink(missing_ok=True)
    db.run("DELETE FROM site_assets WHERE id=?", (aid,))
    db.audit("founder", actor, "site_design.image_removed", aid, {})
