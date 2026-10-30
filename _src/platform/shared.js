import builtPublicAuth from "../generated/public-auth-config.js";
import { resolveSupabaseConfig } from "../shared/supabase-config.js";
// Platform services use Supabase Auth + RLS data, never a browser-supplied user ID.
export class Problem extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const reply = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    },
  });
export const fail = (status, code, message) => {
  throw new Problem(status, code, message);
};
export const uuid = (s) =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
export function text(v, max = 1000) {
  if (typeof v !== "string" || v.length > max)
    fail(400, "invalid_input", "Check the form fields.");
  return v.trim();
}
export async function body(req, max = 40000) {
  const raw = await limited(req, max);
  try {
    const d = JSON.parse(new TextDecoder().decode(raw));
    if (!d || Array.isArray(d) || typeof d !== "object") throw 0;
    return d;
  } catch {
    fail(400, "invalid_json", "Invalid request.");
  }
}
export async function limited(req, max) {
  if (Number(req.headers.get("content-length") || 0) > max)
    fail(413, "too_large", "This file is too large.");
  const reader = req.body?.getReader();
  let n = 0;
  const parts = [];
  if (reader)
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > max) {
        await reader.cancel();
        fail(413, "too_large", "This file is too large.");
      }
      parts.push(value);
    }
  const data = new Uint8Array(n);
  let i = 0;
  for (const p of parts) {
    data.set(p, i);
    i += p.length;
  }
  return data;
}
export function config(env) {
  const resolved = resolveSupabaseConfig(env, builtPublicAuth);
  if (resolved.error) fail(503, resolved.errorCode, resolved.error);
  return resolved.url;
}
export async function sb(
  env,
  path,
  { token, method = "GET", data, schema = "public", service = false } = {},
) {
  const base = config(env);
  const key = service
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : resolveSupabaseConfig(env, builtPublicAuth).anonKey;
  if (!key)
    fail(
      503,
      "database_not_configured",
      "The account service needs its server configuration.",
    );
  let r;
  try {
    r = await fetch(base + path, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: key,
        // Supabase's sb_publishable_/sb_secret_ API keys are NOT JWTs.
        // With no user token, use only apikey; legacy anon/service JWTs may also be Bearer.
        ...(token ? {authorization:"Bearer "+token}:key.split('.').length===3?{authorization:"Bearer "+key}:{}),
        "content-type": "application/json",
        "accept-profile": schema,
        "content-profile": schema,
        prefer: "return=representation",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    fail(
      503,
      "database_unavailable",
      "The account service is temporarily unavailable.",
    );
  }
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    if (
      r.status === 401 &&
      /invalid api key|invalid.*apikey/i.test(
        String(d?.message || d?.msg || ""),
      )
    )
      fail(
        503,
        "auth_key_rejected",
        "Supabase rejected the configured public key. Check the project URL and public key in Cloudflare.",
      );
    if (r.status === 401)
      fail(401, "authentication_failed", "Please sign in again.");
    if (r.status === 403)
      fail(
        403,
        "permission_denied",
        "This account cannot access that resource.",
      );
    if (d?.code === "P0001")
      fail(429, "message_limit", "Your message allowance has been reached.");
    if (d?.code === "55P03")
      fail(409, "reply_in_progress", "Wait for the current reply to finish.");
    if (d?.code === "23505")
      fail(409, "already_exists", "This item already exists.");
    console.error(
      JSON.stringify({
        event: "supabase_failure",
        status: r.status,
        code: d?.code || "unknown",
      }),
    );
    fail(
      503,
      "database_failure",
      "The account service could not complete this request.",
    );
  }
  return d;
}
export const table = (env, name, query = "", opts = {}) =>
  sb(env, "/rest/v1/" + name + (query ? "?" + query : ""), opts);
export const rpc = (env, name, data) =>
  sb(env, "/rest/v1/rpc/" + name, { method: "POST", data, service: true });
