# AELIO project overview

Current implementation **AELIO_v1.0.4**, 2026-10-30. The owner-authorized main push triggered Cloudflare, which rejected publication with error10143 because the configured aelio-engine service was missing. The actual deployment outcome of this repair must be verified.

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
