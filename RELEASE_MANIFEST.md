# AELIO 1.0.5 migration review manifest

Repository: vintagebyjaja/aelio-live. Branch: migration. Base/main: 8da7e87. Main must remain unchanged until explicit user approval. PATHD code remains in its separate repository.

Changes: account/profile/private-schema repair, safe modern Supabase API-key headers, independent signed-in rate limiting, centralized consumer messages/fallbacks, WebGL liquid-metal orb, Chocolate Cream olive/sage accents, eight protected companions/nine stable default chats, coordinated Dream Team/mentions, saved MILA styles, private history search, exact approved portrait crops and custom-only portrait upload/reposition/reset.

SQL: manually review/apply migrations 05 then 06 after existing 01–04. Nothing applied to production. Separate SQL and configuration ZIPs are in deliveries/AELIO_v1.0.5; checksums and execution order included. No new secrets or buckets are required. No file deletions required. Rebuild public output after source changes; this review branch already contains the verified generated output.

Validation: 53 JavaScript tests, 11 disposable local database scenarios, private SQL portrait-lock/cascade fixtures, four Python bridge tests, TypeScript, production build, public/routes/security checks, Wrangler dry-run, desktop/mobile browser contracts, actual software WebGL/reduced-motion/fallback and custom portrait crop browser checks. PATHD has its own 12 tests/builds. Production Auth/provider/runtime/R2 and physical-device audio/FPS remain unverified. Stopped partial replies remain local. Legacy account-deletion constraints fail safely before file deletion. See docs/releases/AELIO_v1.0.5_VALIDATION.md.

## Changed or added files

