import { build } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
await build({
  entryPoints: ["_src/chat/main.tsx"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  outdir: "public/assets/chat",
  entryNames: "app",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const version=JSON.parse(readFileSync("package.json","utf8")).version;
const htmlBase =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><title>AELIO · Your Space</title><link rel="icon" href="/favicon.webp"><link rel="stylesheet" href="/assets/chat/app.css"></head><body><div id="root"></div><script src="/assets/config.js"></script><script type="module" src="/assets/chat/app.js"></script></body></html>';
const widgetHost='<link rel="stylesheet" href="/assets/dreambox-host.css"><script src="/assets/dreambox-host.js" defer></script>';
const html=(htmlBase.replace("</body>",widgetHost+"</body>")).replace("/assets/chat/app.css",`/assets/chat/app.css?v=${version}`).replace("/assets/chat/app.js",`/assets/chat/app.js?v=${version}`);
for (const path of ["chat", "account", "auth/callback", "auth/reset"]) {
  mkdirSync("public/" + path, { recursive: true });
  writeFileSync("public/" + path + "/index.html", html);
}

// Dream Box is the primary home; the approved marketing page remains at /explore/.
writeFileSync("public/index.html",html.replace('<meta name="robots" content="noindex">',''));

await build({entryPoints:["_src/chat/DreamBox.tsx"],bundle:true,minify:true,format:"esm",target:"es2020",outdir:"public/assets/dreambox",entryNames:"widget",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'}});
mkdirSync("public/dreambox",{recursive:true});writeFileSync("public/dreambox/index.html",'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><title>AELIO DreamBox</title><link rel="stylesheet" href="/assets/dreambox/widget.css?v='+version+'"></head><body><div id="dreambox-root"></div><script src="/assets/config.js"></script><script type="module" src="/assets/dreambox/widget.js?v='+version+'"></script></body></html>');
