"""Model providers behind the AELIO Intelligence Gateway.

- OpenAIResponses: OpenAI's Responses API (POST /v1/responses, server-sent events).
  Uses only the Python standard library. The API key is read on the server from
  OPENAI_API_KEY (environment) or the encrypted-at-rest secrets store, and is
  never logged, returned, or sent anywhere except api.openai.com (or the
  OPENAI_BASE_URL the founder configures, e.g. a Cloudflare AI Gateway URL).
  `store: false` keeps conversation state in AELIO's database, not OpenAI's.
- AelioNative: AELIO's own models. Only checkpoints that have passed the
  founder-approved product gate may serve; everything else is refused.
- TestProvider: deterministic, offline, clearly labelled. Only available when
  AELIO_ALLOW_TEST_PROVIDER=1 (tests and local development). Never real AI.
"""
from __future__ import annotations

import hashlib
import http.client
import json
import os
import socket
import ssl
import time
from typing import Iterator
from urllib.parse import urlparse

from .contracts import Done, Event, GenRequest, ProviderError, TextDelta, ToolCall, Usage


class Provider:
    name = "base"
    external = False          # True = user content leaves AELIO infrastructure

    def configured(self) -> bool:
        raise NotImplementedError

    def stream(self, req: GenRequest, model: str) -> Iterator[Event]:
        raise NotImplementedError


# ================================================================== OpenAI
def _openai_key() -> str | None:
    k = os.environ.get("OPENAI_API_KEY")
    if k:
        return k.strip()
    try:
        from ..security import get_secret
        return (get_secret("OPENAI_API_KEY") or "").strip() or None
    except Exception:
        return None


def safety_id(user_id: str | None) -> str | None:
    """Stable, non-reversible user identifier for the provider's abuse monitoring (no email, no uid)."""
    if not user_id:
        return None
    salt = os.environ.get("AELIO_SAFETY_ID_SALT", "aelio")
    return "aelio_" + hashlib.sha256(f"{salt}:{user_id}".encode()).hexdigest()[:32]


