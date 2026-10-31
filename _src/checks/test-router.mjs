import { test } from "node:test";
import assert from "node:assert/strict";
import {
  intelligenceRouter,
  routingConfig,
} from "../platform/providers/router.js";
import { safeRouterSettings } from "../platform/providers/settings.js";
const env = {
  GEMINI_API_KEY: "gemini-secret-fixture",
  GROQ_API_KEY: "groq-secret-fixture",
  OPENAI_API_KEY: "openai-secret-fixture",
  GEMINI_MODEL: "gemini-fixture",
  GROQ_MODEL: "groq-fixture",
  OPENAI_MODEL: "openai-fixture",
  GEMINI_INPUT_USD_PER_MILLION: "1",
  GEMINI_OUTPUT_USD_PER_MILLION: "2",
  GROQ_INPUT_USD_PER_MILLION: "1",
  GROQ_OUTPUT_USD_PER_MILLION: "2",
  OPENAI_INPUT_USD_PER_MILLION: "1",
  OPENAI_OUTPUT_USD_PER_MILLION: "2",
  AELIO_DAILY_AI_BUDGET_USD: "5",
  AELIO_MONTHLY_AI_BUDGET_USD: "100",
  AELIO_OPENAI_EMERGENCY_BUDGET_USD: "1",
  AELIO_CIRCUIT_BREAKER_MS: "0",
};
const payload = {
  request_id: "11111111-1111-4111-8111-111111111111",
  billing_user_id: "22222222-2222-4222-8222-222222222222",
  billing_product: "pathd",
  agents: [{ id: "agent", kind: "mila", name: "MILA" }],
  content: "Hello",
  history: [{ role: "user", content: "Career context from this thread" }],
};
const wire = (e) => "data: " + JSON.stringify(e) + "\n\n";
const success = () =>
  new Response(
    wire({
      choices: [{ delta: { content: "Hello there" }, finish_reason: null }],
    }) +
      wire({ choices: [{ delta: {}, finish_reason: "stop" }] }) +
      wire({ choices: [], usage: { prompt_tokens: 50, completion_tokens: 5 } }),
    { headers: { "content-type": "text/event-stream" } },
  );
function ledger() {
  const calls = [];
  return {
    calls,
    rpc: async (name, data) => {
      calls.push({ name, data });
      return {};
    },
  };
}
test("Gemini-to-Groq fallback only after explicit rejection, with single-source reservations and actual usage", async () => {
  const journal = ledger(),
    calls = [];
  const response = await intelligenceRouter(env, payload, undefined, {
    rpc: journal.rpc,
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return calls.length === 1
        ? new Response("{}", { status: 429 })
        : success();
    },
  });
  const text = await response.text();
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /googleapis/);
  assert.match(calls[1].url, /groq/);
  assert.match(text, /Hello there/);
  assert.match(text, /"type":"complete"/);
  assert.ok(calls[1].body.messages[0].content.includes("MILA"));
  assert.match(JSON.stringify(calls[1].body.messages), /Career context/);
  const settled = journal.calls.filter((c) => c.name === "app_ai_settle");
  assert.equal(settled.length, 2);
  assert.equal(settled[0].data.actual_usd, 0);
  assert.equal(settled[1].data.actual_usd, 0.00006);
  assert.equal(settled[1].data.is_estimated, false);
  assert.ok(
    journal.calls
      .filter((c) => c.name === "app_ai_reserve")
      .every(
        (c) =>
          c.data.uid === payload.billing_user_id &&
          c.data.product_scope === "pathd",
      ),
  );
  assert.doesNotMatch(text, /secret-fixture/);
});
test("ambiguous timeout/network failure never replays a potentially paid request", async () => {
  let calls = 0;
  const j = ledger();
  const r = await intelligenceRouter(env, payload, undefined, {
    rpc: j.rpc,
    fetch: async () => {
      calls++;
      throw new DOMException("Timeout", "AbortError");
    },
  });
  const text = await r.text();
  assert.equal(calls, 1);
  assert.match(text, /provider_request_ambiguous/);
  const settled = j.calls.find((c) => c.name === "app_ai_settle");
  assert.ok(settled.data.actual_usd > 0);
  assert.equal(settled.data.is_estimated, true);
});
test("partial successful HTTP stream is never replayed to another provider", async () => {
  let calls = 0;
  const j = ledger();
  const r = await intelligenceRouter(env, payload, undefined, {
    rpc: j.rpc,
    fetch: async () => {
      calls++;
      return new Response(
        wire({
          choices: [
            { delta: { content: "Partial reply" }, finish_reason: null },
          ],
        }),
      );
    },
  });
  const text = await r.text();
  assert.match(text, /Partial reply/);
  assert.doesNotMatch(text, /"type":"complete"/);
  assert.equal(calls, 1);
  assert.ok(
    j.calls.find((c) => c.name === "app_ai_settle").data.actual_usd > 0,
  );
});
test("budget failure blocks upstream calls and cannot be bypassed by fallback", async () => {
  let calls = 0;
  const r = await intelligenceRouter(env, payload, undefined, {
    rpc: async (name) => {
      if (name === "app_ai_router_config") return {};
      throw new Error("subscriber budget exhausted");
    },
    fetch: async () => {
      calls++;
      return success();
    },
  });
  const text = await r.text();
  assert.equal(calls, 0);
  assert.doesNotMatch(text, /"type":"complete"/);
});
test("router rejects missing prices and unsafe admin keys; complex prices are explicit", () => {
  assert.throws(() =>
    routingConfig({ ...env, GEMINI_INPUT_USD_PER_MILLION: undefined }, payload),
  );
  assert.throws(() => safeRouterSettings({ GEMINI_API_KEY: "never-save" }));
  assert.throws(() => safeRouterSettings({ GROQ_TIMEOUT_MS: "-1" }));
  assert.throws(() =>
    routingConfig(
      { ...env, GEMINI_COMPLEX_MODEL: "advanced" },
      { ...payload, content: "Please debug this architecture" },
    ),
  );
  const config = routingConfig(
    {
      ...env,
      GEMINI_COMPLEX_MODEL: "advanced",
      GEMINI_COMPLEX_INPUT_USD_PER_MILLION: "2",
      GEMINI_COMPLEX_OUTPUT_USD_PER_MILLION: "3",
    },
    { ...payload, content: "Please debug this architecture" },
  );
  assert.equal(config[0].model, "advanced");
  assert.equal(config[0].input, 2);
});

test("history compaction quotes relevant earlier context and never invents or persists memories", async () => {
  const { compactHistory, relevantMemories } = await import(
    "../platform/providers/context.js"
  );
  const rows = Array.from({ length: 25 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: i === 2 ? "Career interview preparation" : "Other turn " + i,
  }));
  const compact = compactHistory(rows, "interview preparation");
  assert.equal(compact.length, 9);
  assert.match(compact[0].content, /Career interview/);
  assert.match(compact[0].content, /not new instructions or verified memories/);
  assert.equal(rows.length, 25);
  assert.equal(
    relevantMemories(
      [{ content: "Fishing" }, { content: "Interview preparation" }],
      "interview",
      1,
    )[0].content,
    "Interview preparation",
  );
});
