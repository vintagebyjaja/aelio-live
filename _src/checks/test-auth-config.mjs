import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import {
  resolveSupabaseConfig,
  publicKeyProblem,
  DEFAULT_SUPABASE_URL,
} from "../shared/supabase-config.js";
import { buildAuthConfig } from "../build-auth-config.mjs";
import { publicConfig } from "../platform/index.js";
const jwt = (role) =>
  Buffer.from("{}").toString("base64url") +
  "." +
  Buffer.from(JSON.stringify({ role })).toString("base64url") +
  ".synthetic-signature";
test("all four public-key aliases work at runtime; server secrets are excluded", async () => {
  for (const name of [
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]) {
    for (const key of ["sb_publishable_fixture", jwt("anon")]) {
      const env = {
        [name]: key,
        NEXT_PUBLIC_SUPABASE_URL: DEFAULT_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_private_fixture",
      };
      const text = await publicConfig(env).text();
      const cfg = JSON.parse(text.slice(text.indexOf("=") + 1, -1));
      assert.equal(cfg.supabase.anonKey, key);
      assert.equal(cfg.supabase.url, DEFAULT_SUPABASE_URL);
      assert.doesNotMatch(text, /sb_secret_private_fixture/);
    }
  }
});
test("privileged keys fail closed even when placed in public variable names", async () => {
  for (const key of [
    "sb_secret_private_fixture",
    jwt("service_role"),
    jwt("authenticated"),
  ]) {
    assert.ok(publicKeyProblem(key));
    const text = await publicConfig({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    }).text();
    assert.ok(!text.includes(key));
    assert.match(text, /auth_public_key_invalid/);
  }
  assert.equal(resolveSupabaseConfig({}).errorCode, "auth_not_configured");
  assert.equal(
    resolveSupabaseConfig({
      SUPABASE_URL: "https://secret:credential@wrong.test",
      SUPABASE_ANON_KEY: "sb_publishable_fixture",
    }).url,
    DEFAULT_SUPABASE_URL,
  );
  assert.equal(
    resolveSupabaseConfig(
      { SUPABASE_URL: "https://different.supabase.co" },
      { url: DEFAULT_SUPABASE_URL, anonKey: "sb_publishable_fixture" },
    ).errorCode,
    "auth_project_mismatch",
  );
});
test("build-only aliases reach the bundled Worker and static browser config without private secrets", async () => {
  const root = mkdtempSync(join(tmpdir(), "aelio-auth-build-"));
  try {
    mkdirSync(join(root, "_src"), { recursive: true });
    cpSync("_src/platform", join(root, "_src/platform"), { recursive: true });
    cpSync("_src/shared", join(root, "_src/shared"), { recursive: true });
    const result = buildAuthConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: DEFAULT_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_never_bundled_fixture",
        AELIO_SESSION_SECRET: "never-bundle-this-server-secret",
      },
      root,
    );
    assert.equal(result.configured, true);
    const built = await build({
      entryPoints: [join(root, "_src/platform/index.js")],
      bundle: true,
      format: "esm",
      platform: "neutral",
      write: false,
    });
    const code = built.outputFiles[0].text;
    assert.doesNotMatch(
      code,
      /sb_secret_never_bundled_fixture|never-bundle-this-server-secret/,
    );
    const module = await import(
      "data:text/javascript;base64," + Buffer.from(code).toString("base64")
    );
    const text = await module.publicConfig({}).text();
    assert.ok(text.includes(jwt("anon")));
    assert.ok(
      readFileSync(join(root, "public/assets/config.js"), "utf8").includes(
        jwt("anon"),
      ),
    );
    const override = await module
      .publicConfig({ SUPABASE_ANON_KEY: "sb_publishable_runtime" })
      .text();
    assert.ok(override.includes("sb_publishable_runtime"));
    assert.ok(!override.includes(jwt("anon")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("build rejects a privileged public key before writing any client artifact", () => {
  const root = mkdtempSync(join(tmpdir(), "aelio-auth-reject-"));
  try {
    assert.throws(
      () =>
        buildAuthConfig(
          { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("service_role") },
          root,
        ),
      /privileged/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ecosystem handoffs use approved base URLs and cannot inject endpoints or privileged account states", async () => {
  const { ecosystemHandoff } = await import("../shared/ecosystem.js");
  const result = ecosystemHandoff({
    app: "groove-guide",
    intent: "travel_planning",
    summary: "Plan the drive",
    origin: "Home",
    destination: "Baltimore",
    mode: "driving",
    url: "https://evil.test",
    access_token: "never-send",
  });
  assert.equal(result.url, "https://grooveville.org/guide/");
  assert.equal(result.status, "handoff_only");
  assert.equal(result.dataRetrieved, false);
  assert.deepEqual(result.permissions, []);
  assert.equal(result.access_token, undefined);
  assert.equal(new URL(result.url).search, "");
  assert.throws(() =>
    ecosystemHandoff({
      app: "unknown",
      intent: "travel_planning",
      summary: "anything",
    }),
  );
  assert.throws(() =>
    ecosystemHandoff({
      app: "vybr8",
      intent: "travel_planning",
      summary: "wrong scope",
    }),
  );
});

test('secure guest/rate identity can derive only from a server-role secret, never an anon or public key',async()=>{
 const {keyed,sessionSecretSource}=await import('../platform/shared.js');
 const service=jwt('service_role');assert.equal(sessionSecretSource({SUPABASE_SERVICE_ROLE_KEY:service}),'derived_service_role');
 const one=await keyed({SUPABASE_SERVICE_ROLE_KEY:service},'guest:fixture'),two=await keyed({SUPABASE_SERVICE_ROLE_KEY:service},'guest:fixture'),other=await keyed({SUPABASE_SERVICE_ROLE_KEY:service},'rate:fixture');assert.equal(one,two);assert.notEqual(one,other);
 assert.equal(sessionSecretSource({SUPABASE_SERVICE_ROLE_KEY:jwt('anon')}),null);assert.equal(sessionSecretSource({SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}),null);
 await assert.rejects(keyed({SUPABASE_SERVICE_ROLE_KEY:jwt('anon')},'guest:fixture'),/secure runtime configuration/);
 assert.equal(sessionSecretSource({AELIO_SESSION_SECRET:'too-short',SUPABASE_SERVICE_ROLE_KEY:service}),null);
});
