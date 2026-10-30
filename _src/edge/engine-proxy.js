import {consumerMessage} from "../shared/experience.js";
// Same-origin bridge: aelio.live/api/* and aelio.live/webhooks/* -> the AELIO engine, privately.
//
// Runs as a Cloudflare Pages Function (see functions/api and functions/webhooks).
// The browser only ever talks to aelio.live. The engine has no public address of its own.
//
// How the engine is reached (first match wins):
//   1. env.AELIO_ENGINE         a binding with .fetch(): a Service binding to the private "aelio-engine" Worker,
//                               which reaches the engine through a Cloudflare Container or Workers VPC (Tunnel
//                               with no public hostname). Recommended for production.
//   2. env.AELIO_ENGINE_ORIGIN  a URL (local development and testing only).
//   3. neither                  answer 503 "engine not connected" so the site still works.
//
// env.AELIO_PROXY_SECRET (Pages secret) is sent as x-aelio-proxy-secret. The engine refuses API requests without it.

const HOP_BY_HOP = ["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer", "proxy-authorization", "host", "content-length"];
// Headers a browser must never be able to set on the engine request.
const CLIENT_FORBIDDEN = ["x-aelio-messaging-secret", "x-aelio-proxy-secret", "x-aelio-client-ip", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip", "cf-connecting-ip", "cookie", "forwarded"];
const ALLOWED_PREFIXES = ["/api/", "/webhooks/"];

function json(status, data) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export async function proxyToEngine({ request, env }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/internal/")) return json(404, {error:"not found"});
  if (!ALLOWED_PREFIXES.some(p => url.pathname.startsWith(p))) return json(404, { error: "not found" });
  const binding = env && env.AELIO_ENGINE && typeof env.AELIO_ENGINE.fetch === "function" ? env.AELIO_ENGINE : null;
  const origin = env && env.AELIO_ENGINE_ORIGIN ? String(env.AELIO_ENGINE_ORIGIN).replace(/\/$/, "") : "";
  if (!binding && !origin) {
    console.error(JSON.stringify({event:"engine_configuration_missing",code:"engine_not_connected"}));
    return json(503, { error: consumerMessage("engine_not_connected"), code: "engine_not_connected" });
  }
  const target = (binding ? "http://aelio-engine.internal" : origin) + url.pathname + url.search;

  const headers = new Headers();
  for (const [k, v] of request.headers) {
    const key = k.toLowerCase();
    if (!HOP_BY_HOP.includes(key) && !CLIENT_FORBIDDEN.includes(key)) headers.set(k, v);
  }
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-aelio-client-ip", ip);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
  if (env.AELIO_PROXY_SECRET) headers.set("x-aelio-proxy-secret", env.AELIO_PROXY_SECRET);

  const init = { method: request.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(request.method)) { init.body = request.body; init.duplex = "half"; }

  let res;
  try {
    res = binding ? await binding.fetch(new Request(target, init)) : await fetch(target, init);
  } catch (e) {
    console.error(JSON.stringify({event:"engine_upstream_failed",code:"engine_unreachable"}));
    return json(502, { error: consumerMessage("engine_unreachable"), code: "engine_unreachable" });
  }
  const out = new Headers();
  for (const [k, v] of res.headers) if (!HOP_BY_HOP.includes(k.toLowerCase()) && k.toLowerCase() !== "set-cookie") out.append(k, v);
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  // Stream the body through untouched (chat replies are server-sent events).
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}
