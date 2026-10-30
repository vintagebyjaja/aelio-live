# AELIO coding agent instructions

Read `PROJECT_OVERVIEW.md`, `PROJECT_HANDOFF.md`, `CHANGELOG.md`, `RELEASE_MANIFEST.md`, and `AELIO_VISUAL_LOCK.md` before development. Current authorized work replaces the historical visual-lock restrictions on authentication/backend changes; the official Dream Beyond icon and approved public design remain protected. Preserve Studio Brain's visual design.

- Work in the existing isolated checkout. Do not create Git worktrees unless explicitly requested.
- Never deploy, publish, push, run production SQL, activate checkout, or connect development to production services without a new explicit user instruction.
- Preserve existing identities, histories, profiles and data. Migration is additive and explicit; never link privileged identities by email alone.
- Supabase is the production source of authentication and structured application data. No Firebase runtime fallback. Historical migration inputs are not runtime dependencies.
- The Original Main Pal is always AELIO, adaptive and permanent, without a selectable named personality. Custom agents retain independent identities, histories, memories and appearance even when styles match.
- MILA has distinct identity and career memory; PATHD exposes only AELIO and MILA. The broader AELIO agent ecosystem remains available on AELIO.
- One shared Auth identity; independent product subscriptions, permissions, usage and consent. Do not assume browser sessions cross domains.
- Keep recovery answers out of logs/metadata/browser responses; use versioned salted slow hashes. Questions alone never authorize a reset. Strong single-use codes are implemented; passkeys are not implemented.
- Keep the existing private R2 bucket and native binding; do not create duplicates or request external R2 access keys.
- Never fabricate operational telemetry, live model responses, deployed status, job-monitoring results or reminder delivery. Test fixtures must be labeled.
- Use stable IDs, RLS and server ownership checks. Never expose service-role credentials to clients. Never log raw tokens, passwords, recovery answers/codes or file contents.
- Preserve accessibility, mobile navigation and reduced-motion support. Use shared components and local assets.
- Run relevant tests/builds. Distinguish live, locally verified, fixture-tested, blocked and unrun checks.
- Update continuity documents and use sequential immutable versioned ZIP deliveries. No ZIP part may contain more than 100 files. Include full inventory, extraction/upload instructions and SHA-256 checksums. SQL/config packages are separate when applicable.

## v1.0.2 continuity

Read `docs/assignments/AELIO_v1.0.2_REQUIREMENTS.md` and `config/DREAM_BOX.md`. Four themes share tokens/components; visual hierarchy is conversation overrides > one custom agent > global AELIO. Inherit mode must retain saved custom settings. Theme changes never alter personalities. Dream Box is `/`; original marketing remains `/explore/`. Update ZIPs are deltas relative to the v1.0.1 delivery and exclude generated build output. A later user clarification authorizes only a Codex migration branch preserving main; never merge or invoke a deployment. GitHub write access was restored and verified with a non-mutating dry run; the user explicitly authorizes committing/pushing the versioned development branch only.

## v1.0.3 deployment repair

The user subsequently authorized updating main and triggering the existing Cloudflare deployment. That authorization supersedes earlier branch-only restrictions for the requested site rollout. It does not authorize production SQL or credential changes. Cloudflare log10143 confirms aelio-engine does not exist; default wrangler.jsonc must not require that missing target. Keep all Brain source and unavailable-service responses. Add its private service binding only after the real backend exists; see config/CONNECT_BRAIN.md.

## Current v1.0.4 instructions

The user authorized pushing the completed AELIO update to main now, followed by the separately validated PATHD update when ready. Keep repositories/domains/deployments separate; do not manually deploy, change Cloudflare settings, production SQL or secrets. Preserve the cinematic redesign already approved; the later AI instructions request functional activation without further redesign. Worker-native OpenAI Responses is a modular chat provider; the existing private Brain remains available with AELIO_AI_PROVIDER=brain. Never expose provider/service-role keys. See config/V1_0_4_SETUP.md and the release validation notes.

## Current 1.0.5 review boundary

The latest user explicitly requests GitHub migration-branch previews first and will approve main later. Push only migration; never main or a manual deployment. PATHD stays in its own repository/branch. Apply no production SQL or secrets. Eight official companions use stable kind IDs and locked identities; Dream Team contains only the six specialists. Only custom agents may be renamed/deleted. See config/V1_0_5_SETUP.md and the 1.0.5 validation notes.

## Main promotion approved — 2026-10-30

The user explicitly approved promoting the reviewed migration update to main. Keep AELIO and PATHD separate. Existing Git-triggered Cloudflare builds are permitted; do not run a manual deployment or change production settings/secrets. The user will retrieve and execute Supabase SQL personally. No production SQL is authorized for Codex.


## 1.0.6 — Optional recovery and sign-in repair (2026-10-30)

Owner authorizes pushing this repair to main in each separate repository. Verified sign-in never forces recovery enrollment. Public browsing remains available; private account data still requires authentication. Signup no longer depends on optional companion/guest configuration. Saving recovery answers does not change passwords or sessions and preserves existing backup codes; new codes require explicit opt-in. Current-password verification remains required when editing security settings. Shared identities do not merge subscriptions or browser sessions.

Run AELIO migration `20261030000007_optional_recovery.sql` once after the already-applied 05 and 06 for answer-only saving. Do not rerun old migrations. Sign-in is independent of 07. No production SQL, credentials/settings changes or manual deployment performed. Local fixture checks do not verify production Auth or Cloudflare runtime configuration.
