import { safeRouterSettings, ROUTER_FIELDS } from "./providers/settings.js";
import { providerHealth } from "./providers/router.js";
import { body, fail, limited, reply, rpc, who, sb } from "./shared.js";
export async function subscriptionAccess(env, u) {
  return rpc(env, "app_ai_access", { uid: u.id });
}
export async function billing(req, env, path) {
  const u = await who(req, env);
  if (path === "/access" && req.method === "GET") {
    if (env.AELIO_SUBSCRIPTIONS_ENABLED !== "true")
      return reply({
        configured: false,
        companion_access: false,
        subscriptions: [],
        allowances: [],
        pathd_plus: false,
        pathd_pro: false,
      });
    return reply({ configured: true, ...(await subscriptionAccess(env, u)) });
  }
  if (path === "/operations" && ["GET", "PATCH"].includes(req.method)) {
    const account = await sb(env, "/rest/v1/rpc/app_account_bootstrap", {
      token: u.token,
      method: "POST",
      data: {},
    });
    if (account.role !== "founder")
      fail(403, "permission_denied", "This page is private.");
    let claims;
    try {
      claims = JSON.parse(
        atob(u.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
    } catch {}
    if (claims?.aal !== "aal2")
      fail(
        403,
        "mfa_required",
        "Verify your second factor before opening financial operations.",
      );
    if (req.method === "PATCH") {
      const d = await body(req);
      await rpc(env, "app_ai_update_router_config", {
        uid: u.id,
        settings: safeRouterSettings(d.settings),
      });
      return reply({ ok: true });
    }
    const settings = {
      ...Object.fromEntries(
        ROUTER_FIELDS.filter((k) => env[k] !== undefined).map((k) => [
          k,
          env[k],
        ]),
      ),
      ...(await rpc(env, "app_ai_router_config", {})),
    };
    return reply({
      ...(await rpc(env, "app_ai_operations", { uid: u.id })),
      settings,
      provider_health: providerHealth(),
      configured_providers: {
        gemini: !!env.GEMINI_API_KEY,
        groq: !!env.GROQ_API_KEY,
        openai: !!env.OPENAI_API_KEY,
      },
    });
  }
  fail(404, "not_found", "Not found.");
}
async function verifySignature(bytes, signature, secret) {
  if (!secret || !signature)
    fail(400, "invalid_signature", "Signature required.");
  const parts = signature.split(",").map((s) => s.split("=")),
    t = parts.find((p) => p[0] === "t")?.[1],
    v = parts.filter((p) => p[0] === "v1").map((p) => p[1]);
  if (!/^\d+$/.test(t || "") || Math.abs(Date.now() / 1000 - Number(t)) > 300)
    fail(400, "invalid_signature", "Invalid signature.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const raw = new TextEncoder().encode(t + ".");
  const message = new Uint8Array(raw.length + bytes.length);
  message.set(raw);
  message.set(bytes, raw.length);
  let good = false;
  for (const sig of v) {
    if (!/^[a-f0-9]{64}$/.test(sig)) continue;
    const b = Uint8Array.from(sig.match(/../g).map((c) => parseInt(c, 16)));
    if (await crypto.subtle.verify("HMAC", key, b, message)) good = true;
  }
  if (!good) fail(400, "invalid_signature", "Invalid signature.");
}
export async function subscriptionWebhook(req, env) {
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const bytes = await limited(req, 1000000);
    await verifySignature(
      bytes,
      req.headers.get("stripe-signature"),
      env.AELIO_SUBSCRIPTION_WEBHOOK_SECRET,
    );
    const event = JSON.parse(new TextDecoder().decode(bytes)),
      o = event.data?.object;
    if (
      !o ||
      typeof event.id !== "string" ||
      !Number.isSafeInteger(event.created)
    )
      fail(400, "invalid_event", "Invalid billing event.");
    // Do not accept test events for a live configuration or vice versa.
    if (event.livemode !== (env.AELIO_BILLING_MODE === "live"))
      fail(400, "billing_mode_mismatch", "Billing mode mismatch.");
    const args = {
      eid: event.id,
      kind: "",
      event_time: event.created,
      sid: null,
      invoice: null,
      amount_usd: null,
      period_start: null,
      period_end: null,
      price: null,
    };
    if (event.type === "invoice.paid") {
      args.kind = "paid";
      args.sid = o.subscription || o.parent?.subscription_details?.subscription;
      const recurring = (o.lines?.data || []).filter(
        (l) => l.type === "subscription" || l.parent?.subscription_item_details,
      );
      if (
        recurring.length !== 1 ||
        o.lines?.has_more ||
        o.currency !== "usd" ||
        o.status !== "paid" ||
        !o.paid ||
        !Number.isSafeInteger(o.amount_paid) ||
        o.amount_paid <= 0
      )
        return reply({
          received: true,
          ignored: "unsupported_invoice_requires_review",
        });
      const line = recurring[0];
      args.invoice = o.id;
      args.amount_usd = o.amount_paid / 100;
      args.period_start = new Date(line.period.start * 1000).toISOString();
      args.period_end = new Date(line.period.end * 1000).toISOString();
      args.price = line.price?.id || line.pricing?.price_details?.price;
    } else if (event.type === "invoice.payment_failed") {
      args.kind = "failed";
      args.sid = o.subscription || o.parent?.subscription_details?.subscription;
    } else if (event.type === "customer.subscription.deleted") {
      args.kind = "canceled";
      args.sid = o.id;
    } else if (event.type === "customer.subscription.updated") {
      args.sid = o.id;
      args.kind =
        o.status === "active" && o.cancel_at_period_end
          ? "cancel_scheduled"
          : [
                "past_due",
                "unpaid",
                "incomplete_expired",
                "paused",
                "canceled",
              ].includes(o.status)
            ? "suspended"
            : "";
      if (!args.kind) return reply({ received: true, ignored: true }); // Updated metadata cannot create paid access.
    } else if (event.type === "charge.refunded") {
      // Resolve the already-recorded invoice mapping in SQL; never trust user metadata.
      if (
        o.currency !== "usd" ||
        !o.invoice ||
        !Number.isSafeInteger(o.amount_refunded)
      )
        return reply({ received: true, ignored: true });
      args.kind = "refund";
      args.invoice = o.invoice;
      args.amount_usd = o.amount_refunded / 100;
      args.sid = await rpc(env, "app_ai_invoice_subscription", {
        invoice: o.invoice,
      });
    } else return reply({ received: true, ignored: true });
    if (typeof args.sid !== "string" || !args.sid)
      fail(
        400,
        "subscription_mapping_required",
        "A verified subscription binding is required.",
      );
    return reply(await rpc(env, "app_ai_billing_event", args));
  } catch (error) {
    const status = error.status || 400;
    console.error(
      JSON.stringify({
        event: "subscription_webhook_rejected",
        code: error.code || "invalid_event",
        status,
      }),
    );
    return reply(
      {
        error: "The billing event could not be processed.",
        code: error.code || "invalid_event",
      },
      status,
    );
  }
}
