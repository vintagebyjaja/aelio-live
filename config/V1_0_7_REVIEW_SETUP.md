# 1.0.7 migration review — owner setup, no production changes by Codex

AELIO main stays on 1.0.6. PATHD main stays on 0.1.4. New AELIO 1.0.7 and PATHD 0.1.5 changes are review-only on their separate migration branches. GitHub code/screenshots are the preview; no preview deployment was created.

## Account and chat diagnosis

Production response/log access is unavailable. Do not describe the production outage as conclusively diagnosed or restored. The existing consumer message collapses missing server credentials and upstream networking into the same account error. Inspect the actual failed response `code` and `request_id`, then match Cloudflare logs. New logs include operation names/SQLSTATE only, not tokens, email, passwords or answers. The authenticated `/api/platform/account/health` endpoint probes owner bootstrap and private server database access separately; it makes no AI request and never claims inference is verified.

Confirmed code defects repaired: optional PATHD legacy-profile insertion could roll back the whole shared account bootstrap; PATHD returned no member when optional profile joins failed; agent reads retried bootstrap and failed even when existing owned agents were readable; the OpenAI global safety counter unnecessarily required guest-cookie signing. These are reproduced/tested locally, not proof of the production failure. Missing/invalid runtime credentials, network policy and provider configuration still require owner verification.

Required AELIO Worker runtime bindings/secrets: existing SUPABASE_URL, one client-safe publishable/anon key alias, SUPABASE_SERVICE_ROLE_KEY for privileged persistence/recovery, OPENAI_API_KEY for the OpenAI provider (or the working private Brain binding and its existing configuration). Server secrets belong in Worker runtime secrets, not only Build variables. Do not copy them into NEXT_PUBLIC_* or bundles. No new R2 credentials/bucket needed. Keep AELIO_STORAGE. AELIO_AI_PROVIDER=openai selects the existing native adapter; brain preserves the private engine option. Global abuse/provider limits still apply even with unlimited message credits.

PATHD keeps its own deployment and NEXT_PUBLIC_SUPABASE_URL plus NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY at build time. Its companion gateway uses the existing optional AELIO_PLATFORM binding or fixed AELIO HTTPS fallback. Browser sessions/cookies remain independent across domains. Never copy tokens into handoff URLs.

## SQL order (manual review/staging first)

01–06 are historical prerequisites. The owner confirmed05 and06 already applied. Apply07 from main if not yet applied. Then08 (custom group image/style),09 (account bootstrap resilience, credit registry and actual plan allowance lookup), and10 (deterministic ordering of newly saved chat turns). These are additive; existing UUIDs, passwords, sessions, plans, permissions and histories are preserved. Do not rerun historical backfills.

09 does NOT automatically grant unlimited credits based on login email. After verifying both existing user IDs in Supabase Auth, use `config/GRANT_APPROVED_UNLIMITED.sql`: read the UUIDs, replace the two commented placeholders and explicitly run the two owner-only helper calls. Granting by verified UUID covers both products and survives provider/email changes. Neither frontend nor service-role API can invoke the administrative grant helper. It grants no Studio Brain, administrator, paid-plan or subscription entitlement. Regular balances remain product-specific. The approved Free allowance remains100; other plan balances are retained and periodic refills require their exact owner-configured rows in core.credit_plan_allowances. Never guess a paid allowance.

## Google and Apple

In the EXISTING Supabase project's Authentication Providers, enable Google/Apple using their developer-console credentials. Enable Supabase's supported manual identity linking. Do not change email verification, users or project-wide settings automatically.

Google console authorized callback: `https://xkpzabgpesishxcluxkp.supabase.co/auth/v1/callback`.
Apple Sign in with Apple Services ID must allow the Supabase Auth host and the same HTTPS callback. Configure Team ID, Key ID, signing key/client-secret JWT securely in Supabase; manage Apple's expiration/rotation. No provider secret goes into public environment variables.

