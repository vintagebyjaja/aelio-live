import {consumerMessage} from "./shared/experience.js";
// Allowlisted PUBLIC config only. Never copy process.env or service-role credentials.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { resolveSupabaseConfig } from "./shared/supabase-config.js";
export function buildAuthConfig(
  env = process.env,
  root = fileURLToPath(new URL("../", import.meta.url)),
) {
  const resolved = resolveSupabaseConfig(env);
  if (resolved.errorCode && resolved.errorCode !== "auth_not_configured")
    throw Error(resolved.error);
  const publicOnly = { url: resolved.url, anonKey: resolved.anonKey };
  const js =
    "// Generated public-only fallback; contains no server credentials.\nexport default " +
    JSON.stringify(publicOnly) +
    ";\n";
  mkdirSync(resolve(root, "_src/generated"), { recursive: true });
  writeFileSync(resolve(root, "_src/generated/public-auth-config.js"), js);
  mkdirSync(resolve(root, "public/assets"), { recursive: true });
  const siteKey =
    typeof env.TURNSTILE_SITE_KEY === "string"
      ? env.TURNSTILE_SITE_KEY.trim()
      : "";
  writeFileSync(
    resolve(root, "public/assets/config.js"),
    "// Generated client-safe configuration.\nwindow.AELIO_CONFIG=" +
      JSON.stringify({
        engine: "",
        auth: "supabase",
        passkeysEnabled: env.AELIO_PASSKEYS_ENABLED === "true",
        turnstileSiteKey: siteKey,
        supabase: {
          ...publicOnly,
          configurationError: resolved.error
            ? { code: resolved.errorCode, message: consumerMessage(resolved.errorCode,resolved.error) }
            : null,
        },
      }) +
      ";\n",
  );
  return { configured: !!resolved.anonKey, source: resolved.source };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = buildAuthConfig();
  console.log(
    result.configured
      ? "Public Supabase configuration prepared."
      : "Public Supabase key missing at build time; Worker runtime configuration can still supply it.",
  );
}
