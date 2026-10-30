import { test } from "node:test";
import assert from "node:assert/strict";
import { platform, publicConfig } from "../platform/index.js";
import { appearance } from "../platform/messaging.js";
import { slowHash } from "../platform/recovery.js";
import { validateFile } from "../platform/storage.js";
import worker from "../edge/worker.js";
const req = (path, method = "GET", body) =>
  new Request("https://aelio.test" + path, {
    method,
    headers: {
      origin: "https://aelio.test",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
test("account config is Supabase only and never contains privileged settings", async () => {
  const r = publicConfig({
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "public",
    SUPABASE_SERVICE_ROLE_KEY: "private-secret",
    AELIO_SESSION_SECRET: "private-session",
  });
  const s = await r.text();
  assert.match(s, /supabase/);
  assert.doesNotMatch(s, /private-secret|private-session|firebase/i);
});
test("platform distinguishes missing accounts and missing engine configuration", async () => {
  const r = await platform(req("/api/platform/status"), {});
  const d = await r.json();
  assert.equal(d.accounts, false);
  assert.equal(d.engineBinding, false);
  assert.equal(d.storageBinding, false);
  assert.equal(d.inferenceVerified, false);
});
test("mutations reject cross-origin requests before touching any service", async () => {
  const r = await platform(
    new Request("https://aelio.test/api/platform/agents", {
      method: "POST",
      headers: { origin: "https://evil.test" },
      body: "{}",
    }),
    {},
  );
  assert.equal(r.status, 403);
  assert.equal((await r.json()).code, "origin_denied");
});
test("appearance rejects CSS injection and arbitrary object paths", () => {
  assert.throws(() => appearance({ outgoing: "url(https://evil)" }));
  assert.throws(() => appearance({ file_id: "../../secret" }));
  assert.throws(() => appearance({ blur: Infinity }));
  assert.deepEqual(
    appearance({ incoming: "#123abc", dim: 20, mode: "light" }),
    { incoming: "#123abc", mode: "light", dim: 20 },
  );
});
test("uploaded file bytes must match type and JSON must parse", () => {
  assert.throws(() =>
    validateFile(
      "photo.png",
      "image/png",
      new TextEncoder().encode("<script>"),
    ),
  );
  assert.throws(() =>
    validateFile("x.json", "application/json", new TextEncoder().encode("{")),
  );
  assert.throws(() =>
    validateFile("x.svg", "image/svg+xml", new TextEncoder().encode("<svg/>")),
  );
  validateFile(
    "report.pdf",
    "application/pdf",
    new TextEncoder().encode("%PDF-1.7"),
  );
  validateFile("notes.txt", "text/plain", new TextEncoder().encode("Hello"));
});
test("recovery hashes are salted, deterministic only with the same salt, and never plaintext", async () => {
  const a = await slowHash(" My Answer "),
    b = await slowHash("my answer", a.salt),
    c = await slowHash("my answer");
  assert.equal(a.hash, b.hash);
  assert.notEqual(a.hash, c.hash);
  assert.notEqual(a.salt, c.salt);
  assert.equal(a.hash.length, 64);
  assert.doesNotMatch(JSON.stringify(a), /my answer/i);
});
test("private messaging bridge is never public through the Worker", async () => {
  const r = await worker.fetch(req("/api/internal/messaging", "POST", {}), {});
  assert.equal(r.status, 404);
});
test("dashboard shell does not require engine availability", async () => {
  const env = { ASSETS: { fetch: async () => new Response("account-shell") } };
  const r = await worker.fetch(req("/account/"), env);
  assert.equal(await r.text(), "account-shell");
});
