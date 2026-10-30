# AELIO_v1.0.1 manual setup and verification

These are owner-run instructions. Nothing in this delivery has deployed, pushed, modified production Supabase or created cloud resources.

## Upload safely

Extract all GitHub parts into one empty folder. Each ZIP contains project files under `AELIO/` or `PATHD/`; merge these directories across parts without flattening their internal paths. The per-part manifests list every file and SHA-256. Use the outer SHA256SUMS file to verify ZIP integrity.

Upload the **contents of AELIO/** to `vintagebyjaja/aelio-live`, and **contents of PATHD/** to `vintagebyjaja/pathd-app`. Never upload PATHD into AELIO or expose the combined checkout as static assets. Files listed as removed in RELEASE_MANIFEST must also be removed from the destination; GitHub's web upload does not delete old files. In particular remove the obsolete Firebase runtime modules after reviewing the tested replacements. Prefer a new review branch that is not connected to production auto-deployment. Uploading to a watched branch can trigger existing Cloudflare automation; pause that automation before uploading if you want to avoid deployment.

Public AELIO build output is **public/** only. It is included because this repository historically serves committed output. Do not publish the repository root, engine/, config/, SQL, tests or tools as static content. Runtime platform APIs require the Worker; a static Pages upload alone is insufficient. Existing Studio styling is retained.

## Required variables and bindings

| Location | Public/client-safe | Server-only secrets | Native bindings |
|---|---|---|---|
| Existing `aelio-live` Worker | SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TURNSTILE_SITE_KEY, AELIO_GUEST_MESSAGES | SUPABASE_SERVICE_ROLE_KEY, AELIO_SESSION_SECRET, AELIO_PROXY_SECRET, AELIO_MESSAGING_SECRET | ASSETS; AELIO_STORAGE → existing aelio-storage; AELIO_ENGINE → private aelio-engine |
| Private engine Worker/container | SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY; no browser bundle here | DATABASE_URL, OPENAI_API_KEY, matching proxy/messaging secrets, configured founder/personal UID+email lists | ENGINE container namespace |
| PATHD Next.js build/runtime | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_TURNSTILE_SITE_KEY | SUPABASE_SERVICE_ROLE_KEY for existing server-only workflows; optional ANTHROPIC_API_KEY for existing resume parser | AELIO_PLATFORM → existing aelio-live |

AELIO injects public config at **/assets/config.js at runtime**. Merely setting arbitrary NEXT_PUBLIC_* variables on AELIO does nothing: it is not Next.js. AELIO's static fallback deliberately has an empty key; the Worker supplies the actual publishable key. PATHD is Next.js and needs its exact NEXT_PUBLIC_* values at build time as well as runtime.

Generate independent cryptographic random proxy and messaging secrets and at least 32 random bytes for AELIO_SESSION_SECRET. The same proxy/messaging values must be supplied to the edge and private engine. Do not place them in wrangler.jsonc, browser config, GitHub uploads or screenshots. Session secret rotation expires guest continuity/rate hashes; plan rotations deliberately.

Use the existing Supabase project `https://xkpzabgpesishxcluxkp.supabase.co`. The public publishable/anon key is not the service-role key. New sb_secret_* keys and legacy service-role credentials are server-only. Configure the engine's Supabase PostgreSQL connection with verified TLS and a role restricted to the private engine schema and required core role information. Never use SQLite as a production fallback. Do not expose aelio_engine through PostgREST.

The R2 bucket is private. Use the **native AELIO_STORAGE binding**. No external R2 access key, secret access key or endpoint is required. PATHD's existing application storage remains separate; its companion bridge does not expose AELIO file APIs. Do not recreate aelio-storage or its binding.

## Supabase database order

1. Back up the existing Supabase project and legacy engine data. Inspect already-applied migrations and existing PATHD schemas. Test a staging copy first. Do not blindly rerun historical PATHD migration 0001 (it contains non-idempotent types).
2. If missing, apply AELIO `20261028000001_platform_identity.sql`, then `20261029000002_messaging_platform.sql`, then `20261029000003_engine_postgres.sql`. Use the order in the SQL package. Migration 02 preserves/restores existing PATHD profile bootstrap, fills missing shared rows without overwriting accounts, and maintains display-name synchronization.
3. PostgREST/API exposed schemas: **public and core** are required. Existing PATHD uses public tables. RLS/grants restrict authenticated users; core recovery hashes, roles, quota state and service RPCs remain inaccessible to browser roles. Never expose aelio_engine. Reload the API schema cache after migrations if needed.
4. Existing Auth identities are preserved. Stage legacy SQLite import with `python tools/import_engine_sqlite.py SOURCE` (read-only plan). It refuses a nonempty target on `--apply`. First verify migration schema and backup. The command operates on DATABASE_URL; no script invokes it automatically. Preserve the source and all backups until fingerprints/counts are independently verified.
5. Review the existing CLI `identity-plan` / `identity-import` mapping against the founder/personal accounts' **existing Supabase UUIDs**. Do not recreate accounts or auto-link by email. A missing mapping now produces `identity_mapping_required` instead of duplicating an engine account.
6. `config/founder-bootstrap.sql` is optional administrative bootstrap, not an automatic migration. Supply the actual existing UUIDs and verify their email/confirmation/providers in Supabase. Configure the engine's matching UUID/email lists. Founder access still requires MFA and Studio security; personal perks never grant Studio.

