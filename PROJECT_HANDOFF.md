# Current handoff — AELIO_v1.0.3 deployment repair

2026-10-30. The user explicitly authorized the tested main update to trigger the current Cloudflare integration. Main was updated to9262158; Cloudflare uploaded the changed assets but failed to publish with code10143: `AELIO_ENGINE` referenced missing Worker `aelio-engine`. v1.0.3 removes the premature service declaration from the default root deployment config, preserving R2 and every other setting. Brain source, private architecture and clear unavailable-engine errors remain unchanged.

This patch does not deploy the backend, run production SQL or set secrets. The real Brain still needs deployment and secure runtime/database configuration. `config/CONNECT_BRAIN.md` gives the exact prerequisite order, binding snippet and runtime names. Dashboard build variables with Next.js names are not equivalent to the AELIO Worker's required runtime variables.

Repair branch: `codex/deployment-fix-v1.0.3`. The user's main/deployment authorization remains in effect for this fix. Verify the next Cloudflare build before claiming the site is live. v1.0.1 and v1.0.2 immutable packages remain preserved. No SQL change is required by this repair; GitHub-source and configuration ZIPs are provided separately.

---

# AELIO current handoff — v1.0.2

2026-10-29. This is an additive update to the preserved v1.0.1 candidate described below. The user's latest clarification authorizes a Codex migration branch in the existing Git repository, preserving main; no deployment or production modification is authorized. GitHub write access was restored after the earlier 403 and verified by a successful non-mutating dry run. The user authorizes committing/pushing `codex/migration-v1.0.2` only; no main merge or production operation is authorized.

Implemented the four official themes with centralized tokens, personalized root Dream Box, photographic category drafts, direct typing/browser dictation fallback, Today location/weather adapter, external Maps links, modular Groove Guide/VYBR8 entry points, global account/guest settings, dynamic agent inheritance with retained custom settings, and preserved conversation overrides. Original marketing is retained at `/explore/`; other routes and existing v1.0.1 capabilities remain. The new SQL migration only adds appearance columns/mode and retains RLS.

Read `config/DREAM_BOX.md`, `docs/assignments/AELIO_v1.0.2_REQUIREMENTS.md` and `docs/releases/AELIO_v1.0.2_VALIDATION.md`. New source ZIPs contain only necessary updates relative to v1.0.1 and exclude generated HTML/JS/CSS; run the full build before owner-managed upload. v1.0.1 ZIPs have not been overwritten. Existing production/service/identity-migration blockers still apply. Do not treat fixture browser results as live-service validation.

---

# AELIO development handoff

## Local delivery candidate

**AELIO_v1.0.1**, 2026-10-29. Baseline AELIO commit `c812a8af6ce8113e201ba706a5951cc3f2aee568`; the baseline had no verified semantic platform release or Git tags. This is the first assigned delivery number, not evidence of a previously published v1.0.0. PATHD source is `vintagebyjaja/pathd-app` (not `pathd-claude`); its package version advances 0.1.0 → 0.1.1 within this combined delivery.

No deployment, push, release publication, real account mutation, destructive source-data operation or production SQL was performed. All database tests used newly created disposable local stores.

## Implemented

