# AELIO_v1.0.1 validation record

Local development only, 2026-10-29. Production Supabase, real user credentials, Cloudflare dashboards/bindings and real AI inference were not accessed or mutated. No deployment, push, publication or production SQL was performed.

## Passed locally

- AELIO JavaScript suite: 28 tests, covering the existing edge bridge, Supabase client sessions/PKCE, PATHD bridge, Worker routing, public-config secrecy, cross-origin mutation rejection, file validation, salted recovery hashing and account/engine separation.
- Five API integration scenarios using **real disposable PostgreSQL 16 + PostgREST**, with explicitly fake Auth/inference and a local storage adapter: owner isolation; separate same-personality agents; independent themes; explicit group target; upload/read/delete and metadata; guest allowance/claim/replay; persistent reminder delivery/idempotency and cross-user denial.
- SQL transaction checks on disposable PostgreSQL: dual memberships, permanent companions, no signup role escalation, RLS denial of other users' conversations/messages, denial of forged model messages/credit changes/service RPC calls, idempotent refunds, independent product credits/suspension, single-use recovery codes, reminder recurrence/deduplication. Additive migration repeated successfully.
- Native **workerd/Miniflare R2 binding** upload/read/delete. This proves local native API compatibility, not the deployed bucket configuration.
- Existing Python gateway exercised on the migrated private PostgreSQL schema: initialization, transactions, consent, usage/wallet metering, gateway completion and audit persistence with the labeled test provider. PostgreSQL logical backup checksum/inventory and restore safeguard pass; no restore performed.
- Engine regression suite: **162 passed, 1 deliberately excluded and separately recorded as blocked** (the known browser-download prerequisite). Includes local asymmetric Supabase JWT verification, founder/personal boundaries, Main Pal identity protections and private gateway bridge.
- AELIO site/Brain/chat production build and TypeScript checks. Public deployment-boundary checks continue to protect the public/ upload.
- Desktop/mobile Dream Box browser contract checks at 1440px and 390px using explicit offline Auth/API fixtures and system Chromium: conversation selection, per-thread unsent drafts, isolation of replies, appearance saving, account dashboard, no horizontal overflow or uncaught page errors.
- PATHD's existing match suite: 3 tests. TypeScript and Next production build pass. Cloudflare OpenNext build passes after pinning compatible Wrangler/Sharp dependencies and bundling the same existing fonts locally. Final recheck results are recorded below.
- Private engine Worker local bundle/container-image dry-run check and non-root Docker image build/start. Local PostgreSQL-backed health request passes; untrusted direct calls are denied. No remote Worker or container was deployed.

## Blocked or unrun

- One existing Quality Lab acceptance test (`test_external_comparison_passes_and_is_labelled`) reaches seven build/unit checks but cannot launch the exact Playwright headless shell; its official CDN download was denied by the environment policy. The protected test, suite assertions and hashes were not weakened. This test remains blocked; system Chromium UI checks are separate evidence.
- Actual Supabase Auth signup/login/recovery for founder/personal/new users, live token refresh, SMTP, CAPTCHA and both production domains: unverified because no credentials/settings were provided. Browser/Auth fixtures do not establish these outcomes.
- Real AI replies and persistence through a real hosted engine: unverified, no authorized real provider key present. Test-provider text is never counted as real AI.
- Actual deployed R2 binding, Cloudflare cron delivery, existing Worker names, deployment preservation and hosted container capability: unverified. Configuration declarations and local builds are not deployments.
- Existing production data import, founder UUID bootstrap and cross-domain real sessions: unrun. Account identities have not been recreated or modified.
- Rust Native research workspace: unrun (no Cargo toolchain installed; unrelated source unchanged). PostgreSQL engine testing is representative, not a claim that the complete historical suite has been run on every database/runtime combination.

See PROJECT_HANDOFF.md for remaining product/runtime limitations and config/SETUP.md for the owner's real-service acceptance checklist.

Final focused engine rechecks: 27 identity/core/bridge tests passed, plus the 3 private-bridge/privacy tests passed after the career-context isolation refinement. All engine Python modules parse and repository whitespace checks pass.
