"""AELIO Intelligence Gateway: the only path from AELIO features to a model.

    feature -> gateway.run(req, caller) -> provider (OpenAI | AELIO Native | test)

For every request the gateway, in order:
  1. refuses if the founder paused AI, the global or per-account daily spend cap is hit,
     or the user is over their rate / concurrency limit;
  2. routes to a provider + model from founder settings (product code never names a model);
  3. requires the user's consent before sending content to an external provider;
  4. reserves a worst-case credit estimate in the wallet (atomic; can't overspend);
  5. streams the reply, retrying or falling back only before any text was produced;
  6. settles the real cost (never more than reserved), or releases it on failure;
  7. records tokens, cost, latency and errors in ai_requests (never message content).
"""
from __future__ import annotations

import threading
import time
import uuid
from collections import defaultdict, deque
from typing import Iterator

from .. import db, usage
from . import providers, settings
from .contracts import Done, GenRequest, ProviderError, TextDelta, ToolCall


class GatewayRefused(Exception):
    def __init__(self, code: str, message: str, status: int = 429, **info):
        super().__init__(message)
        self.code, self.message, self.status, self.info = code, message, status, info


# ---------------------------------------------------------------- per-user limits (single engine process)
_lock = threading.Lock()
_inflight: dict[str, int] = defaultdict(int)
_recent: dict[str, deque] = defaultdict(deque)


def _acquire(uid: str, s: dict) -> None:
    now = time.time()
    with _lock:
        q = _recent[uid]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= int(s["user_requests_per_minute"]):
            raise GatewayRefused("rate_limited", "You're sending messages too quickly. Try again in a minute.", 429)
        if _inflight[uid] >= int(s["user_concurrency"]):
            raise GatewayRefused("too_many_active", "Another reply is still being written. Wait for it to finish.", 429)
        q.append(now)
        _inflight[uid] += 1


def _release_slot(uid: str) -> None:
    with _lock:
        _inflight[uid] = max(0, _inflight[uid] - 1)


def reset_limits() -> None:      # tests
    with _lock:
        _inflight.clear(); _recent.clear()


def _day_start() -> float:
    t = time.gmtime()
    return time.mktime((t.tm_year, t.tm_mon, t.tm_mday, 0, 0, 0, 0, 0, 0)) - time.timezone


def spend_today(user_id: str | None = None) -> float:
    if user_id:
        r = db.q1("SELECT COALESCE(SUM(cost_usd),0) c FROM ai_requests WHERE ts>=? AND user_id=?", (_day_start(), user_id))
    else:
        r = db.q1("SELECT COALESCE(SUM(cost_usd),0) c FROM ai_requests WHERE ts>=?", (_day_start(),))
    return float(r["c"])


def consent_given(uid: str) -> bool:
    r = db.q1("SELECT external_ai_consent_at FROM user_settings WHERE user_id=?", (uid,))
    return bool(r and r["external_ai_consent_at"])


# ---------------------------------------------------------------- run
def run(req: GenRequest, caller: dict) -> Iterator[dict]:
    """Yields JSON-able events: meta, delta, tool_call, done | error. Always ends with done or error."""
    s = settings.get()
    uid = caller.get("user_id")
    role = caller.get("role")
    if s["paused"]:
        raise GatewayRefused("paused", "AELIO's AI features are paused by the founder right now. Nothing was charged.", 503)
    last = req.messages[-1].content if req.messages else ""
    route = settings.choose(req.purpose, last, role, uid, s)
    prov = providers.get(route["provider"])
    if not prov.configured():
        raise GatewayRefused("not_configured", f"The {route['provider']} provider isn't connected yet. Nothing was charged.", 503)
    if prov.external and uid and not consent_given(uid):
        raise GatewayRefused("consent_required", "Before AELIO sends your messages to OpenAI, please review and accept the AI disclosure.",
                             403, provider=route["provider"])
    if spend_today() >= s["global_daily_usd_cap"]:
        raise GatewayRefused("spend_cap", "AELIO reached today's AI spending cap. Nothing was charged.", 503)
    u = usage.user(uid) if uid else None
    exempt = bool(u and usage.exempt(u))
    if exempt and spend_today(uid) >= s["exempt_daily_usd_cap"]:
        raise GatewayRefused("exempt_cap", "This account reached its daily AI safety cap (founder protection). It resets at midnight UTC.", 402)
    if uid:
        _acquire(uid, s)
    rsv = None
    rid = db.new_id("air")
    t0 = time.time()
    record = {"id": rid, "ts": t0, "user_id": uid, "purpose": req.purpose, "tier": route["tier"], "provider": route["provider"],
              "model": route["model"], "status": "running", "conversation_id": req.conversation_id, "exempt": int(exempt)}
    try:
        cap = s["max_output_tokens"].get(route["tier"], 1200) if route["tier"] != "native" else 400
        req.max_output_tokens = min(req.max_output_tokens, cap) if req.max_output_tokens else cap
        est_in = (len(req.instructions) + sum(len(m.content) for m in req.messages)) // 3 + 50
        est_usd = settings.cost_usd(route["model"], est_in, req.max_output_tokens)
        est_credits = settings.credits_for(est_usd, s)
        if uid:
            op = "code_task" if req.purpose == "code" else "chat_message"
            rsv = usage.reserve(uid, op, estimate=est_credits)
            record["reservation_id"] = rsv["id"]
        db.insert("ai_requests", record)
        yield {"type": "meta", "request_id": rid, "provider": route["provider"], "model": route["model"], "tier": route["tier"],
               "external": prov.external, "estimate_credits": est_credits}
        yield from _stream(req, route, prov, s, rid, rsv, t0, exempt)
    except usage.UsageError:
        raise
    finally:
        if uid:
            _release_slot(uid)


