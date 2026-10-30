// aelio.live as a Cloudflare Worker with static assets (wrangler.jsonc). Same behaviour as the Pages setup:
//   /api/*, /webhooks/*      -> the private AELIO engine (same origin; engine has no public address)
//   /brain/my/*, /studiobrain/* -> real file, else the app shell (client-side routes)
//   everything else          -> static files from ./public (never reaches this code: assets are served first)
import { platform, publicConfig, scheduled } from "../platform/index.js";
import { proxyToEngine } from "./engine-proxy.js";
import { serveAppShell, shellFor } from "./app-shell.js";

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(scheduled(env)); },
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/assets/config.js") return publicConfig(env);
    if (pathname.startsWith("/api/platform/")) return platform(request, env);
    if (pathname.startsWith("/api/internal/")) return new Response("Not found", {status:404});
    if (pathname.startsWith("/api/") || pathname.startsWith("/webhooks/")) return proxyToEngine({ request, env });
    if (shellFor(pathname)) return serveAppShell({ request, env });
    return env.ASSETS.fetch(request);
  },
};
