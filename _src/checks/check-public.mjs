// Pre-deploy check: verifies public/ (the only folder Cloudflare Pages uploads)
// contains website files and nothing else. Exit 1 on any problem.
// Usage: node _src/checks/check-public.mjs
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { shellFor } from "../edge/app-shell.js";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUB = join(ROOT, "public");
const problems = [];
const fail = (m) => problems.push(m);

const ALLOWED_EXT = new Set([".html", ".css", ".js", ".json", ".webp", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".txt", ".xml", ".woff2", ".webmanifest"]);
const SPECIAL = new Set(["_redirects", "_headers"]);
// Private top-level folders of the repository: never inside public/.
const BANNED_TOP = ["engine", "native", "_src", "docs", "tests", "functions", "cloudflare"];
// Never allowed at any depth.
const BANNED_ANY = ["node_modules", ".git", "var", "secrets"];
const SECRET_PATTERNS = [
  [/sk_(live|test)_[A-Za-z0-9]{8,}/, "Stripe secret key"],
  [/rk_(live|test)_[A-Za-z0-9]{8,}/, "Stripe restricted key"],
  [/whsec_[A-Za-z0-9]{8,}/, "Stripe webhook secret"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/sb_secret_[A-Za-z0-9_-]{16,}/, "Supabase secret key"],
  [/"private_key"\s*:/, "service-account key"],
  [/sk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/, "OpenAI API key"],
  [/(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|OPENAI_API_KEY|AELIO_FERNET_KEY|AELIO_SESSION_SECRET)\s*[=:]\s*["']?[A-Za-z0-9_\-]{12,}/, "server-only setting with a value"],
];
const MAX_FILE = 25 * 1024 * 1024; // Cloudflare Pages per-file limit
const MAX_FILES = 20000;

if (!existsSync(PUB)) { console.error("public/ is missing"); process.exit(1); }
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isSymbolicLink()) { fail(`symlink not allowed: ${relative(PUB, p)}`); continue; }
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(PUB);

for (const f of files) {
  const rel = relative(PUB, f).split("\\").join("/");
  const segs = rel.split("/");
  const dirs = segs.slice(0, -1);
  const bad = (dirs.length && BANNED_TOP.includes(dirs[0]) ? dirs[0] : null) || dirs.find((s) => BANNED_ANY.includes(s));
  if (bad) fail(`file inside a "${bad}" folder: ${rel}`);
  const name = segs.at(-1);
  if (name.startsWith(".")) fail(`hidden file: ${rel}`);
  if (!(SPECIAL.has(rel) || ALLOWED_EXT.has(extname(name).toLowerCase()))) fail(`file type not allowed on the public site: ${rel}`);
  const size = statSync(f).size;
  if (size > MAX_FILE) fail(`file over 25 MiB: ${rel}`);
  if ([".html", ".js", ".json", ".css", ".txt", ".xml"].includes(extname(name)) || SPECIAL.has(rel)) {
    const text = readFileSync(f, "utf8");
    for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) fail(`${what} found in ${rel}`);
  }
}
if (files.length > MAX_FILES) fail(`${files.length} files (Pages limit ${MAX_FILES})`);
for (const must of ["index.html", "404.html", "_redirects", "_headers"]) if (!existsSync(join(PUB, must))) fail(`missing ${must}`);

// _redirects: Cloudflare Pages supports only 200 and 301-308. Anything else is silently ignored.
// Sign-in provider config: a Supabase cutover must be reachable under the CSP, and no privileged key may ship.
{
  const cfg = readFileSync(join(PUB, "assets", "config.js"), "utf8");
  const headers = readFileSync(join(PUB, "_headers"), "utf8");
  const url = (cfg.match(/supabase:\s*\{[^}]*url:\s*"([^"]*)"/) || [])[1] || "";
  const auth = (cfg.match(/\bauth:\s*"([^"]*)"/) || [])[1] || "firebase";
  if (auth === "supabase" && !url) fail('config.js sets auth: "supabase" but supabase.url is empty');
  if (url && !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)) fail(`supabase.url must be https://<project-ref>.supabase.co (got ${url})`);
  if (url && !headers.includes(url)) fail(`supabase.url ${url} is missing from connect-src in _headers`);
  const key = (cfg.match(/anonKey:\s*"([^"]*)"/) || [])[1] || "";
  let role = "";
  try { role = key.split(".").length === 3 ? JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role : ""; } catch { /* not a JWT */ }
  if (role === "service_role" || key.startsWith("sb_secret_")) fail("config.js holds a Supabase secret (service_role) key; use the publishable/anon key");
}

const rules = readFileSync(join(PUB, "_redirects"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const rewrites = [];
for (const r of rules) {
  const [from, to, code = "302"] = r.split(/\s+/);
  if (!["200", "301", "302", "303", "307", "308"].includes(code)) fail(`unsupported status ${code} in _redirects: ${r}`);
  if (code === "200") rewrites.push(from);
}

// Every internal link in every page must resolve to a file in public/, a rewrite, or an app shell.
const exists = (url) => {
  const path = url.split(/[?#]/)[0];
  if (!path || path === "/") return existsSync(join(PUB, "index.html"));
  if (rewrites.some((r) => r.endsWith("*") ? path.startsWith(r.slice(0, -1)) : path === r)) return true;
  const shell = shellFor(path);                    // Brain deep links: served by _src/edge/app-shell.js
  if (shell) return existsSync(join(PUB, shell, "index.html"));
  const p = join(PUB, decodeURIComponent(path));
  return existsSync(p) && (statSync(p).isFile() || existsSync(join(p, "index.html")));
};
let links = 0;
for (const f of files.filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    if (m[1].startsWith("//")) continue;
    links++;
    if (!exists(m[1])) fail(`broken link ${m[1]} in ${relative(PUB, f)}`);
  }
}

if (problems.length) {
  console.error(`public/ check FAILED (${problems.length} problems):\n - ` + [...new Set(problems)].join("\n - "));
  process.exit(1);
}
console.log(`public/ check passed: ${files.length} files, ${links} internal links resolved, ${rules.length} redirect rules valid, no engine/source/secret files.`);