const verifiedRequests=new WeakMap();
export async function who(req, env, optional = false) {
  const h = req.headers.get("authorization") || "";
  if (!h) {
    if (optional) return null;
    fail(401, "authentication_required", "Sign in to continue.");
  }
  if (!h.startsWith("Bearer "))
    fail(401, "authentication_failed", "Please sign in again.");
  const cached=verifiedRequests.get(req);if(cached?.env===env)return cached.promise;
  const token=h.slice(7);
  const promise=(async()=>{const u=await sb(env,"/auth/v1/user",{token});if(!u?.id||u.is_anonymous)fail(401,"authentication_failed","Please sign in again.");return {id:u.id,email:u.email,token,user:u};})();
  verifiedRequests.set(req,{env,promise});return promise;
}
export const hex = (bytes) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(s) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
}
export function sessionSecretSource(env){
  if(env.AELIO_SESSION_SECRET!==undefined && env.AELIO_SESSION_SECRET!=='')return typeof env.AELIO_SESSION_SECRET==='string'&&env.AELIO_SESSION_SECRET.length>=32?'explicit':null;
  const service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(typeof service!=='string'||service.length<32)return null;
  if(service.startsWith('sb_secret_'))return 'derived_service_role';
  try{const value=service.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(value.padEnd(Math.ceil(value.length/4)*4,'='))).role==='service_role'?'derived_service_role':null;}catch{return null;}
}
export async function keyed(env, s) {
  const source=sessionSecretSource(env);
  if(!source){console.error(JSON.stringify({event:'session_signing_unavailable',explicitPresent:!!env.AELIO_SESSION_SECRET,explicitValid:typeof env.AELIO_SESSION_SECRET==='string'&&env.AELIO_SESSION_SECRET.length>=32,servicePresent:!!env.SUPABASE_SERVICE_ROLE_KEY}));fail(503,'session_not_configured','Account services need secure runtime configuration. Please contact the site owner.');}
  let raw;
  if(source==='explicit')raw=new TextEncoder().encode(env.AELIO_SESSION_SECRET);
  else{
    const master=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SUPABASE_SERVICE_ROLE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    raw=await crypto.subtle.sign('HMAC',master,new TextEncoder().encode('aelio/guest-and-rate-limit/v1'));
  }
  const key=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(s)));
}
export function cookie(req, name) {
  const v = req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + "="));
  return v ? v.slice(name.length + 1) : null;
}
export async function rate(req, env, scope, max = 20, seconds = 60) {
  const ip = req.headers.get("cf-connecting-ip");
  if (!ip && env.AELIO_LOCAL_TEST !== "1")
    fail(
      503,
      "client_identity_unavailable",
      "Client verification is unavailable.",
    );
  const k = await keyed(env, scope + ":" + (ip || "local"));
  if (!(await rpc(env, "app_limit", { k, maximum: max, seconds })))
    fail(429, "rate_limited", "Too many attempts. Please wait and try again.");
}
export function sameOrigin(req) {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.get("origin") !== new URL(req.url).origin
  )
    fail(403, "origin_denied", "Start this action from the application.");
}
export async function own(env, name, id, u) {
  if (!uuid(id)) fail(404, "not_found", "Not found.");
  const rows = await table(env, name, "id=eq." + id + "&owner_id=eq." + u.id, {
    token: u.token,
  });
  if (!rows?.[0]) fail(404, "not_found", "Not found.");
  return rows[0];
}
export async function audit(env, u, action, target) {
  await table(env, "app_audit", "", {
    method: "POST",
    service: true,
    data: { owner_id: u?.id || null, action, target_id: target || null },
  });
}
export async function member(env, u, product = "aelio") {
  let active=await sb(env,"/rest/v1/rpc/app_product_access",{token:u.token,method:"POST",data:{product}});
  if(!active){
    await sb(env,"/rest/v1/rpc/app_account_bootstrap",{token:u.token,method:"POST",data:{}});
    active=await sb(env,"/rest/v1/rpc/app_product_access",{token:u.token,method:"POST",data:{product}});
  }
  if(!active)fail(403,"membership_suspended","This application membership is unavailable.");
}
