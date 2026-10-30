// Minimal local stand-in for Cloudflare Pages, for testing the checks offline.
// Serves ONE folder like Pages serves the output directory: static files,
// directory index.html, 200-rewrites from _redirects, headers from _headers,
// and 404.html with status 404 for anything else.
// Also runs the Pages Functions for /api/* and /webhooks/* (the same-origin engine proxy), with env from
// AELIO_ENGINE_ORIGIN and AELIO_PROXY_SECRET, exactly as Cloudflare would call them.
// Usage: node _src/checks/pages-emulator.mjs <folder> <port>
import { platform, publicConfig } from "../platform/index.js";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { Readable } from "node:stream";
import { shellFor } from "../edge/app-shell.js";
import { proxyToEngine } from "../edge/engine-proxy.js";

const DIR = resolve(process.argv[2] || "public");
const PORT = Number(process.argv[3] || 8790);
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png" };
const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const rules = read(join(DIR, "_redirects")).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => l.split(/\s+/));
const headerBlocks = [];
for (const line of read(join(DIR, "_headers")).split("\n")) {
  if (!line.trim()) continue;
  if (!/^\s/.test(line)) headerBlocks.push({ pattern: line.trim(), headers: [] });
  else { const i = line.indexOf(":"); headerBlocks.at(-1)?.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); }
}
const match = (pat, path) => (pat.endsWith("*") ? path.startsWith(pat.slice(0, -1)) : pat === path);
const file = (p) => { const f = join(DIR, p); if (!f.startsWith(DIR)) return null;
  if (existsSync(f) && statSync(f).isFile()) return f; if (existsSync(join(f, "index.html"))) return join(f, "index.html"); return null; };

async function runFunction(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  headers.set("cf-connecting-ip", req.socket.remoteAddress || "127.0.0.1");   // Cloudflare sets this at the edge
  const init = { method: req.method, headers };
  if (!["GET", "HEAD"].includes(req.method)) { init.body = Readable.toWeb(req); init.duplex = "half"; }
  const env = { AELIO_ENGINE_ORIGIN: process.env.AELIO_ENGINE_ORIGIN, AELIO_PROXY_SECRET: process.env.AELIO_PROXY_SECRET };
  const request = new Request(url, init);
  const r = url.pathname.startsWith("/api/platform/") ? await platform(request, {...process.env,AELIO_LOCAL_TEST:"1"}) : await proxyToEngine({ request, env });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (!r.body) return res.end();
  for await (const chunk of r.body) res.write(chunk);
  res.end();
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.startsWith("/api/") || path.startsWith("/webhooks/")) {
    return runFunction(req, res).catch((e) => { res.writeHead(500); res.end(String(e)); });
  }
  if (path === "/assets/config.js") { const r=publicConfig(process.env); res.writeHead(200,Object.fromEntries(r.headers)); return r.text().then(t=>res.end(t)); }
  if (path === "/assets/config.js" && process.env.AELIO_DEV_CONFIG === "1") {   // local testing only: dev sign-in, same origin
    res.writeHead(200, { "content-type": "text/javascript" });
    return res.end('window.AELIO_CONFIG={engine:"",dev:true,firebase:{}};');
  }
  for (const [from, to, code] of rules) {          // 301/302 redirects, including :splat
    if (code && code !== "200" && match(from, path)) {
      const loc = from.endsWith("*") ? to.replace(":splat", path.slice(from.length - 1)) : to;
      res.writeHead(Number(code), { location: loc }); return res.end();
    }
  }
  for (const b of headerBlocks) if (match(b.pattern, path)) for (const [k, v] of b.headers) res.setHeader(k, v);
  let f = file(path), status = 200;
  if (!f) for (const [from, to, code] of rules) if (code === "200" && match(from, path)) { f = file(to); break; }
  if (!f) { const shell = shellFor(path); if (shell) f = file(shell); }                 // same rule as _src/edge/app-shell.js
  if (!f) { f = join(DIR, "404.html"); status = 404; }
  res.writeHead(status, { "content-type": TYPES[extname(f)] || "text/plain" });
  res.end(readFileSync(f));
}).listen(PORT, () => console.log(`serving ${DIR} on http://localhost:${PORT}`));