class OpenAIResponses(Provider):
    name = "openai"
    external = True

    def __init__(self) -> None:
        self.base = urlparse(os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"))
        self.timeout = float(os.environ.get("AELIO_OPENAI_TIMEOUT_S", "60"))
        self.max_retries = int(os.environ.get("AELIO_OPENAI_RETRIES", "2"))

    def configured(self) -> bool:
        return bool(_openai_key())

    def build_body(self, req: GenRequest, model: str) -> dict:
        body: dict = {
            "model": model,
            "instructions": req.instructions,
            "input": [{"role": m.role, "content": m.content} for m in req.messages],
            "stream": True,
            "store": False,
            "max_output_tokens": int(req.max_output_tokens),
        }
        sid = safety_id(req.user_id)
        if sid:
            body["safety_identifier"] = sid
        if req.tools:
            body["tools"] = [{"type": "function", "name": t.name, "description": t.description,
                              "parameters": t.parameters, "strict": True} for t in req.tools]
        if req.json_schema:
            body["text"] = {"format": {"type": "json_schema", "name": req.json_schema["name"],
                                       "schema": req.json_schema["schema"], "strict": True}}
        return body

    def _headers(self, key: str) -> dict:
        h = {"Authorization": f"Bearer {key}", "Content-Type": "application/json", "Accept": "text/event-stream"}
        if os.environ.get("OPENAI_ORG_ID"):
            h["OpenAI-Organization"] = os.environ["OPENAI_ORG_ID"]
        if os.environ.get("OPENAI_PROJECT_ID"):
            h["OpenAI-Project"] = os.environ["OPENAI_PROJECT_ID"]
        return h

    def _open(self, payload: bytes, key: str):
        host, port = self.base.hostname, self.base.port
        if self.base.scheme == "https":
            conn = http.client.HTTPSConnection(host, port or 443, timeout=self.timeout, context=ssl.create_default_context())
        else:   # only for a local test double; production uses https
            conn = http.client.HTTPConnection(host, port or 80, timeout=self.timeout)
        conn.request("POST", self.base.path.rstrip("/") + "/responses", body=payload, headers=self._headers(key))
        return conn, conn.getresponse()

    def stream(self, req: GenRequest, model: str) -> Iterator[Event]:
        key = _openai_key()
        if not key:
            raise ProviderError("not_configured", "OpenAI isn't connected yet. Add OPENAI_API_KEY on the engine server.", status=503)
        payload = json.dumps(self.build_body(req, model)).encode()
        attempt = 0
        while True:
            try:
                conn, resp = self._open(payload, key)
            except (socket.timeout, TimeoutError):
                err = ProviderError("timeout", "The AI provider didn't respond in time.", retryable=True, status=504)
            except OSError as e:
                err = ProviderError("unavailable", f"Couldn't reach the AI provider ({type(e).__name__}).", retryable=True, status=502)
            else:
                if resp.status == 200:
                    break
                raw = resp.read(4096).decode("utf-8", "replace")
                conn.close()
                err = _http_error(resp.status, raw, resp.getheader("retry-after"))
            # Retry only before any output has been produced, so a user never sees duplicated text.
            if not err.retryable or attempt >= self.max_retries:
                raise err
            attempt += 1
            time.sleep(min(8.0, 0.5 * 2 ** attempt))
        try:
            yield from parse_sse(resp, model)
        except (socket.timeout, TimeoutError):
            raise ProviderError("timeout", "The AI provider stopped responding mid-reply.", status=504)
        finally:
            conn.close()


def _http_error(status: int, raw: str, retry_after: str | None) -> ProviderError:
    try:
        msg = json.loads(raw).get("error", {}).get("message") or raw[:200]
    except Exception:
        msg = raw[:200]
    # Never echo anything that could contain a key fragment.
    msg = msg.replace("sk-", "sk-…")
    if status == 401 or status == 403:
        return ProviderError("auth", "The AI provider rejected AELIO's credentials.", status=502)
    if status == 429:
        return ProviderError("rate_limited", "The AI provider is rate-limiting AELIO right now.", retryable=True, status=503)
    if status >= 500:
        return ProviderError("unavailable", "The AI provider had an error.", retryable=True, status=502)
    return ProviderError("bad_request", f"The AI provider refused the request: {msg}", status=502)


def parse_sse(resp, model: str) -> Iterator[Event]:
    """Translate Responses API server-sent events into AELIO events."""
    data_lines: list[str] = []
    finished = False
    for raw in resp:
        line = raw.decode("utf-8", "replace").rstrip("\r\n")
        if line.startswith("data:"):
            data_lines.append(line[5:].lstrip())
            continue
        if line != "" or not data_lines:
            continue
        data = "\n".join(data_lines)
        data_lines = []
        if data == "[DONE]":
            break
        try:
            ev = json.loads(data)
        except json.JSONDecodeError:
            continue
        t = ev.get("type", "")
        if t == "response.output_text.delta":
            yield TextDelta(ev.get("delta", ""))
        elif t == "response.output_item.done" and (ev.get("item") or {}).get("type") == "function_call":
            it = ev["item"]
            yield ToolCall(it.get("call_id") or it.get("id", ""), it.get("name", ""), it.get("arguments", "{}"))
        elif t in ("response.completed", "response.incomplete"):
            r = ev.get("response") or {}
            u = r.get("usage") or {}
            reason = "stop"
            if t == "response.incomplete":
                reason = {"max_output_tokens": "length", "content_filter": "content_filter"}.get(
                    (r.get("incomplete_details") or {}).get("reason"), "length")
            yield Done(Usage(input_tokens=int(u.get("input_tokens") or 0),
                             cached_tokens=int((u.get("input_tokens_details") or {}).get("cached_tokens") or 0),
                             output_tokens=int(u.get("output_tokens") or 0),
                             reasoning_tokens=int((u.get("output_tokens_details") or {}).get("reasoning_tokens") or 0)),
                       provider="openai", model=r.get("model") or model, finish_reason=reason)
            finished = True
            break
        elif t == "response.failed":
            e = ((ev.get("response") or {}).get("error") or {})
            raise ProviderError("failed", e.get("message") or "The AI provider couldn't finish this reply.")
        elif t == "error":
            raise ProviderError("failed", ev.get("message") or "The AI provider reported an error.",
                                retryable=False)
    if not finished:
        raise ProviderError("failed", "The reply stream ended early.")


# ================================================================== AELIO Native
class AelioNative(Provider):
    """AELIO's own models. Serves only checkpoints with status 'product_approved'.

    Today no checkpoint can have that status: it requires a passed product-gate
    report plus founder approval (see aelio/intelligence/routing.py). Research
    use of unapproved checkpoints happens in Studio Brain's Native Lab, not here.
    """
    name = "aelio-native"
    external = False

    def configured(self) -> bool:
        from .. import db
        return bool(db.q1("SELECT id FROM checkpoints WHERE status='product_approved' LIMIT 1"))

    def stream(self, req: GenRequest, model: str) -> Iterator[Event]:
        from .. import db
        ck = db.q1("SELECT * FROM checkpoints WHERE id=? AND status='product_approved'", (model,))
        if not ck:
            raise ProviderError("not_eligible", "This AELIO Native model hasn't passed the product gate, so it can't serve users.",
                                status=503)
        runtime = (db.loads(ck.get("metrics"), {}) or {}).get("runtime", "numpy-v1")
        if runtime != "numpy-v1":
            raise ProviderError("unavailable", f"Native runtime {runtime} isn't connected to the gateway yet.", status=503)
        from ..native.train import infer
        t0 = time.time()
        prompt = (req.messages[-1].content if req.messages else "")[:600]
        r = infer(ck["id"], prompt, max_new=min(200, req.max_output_tokens), temperature=0.8, seed=int(t0) % 1000)
        text = r["completion"].strip()
        yield TextDelta(text)
        yield Done(Usage(input_tokens=len(prompt) // 4, output_tokens=max(1, len(text) // 4)), provider=self.name, model=ck["id"])


# ================================================================== Test provider
class TestProvider(Provider):
    """Offline, deterministic stand-in used by automated tests and local UI work. Not AI."""
    name = "test"
    external = False

    def configured(self) -> bool:
        return os.environ.get("AELIO_ALLOW_TEST_PROVIDER") == "1"

    def stream(self, req: GenRequest, model: str) -> Iterator[Event]:
        if not self.configured():
            raise ProviderError("not_configured", "The test provider is disabled.", status=503)
        last = req.messages[-1].content if req.messages else ""
        if last.startswith("!fail-before"):
            raise ProviderError("unavailable", "Simulated provider outage (test).", retryable=True)
        if req.json_schema and req.json_schema.get("name") == "code_change":
            import re
            m = re.search(r"=== (.+?) ===\n(.*?)\n=== end ", last, re.S)
            path, old = (m.group(1), m.group(2)) if m else ("NOTES.md", "")
            if "!escape" in last:
                path = "../outside.txt"
            if "!secret" in last:
                path = ".env"
            body = json.dumps({"summary": "[test provider, not AI] appended a marker line",
                               "changes": [{"path": path, "content": old + "\n// edited by AELIO test provider\n", "reason": "test"}]})
            yield TextDelta(body)
            yield Done(Usage(input_tokens=len(last) // 4, output_tokens=len(body) // 4), provider=self.name, model=model)
            return
        words = f"[test provider, not AI] You said: {last[:200]}".split(" ")
        for i, w in enumerate(words):
            if last.startswith("!fail-midway") and i == 3:
                raise ProviderError("failed", "Simulated mid-stream failure (test).")
            yield TextDelta(w + (" " if i < len(words) - 1 else ""))
        if req.tools and last.startswith("!tool"):
            yield ToolCall("call_test", req.tools[0].name, "{}")
        n_in = sum(len(m.content) for m in req.messages) // 4 + len(req.instructions) // 4
        yield Done(Usage(input_tokens=n_in, output_tokens=len(words) * 2), provider=self.name, model=model)


PROVIDERS: dict[str, Provider] = {}


def get(name: str) -> Provider:
    if not PROVIDERS:
        PROVIDERS.update({"openai": OpenAIResponses(), "aelio-native": AelioNative(), "test": TestProvider()})
    if name not in PROVIDERS:
        raise ProviderError("not_configured", f"Unknown provider {name}", status=400)
    if name == "openai":   # re-read settings (base URL, timeouts) each time
        PROVIDERS["openai"] = OpenAIResponses()
    return PROVIDERS[name]
