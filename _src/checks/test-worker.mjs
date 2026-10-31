// The aelio.live Worker (wrangler.jsonc): API to the private engine, Brain deep links to the app shell, never loops.
import { test } from "node:test";
import assert from "node:assert/strict";
import {withStudioFixture,studioToken} from "./studio-fixtures.mjs";
import worker from "../edge/worker.js";

function assets(files) {
  const seen = [];
  return { seen, fetch: async (req) => { const p = new URL(req.url).pathname; seen.push(p);
    return files[p] ? new Response(files[p], { status: 200, headers: { "content-type": "text/html" } }) : new Response("nf", { status: 404 }); } };
}
const FILES = { "/studiobrain/": "STUDIO SHELL", "/brain/my/": "MY SHELL", "/brain/my/index.html": "MY SHELL", "/assets/brain/app.js": "js" };

test("Studio Brain and My AELIO deep links load their app shell", async () => {
  await withStudioFixture(async({env})=>{
  const A = assets(FILES);
  for (const [p, want] of [["/studiobrain/web-designer", "STUDIO SHELL"], ["/studiobrain/security", "STUDIO SHELL"], ["/brain/my/chat", "MY SHELL"], ["/studiobrain/", "STUDIO SHELL"]]) {
    const r = await worker.fetch(new Request("https://aelio.live" + p,{headers:{authorization:'Bearer '+studioToken()}}), {...env,ASSETS: A});
    assert.equal(r.status, 200, p); assert.equal(await r.text(), want, p);
  }
  assert.ok(A.seen.length <= 8, "at most two asset lookups per request: no loops");});
});

test("a missing shell is a 404, not a loop", async () => {
  await withStudioFixture(async({env})=>{const A=assets({});const r=await worker.fetch(new Request("https://aelio.live/studiobrain/x",{headers:{authorization:'Bearer '+studioToken()}}),{...env,ASSETS:A});assert.equal(r.status,404);assert.equal(A.seen.length,2);});
});

test("/api goes to the engine (503 until connected); other paths are plain assets", async () => {
  const A = assets(FILES);
  const r = await worker.fetch(new Request("https://aelio.live/api/health"), { ASSETS: A });
  assert.equal(r.status, 503); assert.equal((await r.json()).code, "engine_not_connected"); assert.equal(A.seen.length, 0);
  const engine = { fetch: async (req) => new Response(JSON.stringify({ path: new URL(req.url).pathname, secret: req.headers.get("x-aelio-proxy-secret") })) };
  const d = await (await worker.fetch(new Request("https://aelio.live/api/public/site-design"), { ASSETS: A, AELIO_ENGINE: engine, AELIO_PROXY_SECRET: "s" })).json();
  assert.deepEqual(d, { path: "/api/public/site-design", secret: "s" });
  const js = await worker.fetch(new Request("https://aelio.live/assets/brain/app.js"), { ASSETS: A });
  assert.equal(await js.text(), "js");
});

test("the public Brain game is not treated as an app shell", async () => {
  const A = assets({});
  const r = await worker.fetch(new Request("https://aelio.live/brain/anything"), { ASSETS: A });
  assert.equal(r.status, 404); assert.equal(A.seen.length, 1);
});
