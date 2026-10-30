# AELIO Supabase-only migration runbook — v1.0.1

The 2026-10-29 consolidated founder directive supersedes the previous dual-provider rollout plan. Active sign-in is Supabase-only. Firebase runtime fallback is removed; historical identity mappings, source data and verified backups are preserved.

The founder and personal accounts already exist in the shared AELIO × PATHD project. Do not recreate, delete or overwrite their UUIDs. No production migration or account verification has been performed in this session.

Follow `config/SETUP.md` in full. Back up first, inspect applied schemas, apply the supplied ordered migrations on staging, import legacy engine rows into an empty destination and review explicit Firebase→existing-Supabase mappings. Verify row counts/fingerprints, MFA/security state, wallet balances, histories and ownership before any owner-controlled cutover. Do not automatically link existing engine identities by email.

The engine now defaults to PostgreSQL through DATABASE_URL. SQLite is an explicitly selected offline test/export source only. `tools/import_engine_sqlite.py` defaults to a read-only plan and refuses a nonempty target on apply. Logical PostgreSQL backup/checksum support is supplied; restore requires an explicit offline safeguard and has not been exercised on production. Keep all old backups until independent migration verification.

Public signup/recovery, founder protection, CAPTCHA, project-wide confirmation settings, both domains' callbacks and live provider/storage checks remain staging acceptance requirements. Schema migrations alone do not complete Auth cutover or prove the Brain is online. Do not deploy, push or execute production SQL automatically.

Rollback: retain the old deployment and its protected data backup, plus a pre-migration Supabase backup. Roll back application deployment/configuration through the owner, keeping the additive new tables intact. Never drop Auth users, histories, profiles or tables as an automatic rollback. Restoring a database is a separate explicit owner-controlled operation. Reintroducing Firebase runtime is not the desired final architecture.
