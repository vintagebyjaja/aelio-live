// Post-deploy check against a live URL (a Cloudflare Pages preview first, then production).
// Usage: node _src/checks/check-deploy.mjs https://<branch>.<project>.pages.dev
// Exit 1 if any public page is missing or any private file is reachable.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(BASE)) { console.error("usage: node _src/checks/check-deploy.mjs <base-url>"); process.exit(2); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const index = JSON.parse(readFileSync(join(ROOT, "public/assets/search-index.json"), "utf8"));

const MUST_LOAD = ["/", ...index.map((p) => p.url), "/brain/", "/brain/my/", "/brain/my/agents", "/studiobrain/", "/studiobrain/models",
  "/assets/site.css", "/assets/site.js", "/assets/config.js", "/assets/brain/app.js", "/assets/brain/app.css", "/favicon.webp"];
// Files that exist in the repository but must never be served.
const MUST_NOT_SERVE = ["/engine/README.md", "/engine/aelio/server.py", "/engine/aelio/firebase_auth.py", "/engine/.env.example",
  "/engine/requirements.txt", "/engine/docs/DEPLOYMENT.md", "/_src/build.mjs", "/_src/brain/api.ts", "/native/Cargo.toml",
  "/native/crates/aelio-model/src/lib.rs", "/package.json", "/README.md", "/.gitignore", "/.env", "/engine/.env", "/.git/config",
  "/engine/Dockerfile", "/_src/edge/engine-proxy.js", "/functions/api/%5B%5Bpath%5D%5D.js", "/cloudflare/aelio-engine-worker/wrangler.vpc.toml"];
// Text that only appears in private files: if a response contains it, the file leaked even if the status looks wrong.
const LEAK_MARKERS = ["from starlette", "import numpy", "[workspace]", "AELIO_FOUNDER_UIDS", "def verify_token", "\"devDependencies\"", "[core]", "fn main()"];

const problems = [];
let checked = 0;
async function get(path) {
  const r = await fetch(BASE + path, { redirect: "manual" });
  const body = [200, 404, 503].includes(r.status) ? await r.text() : "";
  return { status: r.status, body, headers: r.headers };
}
for (const p of MUST_LOAD) {
  const r = await get(p); checked++;
  if (r.status !== 200) problems.push(`${p} returned ${r.status} (expected 200)`);
}
for (const p of MUST_NOT_SERVE) {
  const r = await get(p); checked++;
  const leaked = LEAK_MARKERS.find((m) => r.body.includes(m));
  if (leaked) problems.push(`${p} LEAKS private content (contains "${leaked}")`);
  else if (r.status === 200 && !r.body.includes("Lost in the")) problems.push(`${p} returned 200 with unexpected content`);
}
const home = await get("/");
for (const h of ["content-security-policy", "x-frame-options", "x-content-type-options"])
  if (!home.headers.get(h)) problems.push(`home page missing header ${h}`);
const studio = await get("/studiobrain/");
if (!(studio.headers.get("x-robots-tag") || "").includes("noindex")) problems.push("/studiobrain/ missing noindex header");

// The engine is reached through the same origin. Not connected yet is a valid state, not a failure.
const health = await get("/api/health"); checked++;
let engineState = "unknown";
try { const j = JSON.parse(health.body); engineState = j.ok ? "connected" : (j.code || "error"); } catch { engineState = `HTTP ${health.status}`; }
if (![200, 503].includes(health.status)) problems.push(`/api/health returned ${health.status} (expected 200 connected or 503 not connected)`);
console.log(`engine through ${BASE}/api: ${engineState}`);

if (problems.length) { console.error(`deploy check FAILED on ${BASE}:\n - ${problems.join("\n - ")}`); process.exit(1); }
console.log(`deploy check passed on ${BASE}: ${checked} URLs, all ${MUST_LOAD.length} public URLs load, none of ${MUST_NOT_SERVE.length} private files reachable, security headers present.`);
