import {consumerMessage} from "../shared/experience.js";
import {sessionSecretSource} from "./shared.js";
import builtPublicAuth from "../generated/public-auth-config.js";
import { resolveSupabaseConfig } from "../shared/supabase-config.js";
import {
  Problem,
  reply,
  fail,
  body,
  who,
  member,
  rate,
  sameOrigin,
  table,
  rpc,
  text,
  own,
  audit,
  config,
  sb,
} from "./shared.js";
import {
  chatRoutes,
  PERSONALITIES,
  appearance,
  backgroundFile,
} from "./messaging.js";
import { storage, sweepFiles } from "./storage.js";
import { discovery } from "./discovery.js";
import { recovery } from "./recovery.js";
import {billing,subscriptionWebhook} from "./billing.js";
import { workspaces } from "./workspaces.js";
export function publicConfig(env) {
  const resolved = resolveSupabaseConfig(env, builtPublicAuth);
  return new Response(
    "window.AELIO_CONFIG=" +
      JSON.stringify({
        engine: "",
        auth: "supabase",
        passkeysEnabled: env.AELIO_PASSKEYS_ENABLED === "true",
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
        supabase: {
          url: resolved.url,
          anonKey: resolved.anonKey,
          configurationError: resolved.error
            ? { code: resolved.errorCode, message: consumerMessage(resolved.errorCode,resolved.error) }
            : null,
        },
      }) +
      ";",
    {
      headers: {
        "content-type": "text/javascript",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
async function account(req, env, path) {
  const u = await who(req, env);
  if(path==='/health'&&req.method==='GET'){
    const probes={authentication:{verified:true},account:{verified:false},serverDatabase:{configured:!!env.SUPABASE_SERVICE_ROLE_KEY,verified:false},ai:{configured:!!env.OPENAI_API_KEY||!!env.AELIO_ENGINE?.fetch,inferenceVerified:false}};
    for(const [key,probe] of [['account',()=>sb(env,'/rest/v1/rpc/app_account_bootstrap',{token:u.token,method:'POST',data:{}})],['serverDatabase',()=>rpc(env,'app_service_health',{})]]){
      try{const value=await probe();probes[key].verified=!!value;}catch(error){probes[key].code=error.code||'internal_failure';}
    }
    return reply(probes);
  }
  if (path === "" && req.method === "GET") {
    const result = await sb(env, "/rest/v1/rpc/app_account_bootstrap", {token:u.token,method:"POST",data:{}});
    return reply({...result,user:{...result.user,email:u.email},connectedApps:["aelio","pathd"],paidPlans:"closed"});
  }

  if (path === "" && req.method === "PATCH") {
    const d = await body(req);
    if (d.display_name !== undefined)
      await sb(env,"/rest/v1/rpc/app_update_display_name",{token:u.token,method:"POST",data:{value:text(d.display_name,80)}});
    const p = {};
    for (const k of [
      "external_ai_consent",
      "career_consent",
      "career_outside_mila",
      "mila_welcomed",
    ])
      if (d[k] !== undefined) p[k] = d[k] === true;
    if(d.mila_style!==undefined){if(!["homegirl","ceo","auntie","advisor","teacher","mom"].includes(d.mila_style))fail(400,"invalid_style","Choose an available communication style.");p.mila_style=d.mila_style;}
    if (d.appearance !== undefined) {
      p.appearance = appearance(d.appearance);
      if (p.appearance.file_id)
        await backgroundFile(env, p.appearance.file_id, u);
    }
    if (d.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: d.timezone }).format();
      } catch {
        fail(400, "invalid_timezone", "Choose a valid timezone.");
      }
      p.timezone = d.timezone;
    }
    if (Object.keys(p).length)
      await table(env, "app_preferences", "user_id=eq." + u.id, {
        service: true,
        method: "PATCH",
        data: { ...p, updated_at: new Date().toISOString() },
      });
    await audit(env, u, "account.preferences");
    return reply({ ok: true });
  }
  if (path === "/export" && req.method === "GET") {
    const out = {
      profile:await sb(env,"/rest/v1/rpc/app_export_profile",{token:u.token,method:"POST",data:{}}),
    };
    for (const n of [
      "app_agents",
      "app_conversations",
      "app_files",
      "app_career_records",
      "app_reminders",
      "app_notifications",
      "app_workspace_entries",
      "app_echo_profiles",
      "app_echo_memories",
    ])
      out[n] = await table(env, n, "owner_id=eq." + u.id, { token: u.token });
    out.preferences =
      (
        await table(env, "app_preferences", "user_id=eq." + u.id, {
          token: u.token,
        })
      )[0] || {};
    out.messages = [];
    for (const c of out.app_conversations)
      out.messages.push(
        ...(await table(env, "app_messages", "conversation_id=eq." + c.id, {
          token: u.token,
        })),
      );
    return reply(out, 200, {
      "content-disposition": 'attachment; filename="aelio-account-export.json"',
    });
  }
  if (path === "/delete" && req.method === "POST") {
    const d = await body(req);
    if (d.confirm !== "DELETE MY SHARED ACCOUNT")
      fail(
        400,
        "confirmation_required",
        "This deletes your shared AELIO and PATHD identity. Enter the exact confirmation.",
      );
    const s = await sb(env, "/auth/v1/token?grant_type=password", {
      method: "POST",
      data: { email: u.email, password: text(d.password, 256) },
    });
    if (s.user.id !== u.id)
      fail(403, "reauthentication_required", "Reauthenticate first.");
    if(!await rpc(env,"app_account_deletion_ready",{uid:u.id}))fail(409,"account_deletion_requires_review","This shared account can’t be closed here right now. You can export your data and keep using both sites.");
    if (!env.AELIO_STORAGE)
      fail(
        503,
        "storage_not_configured",
        "Storage must be available to delete your files safely.",
      );
    const files = await table(env, "app_files", "owner_id=eq." + u.id, {
      token: u.token,
    });
    for (const f of files) await env.AELIO_STORAGE.delete(f.object_key);
    await audit(env, u, "account.deletion_requested");
    await sb(env, "/auth/v1/admin/users/" + u.id, {
      method: "DELETE",
      service: true,
    });
    return reply({ ok: true });
  }
  fail(404, "not_found", "Not found.");
}
async function career(req, env, path) {
  const u = await who(req, env);
  await member(env, u, "pathd");
  const m = path.match(
    /^\/(records|reminders|notifications)(?:\/([a-f0-9-]+))?$/i,
  );
  if (!m) fail(404, "not_found", "Not found.");
  const name = {
      records: "app_career_records",
      reminders: "app_reminders",
      notifications: "app_notifications",
    }[m[1]],
    id = m[2];
  if (id) await own(env, name, id, u);
  if (req.method === "GET") {
    return reply({
      items: await table(
        env,
        name,
        "owner_id=eq." + u.id + "&order=created_at.desc&limit=200",
        { token: u.token },
      ),
    });
  }
  if (req.method === "DELETE" && id && m[1] !== "notifications") {
    await table(env, name, "id=eq." + id + "&owner_id=eq." + u.id, {
      service: true,
      method: "DELETE",
    });
    await audit(env, u, "career.delete", id);
    return reply({ ok: true });
  }
  if (req.method === "PATCH" && id && m[1] === "notifications") {
    await table(env, name, "id=eq." + id + "&owner_id=eq." + u.id, {
      service: true,
      method: "PATCH",
      data: { read_at: new Date().toISOString() },
    });
    return reply({ ok: true });
  }
  if (!["POST", "PATCH"].includes(req.method))
    fail(405, "method_not_allowed", "Method not allowed.");
  const d = await body(req);
  const fields = {};
  if (d.title !== undefined) {
    fields.title = text(d.title, 200);
    if (!fields.title) fail(400, "title_required", "Enter a title.");
  }
  if (m[1] === "records") {
    if (d.kind !== undefined) {
      if (
        !["profile", "job", "application", "event", "goal", "search"].includes(
          d.kind,
        )
      )
        fail(400, "invalid_kind", "Choose a valid career record.");
      fields.kind = d.kind;
    }
    if (d.data !== undefined) {
      if (
        !d.data ||
        typeof d.data !== "object" ||
        Array.isArray(d.data) ||
        JSON.stringify(d.data).length > 8000
      )
        fail(400, "invalid_data", "Career details are too long.");
      fields.data = d.data;
    }
  }
  if (m[1] === "reminders") {
    if (d.due_at !== undefined) {
      if (
        !Number.isFinite(Date.parse(d.due_at)) ||
        Date.parse(d.due_at) < Date.now() - 7 * 86400000 ||
        Date.parse(d.due_at) > Date.now() + 5 * 366 * 86400000 ||
        !/(Z|[+-]\d\d:\d\d)$/.test(d.due_at)
      )
        fail(400, "invalid_time", "Choose a date with a timezone.");
      fields.due_at = new Date(d.due_at).toISOString();
    }
    if (d.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: d.timezone }).format();
      } catch {
        fail(400, "invalid_timezone", "Choose a valid timezone.");
      }
      fields.timezone = d.timezone;
    }
    if (d.recurrence !== undefined) {
      if (!["once", "daily", "weekly"].includes(d.recurrence))
        fail(400, "invalid_recurrence", "Choose once, daily or weekly.");
      fields.recurrence = d.recurrence;
    }
    if (d.paused !== undefined) fields.paused = d.paused === true;
    if (d.source_id !== undefined) {
      if (d.source_id) await own(env, "app_career_records", d.source_id, u);
      fields.source_id = d.source_id || null;
    }
  }
  if (
    !id &&
    (!fields.title ||
      (m[1] === "reminders" && !fields.due_at) ||
      (m[1] === "records" && !fields.kind))
  )
    fail(400, "missing_fields", "Complete the required fields.");
  const rows = await table(
    env,
    name,
    id ? "id=eq." + id + "&owner_id=eq." + u.id : "",
    {
      service: true,
      method: id ? "PATCH" : "POST",
      data: id ? fields : { ...fields, owner_id: u.id },
    },
  );
  await audit(env, u, "career." + (id ? "update" : "create"), rows[0]?.id);
  return reply({ item: rows[0] }, id ? 200 : 201);
}
export async function platform(req, env) {
  const id = crypto.randomUUID();
  try {
    if(new URL(req.url).pathname==='/webhooks/ai-subscriptions')return await subscriptionWebhook(req,env);
    sameOrigin(req);
    const p = new URL(req.url).pathname.replace(/^\/api\/platform/, "");
    if (p === "/status" && req.method === "GET")
      return reply({
        accounts: !!resolveSupabaseConfig(env, builtPublicAuth).anonKey,
        databaseConfigured: !!env.SUPABASE_SERVICE_ROLE_KEY,
        sessionConfigured:
          !!sessionSecretSource(env),
        storageBinding: !!env.AELIO_STORAGE,
        engineBinding: !!env.AELIO_ENGINE?.fetch,
        engineDevelopmentOrigin: !!env.AELIO_ENGINE_ORIGIN,
        openAIConfigured: !!env.OPENAI_API_KEY,
        inferenceVerified: false,
      });
    if(p==='/diagnostics'&&req.method==='GET'){
      const user=await who(req,env);
      const own=await sb(env,'/rest/v1/rpc/app_account_bootstrap',{token:user.token,method:'POST',data:{}});
      if(own.role!=='founder')fail(403,'permission_denied','This page is private.');
      return reply({accountAuthConfigured:!!resolveSupabaseConfig(env,builtPublicAuth).anonKey,sessionSigning:sessionSecretSource(env)||'unavailable',explicitSessionPresent:!!env.AELIO_SESSION_SECRET,explicitSessionValid:typeof env.AELIO_SESSION_SECRET==='string'&&env.AELIO_SESSION_SECRET.length>=32,databaseConfigured:!!env.SUPABASE_SERVICE_ROLE_KEY,openAIConfigured:!!env.OPENAI_API_KEY,inferenceVerified:false,accountBootstrapVerified:true});
    }
    // Verified members use an owner-scoped SQL throttle, independent of guest-cookie signing.
    const user = await who(req, env, true);
    if(user){
      if(!await sb(env,"/rest/v1/rpc/app_user_rate_limit",{token:user.token,method:"POST",data:{}}))fail(429,"rate_limited","Too many attempts. Please wait and try again.");
    } else await rate(req, env, "platform", 120, 60);
    if (p.startsWith("/discover/")) return await discovery(req, p.slice(9));
    if (p.startsWith("/recovery/")) return await recovery(req, env, p.slice(9));
    if (p.startsWith("/files")) return await storage(req, env, p.slice(6));
    if (p.startsWith("/account")) return await account(req, env, p.slice(8));
    if(p.startsWith('/billing/'))return await billing(req,env,p.slice(8));
    if (p.startsWith("/career")) return await career(req, env, p.slice(7));
    if (p === '/workspace' || p.startsWith('/workspace/') || p === '/echo' || p.startsWith('/echo/')) return await workspaces(req, env, p);
    return await chatRoutes(req, env, p);
  } catch (e) {
    const status = e instanceof Problem ? e.status : 500,
      code = e instanceof Problem ? e.code : "internal_failure";
    const reference=typeof e.requestId==='string'&&/^[a-f0-9-]{36}$/i.test(e.requestId)?e.requestId:id;
    console.error(
      JSON.stringify({
        event: "platform_request_failed",
        request_id: reference,
        code,
        status,
        path: new URL(req.url).pathname,
      }),
    );
    return reply(
      {
        error:
          consumerMessage(code,e instanceof Problem?e.message:undefined),
        code,
        request_id: reference,
      },
      status,
      { "x-request-id": reference },
    );
  }
}
export async function scheduled(env) {
  await rpc(env, "app_deliver_reminders", {});
  await sweepFiles(env);
}
