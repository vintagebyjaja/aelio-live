# AELIO 1.0.15 — authorized main update

Delta from approved main129ce3b. The owner authorized finishing and pushing directly to main without another review and waived preview delivery. Remote migration and PATHD remain unchanged. No manual deploy, production SQL, credentials, provider activation or billing settings changes were performed.

Extract every numbered part and the separate SQL package over the existing checkout, preserving paths. This is a delta, not a full backup. Verify ZIPs with SHA256SUMS.txt and extracted payload with INVENTORY_SHA256.txt. Each ZIP has at most100 entries. DELETED_FILES.txt lists only obsolete generated chat chunks removed by this update; normal npm run build also cleans them. Do not remove unrelated files or data. Historical deliveries are immutable.

Read docs/releases/AELIO_v1.0.15_IMPLEMENTATION.md and AELIO_v1.0.15_VALIDATION.md. Use npm ci, npm run typecheck, npm test, npm run build and npm run check. Local fixtures do not prove hosted Auth/storage/provider/payment/deployment status. Native AI command execution, deploy/payout integrations and production character/animation assets remain pending. Actual 3D geometry is clearly distinguished from source concepts and decorative imagery.

OWNER SQL: after prior required migrations through16, execute each COMPLETE script individually in Supabase SQL Editor: 20261031000017_native_workspace.sql, then20261031000018_agent_characters.sql. Do not run isolated IF/function-body fragments. The full scripts are transaction-wrapped and tested with the full chain applied twice in disposable PostgreSQL. No production SQL was run by Codex. They do not enable paid generation, payouts or roles.
