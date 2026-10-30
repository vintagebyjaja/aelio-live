// Tests the browser Supabase Auth client against a local mock of Supabase's /auth/v1 API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { webcrypto, createHash } from "node:crypto";

const out = await build({ entryPoints: ["_src/brain/supabase-auth.ts"], bundle: true, format: "esm", write: false, platform: "neutral" });
const { createSupabaseAuth } = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));

const URL_ = "https://abcdefghijklmnop.supabase.co", ANON = "sb_publishable_test";
function mock() {
  const users = new Map(), calls = []; let n = 0, clock = 1_000_000;
  const issue = (u) => ({ access_token: "at" + ++n, refresh_token: "rt" + n, expires_in: 3600, expires_at: clock + 3600, user: { id: u.id, email: u.email } });
  const refresh = new Map(), codes = new Map();
  const fetch = async (url, init) => {
    const u = new URL(url), body = JSON.parse(init.body || "{}"), h = init.headers;
    calls.push({ path: u.pathname + u.search, body, h });
    const json = (s, d) => new Response(JSON.stringify(d), { status: s });
    if (h.apikey !== ANON) return json(401, { msg: "bad key" });
    const p = u.pathname.replace("/auth/v1", ""), g = u.searchParams.get("grant_type");
    if (p === "/signup") {
      if (users.has(body.email)) return json(422, { error_code: "user_already_exists" });
      users.set(body.email, { id: "u" + users.size, email: body.email, pw: body.password, meta: body.data, confirmed: false });
      return json(200, { id: "u", email: body.email });                       // "Confirm email" on: no session
    }
    if (p === "/token" && g === "password") {
      const usr = users.get(body.email);
      if (!usr || usr.pw !== body.password) return json(400, { error_code: "invalid_credentials" });
      if (!usr.confirmed) return json(400, { error_code: "email_not_confirmed" });
      const t = issue(usr); refresh.set(t.refresh_token, usr); return json(200, t);
    }
    if (p === "/token" && g === "refresh_token") {
      const usr = refresh.get(body.refresh_token); refresh.delete(body.refresh_token);   // single use, like Supabase
      if (!usr) return json(400, { error_code: "refresh_token_not_found" });
      const t = issue(usr); refresh.set(t.refresh_token, usr); return json(200, t);
    }
    if (p === "/token" && g === "pkce") {
      const c = codes.get(body.auth_code); codes.delete(body.auth_code);
      const want = createHash("sha256").update(body.code_verifier || "").digest("base64url");
      if (!c || c.challenge !== want) return json(400, { error_code: "flow_state_not_found" });
      const t = issue(c.user); refresh.set(t.refresh_token, c.user); return json(200, t);
    }
    if (p === "/logout") { calls.at(-1).loggedOut = h.authorization; return new Response(null, { status: 204 }); }
    if (p === "/recover") return json(200, {});
    return json(404, {});
  };
  return { fetch, users, calls, codes, tick: (s) => (clock += s), now: () => clock };
}
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const client = (M, product = "aelio", storage = mem()) =>
  [createSupabaseAuth({ url: URL_, anonKey: ANON, product }, { fetch: M.fetch, storage, now: M.now, crypto: webcrypto }), storage];

test("PATHD signup records the product; same credentials then work on aelio.live", async () => {
  const M = mock();
  const [pathd] = client(M, "pathd");
  const r = await pathd.signUp("pat@x.dev", "correct horse battery");
  assert.equal(r.confirmEmail, true);
  assert.deepEqual(M.users.get("pat@x.dev").meta, { signup_product: "pathd", display_name: "" });
  await assert.rejects(pathd.signInWithPassword("pat@x.dev", "correct horse battery"), /Confirm your email/);
  M.users.get("pat@x.dev").confirmed = true;
  const [aelio] = client(M, "aelio");                     // different site, separate storage
  const s = await aelio.signInWithPassword("pat@x.dev", "correct horse battery");
  assert.equal(s.user.email, "pat@x.dev");
  assert.equal(await aelio.accessToken(), s.access_token);
});

