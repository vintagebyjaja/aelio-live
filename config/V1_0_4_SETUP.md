# AELIO v1.0.4 — configuration, activation and rollout

The latest user instruction authorizes an AELIO Git push (and its existing automatic Cloudflare build), not manual Cloudflare deployment, production SQL, secret changes, or pushes to other repositories. PATHD follow-up work remains separate until validated/delivered.

## Public Supabase configuration

AELIO now accepts the first configured key in this order:
1. SUPABASE_PUBLISHABLE_KEY
2. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
3. SUPABASE_ANON_KEY
4. NEXT_PUBLIC_SUPABASE_ANON_KEY

Project URL: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL. The approved shared project is https://xkpzabgpesishxcluxkp.supabase.co. Keep every configured alias pointed at this same project. Existing runtime values override the public build fallback. Mismatched runtime/build projects are rejected.

The exact root cause was a runtime-only read of SUPABASE_PUBLISHABLE_KEY, while Cloudflare supplied other public names at build time. `_src/build-auth-config.mjs` now writes an allowlisted public fallback during `npm run build` and Wrangler's custom build. This also runs when Cloudflare's separate Build command is None. It emits only URL/public key/public CAPTCHA site key, never process.env, service-role keys or OpenAI secrets. A privileged key in a public key slot stops the build. Runtime /assets/config.js stays no-store and validates its selected public key.

## Server runtime credentials

Configure these as Worker runtime secrets in Cloudflare; build variables alone do not create deployed secrets:
- SUPABASE_SERVICE_ROLE_KEY — existing server-only credential; required for owned account/recovery/data APIs.
- OPENAI_API_KEY — existing server-only provider key; used only by Worker-side Responses requests.
- AELIO_SESSION_SECRET — recommended independent random secret of at least32 characters. Existing configured values retain their behavior. If absent, the Worker can derive a purpose-separated guest/rate-limiting HMAC key from a valid server-only Supabase service-role credential. It NEVER derives this from a public/anon key. Explicit invalid short secrets fail closed. Rotating the source server secret invalidates guest continuity/rate hashes, not Supabase account identities/passwords; a separate stable secret avoids coupling those rotations.

`GET /api/platform/status` reports only configuration booleans, including sessionConfigured; it never publishes credentials. Signup checks account-service readiness before creating a user, reducing incomplete enrollment when runtime configuration is absent. Existing users should sign in, not register again.

No new SQL migration is required by v1.0.4. The existing identity/app migrations01–04 must already be applied and verified in the shared project. No production migrations were run here. Confirm core/public schema exposure, grants and existing RLS using the prior setup runbook. Paid plans/subscriptions remain separate between AELIO and PATHD.

## Temporary OpenAI intelligence provider

- With OPENAI_API_KEY available, new chat uses Worker-native https://api.openai.com/v1/responses. It reuses the existing server-side owner verification, agent orchestration, conversation history, approved memory/career consent, attachments and independent product quotas.
- OPENAI_MODEL defaults to gpt-4.1-mini, a fast non-reasoning model. Set it server-side to a model enabled for the actual account. No account/model availability or real latency has been verified from this environment.
- Optional OPENAI_MAX_OUTPUT_TOKENS defaults1200 (bounded128–4096), OPENAI_CONTEXT_CHAR_LIMIT defaults24000 (bounded8000–64000), and OPENAI_DAILY_REQUEST_LIMIT defaults500 requests per UTC date across the platform (bounded1–10000). Group replies consume one safety-count per provider request. Counts are persistent/atomic through the existing database limiter; configure OpenAI project spend limits as an additional owner-controlled safeguard. A failed/stopped request can still incur provider charges for work already done.
- AELIO_AI_PROVIDER=brain selects the retained private engine path instead. The existing Python gateway/Native/Studio architecture is preserved. The public chat provider does not enable Native, sandbox execution, image/video generation or founder access. The missing aelio-engine binding remains optional; do not reintroduce it before that Worker exists.
- Streaming is NDJSON with no-transform/no-store. Provider SSE deltas are forwarded immediately, not buffered to completion. Actual provider first-token/completion times and token counts are logged as metadata only. No guaranteed1–2 second latency is claimed, and local fixture timings are not production measurements.
- Completed turn IDs are idempotent and replay saved history without another provider call. Failed attempts can be explicitly retried with a fresh attempt ID. Stop aborts the client/upstream stream and calls the owned cancellation route; the existing atomic finish RPC prevents duplicate refunds/late commits. Partial stopped/interrupted text remains local with a retryable draft; only completed turns are committed. Reloading can discard an uncommitted partial reply.

## Ecosystem and UX

The previously approved cinematic mobile/desktop redesign is preserved. Four themes, independent agent appearance, guest limits and saved conversations remain. Public website handoffs go only to https://grooveville.org/guide/, https://vybr8.live/ and https://mypathd.com. No unknown API endpoint/query parameter, token or conversation text is added. The structured tool proposes an optional handoff; copying planning details or opening the destination is a user action. No OAuth account link, route/venue result, reservation or private external access is claimed. External-site inspection was blocked with403 in this environment.

## Owner verification after Git-driven deployment

Check the new Cloudflare build, then verify /assets/config.js has the correct public URL/key (and no private values), /api/platform/status shows configured account/database/session booleans, and test real signup/login/refresh/logout, saved chat, streamed Main Pal/MILA/custom-agent replies, stop/retry, ownership and mobile behavior. The account dashboard remains independent of AI readiness. No real user passwords, existing accounts, billing data or production policies were changed during development.
