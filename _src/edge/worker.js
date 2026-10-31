// aelio.live as a Cloudflare Worker with static assets (wrangler.jsonc). Same behaviour as the Pages setup:
//   /api/*, /webhooks/*      -> the private AELIO engine (same origin; engine has no public address)
//   /brain/my/*, /studiobrain/* -> real file, else the app shell (client-side routes)
//   everything else          -> static files from ./public (never reaches this code: assets are served first)
import {studioAPI,studioPage} from "../platform/studio.js";
import {requireStudioFounder} from "../platform/studio-auth.js";
import { platform, publicConfig, scheduled } from "../platform/index.js";
import { proxyToEngine } from "./engine-proxy.js";
import { serveAppShell, shellFor } from "./app-shell.js";

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(scheduled(env)); },
  async fetch(request, env) {
    let pathname;try{pathname=decodeURIComponent(new URL(request.url).pathname).replace(/\/+/g,'/');}catch{return new Response('Not found',{status:404});}
    if(pathname.startsWith('/api/studio/ai/'))return studioAPI(request,env);
    if(pathname==='/studiobrain'||pathname.startsWith('/studiobrain/'))return studioPage(request,env);
    if(pathname.startsWith('/api/brain/')||pathname.startsWith('/api/studio/')){try{await requireStudioFounder(request,env);}catch(e){return new Response(JSON.stringify({error:'Private workspace.'}),{status:e.status||503,headers:{'content-type':'application/json','cache-control':'no-store'}});}}
    if(pathname==='/webhooks/ai-subscriptions')return platform(request,env);
    if (pathname === "/assets/config.js") return publicConfig(env);
    if (pathname.startsWith("/api/platform/")) return platform(request, env);
    if (pathname.startsWith("/api/internal/")) return new Response("Not found", {status:404});
    if (pathname.startsWith("/api/") || pathname.startsWith("/webhooks/")) return proxyToEngine({ request, env });
    if (shellFor(pathname)) return serveAppShell({ request, env });
    return env.ASSETS.fetch(request);
  },
};