test("wrong password and duplicate signup give plain messages", async () => {
  const M = mock(); const [c] = client(M);
  await c.signUp("a@x.dev", "pw-1234567890"); M.users.get("a@x.dev").confirmed = true;
  await assert.rejects(c.signInWithPassword("a@x.dev", "nope"), /don't match/);
  await assert.rejects(c.signUp("a@x.dev", "pw-1234567890"), /already an account/);
});

test("expiring sessions refresh once, even with parallel callers; revoked refresh signs out", async () => {
  const M = mock(); const [c, st] = client(M);
  await c.signUp("a@x.dev", "pw-1234567890"); M.users.get("a@x.dev").confirmed = true;
  const s1 = await c.signInWithPassword("a@x.dev", "pw-1234567890");
  M.tick(3590);
  const [t1, t2] = await Promise.all([c.accessToken(), c.accessToken()]);
  assert.equal(t1, t2); assert.notEqual(t1, s1.access_token);
  assert.equal(M.calls.filter(x => x.path.includes("refresh_token")).length, 1);
  const saved = JSON.parse(st.getItem("aelio.auth")); saved.refresh_token = "revoked"; saved.expires_at = 0;
  st.setItem("aelio.auth", JSON.stringify(saved));
  assert.equal(await c.accessToken(), null);
  assert.equal(st.getItem("aelio.auth"), null);
});

test("Google sign-in uses PKCE; a code can't be used in another browser or twice", async () => {
  const M = mock(); const [c] = client(M);
  const url = new URL(await c.oauthUrl("google", "https://aelio.live/brain/"));
  assert.equal(url.origin + url.pathname, URL_ + "/auth/v1/authorize");
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  const user = { id: "g1", email: "g@x.dev" };
  M.codes.set("code-1", { user, challenge: url.searchParams.get("code_challenge") });
  const [other] = client(M);
  await assert.rejects(other.exchangeCode("code-1"), /another browser/);
  M.codes.set("code-2", { user, challenge: url.searchParams.get("code_challenge") });
  assert.equal((await c.exchangeCode("code-2")).user.email, "g@x.dev");
  await assert.rejects(c.exchangeCode("code-2"), /another browser/);      // verifier was consumed
});

test("sign out clears the session and revokes it on the server", async () => {
  const M = mock(); const [c, st] = client(M);
  await c.signUp("a@x.dev", "pw-1234567890"); M.users.get("a@x.dev").confirmed = true;
  const s = await c.signInWithPassword("a@x.dev", "pw-1234567890");
  await c.signOut();
  assert.equal(st.getItem("aelio.auth"), null);
  assert.equal(M.calls.at(-1).loggedOut, "Bearer " + s.access_token);
});

test("only the publishable key is ever sent", async () => {
  const M = mock(); const [c] = client(M);
  await c.signUp("a@x.dev", "pw-1234567890").catch(() => {});
  assert.ok(M.calls.every(x => x.h.apikey === ANON && !JSON.stringify(x).includes("service_role")));
});

test('missing/privileged config, rejected API key and network errors remain distinct',async()=>{
 let sent=0;const storage=mem();
 for(const anonKey of ['', 'sb_secret_do_not_send'])assert.throws(()=>createSupabaseAuth({url:URL_,anonKey},{storage,fetch:async()=>{sent++;return Response.json({});}}),/configuration/);
 assert.equal(sent,0);
 const keyClient=createSupabaseAuth({url:URL_,anonKey:ANON},{storage,fetch:async()=>Response.json({message:'Invalid API key'},{status:401})});
 await assert.rejects(keyClient.signInWithPassword('a@x.dev','pw'),e=>e.code==='auth_key_rejected'&&/public key/.test(e.message));
 const offline=createSupabaseAuth({url:URL_,anonKey:ANON},{storage,fetch:async()=>{throw new TypeError('offline');}});
 await assert.rejects(offline.signInWithPassword('a@x.dev','pw'),e=>e.code==='auth_network_error');
});
test('signup with confirmation disabled persists a session across client reloads',async()=>{
 const st=mem(),calls=[];const f=async(url,opts)=>{calls.push(JSON.parse(opts.body));return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,user:{id:'fixture-user',email:'new@local.test'}});};
 const c=createSupabaseAuth({url:URL_,anonKey:ANON,product:'aelio'},{fetch:f,storage:st});const result=await c.signUp('new@local.test','strong-local-fixture',undefined,'New user');assert.equal(result.confirmEmail,false);assert.equal(calls[0].data.signup_product,'aelio');
 const reloaded=createSupabaseAuth({url:URL_,anonKey:ANON},{fetch:f,storage:st});assert.equal((await reloaded.session()).user.id,'fixture-user');
});
test('refresh network failures and 429 preserve the stored session for retry',async()=>{
 const M=mock(),[first,st]=client(M);await first.signUp('retry@x.dev','pw-1234567890');M.users.get('retry@x.dev').confirmed=true;await first.signInWithPassword('retry@x.dev','pw-1234567890');M.tick(3590);
 for(const response of ['network','rate']){
  const c=createSupabaseAuth({url:URL_,anonKey:ANON},{storage:st,now:M.now,fetch:async()=>{if(response==='network')throw new TypeError('offline');return Response.json({error_code:'over_request_rate_limit'},{status:429});}});
  await assert.rejects(c.session());assert.ok(st.getItem('aelio.auth'));
 }
 const resumed=createSupabaseAuth({url:URL_,anonKey:ANON},{storage:st,now:M.now,fetch:M.fetch});assert.ok(await resumed.session());
});
test('logout is local to this product session and an in-flight refresh cannot undo it',async()=>{
 const M=mock(),[first,st]=client(M);await first.signUp('race@x.dev','pw-1234567890');M.users.get('race@x.dev').confirmed=true;await first.signInWithPassword('race@x.dev','pw-1234567890');M.tick(3590);let release;
 const c=createSupabaseAuth({url:URL_,anonKey:ANON},{storage:st,now:M.now,fetch:async(url,opts)=>String(url).includes('grant_type=refresh_token')?new Promise(resolve=>{release=()=>resolve(M.fetch(url,opts));}):M.fetch(url,opts)});
 const refresh=c.session();await c.signOut();assert.ok(M.calls.at(-1).path.includes('scope=local'));release();assert.equal(await refresh,null);assert.equal(st.getItem('aelio.auth'),null);
});

