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
export function publicConfig(env) {
  const resolved = resolveSupabaseConfig(env, builtPublicAuth);
  return new Response(
    "window.AELIO_CONFIG=" +
      JSON.stringify({
        engine: "",
        auth: "supabase",
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
        supabase: {
          url: resolved.url,
          anonKey: resolved.anonKey,
          configurationError: resolved.error
            ? { code: resolved.errorCode, message: resolved.error }
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
  if (path === "" && req.method === "GET") {
    const [profiles, plans, prefs, roles] = await Promise.all([
      table(env, "profiles", "user_id=eq." + u.id, {
        schema: "core",
        token: u.token,
      }),
      table(env, "app_entitlements", "user_id=eq." + u.id, { token: u.token }),
      table(env, "app_preferences", "user_id=eq." + u.id, { token: u.token }),
      table(env, "app_roles", "user_id=eq." + u.id, {
        schema: "core",
        service: true,
      }),
    ]);
    return reply({
      user: {
        id: u.id,
        email: u.email,
        display_name: profiles[0]?.display_name || "",
        recovery_enrolled: !!profiles[0]?.recovery_enrolled_at,
      },
      plans: plans.map((p) => ({
        ...p,
        unlimited: roles.some((r) => r.product === p.product),
      })),
      preferences: prefs[0] || {},
      role: roles.find((r) => r.product === "aelio")?.role || "member",
      connectedApps: ["aelio", "pathd"],
      paidPlans: "coming_soon",
    });
  }
  if (path === "" && req.method === "PATCH") {
    const d = await body(req);
    if (d.display_name !== undefined)
      await table(env, "profiles", "user_id=eq." + u.id, {
        schema: "core",
        token: u.token,
        method: "PATCH",
        data: {
          display_name: text(d.display_name, 80),
          updated_at: new Date().toISOString(),
        },
      });
    const p = {};
    for (const k of [
      "external_ai_consent",
      "career_consent",
      "career_outside_mila",
      "mila_welcomed",
    ])
      if (d[k] !== undefined) p[k] = d[k] === true;
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
      profile: (
        await table(env, "profiles", "user_id=eq." + u.id, {
          schema: "core",
          token: u.token,
        })
      )[0],
    };
    for (const n of [
      "app_agents",
      "app_conversations",
      "app_files",
      "app_career_records",
      "app_reminders",
      "app_notifications",
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
    await rate(req, env, "platform", 120, 60);
    if (p.startsWith("/discover/")) return await discovery(req, p.slice(9));
    if (p.startsWith("/recovery/")) return await recovery(req, env, p.slice(9));
    if (p.startsWith("/files")) return await storage(req, env, p.slice(6));
    if (p.startsWith("/account")) return await account(req, env, p.slice(8));
    if (p.startsWith("/career")) return await career(req, env, p.slice(7));
    return await chatRoutes(req, env, p);
  } catch (e) {
    const status = e instanceof Problem ? e.status : 500,
      code = e instanceof Problem ? e.code : "internal_failure";
    console.error(
      JSON.stringify({
        event: "platform_request_failed",
        request_id: id,
        code,
        status,
        path: new URL(req.url).pathname,
      }),
    );
    return reply(
      {
        error:
          e instanceof Problem
            ? e.message
            : "This request could not be completed.",
        code,
        request_id: id,
      },
      status,
      { "x-request-id": id },
    );
  }
}
export async function scheduled(env) {
  await rpc(env, "app_deliver_reminders", {});
  await sweepFiles(env);
}
