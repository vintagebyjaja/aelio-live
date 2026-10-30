# AELIO_v1.0.2 source update manifest

Delta baseline: preserved AELIO_v1.0.1 delivery (not the old Git main). Apply that complete candidate first, then this source update, and run npm ci / npm run build. No previous ZIP was overwritten.

The migration Git branch preserves Git history and contains cumulative v1.0.1 + v1.0.2 work; update ZIPs contain only changed source/assets. Generated public HTML/JS/CSS and unchanged files are excluded. The original marketing homepage remains at /explore/.

## Files added or modified

- AGENTS.md
- CHANGELOG.md
- PROJECT_HANDOFF.md
- PROJECT_OVERVIEW.md
- RELEASE_MANIFEST.md
- _headers
- _src/build-chat.mjs
- _src/build.mjs
- _src/chat/Appearance.tsx
- _src/chat/DreamHome.tsx
- _src/chat/design-system.ts
- _src/chat/main.tsx
- _src/chat/styles.css
- _src/checks/browser_dreamhome.py
- _src/checks/browser_fixtures.py
- _src/checks/browser_messaging.py
- _src/checks/test-appearance.mjs
- _src/checks/test-platform-integration.mjs
- _src/platform/discovery.js
- _src/platform/index.js
- _src/platform/messaging.js
- config/DREAM_BOX.md
- docs/assignments/AELIO_v1.0.2_REQUIREMENTS.md
- docs/releases/AELIO_v1.0.2_VALIDATION.md
- package-lock.json
- package.json
- public/assets/dream/README.txt
- public/assets/dream/business.webp
- public/assets/dream/chocolate-cream.webp
- public/assets/dream/date-night.webp
- public/assets/dream/food.webp
- public/assets/dream/just-chat.webp
- public/assets/dream/new-ideas.webp
- public/assets/dream/ocean-fresh.webp
- public/assets/dream/travel.webp
- supabase/migrations/20261029000004_appearance.sql
- tools/package_update.py

## Deletions since v1.0.1

None.

## SQL and configuration

Run only appearance migration04 after the existing prerequisites; config/DREAM_BOX.md explains headers, provider boundaries and manual build/rollout. Existing Auth/R2 secrets are unchanged. No production SQL, deployment or main merge is part of this delivery. GitHub write access is verified for the user-authorized development branch codex/migration-v1.0.2.

Validation:31 JavaScript tests, six local integration scenarios, TypeScript/build/public checks and responsive browser contracts. See docs/releases/AELIO_v1.0.2_VALIDATION.md for actual boundaries and unverified external services. SHA-256 file and archive hashes are in the external delivery manifests.