test('another client logout is respected while storage-blocked browsers retain a page-only session',async()=>{
 const M=mock(),st=mem(),[one]=client(M,'aelio',st);await one.signUp('tabs@x.dev','pw-1234567890');M.users.get('tabs@x.dev').confirmed=true;
 const [two]=client(M,'aelio',st);await two.signInWithPassword('tabs@x.dev','pw-1234567890');await one.signOut();assert.equal(await two.session(),null);
 const unavailable={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 const c=createSupabaseAuth({url:URL_,anonKey:ANON},{storage:unavailable,fetch:M.fetch,now:M.now});await c.signInWithPassword('tabs@x.dev','pw-1234567890');assert.ok(await c.session());await c.signOut();assert.equal(await c.session(),null);
});

test('Apple OAuth uses fresh PKCE without calendar scopes; linking cannot replace the existing UUID',async()=>{
 const M=mock(),original=M.fetch;let query;
 M.fetch=async(url,init)=>{if(String(url).includes('/user/identities/authorize')){query=new URL(url);assert.ok(init.headers.authorization);assert.equal(query.searchParams.get('skip_http_redirect'),'true');return Response.json({url:'https://appleid.apple.com/auth/authorize?fixture=1'});}return original(url,init);};
 const [c]=client(M);const start=new URL(await c.oauthUrl('apple','https://aelio.live/auth/callback/'));
 assert.equal(start.searchParams.get('provider'),'apple');assert.equal(start.searchParams.get('code_challenge_method'),'s256');assert.ok(!start.search.includes('calendar'));
 await c.signUp('existing@example.test','existing-password');M.users.get('existing@example.test').confirmed=true;
 const old=await c.signInWithPassword('existing@example.test','existing-password');
 assert.match(await c.oauthUrl('apple','https://aelio.live/auth/callback/',true),/^https:\/\/appleid/);
 M.codes.set('mismatched',{user:{id:'other-user',email:'other@example.test'},challenge:query.searchParams.get('code_challenge')});
 await assert.rejects(c.exchangeCode('mismatched'),/original session has been preserved/);
 assert.equal((await c.session()).user.id,old.user.id);
});
