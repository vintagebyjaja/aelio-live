# AELIO_v1.0.9_001 — migration review delivery

Delta against ab5a2bc. Existing checkout only; preserve local work and use migration, never main, for this review. Each archive is immutable and has at most100 files. No files require deletion. Source, SQL, configuration and synthetic preview packages are separated when applicable.

Extract selected archives into this repository's root, preserving their relative paths. Verify every extracted file against INVENTORY_SHA256.txt; archive checksums are in SHA256SUMS.txt. Existing generated public output and approved avatars remain unchanged. Run frozen-lockfile npm ci, tests and type checks; rebuild generated output following the setup guide before a separately approved release. The ZIPs do not deploy or run SQL.

New shared SQL13 lives only in AELIO. Owner reports applying11/12: review/apply only13 manually and confirm before releasing dependent code. Do not run local test-fixture SQL against production. No real provider keys, Stripe IDs, user bindings or subscriptions are fabricated. Provider/subscription activation needs verified mappings, models/prices/caps and hosted validation. Existing Stripe credit purchases remain intact and paid enrollment is not activated by this delivery. Do not push/merge main or manually deploy without approval.

Preview images contain labeled local sample data, not live subscriptions, provider telemetry, generated images or production Auth proof. Full validation and operational boundaries are recorded in the release/configuration documentation. The inventory covers the full delta across archives; packaging metadata itself is not a source file.
