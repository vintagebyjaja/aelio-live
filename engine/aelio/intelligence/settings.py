"""Founder-controlled gateway settings, model prices and routing.

Settings live in the `kv` table (key `intelligence_settings`); every change is
audited. Model identifiers are configuration, never hard-coded in product code.
"""
from __future__ import annotations

import copy
import hashlib
import math
import os

from .. import db

PRICE_SOURCE = ("OpenAI rate card as surveyed by ActuIA on 2026-10-06 and cross-checked with "
                "anotherwrapper.com / pricepertoken.com. Confirm on OpenAI's pricing page before launch.")
# USD per 1M tokens: input, cached input, output
DEFAULT_MODELS = [
    ("gpt-6-luna", "openai", "GPT-6 Luna (everyday chat)", 0.10, 0.01, 0.50, 1),
    ("gpt-6.1-sol", "openai", "GPT-6.1 Sol (complex work, coding)", 2.00, 0.10, 10.00, 1),
    ("gpt-6-astra", "openai", "GPT-6 Astra (highest cost; off by default)", 10.00, 1.00, 50.00, 0),
    ("test-echo", "test", "Test provider (not AI; tests only)", 0.0, 0.0, 0.0, 1),
]


def defaults() -> dict:
    return {
        "paused": False,                       # founder kill switch: refuses every model request
        "tiers": {
            "standard": {"provider": os.environ.get("AELIO_PROVIDER_STANDARD", "openai"),
                         "model": os.environ.get("AELIO_MODEL_STANDARD", "gpt-6-luna")},
            "advanced": {"provider": os.environ.get("AELIO_PROVIDER_ADVANCED", "openai"),
                         "model": os.environ.get("AELIO_MODEL_ADVANCED", "gpt-6.1-sol")},
        },
        "advanced_purposes": ["code"],         # these purposes always use the advanced tier
        "advanced_min_chars": 2500,            # long or code-heavy chat messages also go advanced
        "fallback_to_standard": True,          # advanced fails before any output -> retry once on standard
        "max_output_tokens": {"standard": 1200, "advanced": 4000},
        "history_messages": 20,
        "usd_per_credit": 0.01,                # 1 credit covers up to $0.01 of provider cost
        "min_credits": 1,
        "user_requests_per_minute": 12,
        "user_concurrency": 2,
        "exempt_daily_usd_cap": 5.00,          # founder / unlimited accounts: hard safety cap per account per day
        "global_daily_usd_cap": 25.00,         # all accounts together, per day
        "native": {"stage": "off", "model": None, "percent": 0},   # off | founder | percent
    }


def _merge(base: dict, over: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def get() -> dict:
    return _merge(defaults(), db.kv_get("intelligence_settings", {}) or {})


ALLOWED_KEYS = set(defaults().keys())


def update(changes: dict, actor: str) -> dict:
    bad = set(changes) - ALLOWED_KEYS
    if bad:
        raise ValueError(f"unknown settings: {sorted(bad)}")
    cur = db.kv_get("intelligence_settings", {}) or {}
    new = _merge(cur, changes)
    merged = _merge(defaults(), new)
    validate(merged)
    db.kv_set("intelligence_settings", new)
    db.audit("founder", actor, "intelligence.settings", None, {"changes": changes})
    return merged


def validate(s: dict) -> None:
    for tier in ("standard", "advanced"):
        t = s["tiers"][tier]
        if t["provider"] not in ("openai", "aelio-native", "test"):
            raise ValueError(f"unknown provider {t['provider']}")
        if t["provider"] == "aelio-native":
            raise ValueError("AELIO Native can't be a default tier. Use the staged Native rollout, which requires a product-approved model.")
        m = db.q1("SELECT enabled FROM ai_models WHERE id=?", (t["model"],))
        if not m or not m["enabled"]:
            raise ValueError(f"model {t['model']} isn't in the enabled price list")
    for k in ("usd_per_credit", "exempt_daily_usd_cap", "global_daily_usd_cap"):
        if not (isinstance(s[k], (int, float)) and s[k] > 0):
            raise ValueError(f"{k} must be a positive number")
    n = s["native"]
    if n["stage"] not in ("off", "founder", "percent"):
        raise ValueError("native.stage must be off, founder or percent")
    if n["stage"] != "off":
        if not n.get("model") or not db.q1("SELECT id FROM checkpoints WHERE id=? AND status='product_approved'", (n["model"],)):
            raise ValueError("Native rollout needs a checkpoint that has passed the product gate (status product_approved).")
        if not (0 <= int(n.get("percent", 0)) <= 100):
            raise ValueError("native.percent must be 0-100")


# ---------------------------------------------------------------- prices
def seed_models() -> None:
    t = db.now()
    for mid, prov, label, i, c, o, en in DEFAULT_MODELS:
        if not db.q1("SELECT id FROM ai_models WHERE id=?", (mid,)):
            db.insert("ai_models", {"id": mid, "provider": prov, "label": label, "input_per_m": i, "cached_input_per_m": c,
                                    "output_per_m": o, "enabled": en, "price_source": PRICE_SOURCE, "updated_at": t})


def price(model: str) -> dict:
    p = db.q1("SELECT * FROM ai_models WHERE id=?", (model,))
    if p:
        return p
    # Unknown model (e.g. a dated snapshot name returned by the provider): bill at the most expensive enabled rate.
    worst = db.q1("SELECT MAX(input_per_m) i, MAX(cached_input_per_m) c, MAX(output_per_m) o FROM ai_models WHERE enabled=1")
    return {"id": model, "input_per_m": worst["i"] or 0, "cached_input_per_m": worst["c"] or 0, "output_per_m": worst["o"] or 0,
            "unknown": True}


def cost_usd(model: str, input_tokens: int, output_tokens: int, cached_tokens: int = 0) -> float:
    p = price(model)
    cached = min(cached_tokens, input_tokens)
    c = ((input_tokens - cached) * p["input_per_m"] + cached * (p["cached_input_per_m"] or p["input_per_m"])
         + output_tokens * p["output_per_m"]) / 1e6
    return round(c, 6)


def credits_for(usd: float, s: dict) -> int:
    return max(int(s["min_credits"]), math.ceil(usd / s["usd_per_credit"] - 1e-9))


# ---------------------------------------------------------------- routing
def choose(purpose: str, last_message: str, role: str | None, user_id: str | None, s: dict) -> dict:
    """Pick provider + model + tier. Product code never names a model."""
    n = s["native"]
    if n["stage"] == "founder" and role == "founder":
        return {"provider": "aelio-native", "model": n["model"], "tier": "native"}
    if n["stage"] == "percent" and user_id:
        bucket = int(hashlib.sha256(f"native:{user_id}".encode()).hexdigest()[:8], 16) % 100
        if bucket < int(n["percent"]):
            return {"provider": "aelio-native", "model": n["model"], "tier": "native"}
    tier = "advanced" if (purpose in s["advanced_purposes"] or len(last_message) >= s["advanced_min_chars"]
                          or last_message.count("```") >= 2) else "standard"
    return {**s["tiers"][tier], "tier": tier}