- `AGENTS.md`
- `CHANGELOG.md`
- `PROJECT_HANDOFF.md`
- `PROJECT_OVERVIEW.md`
- `README.md`
- `RELEASE_MANIFEST.md`
- `_src/brain/main.tsx`
- `_src/brain/portal.tsx`
- `_src/brain/security.tsx`
- `_src/build-auth-config.mjs`
- `_src/build-chat.mjs`
- `_src/build.mjs`
- `_src/chat/AelioOrb.tsx`
- `_src/chat/Auth.tsx`
- `_src/chat/Companions.tsx`
- `_src/chat/ConnectedApps.tsx`
- `_src/chat/DreamHome.tsx`
- `_src/chat/Experience.tsx`
- `_src/chat/Icon.tsx`
- `_src/chat/client.ts`
- `_src/chat/design-system.ts`
- `_src/chat/main.tsx`
- `_src/chat/orb-renderer.ts`
- `_src/chat/premium.css`
- `_src/chat/styles.css`
- `_src/checks/browser_avatar.py`
- `_src/checks/browser_companions.py`
- `_src/checks/browser_premium.py`
- `_src/checks/pages-emulator.mjs`
- `_src/checks/test-auth-config.mjs`
- `_src/checks/test-experience.mjs`
- `_src/checks/test-platform-integration.mjs`
- `_src/edge/engine-proxy.js`
- `_src/platform/index.js`
- `_src/platform/messaging.js`
- `_src/platform/providers/openai.js`
- `_src/platform/recovery.js`
- `_src/platform/shared.js`
- `_src/public-experience.mjs`
- `_src/shared/companions.d.ts`
- `_src/shared/companions.js`
- `_src/shared/ecosystem.js`
- `_src/shared/experience.d.ts`
- `_src/shared/experience.js`
- `_src/shared/mila-style.js`
- `_src/visuals.mjs`
- `assets/references/official-portraits/SOURCE_MANIFEST.json`
- `assets/references/official-portraits/dream-team-23e126a6b025.png`
- `assets/references/official-portraits/mila-cb9f4ecaaab5.png`
- `assets/site.js`
- `config/V1_0_5_SETUP.md`
- `deliveries/AELIO_v1.0.5/AELIO_v1.0.5_Config.zip`
- `deliveries/AELIO_v1.0.5/AELIO_v1.0.5_SQL.zip`
- `deliveries/AELIO_v1.0.5/README.md`
- `deliveries/AELIO_v1.0.5/SHA256SUMS.txt`
- `docs/assignments/AELIO_v1.0.5_AUTH_MILA.md`
- `docs/assignments/AELIO_v1.0.5_COMPANIONS.md`
- `docs/assignments/AELIO_v1.0.5_GLOBAL_POLISH.md`
- `docs/assignments/AELIO_v1.0.5_ORB.md`
- `docs/assignments/AELIO_v1.0.5_PORTRAIT_LOCK.md`
- `docs/previews/v1.0.5/README.md`
- `docs/previews/v1.0.5/chocolate-cream-desktop.png`
- `docs/previews/v1.0.5/companions-desktop.png`
- `docs/previews/v1.0.5/companions-mobile.png`
- `docs/previews/v1.0.5/dream-team-desktop.png`
- `docs/previews/v1.0.5/dream-team-mobile.png`
- `docs/previews/v1.0.5/home-desktop.png`
- `docs/previews/v1.0.5/home-mobile.png`
- `docs/previews/v1.0.5/ocean-fresh-desktop.png`
- `docs/releases/AELIO_v1.0.5_VALIDATION.md`
- `engine/aelio/routes_messaging.py`
- `package-lock.json`
- `package.json`
- `public/404.html`
- `public/_headers`
- `public/account/index.html`
- `public/aelio/agent-transfer/index.html`
- `public/aelio/conversation/index.html`
- `public/aelio/how-it-works/index.html`
- `public/aelio/index.html`
- `public/aelio/main-pal/index.html`
- `public/aelio/personalities/index.html`
- `public/aelio/teammate/index.html`
- `public/agent-campus/accountability/index.html`
- `public/agent-campus/community-service/index.html`
- `public/agent-campus/draft-block/index.html`
- `public/agent-campus/index.html`
- `public/agent-campus/lobby/index.html`
- `public/agent-campus/mentor-mentee/index.html`
- `public/agent-campus/onboarding/index.html`
- `public/agent-campus/reports/index.html`
- `public/agent-campus/university/index.html`
- `public/assets/brain/app.js`
- `public/assets/chat/app.css`
- `public/assets/chat/app.js`
- `public/assets/config.js`
- `public/assets/img/companions/angelo.webp`
- `public/assets/img/companions/chloe.webp`
- `public/assets/img/companions/mila-full.webp`
- `public/assets/img/companions/mila.webp`
- `public/assets/img/companions/naomi.webp`
- `public/assets/img/companions/oliver.webp`
- `public/assets/img/companions/reggie.webp`
- `public/assets/img/companions/simone.webp`
- `public/assets/search-index.json`
- `public/assets/site.js`
- `public/auth/callback/index.html`
- `public/auth/reset/index.html`
- `public/brain/index.html`
- `public/brain/my/index.html`
- `public/chat/index.html`
- `public/create/animation/index.html`
- `public/create/architecture/index.html`
- `public/create/design/index.html`
- `public/create/games/index.html`
- `public/create/index.html`
- `public/create/projects/index.html`
- `public/create/worlds/index.html`
- `public/dream-beyond/agent-team/index.html`
- `public/dream-beyond/dream-spaces/index.html`
- `public/dream-beyond/ecosystem/index.html`
- `public/dream-beyond/index.html`
- `public/dream-beyond/main-pal/index.html`
- `public/dream-beyond/vision/index.html`
- `public/explore/index.html`
- `public/index.html`
- `public/live/agent-teams/index.html`
- `public/live/create-agents/index.html`
- `public/live/index.html`
- `public/live/marketplace/index.html`
- `public/live/plans/index.html`
- `public/live/publishing/index.html`
- `public/live/train-agents/index.html`
- `public/studiobrain/index.html`
- `public/technology/dream-cloud/index.html`
- `public/technology/dream-code/index.html`
- `public/technology/dream-deploy/index.html`
- `public/technology/dream-guard/index.html`
- `public/technology/dream-memory/index.html`
- `public/technology/green-guardians/index.html`
- `public/technology/index.html`
- `public/technology/native/index.html`
- `public/values/community/index.html`
- `public/values/green-guardians/index.html`
- `public/values/index.html`
- `public/values/opportunity/index.html`
- `public/values/privacy/index.html`
- `supabase/migrations/20261030000005_account_repair.sql`
- `supabase/migrations/20261030000006_permanent_companions.sql`
- `tools/import_official_portraits.py`


## 1.0.6 — Optional recovery and sign-in repair (2026-10-30)

Owner authorizes pushing this repair to main in each separate repository. Verified sign-in never forces recovery enrollment. Public browsing remains available; private account data still requires authentication. Signup no longer depends on optional companion/guest configuration. Saving recovery answers does not change passwords or sessions and preserves existing backup codes; new codes require explicit opt-in. Current-password verification remains required when editing security settings. Shared identities do not merge subscriptions or browser sessions.

Run AELIO migration `20261030000007_optional_recovery.sql` once after the already-applied 05 and 06 for answer-only saving. Do not rerun old migrations. Sign-in is independent of 07. No production SQL, credentials/settings changes or manual deployment performed. Local fixture checks do not verify production Auth or Cloudflare runtime configuration.
