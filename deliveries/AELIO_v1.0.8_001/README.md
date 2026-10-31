# AELIO_v1.0.8_001 — source restoration delta

Local migration-branch preview. Base: e4b652b2454c5bc1f6cfa18a3b2a0db7109aed52 (SQL11/12).
This package rebuilds ECHO, Brain and conversation projects. It is not the lost original uncommitted implementation. No production changes or remote push performed.

Extraction/review instructions:
1. Preserve any existing local work. Use the existing isolated AELIO checkout; no worktree unless requested. Compare with the base commit and extract this ZIP into the repository root on migration. Review every listed delta. Do not apply to PATHD.
2. Verify each source file with INVENTORY_SHA256.txt. No files need deletion. Keep existing approved avatars/public assets.
3. Run npm ci, npm test and npm run typecheck. Follow config/V1_0_8_RESTORATION.md to build in a local copy without rewriting tracked public output during review. A normal npm run build regenerates public output for a separately authorized release.
4. Read docs/releases/AELIO_v1.0.8_RESTORATION.md for actual checks and limits. Migrations11/12 are already preserved remotely and the owner reports running them. There is no new SQL; do not rerun migrations as part of extraction/startup.
5. Upload only to AELIO's migration review branch if the owner requests a GitHub upload. Do not merge/push main, manually deploy or modify production settings/secrets. This ZIP does not deploy itself.

The separate previews ZIP contains clearly synthetic local browser screenshots, not live production evidence. Root-level DELIVERY_README.md and INVENTORY_SHA256.txt inside the source ZIP are packaging metadata and may be retained outside the checkout. Each ZIP contains fewer than100 files. SHA256SUMS.txt contains archive checksums; INVENTORY_SHA256.txt contains the complete source delta inventory.
