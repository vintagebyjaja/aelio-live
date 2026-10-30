# AELIO development deliveries

These are downloadable review packages, not GitHub releases or deployments. In GitHub, open a ZIP and use **Download raw file**. Keep the branch selector on `codex/migration-v1.0.2`; do not merge main or run a deployment to download files.

- `AELIO_v1.0.1/AELIO_v1.0.1_Delivery.zip` is the preserved complete original candidate: seven upload parts, SQL, configuration and instructions, including the separate AELIO and PATHD projects. No earlier package has been overwritten.
- `AELIO_v1.0.2/AELIO_v1.0.2_Delivery.zip` contains the new source-only Dream Box update, appearance SQL migration04, changed configuration notes/headers, checksums and extraction instructions. Apply it over the v1.0.1 candidate. The inner GitHub ZIP contains only necessary new/modified source/assets and excludes generated HTML/JS/CSS, dependencies and caches.
- The source at the root of this Git branch already contains the complete cumulative AELIO implementation. Do not extract the old candidate over that current branch. To obtain that whole current AELIO source, use GitHub's Code → Download ZIP on the development branch, or clone that branch. To obtain the separate PATHD candidate, extract PATHD from the preserved v1.0.1 bundle; PATHD main has not been changed or pushed.

SQL execution, real service configuration, merge and deployment remain owner-controlled. Read `PROJECT_HANDOFF.md`, `config/SETUP.md`, `config/DREAM_BOX.md` and the validation notes. No production service validation is implied by local test results.

Files within each provided inner GitHub ZIP are limited to100. Archive provenance and SHA-256 files are supplied. No filled environment files or real credentials are included. ZIPs are excluded from source-update collection to avoid recursively packaging previous deliveries.
