import {consumerMessage} from "../shared/experience.js";
import {companion,coordinateTeam} from "../shared/companions.js";
import {milaStyleInstruction} from "../shared/mila-style.js";
import {openAIResponses} from "./providers/openai.js";
import { ecosystemHandoff } from "../shared/ecosystem.js";
import {
  reply,
  fail,
  Problem,
  body,
  who,
  table,
  rpc,
  text,
  uuid,
  random,
  cookie,
  keyed,
  own,
  member,
  audit,
  rate,
  sb,
} from "./shared.js";
const personalities = [
  "The Homie",
  "Proper British",
  "Classy Gyal",
  "Creative",
  "Analytical",
  "Mindful",
  "Tech Savvy",
  "Young & Hip",
  "Good Energy",
  "Real Talk",
];
export const PERSONALITIES = personalities;
export const backgrounds = [
  "AELIO Original",
  "Space & Galaxies",
  "Nature & Waterfalls",
  "City Skyline",
  "Sunset & Beaches",
  "Sports Lounge",
  "Basketball Court",
  "Football Stadium",
  "Cigar Lounge",
  "Executive Office",
  "Luxury Penthouse",
  "Minimal Black",
  "Minimal White",
  "Custom Upload",
];
export function appearance(d) {
  const out = {};
  if (!d || typeof d !== "object" || Array.isArray(d))
    fail(400, "invalid_theme", "Choose valid appearance settings.");
  if (d.design !== undefined) {
    if (
      !["og-light", "og-dark", "ocean-fresh", "chocolate-cream"].includes(
        d.design,
      )
    )
      fail(400, "invalid_theme", "Choose an official AELIO design.");
    out.design = d.design;
  }
  if (d.motion !== undefined) {
    if (!["system", "reduced"].includes(d.motion))
      fail(400, "invalid_theme", "Invalid motion preference.");
    out.motion = d.motion;
  }
  for (const k of ["incoming", "outgoing", "text"])
    if (d[k] !== undefined) {
      if (!/^#[0-9a-f]{6}$/i.test(d[k]))
        fail(400, "invalid_color", "Use a six-digit color.");
      out[k] = d[k];
    }
  if (d.mode !== undefined) {
    if (!["dark", "light"].includes(d.mode))
      fail(400, "invalid_theme", "Invalid theme.");
    out.mode = d.mode;
  }
  if (d.background !== undefined) {
    if (!backgrounds.includes(d.background))
      fail(400, "invalid_theme", "Invalid background.");
    out.background = d.background;
  }
  for (const k of ["dim", "blur"])
    if (d[k] !== undefined) {
      const n = Number(d[k]);
      if (!Number.isFinite(n) || n < 0 || n > (k === "blur" ? 20 : 90))
        fail(400, "invalid_theme", "Invalid appearance setting.");
      out[k] = n;
    }
  if (d.file_id !== undefined) {
    if (d.file_id !== null && !uuid(d.file_id))
      fail(400, "invalid_theme", "Invalid background file.");
    out.file_id = d.file_id;
  }
  return out;
}
export async function backgroundFile(env, id, u) {
  const file = await own(env, "app_files", id, u);
  if (
    file.status !== "ready" ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.mime)
  )
    fail(400, "invalid_background", "Choose an uploaded image.");
  return file;
}
export async function guest(req, env, create = false) {
  let id = cookie(req, "aelio_guest");
  let header = null;
  if (!id || !/^[a-f0-9]{64}$/.test(id)) {
    if (!create)
      fail(401, "guest_session_required", "Start a guest conversation first.");
    id = random();
    header = `aelio_guest=${id}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;
  }
  const hash = await keyed(env, "guest:" + id);
  let rows = await table(env, "app_guests", "id_hash=eq." + hash, {
    service: true,
  });
  if (!rows.length && create)
    rows = await table(env, "app_guests", "", {
      service: true,
      method: "POST",
      data: { id_hash: hash },
    });
  const g = rows[0];
  if (!g || g.claimed_by || Date.parse(g.expires_at) <= Date.now())
    fail(
      401,
      "guest_expired",
      "This guest session has ended. Sign in to keep chatting.",
    );
  return { ...g, header };
}
export async function conversation(req, env, id, u) {
  if (u) return own(env, "app_conversations", id, u);
  const g = await guest(req, env);
  if (!uuid(id)) fail(404, "not_found", "Not found.");
  const rows = await table(
    env,
    "app_conversations",
    "id=eq." + id + "&guest_hash=eq." + g.id_hash,
    { service: true },
  );
  if (!rows[0]) fail(404, "not_found", "Not found.");
  return rows[0];
}
export async function chatRoutes(req, env, path) {
  const productScope =
    req.headers.get("x-aelio-product") === "pathd" ? "pathd" : "aelio";
  const u = await who(req, env, true);
  if (u) await member(env, u, productScope);
  if (path === "/guest" && req.method === "POST") {
    const g = await guest(req, env, true);
    let threads = await table(
      env,
      "app_conversations",
      "guest_hash=eq." + g.id_hash,
      { service: true },
    );
    if (!threads.length)
      threads = await table(env, "app_conversations", "", {
        method: "POST",
        service: true,
        data: { guest_hash: g.id_hash, title: "AELIO", participants: [] },
      });
    return reply(
      {
        conversation: threads[0],
        remaining: Math.max(
          0,
          Number(env.AELIO_GUEST_MESSAGES || 10) - g.messages_used,
        ),
      },
      200,
      g.header ? { "set-cookie": g.header } : {},
    );
  }
  if (path === "/guest/claim" && req.method === "POST") {
    if (!u) fail(401, "authentication_required", "Sign in first.");
    const g = await guest(req, env);
    const count = await rpc(env, "app_claim_guest", {
      g: g.id_hash,
      uid: u.id,
    });
    await audit(env, u, "guest.claim");
    return reply({ count }, 200, {
      "set-cookie":
        "aelio_guest=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
    });
  }
  if (path === "/agents") {
    if (!u) fail(401, "authentication_required", "Sign in to manage agents.");
    if (req.method === "GET") {
      await sb(env,"/rest/v1/rpc/app_account_bootstrap",{token:u.token,method:"POST",data:{}});
      return reply({
        agents: await table(
          env,
          "app_agents",
          "owner_id=eq." +
            u.id +
            (productScope === "pathd" ? "&kind=in.(aelio,mila)" : "") +
            "&order=created_at.asc",
          { token: u.token },
        ),
        personalities,
      });
    }
    if (req.method === "POST") {
      if (productScope === "pathd")
        fail(403, "pathd_agents", "PATHD offers AELIO and MILA only.");
      const d = await body(req);
      const a = agentFields(d);
      if(a.avatar_file_id)await backgroundFile(env,a.avatar_file_id,u);
      if (a.appearance?.file_id)
        await backgroundFile(env, a.appearance.file_id, u);
      if (!a.name) fail(400, "name_required", "Name your agent.");
      const rows = await table(env, "app_agents", "owner_id=eq." + u.id, {
        token: u.token,
      });
      if (rows.length >= 100)
        fail(429, "agent_limit", "You have reached the agent limit.");
      return reply(
        {
          agent: (
            await table(env, "app_agents", "", {
              service: true,
              method: "POST",
              data: { ...a, owner_id: u.id, kind: "custom" },
            })
          )[0],
        },
        201,
      );
    }
  }
  const am = path.match(/^\/agents\/([a-f0-9-]+)(\/publish)?$/i);
  if (am) {
    if (!u) fail(401, "authentication_required", "Sign in first.");
    const a = await own(env, "app_agents", am[1], u);
    if (am[2] && req.method === "POST") {
      if (a.kind !== "custom")
        fail(400, "system_agent", "System companions cannot be published.");
      const d = await body(req);
      const row = {
        creator_id: u.id,
        name: a.name,
        subtitle: a.subtitle,
        specialty: a.specialty,
        personality: a.personality,
        description: text(d.description, 1000),
        capabilities: [],
        status: "draft",
      };
      return reply(
        {
          publication: (
            await table(env, "app_agent_publications", "", {
              service: true,
              method: "POST",
              data: row,
            })
          )[0],
        },
        201,
      );
    }
    if(a.kind!=="custom" && req.method==="PATCH"){
      const d=await body(req);if(Object.keys(d).some(k=>!["appearance","appearance_mode"].includes(k)))fail(403,"permanent_companion","This companion’s identity stays the same. You can customize its appearance.");
      const fields={};if(d.appearance!==undefined){fields.appearance=appearance(d.appearance);if(fields.appearance.file_id)await backgroundFile(env,fields.appearance.file_id,u);}
      if(d.appearance_mode!==undefined){if(!['inherit','custom'].includes(d.appearance_mode))fail(400,'invalid_appearance','Choose how this companion should look.');fields.appearance_mode=d.appearance_mode;}
      return reply({agent:(await table(env,"app_agents","id=eq."+a.id+"&owner_id=eq."+u.id,{service:true,method:"PATCH",data:fields}))[0]});
    }
    if (a.kind !== "custom")
      fail(
        403,
        "permanent_companion",
        "Your permanent companions stay with you.",
      );
    if (req.method === "PATCH") {
      const d = await body(req);
      const fields = agentFields(d);
      if(fields.avatar_file_id)await backgroundFile(env,fields.avatar_file_id,u);
      if (fields.appearance?.file_id)
        await backgroundFile(env, fields.appearance.file_id, u);
      return reply({
        agent: (
          await table(
            env,
            "app_agents",
            "id=eq." + a.id + "&owner_id=eq." + u.id,
            { service: true, method: "PATCH", data: fields },
          )
        )[0],
      });
    }
    if (req.method === "DELETE") {
      const cs = await table(env, "app_conversations", "owner_id=eq." + u.id, {
        token: u.token,
      });
      if (cs.some((c) => c.participants.includes(a.id)))
        fail(
          409,
          "agent_in_use",
          "Remove this agent’s conversations before deleting it.",
        );
      await table(env, "app_agents", "id=eq." + a.id + "&owner_id=eq." + u.id, {
        service: true,
        method: "DELETE",
      });
      return reply({ ok: true });
    }
  }
  if(path==='/conversations/search'&&req.method==='GET'){
    if(!u)fail(401,'authentication_required','Sign in to search your history.');
    const term=text(new URL(req.url).searchParams.get('q')||'',100);
    return reply({conversations:await sb(env,'/rest/v1/rpc/app_search_history',{token:u.token,method:'POST',data:{term,product_scope:productScope}})});
  }
  if (path === "/conversations") {
    if (!u)
      fail(401, "authentication_required", "Sign in to save conversations.");
    if (req.method === "GET")
      return reply({
        conversations: await table(
          env,
          "app_conversations",
          "owner_id=eq." +
            u.id +
            (productScope === "pathd" ? "&product=eq.pathd" : "") +
            "&order=updated_at.desc&limit=500&select=*,app_messages(content,created_at)&app_messages.order=created_at.desc&app_messages.limit=1",
          { token: u.token },
        ),
      });
    if (req.method === "POST") {
      const d = await body(req);
      if (
        !Array.isArray(d.participants) ||
        !d.participants.length ||
        d.participants.length > 8 ||
        new Set(d.participants).size !== d.participants.length
      )
        fail(400, "invalid_participants", "Choose one to eight agents.");
      const agents = await Promise.all(
        d.participants.map((id) => own(env, "app_agents", id, u)),
      );
      const product =
        productScope === "pathd" || d.product === "pathd" ? "pathd" : "aelio";
      if (product === "pathd" && agents.some((a) => !["aelio","mila"].includes(a.kind)))
        fail(403, "pathd_agents", "PATHD offers AELIO and MILA only.");
      await member(env, u, product);
      return reply(
        {
          conversation: (
            await table(env, "app_conversations", "", {
              service: true,
              method: "POST",
              data: {
                owner_id: u.id,
                product,
                participants: d.participants,
                title: text(
                  d.title || agents.map((a) => a.name).join(" + "),
                  160,
                ),
                subtitle: text(d.subtitle || "", 160),
              },
            })
          )[0],
        },
        201,
      );
    }
  }
  const cm = path.match(
    /^\/conversations\/([a-f0-9-]+)(\/messages|\/respond|\/cancel|\/suggest-subtitle)?$/i,
  );
  if (cm) {
    const c = await conversation(req, env, cm[1], u);
    if (u) await member(env, u, c.product);
    if (productScope === "pathd" && c.product !== "pathd")
      fail(404, "not_found", "Not found.");
    if (cm[2] === "/messages" && req.method === "GET") {
      const rows = await table(
        env,
        "app_messages",
        "conversation_id=eq." +
          c.id +
          "&order=created_at.desc,id.desc&limit=100",
        { ...(u ? { token: u.token } : { service: true }) },
      );
      return reply({ messages: rows.reverse() });
    }
    if(cm[2]==='/cancel' && req.method==='POST'){
      const data=await body(req);if(!uuid(data.request_id))fail(400,'invalid_request_id','Choose a valid generation request.');
      const attempt=await rpc(env,'app_chat_request_lookup',{rid:data.request_id});
      if(!attempt||attempt.conversation_id!==c.id||attempt.owner_id!==(u?.id||null))fail(404,'not_found','Not found.');
      if(attempt.status==='running')await rpc(env,'app_finish_chat',{rid:attempt.id,ok:false});
      return reply({stopped:attempt.status!=='complete',complete:attempt.status==='complete'});
    }
    if (cm[2] === "/respond" && req.method === "POST")
      return generate(req, env, c, u);
    if (cm[2] === "/suggest-subtitle" && req.method === "POST")
      return generate(req, env, c, u, true);
    if (!u) fail(403, "sign_in_required", "Sign in to manage conversations.");
    if (req.method === "PATCH" && !cm[2]) {
      const d = await body(req),
        fields = {};
      for (const k of ["title", "subtitle"])
        if (d[k] !== undefined) fields[k] = text(d[k], 160);
      if(c.permanent_key==='dream-team'&&((fields.title!==undefined&&fields.title!==c.title)||(fields.subtitle!==undefined&&fields.subtitle!==c.subtitle)))fail(403,"permanent_conversation","Dream Team keeps its name. You can customize its appearance.");
      for (const k of ["pinned", "archived", "memory_enabled"])
        if (d[k] !== undefined) fields[k] = d[k] === true;
      if (d.appearance) {
        fields.appearance = appearance(d.appearance);
        if (fields.appearance.file_id) {
          const f = await own(env, "app_files", fields.appearance.file_id, u);
          if (!f.mime.startsWith("image/") || f.status !== "ready")
            fail(400, "invalid_background", "Choose an uploaded image.");
        }
      }
      return reply({
        conversation: (
          await table(
            env,
            "app_conversations",
            "id=eq." + c.id + "&owner_id=eq." + u.id,
            { service: true, method: "PATCH", data: fields },
          )
        )[0],
      });
    }
    if (req.method === "DELETE" && !cm[2]) {
      if(c.permanent_key)fail(403,"permanent_conversation","This chat stays with you. You can archive it instead.");
      if (c.busy_until && Date.parse(c.busy_until) > Date.now())
        fail(409, "reply_in_progress", "Wait for the reply to finish.");
      await table(
        env,
        "app_conversations",
        "id=eq." + c.id + "&owner_id=eq." + u.id,
        { service: true, method: "DELETE" },
      );
      return reply({ ok: true });
    }
  }
  fail(404, "not_found", "Not found.");
}
export function avatarCrop(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['x','y','zoom'].includes(k)))fail(400,'invalid_avatar_crop','Choose a valid portrait crop.');
 const crop={x:value.x??50,y:value.y??35,zoom:value.zoom??1};
 if(!Object.values(crop).every(n=>typeof n==='number'&&Number.isFinite(n))||crop.x<0||crop.x>100||crop.y<0||crop.y>100||crop.zoom<1||crop.zoom>3)fail(400,'invalid_avatar_crop','Adjust the portrait within the image.');
 return crop;
}
function agentFields(d) {
  const a = {};
  if(d.avatar_crop!==undefined)a.avatar_crop=avatarCrop(d.avatar_crop);
  if(d.avatar_file_id!==undefined){if(d.avatar_file_id!==null&&!uuid(d.avatar_file_id))fail(400,"invalid_avatar","Choose an uploaded portrait.");a.avatar_file_id=d.avatar_file_id;}
  if (d.appearance !== undefined) a.appearance = appearance(d.appearance);
  if (d.appearance_mode !== undefined) {
    if (!["inherit", "custom"].includes(d.appearance_mode))
      fail(400, "invalid_theme", "Choose inherited or custom appearance.");
    a.appearance_mode = d.appearance_mode;
  }
  if (d.name && ["aelio", "mila"].includes(String(d.name).trim().toLowerCase()))
    fail(400, "reserved_name", "AELIO and MILA are reserved companion names.");
  for (const [k, max] of Object.entries({
    name: 80,
    subtitle: 160,
    specialty: 1000,
    instructions: 4000,
    voice: 80,
  }))
    if (d[k] !== undefined) a[k] = text(d[k], max);
  if (d.personality !== undefined) {
    if (d.personality !== null && !personalities.includes(d.personality))
      fail(400, "invalid_personality", "Choose an available personality.");
    a.personality = d.personality;
  }
  if (d.memories !== undefined) {
    if (!Array.isArray(d.memories) || d.memories.length > 30)
      fail(400, "invalid_memories", "Use up to 30 approved memories.");
    a.memories = d.memories.map((m) => text(m, 300));
  }
  if (d.memory_enabled !== undefined)
    a.memory_enabled = d.memory_enabled === true;
  return a;
}
async function engine(env, payload, signal) {
  const provider=env.AELIO_AI_PROVIDER || (env.OPENAI_API_KEY?'openai':'brain');
  if(provider==='openai')return openAIResponses(env,payload,signal);
  if(provider!=='brain')fail(503,'ai_provider_invalid','The AI provider configuration is invalid.');
  if (!env.AELIO_ENGINE?.fetch && !env.AELIO_ENGINE_ORIGIN)
    fail(
      503,
      "engine_not_connected",
      "The account service is online, but the AELIO engine binding is missing.",
    );
  if (!env.AELIO_MESSAGING_SECRET || !env.AELIO_PROXY_SECRET)
    fail(
      503,
      "engine_configuration_missing",
      "The private engine bridge needs its server secrets.",
    );
  const target =
    (env.AELIO_ENGINE?.fetch
      ? "http://aelio-engine.internal"
      : env.AELIO_ENGINE_ORIGIN.replace(/\/$/, "")) + "/api/internal/messaging";
  const req = new Request(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aelio-proxy-secret": env.AELIO_PROXY_SECRET,
      "x-aelio-messaging-secret": env.AELIO_MESSAGING_SECRET,
    },
    body: JSON.stringify(payload),
    signal,
  });
  let res;
  try {
    res = env.AELIO_ENGINE?.fetch
      ? await env.AELIO_ENGINE.fetch(req)
      : await fetch(req);
  } catch {
    fail(
      502,
      "engine_unavailable",
      "The AELIO engine is temporarily unavailable. Your account remains accessible.",
    );
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    fail(
      res.status,
      e.code || "brain_failure",
      e.error || "The Brain could not complete this request.",
    );
  }
  return res;
}
async function generate(req, env, c, u, suggest = false) {
  const d = await body(req);
  const input = text(d.content || "", 8000);
  if (!input && !suggest) fail(400, "empty_message", "Write a message first.");
  if (d.consent !== true)
    fail(
      403,
      "consent_required",
      "Accept the AI disclosure before sending a message.",
    );
  const rid=d.request_id || crypto.randomUUID();
  if(!uuid(rid))fail(400,'invalid_request_id','Use a valid request identifier.');
  async function replayAttempt(){
    const previous=await rpc(env,'app_chat_request_lookup',{rid});
    if(!previous)return null;
    if(previous.conversation_id!==c.id||previous.owner_id!==(u?.id||null))fail(409,'request_id_reused','Use a new request identifier.');
    if(previous.status==='running')fail(409,'reply_in_progress','This reply is still running. Stop it or wait before retrying.');
    if(previous.status==='failed')fail(409,'retry_new_request','The earlier attempt ended. Retry with a new request identifier.');
    const stored=await table(env,'app_messages','conversation_id=eq.'+c.id+'&request_id=eq.'+rid+'&role=eq.user',{service:true});
    if(!stored.some(message=>message.content===input))fail(409,'request_id_reused','This request identifier belongs to a different message.');
    return new Response(JSON.stringify({type:'saved',request_id:rid,replayed:true})+'\n',{headers:{'content-type':'application/x-ndjson','cache-control':'no-store','x-request-id':rid}});
  }
  if(d.request_id){const replay=await replayAttempt();if(replay)return replay;}
  let agents = u
    ? await Promise.all(
        c.participants.map((id) => own(env, "app_agents", id, u)),
      )
    : [
        {
          id: null,
          kind: "aelio",
          name: "AELIO",
          subtitle: "Your Original Main Pal",
        },
      ];
  if (
    c.product === "pathd" &&
    agents.some((a) => !["aelio", "mila"].includes(a.kind))
  )
    fail(403, "pathd_agents", "PATHD offers AELIO and MILA only.");
  if(c.permanent_key==="dream-team"&&(!d.target||d.target==="group")){agents=coordinateTeam(agents,input);}
  else if (d.target && d.target !== "group") {
    agents = agents.filter((a) => a.id === d.target);
    if (!agents.length)
      fail(400, "invalid_target", "Choose a participant in this conversation.");
  } else if (d.target !== "group") agents = agents.slice(0, 1);
  if (agents.length > (c.permanent_key==="dream-team"?6:4))
    fail(400, "group_limit", "Address up to four agents at a time.");
  const history = (
    await table(
      env,
      "app_messages",
      "conversation_id=eq." +
        c.id +
        "&status=eq.complete&order=created_at.desc,id.desc&limit=30",
      { ...(u ? { token: u.token } : { service: true }) },
    )
  ).reverse();
  const pref = u
    ? (
        await table(env, "app_preferences", "user_id=eq." + u.id, {
          token: u.token,
        })
      )[0]
    : null;
  agents=agents.map(agent=>{const official=companion(agent.kind);return official&&!["aelio","mila"].includes(agent.kind)?{...agent,name:official.name,instructions:official.description}:agent;});
  agents=agents.map(agent=>agent.kind==="mila"?{...agent,instructions:[agent.instructions||"",milaStyleInstruction(pref?.mila_style)].filter(Boolean).join("\n")}:agent);
  const career =
    u &&
    pref?.career_consent &&
    ((c.participants.length === 1 && agents.some((a) => a.kind === "mila")) ||
      pref.career_outside_mila)
      ? await table(
          env,
          "app_career_records",
          "owner_id=eq." + u.id + "&limit=30",
          { token: u.token },
        )
      : [];
  const attachments = [];
  if (d.file_ids?.length) {
    if (!u || !Array.isArray(d.file_ids) || d.file_ids.length > 3)
      fail(400, "attachments_invalid", "Sign in and select up to three files.");
    for (const id of d.file_ids) {
      const f = await own(env, "app_files", id, u);
      if (
        f.status !== "ready" ||
        (f.conversation_id && f.conversation_id !== c.id) ||
        f.size_bytes > 1000000 ||
        (f.expires_at && Date.parse(f.expires_at) <= Date.now())
      )
        fail(
          400,
          "attachment_unavailable",
          "This attachment is unavailable or too large for chat.",
        );
      if (
        !["text/plain", "application/json", "application/pdf"].includes(f.mime)
      )
        fail(
          415,
          "attachment_unsupported",
          "Text, JSON and PDF attachments are supported for inference. Other media can be stored and downloaded.",
        );
      const o = await env.AELIO_STORAGE?.get(f.object_key);
      if (!o) fail(404, "attachment_missing", "Attachment not found.");
      const bytes = new Uint8Array(await o.arrayBuffer());
      let s = "";
      for (const b of bytes) s += String.fromCharCode(b);
      attachments.push({ name: f.name, mime: f.mime, base64: btoa(s) });
    }
  }
  if (!u)
    await rate(
      req,
      env,
      "guest-daily",
      Number(env.AELIO_GUEST_MESSAGES || 10),
      86400,
    );
  let remaining;
  try{remaining = await rpc(env, "app_reserve_chat", {
    cid: c.id,
    uid: u?.id || null,
    guest: c.guest_hash,
    allowance: Number(env.AELIO_GUEST_MESSAGES || 10),
    rid,
  });}catch(error){if(error instanceof Problem&&error.code==='already_exists'){const replay=await replayAttempt();if(replay)return replay;}throw error;}
  const job=new AbortController();const onAbort=()=>job.abort();if(req.signal.aborted)job.abort();req.signal.addEventListener('abort',onAbort,{once:true});
  let upstreamReader;
  let first;
  try {
    first = await engine(env, {
      user_token: u?.token || null,
      guest: c.guest_hash,
      conversation_id: c.id,
      agents,
      dream_team:c.permanent_key==="dream-team",
      history,
      content: suggest
        ? "Suggest one short conversation subtitle. Return only the subtitle."
        : input,
      career,
      career_outside_mila: pref?.career_outside_mila === true,
      attachments,
      consent: true,
      suggest,
      reminder_tools: !!u && d.allow_reminders === true,
      ecosystem_tools: c.product === "aelio" && !suggest,
      now: new Date().toISOString(),
      timezone: pref?.timezone || "UTC",
      memory_enabled: c.memory_enabled,
    },job.signal);
  } catch (e) {
    job.abort();req.signal.removeEventListener("abort",onAbort);
    await rpc(env, "app_finish_chat", { rid, ok: false });
    throw e;
  }
  const enc = new TextEncoder();
  let ok = false;
  const stream = new ReadableStream({
    async start(controller) {
      const outputs = new Map();
      let done = false;
      try {
        const reader = first.body.getReader();upstreamReader=reader;
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buf += decoder.decode(chunk.value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i);
            buf = buf.slice(i + 1);
            if (!line.trim()) continue;
            const ev = JSON.parse(line);
            if (ev.type === "delta")
              outputs.set(
                ev.agent_id,
                (outputs.get(ev.agent_id) || "") + ev.text,
              );
            if (
              ev.type === "tool_call" &&
              ev.name === "propose_ecosystem_handoff"
            ) {
              if (c.product !== "aelio" || suggest)
                throw Error("This workspace does not allow ecosystem actions.");
              ev.type = "ecosystem_handoff";
              ev.proposal = ecosystemHandoff(JSON.parse(ev.arguments));
              delete ev.arguments;
            }
            if (ev.type === "tool_call" && ev.name === "propose_reminder") {
              let proposal;
              try {
                proposal = JSON.parse(ev.arguments);
                if (
                  typeof proposal.title !== "string" ||
                  proposal.title.length > 200 ||
                  !Number.isFinite(Date.parse(proposal.due_at)) ||
                  !["once", "daily", "weekly"].includes(proposal.recurrence)
                )
                  throw 0;
                new Intl.DateTimeFormat("en-US", {
                  timeZone: proposal.timezone,
                }).format();
              } catch {
                throw new Error("Invalid reminder proposal");
              }
              ev.type = "reminder_proposal";
              ev.proposal = {
                title: proposal.title,
                due_at: proposal.due_at,
                timezone: proposal.timezone,
                recurrence: proposal.recurrence,
              };
              delete ev.arguments;
            }
            if (ev.type === "error")
              throw new Problem(
                502,
                ev.code || "brain_failure",
                ev.message || "The Brain response failed.",
              );
            if (ev.type === "complete") done = true;
            controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
          }
        }
        if (!done) throw new Error("The Brain response ended early.");
        if (!suggest)
          await rpc(env, "app_commit_chat", {
            rid,
            input,
            responses: Array.from(outputs, ([id, content]) => ({
              agent_id: id || null,
              speaker: agents.find((a) => a.id === id)?.name || "AELIO",
              content: content.slice(0, 32000),
            })),
          });
        ok = true;
        controller.enqueue(
          enc.encode(
            JSON.stringify({ type: "saved", remaining, request_id: rid }) +
              "\n",
          ),
        );
      } catch (e) {
        console.error(
          JSON.stringify({
            event: "brain_stream_failure",
            request_id: rid,
            code: e instanceof Problem ? e.code : "generation_failed",
          }),
        );
        try {
          controller.enqueue(
            enc.encode(
              JSON.stringify({
                type: "error",
                code: e instanceof Problem ? e.code : "brain_failure",
                message:
                  consumerMessage(e instanceof Problem?e.code:"generation_failed",e instanceof Problem?e.message:"The reply could not be saved or completed. Please retry."),
              }) + "\n",
            ),
          );
        } catch {}
      } finally {
        job.abort();req.signal.removeEventListener("abort",onAbort);await upstreamReader?.cancel().catch(()=>{});
        try {
          await rpc(env, "app_finish_chat", { rid, ok });
        } finally {
          try {
            controller.close();
          } catch {}
        }
      }
    },
    async cancel(){job.abort();await upstreamReader?.cancel().catch(()=>{});await rpc(env,'app_finish_chat',{rid,ok:false});}
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-cache, no-store, no-transform",
      "x-accel-buffering":"no",
      "x-request-id": rid,
    },
  });
}
