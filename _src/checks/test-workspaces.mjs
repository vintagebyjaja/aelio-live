import { test } from "node:test";
import assert from "node:assert/strict";
import {
  workspaces,
  workspaceFields,
  echoSpec,
  withEchoContext,
} from "../platform/workspaces.js";
import { chatRoutes } from "../platform/messaging.js";
import { responseBody } from "../platform/providers/openai.js";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  aid = "33333333-3333-4333-8333-333333333333",
  cid = "44444444-4444-4444-8444-444444444444",
  mid = "55555555-5555-4555-8555-555555555555";
const env = {
  SUPABASE_URL: "https://offline.test",
  SUPABASE_PUBLISHABLE_KEY: "public-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "server-fixture",
};
const request = (path, method = "GET", data, product) =>
  new Request("https://aelio.test/api/platform" + path, {
    method,
    headers: {
      authorization: "Bearer local-fixture",
      origin: "https://aelio.test",
      ...(product ? { "x-aelio-product": product } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
async function fixture(run) {
  const original = globalThis.fetch,
    calls = [];
  const db = {
    app_agents: [
      {
        id: aid,
        owner_id: uid,
        kind: "custom",
        name: "Joe",
        memory_enabled: true,
        memories: ["UNREVIEWED LEGACY MEMORY"],
      },
    ],
    app_echo_profiles: [
      {
        agent_id: aid,
        owner_id: uid,
        mode: "memory",
        subject: "deceased",
        memories_enabled: true,
      },
    ],
    app_echo_memories: [],
    app_workspace_entries: [{ id: mid, owner_id: other, title: "Private" }],
    app_conversations: [
      { id: cid, owner_id: uid, participants: [aid], product: "aelio" },
    ],
  };
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url),
      name = u.pathname.split("/").at(-1),
      data = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ url: u, opts, data, name });
    let result;
    if (u.pathname === "/auth/v1/user")
      result = { id: uid, email: "fixture@test.invalid" };
    else if (name === "app_product_access") result = true;
    else if (name === "app_create_echo")
      result = { agent_id: aid, conversation_id: cid };
    else if (name === "app_review_echo_memory" || name === "app_delete_echo")
      result = { ok: true };
    else if (name === "app_echo_context")
      result = [{ kind: "story", content: "APPROVED fishing memory" }];
    else if (db[name]) {
      let rows = db[name].filter((row) =>
        [...u.searchParams].every(
          ([k, v]) => !v.startsWith("eq.") || String(row[k]) === v.slice(3),
        ),
      );
      if (opts.method === "POST") {
        const row = { id: mid, ...data };
        db[name].push(row);
        rows = [row];
      }
      if (opts.method === "PATCH") rows.forEach((r) => Object.assign(r, data));
      if (opts.method === "DELETE")
        db[name] = db[name].filter((r) => !rows.includes(r));
      result = rows;
    } else throw Error("Unexpected fixture operation " + u.pathname);
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await run({ db, calls });
  } finally {
    globalThis.fetch = original;
  }
}
test("Brain rejects unsafe links and invalid sections; writes cannot forge owner IDs", async () => {
  assert.throws(() => workspaceFields({ section: "admin", title: "x" }, true));
  assert.throws(() =>
    workspaceFields(
      { section: "create", title: "x", url: "javascript:alert(1)" },
      true,
    ),
  );
  assert.throws(() =>
    workspaceFields({ url: "https://user:pass@example.test" }, false),
  );
  await fixture(async ({ calls }) => {
    const r = await workspaces(
      request("/workspace", "POST", {
        section: "create",
        title: "My book",
        owner_id: other,
      }),
      env,
      "/workspace",
    );
    assert.equal(r.status, 201);
    const write = calls.find(
      (c) => c.name === "app_workspace_entries" && c.opts.method === "POST",
    );
    assert.equal(write.data.owner_id, uid);
  });
});
test("Brain owner checks reject cross-user edits and PATHD cannot use AELIO workspaces", async () => {
  await fixture(async ({ calls }) => {
    await assert.rejects(
      () =>
        workspaces(
          request("/workspace/" + mid, "PATCH", { title: "stolen" }),
          env,
          "/workspace/" + mid,
        ),
      (e) => e.status === 404,
    );
    assert.ok(!calls.some((c) => c.opts.method === "PATCH"));
    await assert.rejects(
      () =>
        workspaces(request("/echo", "GET", undefined, "pathd"), env, "/echo"),
      (e) => e.status === 403,
    );
  });
});
test("ECHO requires disclosure, living consent, styles and nonpermanent names", () => {
  const d = {
    mode: "memory",
    name: "Joe",
    subject: "living",
    disclosure_ack: true,
  };
  assert.throws(() => echoSpec(d));
  assert.throws(() =>
    echoSpec({ ...d, subject: "self", disclosure_ack: false }),
  );
  assert.throws(() => echoSpec({ ...d, subject: "self", name: " Naomi " }));
  assert.throws(() =>
    echoSpec({
      ...d,
      subject: "self",
      mode: "personality",
      base_style: "unknown",
    }),
  );
  assert.equal(echoSpec({ ...d, subject_consent: true }).subject_consent, true);
});
test("ECHO creation calls the atomic SQL function with verified identity and ignores forged fields", async () => {
  await fixture(async ({ calls }) => {
    const r = await workspaces(
      request("/echo", "POST", {
        mode: "original",
        name: "Original Joe",
        disclosure_ack: true,
        uid: other,
        owner_id: other,
      }),
      env,
      "/echo",
    );
    assert.equal(r.status, 201);
    const write = calls.find((c) => c.name === "app_create_echo");
    assert.equal(write.data.uid, uid);
    assert.equal(write.data.spec.owner_id, undefined);
  });
});
test("supplied memories are pending regardless of client approval; review requires owner and matching ECHO", async () => {
  await fixture(async ({ db, calls }) => {
    await workspaces(
      request("/echo/" + aid + "/memories", "POST", {
        kind: "story",
        content: "Fishing",
        status: "approved",
      }),
      env,
      "/echo/" + aid + "/memories",
    );
    assert.equal(db.app_echo_memories[0].status, "pending");
    db.app_echo_memories[0].echo_id = other;
    await assert.rejects(
      () =>
        workspaces(
          request("/echo/" + aid + "/memories/" + mid, "PATCH", {
            approve: true,
          }),
          env,
          "/echo/" + aid + "/memories/" + mid,
        ),
      (e) => e.status === 404,
    );
    assert.ok(!calls.some((c) => c.name === "app_review_echo_memory"));
  });
});
test("ECHO inference replaces legacy memories with reviewed context and honors both memory switches", async () => {
  await fixture(async ({ db, calls }) => {
    const u = { id: uid, token: "local-fixture" };
    let [a] = await withEchoContext(env, u, db.app_agents, true);
    assert.deepEqual(a.memories, [
      { kind: "story", content: "APPROVED fishing memory" },
    ]);
    assert.match(a.instructions, /AI simulation/);
    const prompt = responseBody(
      {},
      { content: "Hi", memory_enabled: true },
      a,
    ).instructions;
    assert.match(prompt, /APPROVED fishing memory/);
    assert.ok(prompt.indexOf("ECHO AI simulation") < prompt.indexOf("<authorized_agent_profile>"));
    assert.doesNotMatch(prompt, /UNREVIEWED/);
    [a] = await withEchoContext(env, u, db.app_agents, false);
    assert.deepEqual(a.memories, []);
    assert.equal(a.memory_enabled, false);
    db.app_echo_profiles[0].memories_enabled = false;
    [a] = await withEchoContext(env, u, db.app_agents, true);
    assert.deepEqual(a.memories, []);
    assert.equal(calls.filter((c) => c.name === "app_echo_context").length, 1);
  });
});
test("permanent companions bypass ECHO context and cannot be deleted as ECHOs", async () => {
  await fixture(async ({ db, calls }) => {
    db.app_agents[0].kind = "aelio";
    const agents = await withEchoContext(env, { id: uid }, db.app_agents, true);
    assert.equal(agents[0].kind, "aelio");
    assert.equal(calls.length, 0);
    await assert.rejects(
      () => workspaces(request("/echo/" + aid, "DELETE"), env, "/echo/" + aid),
      (e) => e.status === 404,
    );
    assert.ok(!calls.some((c) => c.name === "app_delete_echo"));
  });
});
test("conversation projects persist through owner-scoped update and reject blank or overlong names", async () => {
  await fixture(async ({ db, calls }) => {
    const path = "/conversations/" + cid;
    let r = await chatRoutes(
      request(path, "PATCH", { project: " My studio " }),
      env,
      path,
    );
    assert.equal((await r.json()).conversation.project, "My studio");
    await assert.rejects(
      () => chatRoutes(request(path, "PATCH", { project: " " }), env, path),
      (e) => e.code === "invalid_project",
    );
    await assert.rejects(
      () =>
        chatRoutes(
          request(path, "PATCH", { project: "x".repeat(81) }),
          env,
          path,
        ),
      (e) => e.code === "invalid_project",
    );
    await chatRoutes(request(path, "PATCH", { project: null }), env, path);
    assert.equal(db.app_conversations[0].project, null);
    assert.ok(
      calls
        .filter(
          (c) => c.name === "app_conversations" && c.opts.method === "PATCH",
        )
        .every((c) => c.url.searchParams.get("owner_id") === "eq." + uid),
    );
  });
});

test('streaming speaker prefixes split across chunks are removed without changing quoted/later content',async()=>{
 const {speakerPrefixFilter}=await import('../platform/formatting.js');
 for(const chunks of [['[AE','LIO]',' Hello'],['AE','LIO:', ' Hello'],['[AELIO] Hello']]){const f=speakerPrefixFilter('AELIO');assert.equal(chunks.map(c=>f(c)).join('')+f('',true),'Hello');}
 for(const content of ['"AELIO: hello"','Discuss AELIO: this is useful','AELIO:Meaningful','[AELIO]s example']){const f=speakerPrefixFilter('AELIO');assert.equal(f(content)+f('',true),content);}
});
