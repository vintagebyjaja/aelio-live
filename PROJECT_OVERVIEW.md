# AELIO project overview

Current implementation **AELIO_v1.0.5**, migration-branch review only. Previous implementation **AELIO_v1.0.4**, 2026-10-30. The owner-authorized main push triggered Cloudflare, which rejected publication with error10143 because the configured aelio-engine service was missing. The actual deployment outcome of this repair must be verified.

AELIO is Dream Beyond / Grooveville LLC's adaptive Original Main Pal: **One Mind. Your Energy.** His name and identity are permanent. Named styles belong to separate custom agents. MILA is PATHD's distinct career and life companion, not a renamed AELIO.

## Maintained components

| Component | Source | Responsibility |
|---|---|---|
| Public marketing website | `_src/`, built `public/` | Existing approved visuals and official Dream Beyond icon; prominent Chat entry |
| Dream Box / Chat | `_src/chat/` | Public guest chat, independent agent/group threads, drafts, appearance, account/recovery and career interfaces |
| Existing Brain / Studio | `_src/brain/` | Existing founder back office, historical member features, MFA/security gates; no Studio redesign |
| Cloudflare edge | `_src/edge/`, `_src/platform/` | Same-origin routing, account service, R2 ownership/limits, guest quota and persistence, recovery, reminder cron |
| Private engine | `engine/aelio/` | Existing inference gateway, model routing, usage/cost controls, orchestration and research features |
| Engine runtime integration | `cloudflare/aelio-engine-worker/`, `Dockerfile.engine` | Private service-bound Worker/container; one engine instance |
| Structured data | `supabase/migrations/` | Shared Auth UUID/core profile, independent entitlements, application tables and RLS; private engine PostgreSQL schema |
| Large files | Native `AELIO_STORAGE` binding | Existing private `aelio-storage` R2 bucket; metadata/ownership in Supabase |
| PATHD | Separate `vintagebyjaja/pathd-app` repository | Next.js application with native AELIO/MILA interface and private `AELIO_PLATFORM` service binding |
| Native | `native/` | Independent research; no claim of a product-approved Native model |

`aelio/__init__.py` routes historical Python entry points to the maintained `engine/aelio` implementation. Older root copies and documentation are preserved for provenance; do not develop a second engine. Existing engine conversations/wallets remain available through the older member Brain interface after explicit data/identity migration. New messaging threads live in `public.app_*`; histories are not silently merged.

## Boundaries

Supabase Auth is the sole production sign-in provider. SQLite/local-password mode is explicit offline testing/export only. Firebase runtime sign-in is removed; historical mappings and backups remain available. Do not associate accounts by email alone.

A shared Supabase UUID works on both domains. Each domain establishes its own session with the shared identity provider; credentials work on both. No raw access or refresh tokens are passed in links. Automatic cross-domain session SSO is not implemented; independent sign-in is supported.

AELIO and PATHD memberships, message credits, subscriptions and private data are independent. Both memberships are provisioned without duplicating Auth users or overwriting existing profiles. Paid plans/checkout stay closed. Founder access requires administrative UUID+email assignment, confirmed ownership and existing MFA/Studio gates. The personal role has approved AELIO perks without Studio access.

Agents access only the current authorized thread, approved agent memories and selected files. Career data requires explicit consent; outside-MILA use requires separate permission. Marketplace profile drafts contain no private histories, files, credentials or memories. Publishing and purchasing are not enabled.

## Operational limits

Real provider output, actual Supabase users, live cross-domain callbacks, actual Cloudflare bindings and production migration are unverified. Local fixture providers are clearly marked test-only. Inference is not enabled by a successful login, database connection or R2 upload. See `docs/releases/AELIO_v1.0.1_VALIDATION.md` and `config/SETUP.md` before any manual rollout.

## Dream Box v1.0.2