def _stream(req, route, prov, s, rid, rsv, t0, exempt) -> Iterator[dict]:
    produced: list[str] = []
    ttft = None
    model = route["model"]
    attempts = [route]
    if route["tier"] == "advanced" and s["fallback_to_standard"]:
        attempts.append({**s["tiers"]["standard"], "tier": "standard"})
    done = None
    err: ProviderError | None = None
    try:
        for i, rt in enumerate(attempts):
            p = providers.get(rt["provider"])
            model = rt["model"]
            try:
                for ev in p.stream(req, model):
                    if isinstance(ev, TextDelta):
                        if ttft is None:
                            ttft = int((time.time() - t0) * 1000)
                        produced.append(ev.text)
                        yield {"type": "delta", "text": ev.text}
                    elif isinstance(ev, ToolCall):
                        yield {"type": "tool_call", "call_id": ev.call_id, "name": ev.name, "arguments": ev.arguments}
                    elif isinstance(ev, Done):
                        done = ev
                err = None
                break
            except ProviderError as e:
                err = e
                if produced or i == len(attempts) - 1:
                    break
                db.update("ai_requests", "id", rid, model=attempts[i + 1]["model"], tier=attempts[i + 1]["tier"])
                yield {"type": "notice", "text": "The advanced model was unavailable, so a standard model is answering."}
    except GeneratorExit:
        # The client went away mid-reply. The provider still produced tokens; charge for what was delivered.
        out_tok = max(1, sum(len(t) for t in produced) // 4)
        in_tok = (len(req.instructions) + sum(len(m.content) for m in req.messages)) // 4
        _finish(rid, rsv, "cancelled", model, in_tok, 0, out_tok, t0, ttft, s, "client_disconnected")
        raise
    if err is not None or done is None:
        e = err or ProviderError("failed", "The reply ended without completing.")
        _finish(rid, rsv, "error", model, 0, 0, 0, t0, ttft, s, e.code, charge=False)
        yield {"type": "error", "code": e.code, "message": e.message, "partial": bool(produced),
               "credits_charged": 0, "note": "Failed replies are never charged."}
        return
    u = done.usage
    usd, credits = _finish(rid, rsv, "ok", done.model or model, u.input_tokens, u.cached_tokens, u.output_tokens, t0, ttft, s)
    yield {"type": "done", "request_id": rid, "provider": done.provider, "model": done.model, "finish_reason": done.finish_reason,
           "usage": {"input_tokens": u.input_tokens, "cached_tokens": u.cached_tokens, "output_tokens": u.output_tokens},
           "cost_usd": usd, "credits_charged": 0 if exempt else credits, "exempt": exempt}


def _finish(rid, rsv, status, model, in_tok, cached, out_tok, t0, ttft, s, error_code=None, charge=True):
    usd = settings.cost_usd(model, in_tok, out_tok, cached) if (in_tok or out_tok) else 0.0
    credits = settings.credits_for(usd, s) if (in_tok or out_tok) else 0
    charged = 0
    if rsv:
        if charge and status in ("ok", "cancelled"):
            charged = usage.settle(rsv["id"], credits)["charged"]
        else:
            usage.release(rsv["id"])
    db.update("ai_requests", "id", rid, status=status, error_code=error_code, model=model, input_tokens=in_tok,
              cached_tokens=cached, output_tokens=out_tok, cost_usd=usd, credits=charged,
              latency_ms=int((time.time() - t0) * 1000), ttft_ms=ttft)
    return usd, charged


def collect(req: GenRequest, caller: dict) -> dict:
    """Non-streaming helper: runs the stream and returns the final text and done/error event."""
    text, final, meta = [], None, None
    for ev in run(req, caller):
        if ev["type"] == "delta":
            text.append(ev["text"])
        elif ev["type"] == "meta":
            meta = ev
        elif ev["type"] in ("done", "error"):
            final = ev
    return {"text": "".join(text), "final": final, "meta": meta}


def new_request_id() -> str:
    return uuid.uuid4().hex
