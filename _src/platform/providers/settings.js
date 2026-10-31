import { fail } from "../shared.js";
export const ROUTER_FIELDS = [
  "AELIO_PRIMARY_PROVIDER",
  "AELIO_IMAGE_PRIMARY_PROVIDER",
  ...["OPENAI","GEMINI"].flatMap(p=>["IMAGE_MODEL","IMAGE_MAX_COST_USD","IMAGE_INPUT_USD_PER_MILLION","IMAGE_OUTPUT_USD_PER_MILLION"].map(k=>p+"_"+k)),
  "AELIO_SECONDARY_PROVIDER",
  "AELIO_EMERGENCY_PROVIDER",
  "AELIO_DAILY_AI_BUDGET_USD",
  "AELIO_MONTHLY_AI_BUDGET_USD",
  "AELIO_OPENAI_EMERGENCY_BUDGET_USD",
  ...["GEMINI", "GROQ", "OPENAI"].flatMap((p) =>
    [
      "MODEL",
      "COMPLEX_MODEL",
      "INPUT_USD_PER_MILLION",
      "OUTPUT_USD_PER_MILLION",
      "COMPLEX_INPUT_USD_PER_MILLION",
      "COMPLEX_OUTPUT_USD_PER_MILLION",
      "TIMEOUT_MS",
      "DAILY_BUDGET_USD",
      "MONTHLY_BUDGET_USD",
    ]
      .map((k) => p + "_" + k)
      .concat("AELIO_" + p + "_ENABLED"),
  ),
];
export function safeRouterSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "invalid_settings", "Choose valid routing settings.");
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (!ROUTER_FIELDS.includes(key))
      fail(
        400,
        "invalid_settings",
        "Only provider models, prices, timeouts and budget controls may be saved.",
      );
    if (key.endsWith("_PROVIDER")) {
      if (!(key==="AELIO_IMAGE_PRIMARY_PROVIDER"?["gemini","openai"]:["gemini", "groq", "openai"]).includes(v))
        fail(400, "invalid_settings", "Choose a supported provider.");
      out[key] = v;
    } else if (key.endsWith("_ENABLED")) {
      if (!["true", "false"].includes(v))
        fail(400, "invalid_settings", "Choose an enabled state.");
      out[key] = v;
    } else if (key.endsWith("_MODEL")) {
      if (
        v !== "" &&
        (typeof v !== "string" || !/^[a-zA-Z0-9_./:-]{1,160}$/.test(v))
      )
        fail(400, "invalid_settings", "Choose a valid model identifier.");
      out[key] = v;
    } else {
      const n = Number(v);
      if (
        !Number.isFinite(n) ||
        n < 0 ||
        n > 1000000 ||
        (key.endsWith("TIMEOUT_MS") && (n < 1000 || n > 90000))
      )
        fail(400, "invalid_settings", "Choose a valid limit or price.");
      out[key] = String(n);
    }
  }
  return out;
}
