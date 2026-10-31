// Requires disposable PostgreSQL + PostgREST on 55433, migrations applied. No production endpoints.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { platform } from "../platform/index.js";
import { scheduled } from "../platform/index.js";
const original = globalThis.fetch,
  rest = "http://127.0.0.1:55433",
  key = "aelio-local-rest-test-key-at-least-32-bytes";
const jwt = (role, sub) => {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    p = Buffer.from(
      JSON.stringify({ role, sub, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
  return (
    h +
    "." +
    p +
    "." +
    createHmac("sha256", key)
      .update(h + "." + p)
      .digest("base64url")
  );
};
const one = "11111111-1111-4111-8111-111111111111",
  two = "22222222-2222-4222-8222-222222222222",
  service = jwt("service_role"),
  tokens = {
    [one]: jwt("authenticated", one),
    [two]: jwt("authenticated", two),
  };
let payloads = [];
let resetPassword=null, logouts=0;
const objects = new Map();
const env = {
  SUPABASE_URL: "http://offline-supabase.local",
  SUPABASE_PUBLISHABLE_KEY: jwt("anon"),
  SUPABASE_SERVICE_ROLE_KEY: service,
  AELIO_SESSION_SECRET:
    "isolated-local-" + crypto.randomUUID() + "-" + crypto.randomUUID(),
  AELIO_GUEST_MESSAGES: "2",
  AELIO_MESSAGING_SECRET: "test-messaging-secret",
  AELIO_PROXY_SECRET: "test-proxy-secret",
  AELIO_STORAGE: {
    async put(k, v) {
      objects.set(k, new Uint8Array(v));
    },
    async get(k) {
      const b = objects.get(k);
      return b ? { body: b, arrayBuffer: async () => b.buffer } : null;
    },
    async delete(k) {
      objects.delete(k);
    },
  },
  AELIO_ENGINE: {
    async fetch(r) {
      const p = await r.json();
      payloads.push(p);
      return new Response(
        p.agents
          .map(
            (a) =>
              JSON.stringify({
                type: "delta",
                agent_id: a.id,
                speaker: a.name,
                text: "[offline test provider] " + p.content,
              }) + "\n",
          )
          .join("") +
          JSON.stringify({ type: "complete" }) +
          "\n",
      );
    },
  },
};
globalThis.fetch = async (url, opts = {}) => {
 if(new Headers(opts.headers).get('accept-profile')==='core')return new Response(JSON.stringify({code:'PGRST106',message:'Private schema is intentionally not exposed in this fixture.'}),{status:406,headers:{'content-type':'application/json'}});
  const s = String(url);
  if (s.startsWith(env.SUPABASE_URL + "/auth/v1/")) {
    const token = new Headers(opts.headers).get("authorization")?.slice(7);
    const id = Object.keys(tokens).find((id) => tokens[id] === token);
    if (s.endsWith("/user"))
      return Response.json(
        id
          ? { id, email: id === one ? "one@local.test" : "two@local.test" }
          : { error: "bad token" },
        { status: id ? 200 : 401 },
      );
    if(s.includes('/token?grant_type=password')){const data=JSON.parse(opts.body);return Response.json({user:{id:one,email:'one@local.test'},access_token:tokens[one],refresh_token:'fixture-refresh',expires_in:3600});}
    if(s.includes('/admin/users/')){resetPassword=JSON.parse(opts.body).password;return Response.json({id:one});}
    if(s.includes('/logout')){logouts++;return Response.json({ok:true});}
    throw new Error("Unsupported auth fixture operation");
  }
  if (s.startsWith(env.SUPABASE_URL + "/rest/v1/"))
    return original(
      rest + s.slice((env.SUPABASE_URL + "/rest/v1").length),
      opts,
    );
  return original(url, opts);
};
function request(path, method = "GET", data, uid = one, extra = {}) {
  return new Request("https://aelio.local/api/platform" + path, {
    method,
    headers: {
      origin: "https://aelio.local",
      "cf-connecting-ip": "192.0.2.19",
      ...(uid ? { authorization: "Bearer " + tokens[uid] } : {}),
      "content-type": "application/json",
      ...extra,
    },
    body:
      data === undefined
        ? undefined
        : typeof data === "string"
          ? data
          : JSON.stringify(data),
  });
}
async function call(path, method = "GET", data, uid = one, extra = {}) {
  const r = await platform(request(path, method, data, uid, extra), env);
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify({ path, status: r.status, d }));
  return d;
}
await test("real local RLS: isolated agents, two same-personality identities, per-chat themes, groups and storage lifecycle", async () => {
  const agents = (await call("/agents")).agents;
  assert.equal(agents.filter((a) => a.kind !== "custom").length, 8);
  const a = (
      await call("/agents", "POST", {
        name: "Chester",
        personality: "The Homie",
        subtitle: "Architecture",
      })
    ).agent,
    b = (
      await call("/agents", "POST", {
        name: "Marcus",
        personality: "The Homie",
        subtitle: "Relationships",
      })
    ).agent;
  assert.notEqual(a.id, b.id);
  const c = (
      await call("/conversations", "POST", {
        participants: [a.id],
        title: "Chester",
      })
    ).conversation,
    d = (
      await call("/conversations", "POST", {
        participants: [b.id],
        title: "Marcus",
      })
    ).conversation;
  await call("/conversations/" + c.id, "PATCH", {
    appearance: { outgoing: "#123abc", background: "City Skyline" },
  });
  assert.equal(
    (await call("/conversations")).conversations.find((x) => x.id === d.id)
      .appearance.outgoing,
    undefined,
  );
  const denied = await platform(
    request("/conversations/" + c.id + "/messages", "GET", undefined, two),
    env,
  );
  assert.equal(denied.status, 404);
  const file = (
    await call("/files", "POST", "private text", one, {
      "content-type": "text/plain",
      "x-file-name": "notes.txt",
      "x-conversation-id": c.id,
    })
  ).file;
  const foreign = await platform(
    request("/files/" + file.id, "GET", undefined, two),
    env,
  );
  assert.equal(foreign.status, 404);
  const retrieved = await platform(request("/files/" + file.id), env);
  assert.equal(await retrieved.text(), "private text");
  assert.match(retrieved.headers.get("content-disposition"), /attachment/);
  assert.equal(
    (await call("/files")).files.find((f) => f.id === file.id).owner_id,
    one,
  );
  const g = (
    await call("/conversations", "POST", {
      participants: [a.id, b.id],
      title: "Dream Team",
    })
  ).conversation;
  const response = await platform(
    request("/conversations/" + g.id + "/respond", "POST", {
      content: "Hello",
      consent: true,
      target: b.id,
    }),
    env,
  );
  const events = await response.text();
  assert.match(events, /saved/);
  assert.equal(payloads.at(-1).agents.length, 1);
  assert.equal(payloads.at(-1).agents[0].id, b.id);
  assert.equal(
    (await call("/conversations/" + g.id + "/messages")).messages.length,
    2,
  );
  await call("/files/" + file.id, "DELETE");
  assert.equal(objects.has(file.object_key), false);
  assert.equal(
    (await call("/files")).files.some((f) => f.id === file.id),
    false,
  );
  await call("/conversations/" + c.id, "DELETE");
  await call("/conversations/" + d.id, "DELETE");
  await call("/conversations/" + g.id, "DELETE");
  await call("/agents/" + a.id, "DELETE");
  await call("/agents/" + b.id, "DELETE");
});
await test("guest allowance persists in PostgreSQL, refuses over-limit generation, and securely transfers history once", async () => {
  const r = await platform(request("/guest", "POST", {}, null), env);
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0],
    g = await r.json();
  assert.equal(g.remaining, 2);
  for (let i = 0; i < 2; i++) {
    const r = await platform(
      request(
        "/conversations/" + g.conversation.id + "/respond",
        "POST",
        { content: "guest " + i, consent: true },
        null,
        { cookie },
      ),
      env,
    );
    assert.equal(r.status, 200);
    assert.match(await r.text(), /saved/);
  }
  const denied = await platform(
    request(
      "/conversations/" + g.conversation.id + "/respond",
      "POST",
      { content: "excess", consent: true },
      null,
      { cookie },
    ),
    env,
  );
  assert.equal(denied.status, 429);
  const claimed = await call("/guest/claim", "POST", {}, one, { cookie });
  assert.equal(claimed.count, 1);
  assert.equal(
    (await call("/conversations/" + g.conversation.id + "/messages")).messages
      .length,
    4,
  );
  const replay = await platform(
    request("/guest/claim", "POST", {}, two, { cookie }),
    env,
  );
  assert.equal(replay.status, 401);
  await call("/conversations/" + g.conversation.id, "DELETE");
});
await test("reminders persist, deliver once, and expose notifications only to their owner", async () => {
  const r = (
    await call("/career/reminders", "POST", {
      title: "Interview",
      due_at: new Date(Date.now() - 60000).toISOString(),
      timezone: "America/New_York",
      recurrence: "once",
    })
  ).item;
  await scheduled(env);
  await scheduled(env);
  const list = await call("/career/notifications");
  assert.equal(list.items.filter((n) => n.reminder_id === r.id).length, 1);
  assert.equal(
    (await call("/career/notifications", "GET", undefined, two)).items.some(
      (n) => n.reminder_id === r.id,
    ),
    false,
  );
  await call("/career/reminders/" + r.id, "DELETE");
});
await test('recovery route needs both protected answers and an unused strong code; codes are atomic and private',async()=>{
 const enroll=await call('/recovery/enroll','POST',{generate_codes:true,password:'fixture-password',questions:['Question one for local test?','Question two for local test?'],answers:['answer one','answer two']});
 assert.equal(enroll.codes.length,8);assert.equal(new Set(enroll.codes).size,8);
 const wrong=await platform(request('/recovery/reset','POST',{email:'one@local.test',password:'new-password-local-only',answers:['wrong','wrong'],code:enroll.codes[0]},null),env);assert.equal(wrong.status,400);assert.equal(resetPassword,null);
 const ok=await call('/recovery/reset','POST',{email:'one@local.test',password:'new-password-local-only',answers:['answer one','answer two'],code:enroll.codes[0]},null);assert.equal(ok.ok,true);assert.equal(resetPassword,'new-password-local-only');assert.ok(logouts>0);
 const replay=await platform(request('/recovery/reset','POST',{email:'one@local.test',password:'another-password-local-only',answers:['answer one','answer two'],code:enroll.codes[0]},null),env);assert.equal(replay.status,400);
 const hidden=await original(rest+'/recovery_credentials',{headers:{authorization:'Bearer '+tokens[two],'accept-profile':'core'}});assert.ok([401,403].includes(hidden.status));
});
await test('career context stays inside MILA unless outside sharing is explicitly granted',async()=>{
 const as=(await call('/agents')).agents,mila=as.find(a=>a.kind==='mila'),aelio=as.find(a=>a.kind==='aelio');
 const record=(await call('/career/records','POST',{kind:'goal',title:'Private career goal',data:{notes:'career-private-fixture'}})).item;
 await call('/account','PATCH',{career_consent:true,career_outside_mila:false});
 const c=(await call('/conversations','POST',{participants:[mila.id],title:'MILA privacy'})).conversation;
 let r=await platform(request('/conversations/'+c.id+'/respond','POST',{content:'Career goals',consent:true}),env);await r.text();assert.ok(payloads.at(-1).career.some(x=>x.id===record.id));
 const group=(await call('/conversations','POST',{participants:[mila.id,aelio.id],title:'Group privacy'})).conversation;
 r=await platform(request('/conversations/'+group.id+'/respond','POST',{content:'General topic',target:'group',consent:true}),env);await r.text();assert.equal(payloads.at(-1).career.length,0);
 await call('/account','PATCH',{career_consent:false,career_outside_mila:false});await call('/career/records/'+record.id,'DELETE');await call('/conversations/'+c.id,'DELETE');await call('/conversations/'+group.id,'DELETE');
});
await test('global appearance and retained custom agent settings persist with ownership checks',async()=>{
 await call('/account','PATCH',{appearance:{design:'ocean-fresh',dim:12}});
 assert.equal((await call('/account')).preferences.appearance.design,'ocean-fresh');
 const a=(await call('/agents','POST',{name:'Appearance-only fixture',personality:'Analytical',appearance_mode:'custom',appearance:{design:'chocolate-cream',outgoing:'#aabbcc'}})).agent;
 const inherited=(await call('/agents/'+a.id,'PATCH',{appearance_mode:'inherit'})).agent;
 assert.equal(inherited.appearance.design,'chocolate-cream');assert.equal(inherited.personality,'Analytical');
 const restored=(await call('/agents/'+a.id,'PATCH',{appearance_mode:'custom'})).agent;assert.equal(restored.appearance.outgoing,'#aabbcc');
 const denied=await platform(request('/agents/'+a.id,'PATCH',{appearance:{design:'og-dark'}},two),env);assert.equal(denied.status,404);
 const invalid=await platform(request('/account','PATCH',{appearance:{design:'malicious'}}),env);assert.equal(invalid.status,400);
 await call('/agents/'+a.id,'DELETE');
});

await test('stable request IDs replay completed turns without a second AI call or duplicate messages',async()=>{
 const a=(await call('/agents')).agents.find(a=>a.kind==='aelio');const c=(await call('/conversations','POST',{participants:[a.id],title:'Idempotent test'})).conversation;
 const request_id=crypto.randomUUID(),before=payloads.length;
 let response=await platform(request('/conversations/'+c.id+'/respond','POST',{content:'Save this once',consent:true,request_id}),env);assert.equal(response.status,200);assert.match(await response.text(),/saved/);
 response=await platform(request('/conversations/'+c.id+'/respond','POST',{content:'Save this once',consent:true,request_id}),env);assert.equal(response.status,200);assert.match(await response.text(),/replayed/);assert.equal(payloads.length,before+1);
 assert.equal((await call('/conversations/'+c.id+'/messages')).messages.length,2);
 const changed=await platform(request('/conversations/'+c.id+'/respond','POST',{content:'Different input',consent:true,request_id}),env);assert.equal(changed.status,409);
 const denied=await platform(request('/conversations/'+c.id+'/cancel','POST',{request_id},two),env);assert.equal(denied.status,404);
 await call('/conversations/'+c.id,'DELETE');
});

await test('owner bootstrap is independent of guest signing, idempotent and permanently preserves eight companions and nine chats',async()=>{
 const local={...env,AELIO_SESSION_SECRET:'short',SUPABASE_SERVICE_ROLE_KEY:undefined};
 const replies=await Promise.all(Array.from({length:3},()=>platform(request('/account'),local)));for(const reply of replies){assert.equal(reply.status,200);assert.equal((await reply.json()).user.id,one);}
 const health=await platform(request('/account/health'),local);const checked=await health.json();assert.equal(checked.authentication.verified,true);assert.equal(checked.account.verified,true);assert.equal(checked.serverDatabase,undefined);assert.equal(checked.ai,undefined);
 const as=(await call('/agents')).agents,permanent=as.filter(a=>a.kind!=='custom');assert.equal(permanent.length,8);assert.equal(new Set(permanent.map(a=>a.kind)).size,8);
 const chats=(await call('/conversations')).conversations.filter(c=>c.permanent_key);assert.equal(chats.length,9);assert.equal(new Set(chats.map(c=>c.permanent_key)).size,9);
 const team=chats.find(c=>c.permanent_key==='dream-team');assert.equal(team.participants.length,6);assert.ok(!team.participants.includes(permanent.find(a=>a.kind==='aelio').id));
 const before=chats.map(c=>c.id).sort();await call('/account');assert.deepEqual((await call('/conversations')).conversations.filter(c=>c.permanent_key).map(c=>c.id).sort(),before);
 const removed=await platform(request('/agents/'+permanent[2].id,'DELETE'),env);assert.equal(removed.status,403);
 const removedChat=await platform(request('/conversations/'+team.id,'DELETE'),env);assert.equal(removedChat.status,403);
 const changed=await call('/agents/'+permanent[2].id,'PATCH',{appearance_mode:'custom',appearance:{design:'chocolate-cream'}});assert.equal(changed.agent.appearance.design,'chocolate-cream');
 const renamed=await platform(request('/agents/'+permanent[2].id,'PATCH',{name:'Renamed'}),env);assert.equal(renamed.status,403);
 const req=request('/agents');const pathd=new Request(req,{headers:{...Object.fromEntries(req.headers),'x-aelio-product':'pathd'}});const only=(await (await platform(pathd,env)).json()).agents;assert.deepEqual(only.map(a=>a.kind).sort(),['aelio','mila']);
 const twoAccounts=await platform(request('/account','GET',undefined,two),local);assert.equal((await twoAccounts.json()).user.id,two);
});
await test('Dream Team coordinates direct mentions, streams correct speakers and preserves style and search privacy',async()=>{
 const team=(await call('/conversations')).conversations.find(c=>c.permanent_key==='dream-team');
 let response=await platform(request('/conversations/'+team.id+'/respond','POST',{content:'@Naomi help me build this app',consent:true}),env);assert.equal(response.status,200);assert.match(await response.text(),/Naomi/);assert.deepEqual(payloads.at(-1).agents.map(a=>a.kind),['naomi']);
 response=await platform(request('/conversations/'+team.id+'/respond','POST',{content:'Everybody, share your perspective',consent:true}),env);assert.equal(response.status,200);await response.text();assert.equal(payloads.at(-1).agents.length,6);
 await call('/account','PATCH',{mila_style:'advisor'});const mila=(await call('/conversations')).conversations.find(c=>c.permanent_key==='mila');response=await platform(request('/conversations/'+mila.id+'/respond','POST',{content:'Help me plan',consent:true}),env);await response.text();assert.match(payloads.at(-1).agents[0].instructions,/Thoughtful, practical, strategic/);
 const results=await call('/conversations/search?q='+encodeURIComponent('@Naomi help'));assert.ok(results.conversations.some(c=>c.id===team.id));const hidden=await call('/conversations/search?q='+encodeURIComponent('@Naomi help'),'GET',undefined,two);assert.ok(!hidden.conversations.some(c=>c.id===team.id));
});

await test('legacy deletion barriers fail before deleting any owned R2 objects',async()=>{
 const uploads=objects.size;
 const response=await platform(request('/account/delete','POST',{confirm:'DELETE MY SHARED ACCOUNT',password:'fixture-password'}),env);
 assert.equal(response.status,409);assert.equal((await response.json()).code,'account_deletion_requires_review');assert.equal(objects.size,uploads);
 const denied=await original(rest+'/rpc/app_recovery_record',{method:'POST',headers:{authorization:'Bearer '+tokens[one],'content-type':'application/json'},body:JSON.stringify({uid:one})});assert.ok([401,403].includes(denied.status));
});

await test('custom portraits are owned and editable while permanent portraits and crops stay locked',async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
 const uploaded=await platform(new Request('https://aelio.test/api/platform/files',{method:'POST',headers:{origin:'https://aelio.test',authorization:'Bearer '+tokens[one],'content-type':'image/png','x-file-name':'portrait.png','x-file-category':'agents','cf-connecting-ip':'127.0.0.1'},body:png}),env);assert.equal(uploaded.status,201);const file=(await uploaded.json()).file;
 const agent=(await call('/agents','POST',{name:'Owned portrait fixture',avatar_file_id:file.id,avatar_crop:{x:25,y:40,zoom:1.5}})).agent;assert.equal(agent.avatar_file_id,file.id);assert.equal(agent.avatar_crop.zoom,1.5);
 const stolen=await platform(request('/agents','POST',{name:'Unauthorized portrait fixture',avatar_file_id:file.id},two),env);assert.equal(stolen.status,404);
 const system=(await call('/agents')).agents.find(a=>a.kind==='mila');const denied=await platform(request('/agents/'+system.id,'PATCH',{avatar_file_id:file.id,avatar_crop:{x:0,y:0,zoom:3}}),env);assert.equal(denied.status,403);
 const reset=(await call('/agents/'+agent.id,'PATCH',{avatar_file_id:null,avatar_crop:{x:50,y:35,zoom:1}})).agent;assert.equal(reset.avatar_file_id,null);await call('/agents/'+agent.id,'DELETE');await call('/files/'+file.id,'DELETE');
});