Supabase redirect allowlist should include exact paths:
- `https://aelio.live/auth/callback/`
- `https://aelio.live/auth/reset/`
- `https://mypathd.com/auth/callback` and the same callback with `?next=/home` and `?next=/settings/security` (Supabase matches the query; use the approved narrow domain callback wildcard only if necessary)
- PATHD's existing reset callback paths (inspect `/forgot-password` and `/auth/callback`)
- explicitly approved local development callbacks only; include www variants only if actually used.

Each app supplies its own callback. Existing users should sign in with their current method and LINK the provider from security settings, especially for Apple private relay. No application email-based merge or duplicate profile creation is performed. Supabase itself controls verified-provider identity linking; review that project policy before enabling providers. Account-link callbacks retain/check the existing UUID. PKCE and GoTrue OAuth state are used. Login requests never include calendar scopes.

OAuth buttons/code are implemented and fixture-tested. Live Google/Apple console configuration and end-to-end sign-in/linking are unverified.

## Native passkeys — default OFF until project validation

The official @supabase/auth-js2.118 client and PATHD's existing SDK expose supported GoTrue WebAuthn authentication/registration/list/delete APIs. Use those native server challenges/verification; no custom biometric database, magic-token minting or security-question reset was invented. No biometric data is stored by the apps.

Passkey controls are gated by AELIO_PASSKEYS_ENABLED=true (AELIO public runtime/build flag) or NEXT_PUBLIC_ENABLE_PASSKEYS=true (PATHD build flag), secure context and browser WebAuthn support. Keep flags off until the deployed GoTrue version, native passkey feature, RP ID/origin allowlist, server challenge expiration/replay handling and recent-authentication/MFA policy are verified. SDK support does not prove the hosted project feature is enabled. UI also requires a recent verified sign-in for sensitive changes; enforce corresponding recent-auth policy in the native auth service before enabling it. No custom security check can substitute for native server policy.

Unrelated registrable domains cannot share a single WebAuthn RP ID. Do not claim an aelio.live credential works directly at mypathd.com. If the native project cannot support approved per-origin registrations, keep PATHD passkeys disabled. A reviewed central authentication-origin handoff with PKCE/state would be needed for cross-domain passkey reuse; this iteration does not introduce that infrastructure. Google/Apple/password remain supported alternatives. Real device registration, replay rejection, user verification and both-domain sign-in remain untested.

## Calendars — prepared, not connected

Calendar consent is separate from identity login. Google Calendar preparation documents `calendar.events.readonly` for reading authorized events; free/busy-only use should request its narrower availability scope instead. A production integration needs a dedicated consent handler, state/PKCE, encrypted server token vault, refresh/revocation and ownership checks. No calendar tokens are collected/stored and no calendar scope is requested at login. Event editing needs additional scope and explicit approval.

Sign in with Apple provides no Apple Calendar access. Feasible options need a consented native EventKit companion or a reviewed server-side CalDAV integration; never collect an Apple password in this UI. No background monitoring or event modifications are implemented. Connected Apps reports permission/integration required, never Connected.

## Group/widget limitations

No artificial group-count cap is introduced; each group has up to8 owned participants and one bounded user-triggered turn. Normal turns select up to3 relevant voices; explicit everyone can select all8. Dream Team remains the permanent six specialists. Private Brain must separately honor the existing group metadata; live inference is unverified. The UNCs is an exact scripted example. Big Dre/Marcus use distinct fictional monogram profile images, not extra permanent agents or altered approved portraits.

DreamBox is a shared, same-origin lazy iframe using existing Auth/chat APIs. Minimize keeps its current stream alive. Full-page navigation restores server history and the unsent tab draft; a stream interrupted by navigation must be reopened/retried, and there is no autonomous background continuation. Agent histories stay separate. Voice appears only when browser recognition is available; browser permission is required. No speech output/autoplay is added.


Latest priority: backend response restoration precedes the deferred workspace/UI refinement. Cloudflare runtime logs are not connected here. Use a copied support reference to correlate chat_pipeline / openai_request_rejected / openai_stream_failed / brain_stream_failure records. Provider credential or billing failures require runtime/provider correction; unlimited application credits do not bypass provider billing or platform abuse limits.
