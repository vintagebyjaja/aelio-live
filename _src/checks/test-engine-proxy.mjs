// Tests for the same-origin engine proxy (the code Cloudflare Pages runs for aelio.live/api/*).
// Run: node --test _src/checks/test-engine-proxy.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { proxyToEngine } from "../edge/engine-proxy.js";

function origin(handler) {
  return new Promise((ok) => {
    const seen = [];
    const srv = createServer(async (req, res) => {
      let body = ""; for await (const c of req) body += c;
      seen.push({ method: req.method, url: req.url, headers: req.headers, body });
      handler(req, res);
    }).listen(0, () => ok({ url: `http://127.0.0.1:${srv.address().port}`, seen, close: () => srv.close() }));
  });
}
const call = (path, init = {}, env = {}) => proxyToEngine({ request: new Request("https://aelio.live" + path, init), env });

test("no engine configured: 503 engine_not_connected, site keeps working", async () => {
  const r = await call("/api/me");
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, "engine_not_connected");
});

test("only /api/ and /webhooks/ are forwarded", async () => {
  const o = await origin((q, s) => s.end("x"));
  const r = await call("/engine/README.md", {}, { AELIO_ENGINE_ORIGIN: o.url });
  assert.equal(r.status, 404);
  // product API (/v1, app keys) and public model list are never reachable from the public site
  for (const p of ["/v1/core/respond", "/v1/status", "/public/v1/models", "/apix/", "/api"]) {
    assert.equal((await call(p, { method: "POST" }, { AELIO_ENGINE_ORIGIN: o.url })).status, 404, p);
  }
  assert.equal(o.seen.length, 0); o.close();
});

test("forwards method, body, auth; strips spoofable headers; adds secret and client IP", async () => {
  const o = await origin((q, s) => { s.writeHead(201, { "content-type": "application/json", "set-cookie": "a=b" }); s.end('{"ok":true}'); });
  const r = await call("/api/my/settings?x=1", {
    method: "PUT", body: '{"a":1}',
    headers: { authorization: "Bearer tok", "content-type": "application/json", "cf-connecting-ip": "203.0.113.5",
               "x-aelio-proxy-secret": "attacker", "x-aelio-client-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9", cookie: "session=s" },
  }, { AELIO_ENGINE_ORIGIN: o.url, AELIO_PROXY_SECRET: "real-secret" });
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(r.headers.get("set-cookie"), null);
  const h = o.seen[0].headers;
  assert.equal(o.seen[0].method, "PUT"); assert.equal(o.seen[0].url, "/api/my/settings?x=1"); assert.equal(o.seen[0].body, '{"a":1}');
  assert.equal(h.authorization, "Bearer tok");
  assert.equal(h["x-aelio-proxy-secret"], "real-secret");
  assert.equal(h["x-aelio-client-ip"], "203.0.113.5");
  assert.equal(h["x-forwarded-for"], undefined); assert.equal(h.cookie, undefined);
  assert.equal(h["x-forwarded-host"], "aelio.live");
  o.close();
});

test("streams server-sent events through without buffering", async () => {
  const o = await origin((q, s) => {
    s.writeHead(200, { "content-type": "text/event-stream" });
    s.write("data: one\n\n"); setTimeout(() => { s.write("data: two\n\n"); s.end(); }, 150);
  });
  const r = await call("/api/my/agents/a/chat/stream", { method: "POST", body: "{}" }, { AELIO_ENGINE_ORIGIN: o.url });
  const reader = r.body.getReader(); const t0 = Date.now();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /data: one/); assert.ok(Date.now() - t0 < 120, "first event arrived before the stream finished");
  let rest = ""; for (;;) { const { value, done } = await reader.read(); if (done) break; rest += new TextDecoder().decode(value); }
  assert.match(rest, /data: two/); o.close();
});

test("binding mode uses env.AELIO_ENGINE.fetch with an internal URL", async () => {
  let got;
  const env = { AELIO_ENGINE: { fetch: async (req) => { got = req; return new Response("ok", { status: 200 }); } }, AELIO_PROXY_SECRET: "s" };
  const r = await call("/api/health", {}, env);
  assert.equal(r.status, 200);
  assert.equal(new URL(got.url).host, "aelio-engine.internal");
  assert.equal(got.headers.get("x-aelio-proxy-secret"), "s");
});

test("engine down: 502 engine_unreachable", async () => {
  const r = await call("/api/me", {}, { AELIO_ENGINE_ORIGIN: "http://127.0.0.1:9" });
  assert.equal(r.status, 502); assert.equal((await r.json()).code, "engine_unreachable");
});