globalThis.fetch = original;

await test('custom groups preserve histories, enforce owned participants, route mentions and remain editable independently',async()=>{
 globalThis.fetch=async(url,opts={})=>{const s=String(url);if(s.startsWith(env.SUPABASE_URL+'/auth/v1/'))return Response.json({id:one,email:'one@local.test'});if(s.startsWith(env.SUPABASE_URL+'/rest/v1/'))return original(rest+s.slice((env.SUPABASE_URL+'/rest/v1').length),opts);return original(url,opts);};
 // Owner checks exercised through the same production handlers; no inference required.
 try{const agents=(await call('/agents')).agents;const ids=agents.filter(a=>['aelio','naomi','reggie'].includes(a.kind)).map(a=>a.id);
 const first=(await call('/conversations','POST',{participants:ids,title:'Group fixture one'})).conversation;
 const second=(await call('/conversations','POST',{participants:ids,title:'Group fixture two'})).conversation;assert.notEqual(first.id,second.id);
 const edited=(await call('/conversations/'+first.id,'PATCH',{participants:ids.slice(0,2),group_tone:'debate',title:'Renamed fixture'})).conversation;assert.equal(edited.participants.length,2);assert.equal(edited.group_tone,'debate');
 const reread=(await call('/conversations')).conversations.find(c=>c.id===first.id);assert.equal(reread.title,'Renamed fixture');
 const team=(await call('/conversations')).conversations.find(c=>c.permanent_key==='dream-team');const denied=await platform(request('/conversations/'+team.id,'PATCH',{participants:ids}),env);assert.equal(denied.status,403);
 await call('/conversations/'+first.id,'DELETE');await call('/conversations/'+second.id,'DELETE');
 }finally{globalThis.fetch=original;}
});