- Dream Box chat/account interface added alongside existing marketing and Brain pages; responsive sidebar/drawer, instant chat selection, isolated drafts/stream updates, per-thread appearance previews/saving, groups with explicit target selection, custom agent subtitles/instructions/memory controls, sanitized marketplace profile drafts.
- Permanent AELIO identity enforced in both new chat and legacy member APIs. MILA has her own history and scoped career context, with Go to Your PATH navigation. Existing Studio visual design retained.
- Persistent configurable guest quota (10 default), per-IP daily abuse cap, server rate limits, expiring HttpOnly guest cookie and single-claim thread transfer. Free accounts start with independent per-product 100-message monthly allowances; existing gateway credit/spend controls remain additional safeguards. Approved AELIO founder/personal allowances are server-assigned.
- Supabase-only active browser/engine identity; account dashboard independent of engine health; shared profile/provisioning, recovery enrollment and Free-plan initialization. Founder administration uses known UUIDs plus confirmed ownership and MFA, never an entered email alone.
- Two-phase signup/recovery enrollment; salted six-round PBKDF2-SHA256 chain (100k per round), 256-bit single-use recovery codes, reauthentication for updates, generic recovery errors, per-IP throttling, Supabase global sign-out after password recovery. Optional Turnstile widget integration on both sites; the shared Supabase CAPTCHA/rate-limit settings must be configured by the owner before disabling confirmations.
- Native private R2 upload/read/delete, MIME/extension/signature checks, random keys, per-file/total quotas, metadata/ownership checks, authenticated downloads, retention cleanup, text/JSON/PDF inference attachments and downloadable generated text outputs.
- PostgreSQL compatibility for the existing engine, additive private schema, non-destructive offline import tooling, explicit identity mapping, logical PostgreSQL backups and guarded restore. Source SQLite data and legacy identity records are not automatically deleted.
- Persistent reminders, timezone-aware daily/weekly recurrence, in-app notifications/history, idempotent cron delivery and crash-refund handling. AELIO MILA can draft tool-based reminder suggestions for explicit user confirmation. Job monitoring is honestly unavailable without a provider.
- PATHD native two-agent interface, private service bridge, shared security enrollment, career-profile import with consent, Ask MILA on jobs/navigation, reminder management and independent subscription display; existing brand and unrelated features preserved.
- Missing private engine Worker/container integration and PATHD Cloudflare build adapter supplied as local source/configuration. Existing R2 declaration merged into root Wrangler.

## Outstanding external verification and limitations

1. No Supabase key, database credential, founder/personal UUID mapping, real login password or AI key was configured in this environment. Do not claim actual founder/personal login, real AI output, real signup/recovery, live RLS or deployed R2 works. The owner must perform the staging checklist in `config/SETUP.md`.
2. The Cloudflare dashboard bindings and actual hosting names are user-reported, not remotely inspected. PATHD Wrangler's `pathd-app` name must match its actual existing Worker before manual use. Do not create a duplicate deployment accidentally.
3. Supabase Auth/project-wide email-confirmation/CAPTCHA/redirect settings were not changed. Existing unconfirmed/passwordless accounts need legitimate owner verification/secure password setup, not replacement registration.
4. Identity/data migration is not complete: stage/backup/export the legacy SQLite engine database and reviewed Firebase→existing-Supabase mapping first. The engine refuses duplicate account creation on unresolved email collisions. Import uses an empty migrated destination and preserves IDs; no source data is altered.
5. Existing histories remain in the legacy engine tables/UI; the new Dream Box does not silently import or merge them. A dedicated migration into new thread tables needs a reviewed identity/context mapping.
6. One existing Quality Lab acceptance test cannot run its browser step because its exact Playwright headless-shell download is blocked by the current environment network policy. System Chromium was used through its supported explicit executable option for new UI checks. No protected suite was weakened or re-hashed.
7. Automatic cross-domain SSO is not implemented. Both sites establish their own sessions with the shared Supabase provider. No raw token handoff in URLs.
8. Storage for audio/video/images is implemented; inference attachments currently support text, JSON and PDF, not voice/vision/video analysis. Some background categories reuse approved artwork; the UI discloses that. Passkeys, marketplace publishing/purchasing, email/push notification delivery and real job monitoring are not enabled.
9. Cloudflare engine container files are ephemeral. Supabase holds structured records; new user files use R2. Legacy Native Lab, Code Studio sandbox and local research artifacts still require suitable private execution/persistent artifact infrastructure. The container explicitly refuses sandbox execution until a secure backend is provided. No production execution-readiness claim is made.
10. Existing gateway model IDs/prices require validation against the configured provider account; source defaults are preserved. One engine instance is configured because gateway rate/concurrency state is currently in-process.
11. Global sign-out revokes refresh sessions; existing Supabase access JWTs can remain valid until expiry. Use short access-token lifetimes and validate sensitive actions with reauthentication. No unsupported claim of immediate JWT revocation is made.

## Next exact actions

Read the configuration and SQL instructions; configure and validate a staging copy with the owner's keys. Resolve the protected browser download policy if that separate Quality Lab workflow is required. Run real end-to-end Auth/recovery/provider/R2 checks before claiming operational readiness. The owner handles all uploads, settings and deployment; do not do them automatically.
