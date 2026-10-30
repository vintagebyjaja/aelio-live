# AELIO 1.0.5 migration preview setup

Review branch: migration. MAIN MUST REMAIN UNCHANGED UNTIL THE USER APPROVES. No manual deployment, production SQL, secrets or Cloudflare settings were modified. Preview screenshots use explicit local synthetic users and provider output; they do not prove a live deployment.

## Apply SQL manually after review

The existing shared Supabase project remains https://xkpzabgpesishxcluxkp.supabase.co. Back up and test on staging first. Apply existing migrations 01–04 if not already present, then apply 20261030000005_account_repair.sql followed by 20261030000006_permanent_companions.sql ONCE to the shared database. Both new migrations are transactional and safe to rerun. Do not create a second project or duplicate accounts. Do not copy all AELIO source into PATHD. The SQL package is shared database work, not a website merge.

05 adds owner-scoped public account/profile RPCs and narrow service-only recovery/chat-request accessors. It preserves all UUIDs, names, profiles, recovery credentials, sessions, credits and subscriptions, filling only missing rows. 06 expands the existing agent kind constraint, adds a unique permanent conversation key and optional custom avatar reference, provisions six official companions and Dream Team lazily at verified account startup, and protects permanent identities/chats. It adopts one existing matching AELIO/MILA chat without deleting or renaming it; other histories stay intact. Owner-scoped message search respects existing RLS. No browser can call the privileged hash/request accessors. core can remain outside PostgREST's exposed schemas; public must expose the new RPCs and reload its schema cache after migration. Existing core RLS policies are retained.

## Runtime checks without exposing credentials

AELIO_SESSION_SECRET is a plain string of at least 32 characters, ideally 32 random bytes encoded as base64 or 64 random hex characters. It does not have to be a JWT. It must be a Worker runtime secret, not a build-only variable. An explicit short value is rejected; when absent, an eligible server-only service credential provides the existing purpose-separated HMAC fallback. Verified account startup and its SQL rate limit no longer depend on guest-cookie signing. Guest operations and other privileged rate limits still need valid signing configuration.

Existing names: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL); SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY; server-only SUPABASE_SERVICE_ROLE_KEY; OPENAI_API_KEY; optional OPENAI_MODEL. Never place server secrets in a public variable. New sb_publishable_/sb_secret_ API keys go in the apikey header, not in Bearer authorization. User access JWTs remain Bearer tokens. No new secret or binding is required by this update; do not generate duplicate infrastructure.

GET /api/platform/status reports configuration presence, not successful inference. The authenticated founder-only /api/platform/diagnostics adds safe signing/source checks and verifies account bootstrap; it returns no key material. Worker logs retain request ID, status and database error code. They never log credentials, recovery hashes/answers/codes, prompts or files. No Cloudflare connector or real production credentials were available locally, so actual dashboard/runtime presence was not remotely verified.

## Orb and appearance

AelioOrb uses a lazily initialized native WebGL fragment shader over an analytic sphere (smooth normals, no exterior displacement or sphere rotation). This avoids a large Three.js dependency. One active WebGL context, capped DPR, offscreen/tab pause, resource cleanup, reduced motion and established lightweight fallback. Actual microphone/playback MediaStreams can feed its audio analyser; speech recognition can continue without an analyser. No fake speaking signal is generated. Mobile hardware frame rates and real-device microphone/speech playback remain unverified. Only Chocolate Cream receives the olive/sage palette accents; other theme tokens remain unchanged.

## Acceptance after owner-managed rollout

Verify real login on each domain, callback redirects, refresh/logout, missing-profile initialization, one-time recovery, shared identity but separate entitlements, all eight AELIO companions plus Dream Team, PATHD filtering to AELIO/MILA, saved styles/history, Stop/Retry, uploads, private cross-user denial and real first-token latency. Do not label configuration presence or fixture output as a live AI test. Review changes on the migration branches before approving main.

Public headers permit only same-origin geolocation (still requiring the user’s explicit browser permission) and blob images for owned uploaded avatars/backgrounds. Script policy is unchanged. Chat asset URLs include the release version so updated code is requested after approval/deployment.

Local checks also found a legacy PATHD profiles→Auth foreign key without delete cascading. The new service-only preflight refuses shared-account deletion before touching R2 files when restrictive legacy references exist. This prevents partial data loss. Resolving legacy whole-account deletion needs a separately reviewed retention/deletion plan; no existing foreign keys or data were changed.

Official portraits are fixed in the versioned companion registry. Users may change chat environments, never official faces. Custom agents alone have owned R2 avatar IDs and bounded crop settings. tools/import_official_portraits.py performs explicit local extraction from approved originals; it does not generate faces or expose an upload endpoint. The same MILA WebP is copied byte-for-byte into PATHD’s separate public assets. Full-resolution source pixels and source hashes are retained for deliberate future founder-reviewed updates.
