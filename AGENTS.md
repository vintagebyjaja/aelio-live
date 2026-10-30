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
