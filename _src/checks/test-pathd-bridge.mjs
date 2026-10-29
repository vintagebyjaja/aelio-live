// Tests for the PATHD -> AELIO Core bridge (runs on mypathd.com).
import { test } from "node:test";
import assert from "node:assert/strict";
import { aelioCore } from "../../integrations/pathd/aelio-core-proxy.js";

function binding() {
  const seen = [];
  return { seen, fetch: async (req) => { seen.push({ url: req.url, method: req.method, headers: Object.fromEntries(req.headers), body: await req.text() });
                                         return new Response('{"output":"hi"}', { status: 200, headers: { "content-type": "application/json", "set-cookie": "x=1" } }); } };
}
const env = (b) => ({ AELIO_ENGINE: b, AELIO_CORE_KEY: "aelio_app_key", AELIO_PROXY_SECRET: "s3cret" });
const call = (path, init, e) => aelioCore({ request: new Request("https://mypathd.com" + path, init), env: e });

test("user token becomes X-AELIO-User-Token; PATHD's key and the proxy secret are added server-side", async () => {
  const b = binding();
  const r = await call("/api/ai/respond", { method: "POST", headers: { authorization: "Bearer user.jwt.tok", "x-aelio-proxy-secret": "spoof",
                       "x-aelio-user-token": "spoof", cookie: "a=b" }, body: '{"input":"hi"}' }, env(b));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("set-cookie"), null);
  const s = b.seen[0];
  assert.equal(s.url, "http://aelio-engine.internal/v1/core/respond");
  assert.equal(s.headers.authorization, "Bearer aelio_app_key");
  assert.equal(s.headers["x-aelio-user-token"], "user.jwt.tok");
  assert.equal(s.headers["x-aelio-proxy-secret"], "s3cret");
  assert.equal(s.headers.cookie, undefined);
  assert.equal(s.body, '{"input":"hi"}');
});

test("only the AI routes and methods are reachable", async () => {
  const b = binding();
  for (const [p, m, st] of [["/api/ai/../../v1/models", "GET", 404], ["/api/ai/status", "GET", 404], ["/api/ai/respond", "GET", 405],
                            ["/api/ai/memories", "POST", 405], ["/api/ai/admin", "POST", 404]]) {
    assert.equal((await call(p, { method: m, headers: { authorization: "Bearer t" } }, env(b))).status, st, p + " " + m);
  }
  assert.equal(b.seen.length, 0);
});

test("signed-out, not connected, too large", async () => {
  const b = binding();
  assert.equal((await call("/api/ai/respond", { method: "POST", body: "{}" }, env(b))).status, 401);
  assert.equal((await call("/api/ai/respond", { method: "POST", headers: { authorization: "Bearer t" }, body: "{}" }, {})).status, 503);
  assert.equal((await call("/api/ai/respond", { method: "POST", headers: { authorization: "Bearer t" }, body: "x".repeat(70000) }, env(b))).status, 413);
  assert.equal(b.seen.length, 0);
});

test("memory delete passes only the id parameter", async () => {
  const b = binding();
  await call("/api/ai/memories?id=mem_1&evil=1", { method: "DELETE", headers: { authorization: "Bearer t" } }, env(b));
  assert.equal(b.seen[0].url, "http://aelio-engine.internal/v1/core/memories?id=mem_1");
});