The root and `/chat/` now open the personalized Dream Box. The approved prior marketing homepage is at `/explore/`. Four token-based designs (OG Light, OG Dark, Ocean Fresh, Chocolate Cream) share one responsive UI, six photographic primary topics and seven secondary topics. Categories prepare editable AELIO drafts; they never create personalities or automatically send. Global account/guest preferences, retained independent custom-agent visuals and conversation overrides resolve dynamically. Today offers optional transient location/weather, clearly labeled external Maps searches, and honest future Groove Guide/VYBR8 integration points. See the v1.0.2 validation and configuration notes.

The default website deployment no longer requires a not-yet-created Brain Worker. All real engine source and connection hooks remain intact. Read config/CONNECT_BRAIN.md before enabling the service binding. A functioning website is separate from verified inference/Auth/database readiness.

## v1.0.4 completed AELIO update

The approved cinematic Home/Discover/Agents/Create/Projects/Connected Apps/Settings UX is implemented for desktop/tablet/mobile with four themes, actual owned history, an animated orb and unified explicit-send composer. Supabase public aliases resolve at build/runtime without leaking secrets; session refresh and product-local logout are hardened. Guest/rate HMAC can derive from the server-only service credential when a dedicated secret is absent. Worker-native OpenAI Responses streams through existing authorized orchestration, quotas and persistent conversations; model/output/context/daily limits are server-configurable. Existing private Brain/Native infrastructure remains separate. Website handoffs are labeled and never claim API/account-linking access. PATHD remains a separate application/repository.

1.0.5 adds owner-scoped account repair RPCs and permanent official companions/Dream Team, consumer copy/fallback polish and the native WebGL liquid-metal orb. See config/V1_0_5_SETUP.md. Main is preserved pending explicit review.


## 1.0.6 — Optional recovery and sign-in repair (2026-10-30)

Owner authorizes pushing this repair to main in each separate repository. Verified sign-in never forces recovery enrollment. Public browsing remains available; private account data still requires authentication. Signup no longer depends on optional companion/guest configuration. Saving recovery answers does not change passwords or sessions and preserves existing backup codes; new codes require explicit opt-in. Current-password verification remains required when editing security settings. Shared identities do not merge subscriptions or browser sessions.

Run AELIO migration `20261030000007_optional_recovery.sql` once after the already-applied 05 and 06 for answer-only saving. Do not rerun old migrations. Sign-in is independent of 07. No production SQL, credentials/settings changes or manual deployment performed. Local fixture checks do not verify production Auth or Cloudflare runtime configuration.


## 1.0.7 — Migration review, not main (2026-10-30)

The owner requests migration-only review for this iteration. Preserve main at AELIO1.0.6 / PATHD0.1.4. No manual deployment, production SQL, secrets or settings changes. Accounts remain separate in each repository with shared Auth identities and independent subscriptions.

Account repair isolates optional legacy PATHD profile failures, preserves verified sessions and existing agent access, and removes guest-signing dependence from the global AI counter. Recovery questions are optional settings and absent from signup. Google/Apple PKCE and authenticated provider linking are wired; native Supabase passkey controls are default-off pending hosted-project/RP/recent-auth policy verification. Do not claim live OAuth/passkeys/production chat has been verified. The production outage's exact response/log is still needed.

AELIO09 SQL adds a private UUID-bound unlimited-credit registry; grants require the owner-verified IDs in config/GRANT_APPROVED_UNLIMITED.sql and confer no admin/Studio Brain/paid-plan permissions. Regular balances stay plan/product specific. Apply07 if needed, then08 and09 manually only after review; never rerun historical backfills. No real entitlement or production database was changed by Codex.

AELIO additionally includes bounded editable custom groups, the exact scripted UNCs marketing example, shared editorial styles and a reusable lazy page-aware DreamBox. These earlier requested features remain on migration. PATHD does not receive the AELIO group ecosystem or visual redesign. See AELIO config/V1_0_7_REVIEW_SETUP.md and release validation notes for manual setup and limitations.


## Pending migration provider-stream repair — 2026-10-30

Fixed Responses nested failure parsing and safe provider status/category/request-ID diagnostics. Live provider rejection remains unverified without production logs; no automatic retry added. Preserve current UI and pending1.0.8 work. See `docs/diagnostics/PROVIDER_STREAM_REPAIR.md`. No main push or deployment authorized.
