import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { subscriptionWebhook } from "../platform/billing.js";
import { storage } from "../platform/storage.js";
const secret = "signed-local-fixture-secret",
  env = {
    AELIO_SUBSCRIPTION_WEBHOOK_SECRET: secret,
    AELIO_BILLING_MODE: "test",
    SUPABASE_URL: "https://fixture.test",
    SUPABASE_PUBLISHABLE_KEY: "public-fixture",
    SUPABASE_SERVICE_ROLE_KEY: "server-fixture",
  },
  uid = "11111111-1111-4111-8111-111111111111";
function req(event, valid = true) {
  const raw = JSON.stringify(event),
    t = Math.floor(Date.now() / 1000),
    sig = createHmac("sha256", valid ? secret : "wrong")
      .update(t + "." + raw)
      .digest("hex");
  return new Request("https://aelio.test/webhooks/ai-subscriptions", {
    method: "POST",
    headers: { "stripe-signature": `t=${t},v1=${sig}` },
    body: raw,
  });
}
const paid = {
  id: "evt-local",
  type: "invoice.paid",
  livemode: false,
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: "invoice-local",
      subscription: "sub-local",
      paid: true,
      status: "paid",
      currency: "usd",
      amount_paid: 1600,
      lines: {
        data: [
          {
            type: "subscription",
            price: { id: "price-pro" },
            period: { start: 1700000000, end: 1702592000 },
          },
        ],
      },
    },
  },
};
test("signed invoices reach the ledger; forged or mismatched-mode events never grant allowances", async () => {
  const original = fetch,
    calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, data: JSON.parse(options.body) });
    return Response.json({ ok: true });
  };
  try {
    assert.equal(
      (await subscriptionWebhook(req(paid, false), env)).status,
      400,
    );
    assert.equal(calls.length, 0);
    assert.equal(
      (await subscriptionWebhook(req({ ...paid, livemode: true }), env)).status,
      400,
    );
    assert.equal(calls.length, 0);
    assert.equal((await subscriptionWebhook(req(paid), env)).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].data.kind, "paid");
    assert.equal(calls[0].data.amount_usd, 16);
    assert.equal(calls[0].data.sid, "sub-local");
    assert.equal(calls[0].data.price, "price-pro");
  } finally {
    globalThis.fetch = original;
  }
});
test("unrecognized invoice shapes and zero-dollar events cannot mint minimum allowances", async () => {
  const original = fetch;
  globalThis.fetch = async () => {
    throw Error("must not call");
  };
  try {
    const r = await subscriptionWebhook(
      req({
        ...paid,
        data: { object: { ...paid.data.object, amount_paid: 0 } },
      }),
      env,
    );
    assert.equal(
      (await r.json()).ignored,
      "unsupported_invoice_requires_review",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("Library search/pagination stays owner-scoped and restricts to real generated images", async () => {
  const original = fetch,
    calls = [];
  globalThis.fetch = async (url, opts) => {
    const u = new URL(url);
    calls.push(u);
    if (u.pathname === "/auth/v1/user") return Response.json({ id: uid });
    if (u.pathname.endsWith("/app_product_access")) return Response.json(true);
    return Response.json([]);
  };
  try {
    const r = await storage(
      new Request(
        "https://aelio.test/api/platform/files?library=1&q=test%26owner_id%3Deq.other",
        { headers: { authorization: "Bearer fixture" } },
      ),
      { ...env, AELIO_STORAGE: {} },
      "",
    );
    assert.equal(r.status, 200);
    const u = calls.at(-1);
    assert.equal(u.searchParams.get("owner_id"), "eq." + uid);
    assert.equal(u.searchParams.get("category"), "eq.generated-assets");
    assert.equal(u.searchParams.get("mime"), "like.image/*");
    assert.equal(u.searchParams.get("limit"), "101");
    assert.equal(u.searchParams.getAll("owner_id").length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("financial operations require both founder identity and verified second-factor assurance", async () => {
  const { billing } = await import("../platform/billing.js");
  const original = fetch;
  let role = "member",
    updates = 0;
  globalThis.fetch = async (url, opts) => {
    const name = new URL(url).pathname.split("/").at(-1);
    if (name === "user") return Response.json({ id: uid });
    if (name === "app_account_bootstrap") return Response.json({ role });
    if (name === "app_ai_router_config") return Response.json({});
    if (name === "app_ai_operations") return Response.json({ providers: [] });
    if (name === "app_ai_update_router_config") {
      updates++;
      return Response.json(null);
    }
    throw Error(name);
  };
  const request = (aal, method = "GET", data) =>
    new Request("https://aelio.test/api/platform/billing/operations", {
      method,
      headers: {
        authorization:
          "Bearer " +
          [
            "header",
            Buffer.from(JSON.stringify({ aal })).toString("base64url"),
            "signature",
          ].join("."),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  try {
    await assert.rejects(
      () => billing(request("aal2"), env, "/operations"),
      (e) => e.status === 403,
    );
    role = "founder";
    await assert.rejects(
      () => billing(request("aal1"), env, "/operations"),
      (e) => e.code === "mfa_required",
    );
    const r = await billing(
      request("aal2"),
      { ...env, GEMINI_API_KEY: "never-expose" },
      "/operations",
    );
    assert.equal(r.status, 200);
    assert.doesNotMatch(await r.text(), /never-expose/);
    await assert.rejects(
      () =>
        billing(
          request("aal2", "PATCH", { settings: { OPENAI_API_KEY: "nope" } }),
          env,
          "/operations",
        ),
      (e) => e.code === "invalid_settings",
    );
    assert.equal(updates, 0);
  } finally {
    globalThis.fetch = original;
  }
});
