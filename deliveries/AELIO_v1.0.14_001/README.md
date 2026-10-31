# AELIO 1.0.14 — unpublished migration review delta

Base/main: acfb35e. Extract all numbered parts over the existing repository preserving paths. This is a delta, not a complete backup. Verify SHA256SUMS.txt for ZIPs and INVENTORY_SHA256.txt for extracted files. Each part has at most 100 entries. Generated stale-chunk deletions are listed in DELETED_FILES.txt; the normal npm run build cleans them automatically. Do not remove any user data or unrelated files.

Read docs/releases/AELIO_v1.0.14_REVIEW.md and open docs/previews/combined-v1.0.14/index.html and docs/previews/restoration-v0.3/index.html for visual reviews. Source references are review-only; no concept painting substitutes for interactive world geometry. AUREVIA is a code-authored benchmark awaiting visual approval, not full reference-level restoration. New generated wallpapers are review-pending 2D chat backgrounds only. All account messages in screenshots are fixtures; WebGL captures show the actual renderer.

Run npm ci, npm run typecheck, npm test, npm run build, npm run check. Private Brain bridge changes require the existing engine’s normal separately authorized rollout; no manual deployment is authorized. No new SQL migration, service, API key, production configuration, pricing or role change is required by this delta. Existing production SQL/Auth/provider setup remains unverified here. Physical iOS Safari and live provider semantic behavior are unverified; local Chromium/synthetic transport tests do not establish those outcomes.

Do not push even migration, merge main, deploy or run production SQL without the owner’s explicit authorization. PATHD is unchanged. Historical delivery ZIPs remain immutable.
