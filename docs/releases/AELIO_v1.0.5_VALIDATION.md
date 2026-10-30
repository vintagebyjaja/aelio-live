# AELIO 1.0.5 validation

Review branch only; main remains 8da7e87 until explicit user approval. PATHD 0.1.3 is a separate repository/branch. No manual deployment, production SQL, live-user mutation, secrets or dashboard setting changes.

Verified locally:

- 53 JavaScript unit tests: API-key aliases/security, modern keys without invalid Bearer headers, sessions, Worker routing, OpenAI streaming/cancellation, identity templates, coordinator and consumer language.
- TypeScript and production build passed. Static public check resolves 8,840 internal links across 127 files and validates eight redirect rules; route check passes 82 loopback URLs, including private-file denial and security headers. Exact link count can vary with generated content, without changing the checked conditions.
- Wrangler dry-run compiles the Worker and preserves AELIO_STORAGE. No upload/deployment performed.
- Eleven disposable PostgreSQL/PostgREST scenarios pass with direct core REST access deliberately blocked: RLS/ownership, storage lifecycle, guest claim/limits, recovery factors/code replay protection, reminders, career privacy, appearance persistence, completed-request replay, bootstrap without guest secret or service key, eight stable companions/nine stable chats, direct/group speaker routing, MILA style, private search and restrictive-deletion safety preflight. Migration reapplication passed.
- A rolled-back synthetic SQL fixture confirms permanent-entry delete protection and that the new guards permit whole-account cascades after independent legacy NO ACTION profile references are removed inside that fixture only.
- Four private Python Brain bridge tests passed, with an existing Starlette TestClient/httpx deprecation warning.
- Browser contracts at 1440/768/390/320px: explicit Send, fixture streaming, navigation/back, retained drafts, no overflow, theme inheritance/save, useful connected-app links and guest appearance persistence.
- Companion browser checks at 1440/390/320px: eight clickable official identities, no duplicate default chats, original portraits decode, Dream Team/mentions, retryable drafts and correct synthetic speakers. Actual software WebGL compiles and internal pixels change; reduced motion and forced no-WebGL fallback work.
- Public HTML copy audit found no consumer-facing configuration/unfinished-status phrases in generated marketing pages. Internal diagnostics and private research tooling retain technical details. Privacy, consent, pricing and account-access warnings remain explicit.

Limits:

No live Supabase account, deployed runtime bindings, OPENAI_API_KEY/model availability, real first-token latency, microphone/playback or physical-device FPS was verified. The environment has no production credentials/Cloudflare connector and outbound live site access is restricted. Configuration presence is not evidence of successful inference.

Existing shared migrations 01–04 plus new 05/06 require owner staging/review and manual execution. Missing migrations cause an honest error, never a fabricated account or AI response. New API/appearance/account features preserve UUIDs and existing records; they do not merge subscriptions or cross-domain browser cookies.

Stopped partial replies remain local; only completed turns persist. Advanced external OAuth/API account linking and live venue/route data are not provided. Legacy restrictive PATHD profile foreign keys can prevent whole-account deletion; the new preflight stops before deleting files, pending a separately reviewed retention plan.

The AELIO project has no separate configured lint script; TypeScript/build/tests were run. PATHD's legacy next lint opens an ESLint configuration prompt, so standalone lint is not claimed as passed. No protected test was disabled or weakened.

Approved portrait delivery: six exact source crops and MILA’s business-casual image were optimized as WebP without generation/retouching. Full-resolution decoded source pixels are preserved losslessly under assets/references/official-portraits with original-file SHA-256 identifiers. AELIO and PATHD MILA assets have identical SHA-256 values. System portrait/crop changes are rejected by API and database; a synthetic custom-upload browser check proves real square-image reposition/zoom, save, remove and blob-CSP display.
