# AELIO 1.0.6 / PATHD 0.1.4 sign-in repair

Verified credentials previously led to mandatory recovery screens. AELIO's root guard and PATHD's sign-in redirect/dashboard guard now allow normal entry independently of recovery enrollment. Public routes remain public; account, private histories and settings remain authenticated. Supabase session persistence/logout implementations are preserved.

Initial signup saves answers without generating codes. Settings offers an unchecked explicit option to generate replacement codes. Saving answers preserves existing codes, passwords and sessions. Security changes still verify the current password; recovery questions alone cannot reset a password. Signup does not depend on optional guest-signing or companion readiness. Optional recovery failures after account creation do not send users back through registration.

Authenticated recovery setup uses a verified-owner 5 attempts/15 minutes database limit without guest-signing dependence. Anonymous password recovery retains its existing stronger-factor verification and anonymous throttling.

## Manual owner step

Run only `supabase/migrations/20261030000007_optional_recovery.sql` once after the already-applied 05 and 06 in the existing shared project. It adds one server-only function for answer-only saving. Do not rerun prior migrations or alter users, policies, passwords, subscriptions or sessions. Sign-in does not depend on 07; saving answers does. Existing runtime Supabase public URL/key and server-only service-role key are still required. No new secret is introduced.

## Validation

- AELIO: 54 automated JavaScript checks passed, including answer-only setup without guest signing and no privileged password/session operation; TypeScript and production build passed; public asset/link validation passed.
- PATHD: 12 automated checks passed, including verified unenrolled account access, profile-service failure tolerance, invalid-session rejection and same-site redirects; TypeScript and production Next build passed.
- Migration 07 executed successfully only against disposable local PostgreSQL. Transactional assertions verified existing codes survive answer updates and anonymous/authenticated browser roles cannot execute its private function.
- Production credentials, live login, live email recovery, Cloudflare runtime bindings and deployment success cannot be verified from this restricted environment. Build warnings about absent local credentials are expected; no production credentials were copied locally.

No production database, secrets/settings or manual deployment changed. Main pushes are explicitly authorized by the owner and may trigger their existing Cloudflare pipeline.
