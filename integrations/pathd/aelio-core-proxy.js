// PATHD -> AELIO Core bridge. Runs on mypathd.com as a Cloudflare Pages Function (functions/api/ai/[[path]].js).
//
//   browser on mypathd.com --(Supabase session token)--> mypathd.com/api/ai/...   (PATHD's own domain and UI)
//   this function --(service binding AELIO_ENGINE, no public address)--> private aelio-engine Worker --> AELIO engine /v1/core/...
//
// Two credentials reach AELIO on every call:
//   Authorization: Bearer <env.AELIO_CORE_KEY>   PATHD's product key (scopes core:respond, core:memory). Server secret.
//   X-AELIO-User-Token: <the user's token>       the person, from the shared Supabase project; AELIO verifies it and
//                                                checks the account has joined PATHD.
// Nothing about AELIO is shown to PATHD's users unless PATHD chooses to ("Powered by AELIO").
//
// Pages project settings for mypathd.com (same Cloudflare account as aelio.live):
//   Service binding  AELIO_ENGINE -> aelio-engine (Worker)
//   Secrets          AELIO_CORE_KEY (from `python -m aelio.cli register-app PATHD pathd core:respond,core:memory`)
//                    AELIO_PROXY_SECRET (same value as aelio.live's; the engine refuses requests without it)

const ROUTES = {
  "respond":  { to: "/v1/core/respond",  methods: ["POST"] },
  "consent":  { to: "/v1/core/consent",  methods: ["GET", "POST"] },
  "memories": { to: "/v1/core/memories", methods: ["GET", "DELETE"] },
  "services": { to: "/v1/core/services", methods: ["GET"] },
};
const MAX_BODY = 64 * 1024;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function aelioCore({ request, env }) {
  const url = new URL(request.url);
  const name = url.pathname.replace(/^\/api\/ai\/?/, "").replace(/\/$/, "");
  const r = ROUTES[name];
  if (!r) return json(404, { error: "not found" });
  if (!r.methods.includes(request.method)) return json(405, { error: "method not allowed" });
  if (!env.AELIO_ENGINE || typeof env.AELIO_ENGINE.fetch !== "function" || !env.AELIO_CORE_KEY) {
    return json(503, { error: "AI features aren't connected yet.", code: "ai_not_connected" });
  }
  const auth = request.headers.get("authorization") || "";
  const userToken = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (name !== "services" && !userToken) return json(401, { error: "Sign in to use AI features.", code: "signed_out" });

  const headers = new Headers({ "authorization": "Bearer " + env.AELIO_CORE_KEY, "content-type": "application/json" });
  if (userToken) headers.set("x-aelio-user-token", userToken);
  if (env.AELIO_PROXY_SECRET) headers.set("x-aelio-proxy-secret", env.AELIO_PROXY_SECRET);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-aelio-client-ip", ip);

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method === "POST") {
    const body = await request.text();
    if (body.length > MAX_BODY) return json(413, { error: "Request too large." });
    init.body = body;
  }
  const allowedQuery = name === "memories" && url.searchParams.get("id") ? "?id=" + encodeURIComponent(url.searchParams.get("id")) : "";
  let res;
  try {
    res = await env.AELIO_ENGINE.fetch(new Request("http://aelio-engine.internal" + r.to + allowedQuery, init));
  } catch {
    return json(502, { error: "AI features are temporarily unavailable.", code: "ai_unreachable" });
  }
  return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "application/json", "cache-control": "no-store" } });
}