AELIO's structured application tables are public.app_* with RLS, core shared identity/recovery metadata, and private aelio_engine legacy features. The existing PATHD schema is reused; there is no second Auth database.

## Auth settings — owner must verify on staging

Site URL: **https://aelio.live**. Prefer exact redirect allow-list entries:

- https://aelio.live/auth/callback/
- https://aelio.live/auth/reset/
- https://mypathd.com/auth/callback
- https://mypathd.com/auth/callback?next=/settings/security
- https://mypathd.com/auth/callback?next=/reset-password

Add equivalent www URLs only if those hosts are actually used. Set PATHD NEXT_PUBLIC_SITE_URL=https://mypathd.com. Its callbacks stay on PATHD; it never sends normal sign-in to AELIO's Site URL. Supabase sharing does not share browser cookies: establish a session on each domain using the same identity/provider. Links never carry raw access/refresh tokens. Automatic session SSO is not supplied.

**Do not disable email confirmation until secure recovery enrollment, CAPTCHA, per-IP Auth rate limits and founder protection pass staging tests on both applications.** Configure Supabase's supported CAPTCHA provider (Turnstile), the private verification secret in Supabase Auth, and the public site key in both apps. The widgets pass tokens through the Auth API; secrets never enter frontend code. Supabase must enforce CAPTCHA/rate limits even if a caller bypasses the form. Confirm redirect/email templates, password rules, session expiry and SMTP recovery delivery before opening signup. Then the owner can disable Confirm email for ordinary registration. No project-wide Auth setting has been changed here.

For an existing passwordless/unconfirmed founder or personal account, use legitimate owner verification and a secure password setup/recovery link for the same UUID. Do not create a replacement. Existing sessions/profiles/subscriptions are not reset by enrollment. Recovery codes are shown once; store/download them privately. Questions alone never reset a password. Secure email recovery is the fallback; passkeys are not implemented in this version.

Global sign-out revokes refresh sessions after a recovery reset. Already-issued JWTs may remain valid until expiry; configure an appropriately short access-token lifetime, and require reauthentication for sensitive changes. Do not promise immediate revocation of every access token.

## Cloudflare runtime integration

The existing connection error originated from `_src/edge/engine-proxy.js`: it returns engine_not_connected when neither AELIO_ENGINE nor a development origin exists. The frontend displayed that /api/me failure. R2 and Supabase cannot replace that missing backend.

The supplied private engine Worker/container source is in cloudflare/aelio-engine-worker. It has no workers.dev or public route and accepts only the private proxy secret. Keep a single engine instance because existing gateway limits are in-process. Cloudflare Containers availability/billing and actual service provisioning are unverified; the owner chooses when to configure them. Runtime files are ephemeral: Native/Code Studio execution and historical local artifacts need a suitable private execution/artifact host before those workflows can be considered operational. Sandboxed execution is deliberately refused in the supplied container until configured securely.

AELIO's root Worker retains its existing settings and adds the reported R2 binding, private engine binding and a one-minute cron. Cron runs the Supabase reminder RPC and storage-retention cleanup; in-app delivery is implemented, email/push/job monitoring is not. Verify cron is enabled in the actual account. The supplied `pathd-app` Worker name is a template: replace it with the actual existing PATHD Worker name before manual use; keep deployments separate.

Local builds are `npm ci && npm run build && npm test && npm run typecheck` in AELIO, `npm ci && npm run typecheck && npm test && npm run build:cloudflare` in PATHD. The engine worker package has a local dry-run check. None is a deployment script. npm run dev in AELIO provides static/account API development; R2 development needs Cloudflare's native local binding emulator. Never point local development at production credentials automatically.

## Required real-service acceptance before calling this operational

- Verify existing founder and personal UUIDs/providers/confirmation and login without account recreation; verify founder MFA/Studio versus personal access and regular-user denial.
- New Free signup without email confirmation only after shared abuse controls are enforced; show/store one-time codes, then sign in on the second domain using the same identity. Verify no duplicate Auth/profile rows.
- Exercise recovery correct/wrong answers, code reuse, wrong account, rate limits, email fallback, password changes, global sign-out, refresh/logout and cross-domain redirect/session behavior.
- Read/update shared profiles from both sites; prove cross-user RLS and independent plan/usage/suspension boundaries.
- Inspect actual AELIO_STORAGE and AELIO_ENGINE bindings; upload/download/delete through the deployed Worker, verify metadata and unauthorized denial. A local native R2 emulator passed, but this is not a deployed-binding check.
- Configure a provider-authorized model/pricing and real key on the private engine. Verify real streaming through website → edge → existing gateway → provider, usage/cost records and saved replies. No real model call has been made here.
- Verify guest allowance, transfer, Main Pal invariants, two same-style agents' isolation, themes/drafts/groups and MILA career consent boundaries.
- Create a near-term and recurring reminder; observe actual scheduled in-app notification delivery, cancellation and timezone behavior. Job monitoring must remain unavailable until a real provider is connected.
- Turn the engine off and verify sign-in/account settings remain accessible with an honest chat-service error.
- Check public/private asset boundaries, mobile navigation and unchanged Studio branding before any owner-run rollout.

Keep paid checkout closed and historical backups intact. Real-service checks are not marked passed by the local test results.
