// Builds the studio web app into web/dist. Usage: node web/build.mjs
import { build } from "esbuild";
import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, "dist/assets"), { recursive: true });
await build({
  entryPoints: [join(here, "src/main.tsx")], bundle: true, minify: true, sourcemap: false,
  outdir: join(here, "dist/assets"), entryNames: "app", format: "esm", target: "es2020",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  nodePaths: [join(here, "node_modules"), "/opt/npm-tools/node_modules"], logLevel: "info",
});
copyFileSync(join(here, "src/index.html"), join(here, "dist/index.html"));
copyFileSync(join(here, "src/favicon.svg"), join(here, "dist/assets/favicon.svg"));
writeFileSync(join(here, "dist/BUILD_INFO.txt"), `built ${new Date().toISOString()}\n`);
