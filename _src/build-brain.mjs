// Builds the Brain app (brain game, My AELIO, Studio Brain) into public/assets/brain/.
// Needs: npm install react@19 react-dom@19 esbuild   (see README)
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public");
await build({ entryPoints: [join(ROOT, "_src/brain/main.tsx")], bundle: true, minify: true, format: "esm", target: "es2020",
  outdir: join(OUT, "assets/brain"), entryNames: "app", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  nodePaths: [join(ROOT, "node_modules"), "/opt/npm-tools/node_modules"], logLevel: "warning" });
const v = Date.now().toString(36);
const shell = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title}</title><link rel="icon" href="/favicon.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/brain/app.css?v=${v}"></head><body><div id="root"></div>
<script src="/assets/config.js?v=${v}"></script><script type="module" src="/assets/brain/app.js?v=${v}"></script></body></html>`;
for (const [dir, title] of [["brain", "Brain · AELIO"], ["brain/my", "My AELIO"], ["studiobrain", "Studio Brain · AELIO"]]) {
  mkdirSync(join(OUT, dir), { recursive: true });
  writeFileSync(join(OUT, dir, "index.html"), shell(title));
}
console.log("built brain app");
