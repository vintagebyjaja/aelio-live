// Shared by the build, Worker and browser. Never return or serialize server secrets.
export const DEFAULT_SUPABASE_URL = "https://xkpzabgpesishxcluxkp.supabase.co";
const KEY_NAMES = [
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const value = (v) => (typeof v === "string" ? v.trim() : "");
export function publicKeyProblem(key, serviceKey = "") {
  if (!key) return "missing_public_key";
  if (key === value(serviceKey) || /^(sb_secret_|sk[-_])/i.test(key))
    return "unsafe_public_key";
  if (key.split(".").length === 3) {
    try {
      const segment = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(
        atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, "=")),
      );
      if (claims.role !== "anon") return "unsafe_public_key";
    } catch {
      return "invalid_public_key";
    }
  }
  return null;
}
export function resolveSupabaseConfig(env = {}, built = {}) {
  const runtimeURL =
    value(env.SUPABASE_URL) || value(env.NEXT_PUBLIC_SUPABASE_URL);
  const runtimeKey = KEY_NAMES.map((k) => value(env[k])).find(Boolean) || "";
  const url = runtimeURL || value(built.url) || DEFAULT_SUPABASE_URL;
  const key = runtimeKey || value(built.anonKey);
  const result = {
    url,
    anonKey: "",
    source: runtimeKey ? "runtime" : key ? "build" : "missing",
    errorCode: null,
    error: null,
  };
  try {
    const parsed = new URL(url);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/"
    )
      throw Error();
    result.url = parsed.origin;
    if (
      runtimeURL &&
      !runtimeKey &&
      key &&
      value(built.url) &&
      new URL(built.url).origin !== parsed.origin
    ) {
      result.errorCode = "auth_project_mismatch";
      result.error =
        "The Supabase runtime URL does not match the public key’s build configuration.";
      return result;
    }
  } catch {
    result.url = DEFAULT_SUPABASE_URL;
    result.errorCode = "auth_url_invalid";
    result.error =
      "Supabase sign-in has an invalid project URL. Check Cloudflare public configuration.";
    return result;
  }
  const problem = publicKeyProblem(key, env.SUPABASE_SERVICE_ROLE_KEY);
  if (problem) {
    result.errorCode =
      problem === "missing_public_key"
        ? "auth_not_configured"
        : "auth_public_key_invalid";
    result.error =
      problem === "missing_public_key"
        ? "Supabase sign-in needs a public publishable or anon key in Cloudflare runtime settings or build variables. Your password has not been sent."
        : "Supabase public configuration contains an invalid or privileged key. Use only the publishable key or anon key; your password has not been sent.";
    return result;
  }
  result.anonKey = key;
  return result;
}
