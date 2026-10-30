# AELIO 1.0.7 — migration review only

The GitHub ZIPs are changed-file deltas over AELIO main1.0.6 (5d03c46), not a complete replacement repository. Extract ALL numbered parts over that repository root, preserving paths. Each part has at most100 project files. No deletions. Do not copy into public/ as a whole, and do not overwrite previous deliveries. Dependencies/caches/secrets are excluded. Run npm ci, npm run typecheck, npm test, npm run build and npm run check. Generated public outputs are included because the current Cloudflare asset flow uses committed public files.

Review migration against main; do not promote/deploy without owner approval. PATHD changes belong only in vintagebyjaja/pathd-app migration, never inside AELIO's deploy root. No production SQL or manual deployment was executed.

SQL: owner confirmed05/06 already applied. Apply07 from main only if not yet applied, then08,09,10 in order after review/staging. The SQL ZIP includes only08–10 and the owner-only UUID credit grant template. Verify both approved Auth user UUIDs before uncommenting its grant calls. Credit overrides do not grant admin/Studio Brain or merge subscriptions. No real account received a grant automatically.

Configuration: see Config.zip and config/V1_0_7_REVIEW_SETUP.md for Worker runtime credentials versus build variables, exact OAuth callbacks, native-passkey default-off flags and calendar separation. No actual credentials included. Native passkeys, live OAuth and production AI responses are not verified. The precise production outage still needs runtime logs/a support reference.

Backend repair is prioritized; the new resizable-workspace/UI refinement assignment is saved as deferred. Earlier implemented visual/group/DreamBox work is review-only. See docs/releases/AELIO_v1.0.7_VALIDATION.md and docs/review/v1.0.7/README.md for actual local tests/screenshots and limitations.
