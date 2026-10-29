// aelio.live as a Cloudflare Worker with static assets (wrangler.jsonc). Same behaviour as the Pages setup:
//   /api/*, /webhooks/*      -> the private AELIO engine (same origin; engine has no public address)
//   /brain/my/*, /studiobrain/* -> real file, else the app shell (client-side routes)
//   everything else          -> static files from ./public (never reaches this code: assets are served first)
import { proxyToEngine } from "./engine-proxy.js";
import { serveAppShell, shellFor } from "./app-shell.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/") || pathname.startsWith("/webhooks/")) return proxyToEngine({ request, env });
    if (shellFor(pathname)) return serveAppShell({ request, env });
    return env.ASSETS.fetch(request);
  },
};
