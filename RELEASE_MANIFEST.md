# AELIO_v1.0.4 change manifest

Application: AELIO only. Base:db874d4 (v1.0.3). User-authorized immediate Git push to main; PATHD remains separate. No new SQL migration or runtime secret value is included. Existing database migrations remain prerequisites. Setup:config/V1_0_4_SETUP.md. Validation:docs/releases/AELIO_v1.0.4_VALIDATION.md.

## Changed, added or removed paths

- AGENTS.md
- CHANGELOG.md
- PROJECT_HANDOFF.md
- PROJECT_OVERVIEW.md
- RELEASE_MANIFEST.md
- _src/brain/supabase-auth.ts
- _src/build-auth-config.mjs
- _src/chat/Auth.tsx
- _src/chat/ConnectedApps.tsx
- _src/chat/DreamHome.tsx
- _src/chat/Icon.tsx
- _src/chat/Markdown.tsx
- _src/chat/client.ts
- _src/chat/design-system.ts
- _src/chat/main.tsx
- _src/chat/premium.css
- _src/checks/browser_dreamhome.py
- _src/checks/browser_premium.py
- _src/checks/pages-emulator.mjs
- _src/checks/test-auth-config.mjs
- _src/checks/test-openai.mjs
- _src/checks/test-platform-integration.mjs
- _src/checks/test-supabase-auth.mjs
- _src/generated/public-auth-config.js
- _src/platform/index.js
- _src/platform/messaging.js
- _src/platform/providers/openai.js
- _src/platform/shared.js
- _src/shared/ecosystem.d.ts
- _src/shared/ecosystem.js
- _src/shared/supabase-config.d.ts
- _src/shared/supabase-config.js
- config/V1_0_4_SETUP.md
- deliveries/AELIO_v1.0.1/AELIO_v1.0.1_Delivery.sha256 (removed; preserved in prior Git history and immutable external backup)
- deliveries/AELIO_v1.0.1/AELIO_v1.0.1_Delivery.zip (removed; preserved in prior Git history and immutable external backup)
- deliveries/README.md
- docs/assignments/AELIO_v1.0.4_AI_REQUEST.md
- docs/assignments/AELIO_v1.0.4_DESKTOP_REQUEST.md
- docs/assignments/AELIO_v1.0.4_MOBILE_REQUEST.md
- docs/releases/AELIO_v1.0.4_VALIDATION.md
- engine/aelio/routes_messaging.py
- engine/tests/test_messaging_bridge.py
- package-lock.json
- package.json
- public/assets/brain/app.js
- public/assets/chat/app.css
- public/assets/chat/app.js
- public/assets/config.js
- public/assets/dream/ideas-horizon.webp
- public/assets/dream/og-dark-mobile.webp
- public/assets/dream/og-dark-waterfront.webp
- public/assets/dream/og-light-mobile.webp
- public/assets/dream/og-light-waterfront.webp
- public/brain/index.html
- public/brain/my/index.html
- public/studiobrain/index.html
- wrangler.jsonc

No versioned ZIP is required by the latest user delivery workflow. Previous archives were not overwritten.
