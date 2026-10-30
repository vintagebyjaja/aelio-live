import { Container, getContainer } from "@cloudflare/containers";
export class AelioEngine extends Container {
  defaultPort = 8787;
  sleepAfter = "10m";
  constructor(ctx, env) {
    super(ctx, env);
    const names = [
      "DATABASE_URL",
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "AELIO_PROXY_SECRET",
      "AELIO_MESSAGING_SECRET",
      "OPENAI_API_KEY",
      "AELIO_FOUNDER_UIDS",
      "AELIO_FOUNDER_EMAILS",
      "AELIO_MEMBER_UIDS",
      "AELIO_MEMBER_EMAILS",
      "AELIO_UNLIMITED_UIDS",
      "AELIO_UNLIMITED_EMAILS",
    ];
    const out = {
      AELIO_AUTH: "supabase",
      AELIO_DATABASE: "postgres",
      AELIO_PAID_PLANS_OPEN: "0",
      AELIO_DATA_DIR: "/tmp/aelio-runtime",
      AELIO_SANDBOX: "unavailable",
    };
    for (const n of names) if (env[n]) out[n] = env[n];
    this.envVars = out;
  }
}
export default {
  async fetch(request, env) {
    if (
      !env.AELIO_PROXY_SECRET ||
      request.headers.get("x-aelio-proxy-secret") !== env.AELIO_PROXY_SECRET
    )
      return new Response("Not found", { status: 404 });
    if (!env.DATABASE_URL)
      return Response.json(
        {
          error: "The engine database is not configured.",
          code: "engine_database_not_configured",
        },
        { status: 503 },
      );
    // A single instance preserves existing in-process gateway limits. Never multiply instances without shared limit state.
    try {
      return await getContainer(env.ENGINE, "primary").fetch(request);
    } catch {
      return Response.json(
        {
          error: "The private engine could not start.",
          code: "engine_startup_failed",
        },
        { status: 503 },
      );
    }
  },
};