await test('all eight companions traverse provider streaming and saved history; Simone provider failure is correlated and refunded',async()=>{
 const previousFetch=globalThis.fetch,previousInfo=console.info,previousError=console.error,logs=[];let rejectProvider=true;
 console.info=(value)=>logs.push(String(value));console.error=(value)=>logs.push(String(value));
 globalThis.fetch=async(url,options={})=>{const s=String(url);
  if(s.startsWith(env.SUPABASE_URL+'/auth/v1/'))return Response.json({id:two,email:'two@local.test'});
  if(s.startsWith(env.SUPABASE_URL+'/rest/v1/'))return original(rest+s.slice((env.SUPABASE_URL+'/rest/v1').length),options);
  if(s==='https://api.openai.com/v1/responses')return rejectProvider?Response.json({error:{code:'invalid_api_key',message:'fixture-secret-sentinel'}},{status:401}):new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:'Explicit synthetic provider reply.'})+'\n\ndata: '+JSON.stringify({type:'response.completed',response:{usage:{input_tokens:1,output_tokens:1}}})+'\n\n');
  throw Error('Unexpected network in provider fixture');
 };
 const configured={...env,AELIO_AI_PROVIDER:'openai',OPENAI_API_KEY:'fixture-secret-sentinel',AELIO_SESSION_SECRET:'short'};
 const api=async(path,method='GET',data)=>{const response=await platform(request(path,method,data,two),configured);const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result;};
 try{
  const agents=(await api('/agents')).agents.filter(a=>a.kind!=='custom');assert.equal(agents.length,8);
  const simone=agents.find(a=>a.kind==='simone');const c=(await api('/conversations','POST',{participants:[simone.id],title:'Simone backend regression fixture'})).conversation;
  const before=(await api('/account')).plans.find(p=>p.product==='aelio').credits;const request_id=crypto.randomUUID();
  const failed=await platform(request('/conversations/'+c.id+'/respond','POST',{content:'do-not-log-body',consent:true,request_id},two),configured);const failedText=await failed.text();assert.match(failedText,/provider_credentials_rejected/);assert.match(failedText,new RegExp(request_id));assert.match(failedText,/provider_stream/);
  const after=(await api('/account')).plans.find(p=>p.product==='aelio').credits;assert.equal(after,before);assert.equal((await api('/conversations/'+c.id+'/messages')).messages.length,0);await api('/conversations/'+c.id,'DELETE');
  rejectProvider=false;
  for(const agent of agents){const chat=(await api('/conversations','POST',{participants:[agent.id],title:'Backend fixture '+agent.name})).conversation;const response=await platform(request('/conversations/'+chat.id+'/respond','POST',{content:'do-not-log-body',consent:true,request_id:crypto.randomUUID()},two),configured);const output=await response.text();assert.match(output,/Explicit synthetic provider reply/);assert.match(output,/"type":"saved"/);const saved=(await api('/conversations/'+chat.id+'/messages')).messages;assert.equal(saved.length,2);assert.equal(saved[1].speaker,agent.name);await api('/conversations/'+chat.id,'DELETE');}
  const diagnostic=logs.join('\n');assert.match(diagnostic,/credit_reservation/);assert.match(diagnostic,/message_persistence/);assert.match(diagnostic,/openai_request_rejected/);assert.ok(!diagnostic.includes('fixture-secret-sentinel'));assert.ok(!diagnostic.includes('do-not-log-body'));assert.ok(!diagnostic.includes('two@local.test'));
 }finally{globalThis.fetch=previousFetch;console.info=previousInfo;console.error=previousError;}
});
