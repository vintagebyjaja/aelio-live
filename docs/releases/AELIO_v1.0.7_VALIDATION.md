# AELIO 1.0.7 / PATHD 0.1.5 — migration review

## Implemented

- Shared account bootstrap tolerates an incompatible optional PATHD legacy profile instead of rolling back the shared account transaction. Existing owned agents remain readable if bootstrap fails. PATHD retains verified identity when optional career profile joins fail. Existing AELIO agent/history loads resolve independently. No session or user deletion.
- Operation-specific safe database logging, differentiated rejected server credentials and owner-scoped account health probes. Exact production failure remains unconfirmed without its response/code/request ID or logs.
- AI global safety counter uses a non-private digest scope rather than requiring guest signing. Existing OpenAI/private-Brain adapters, streaming, saved messages, credit reservation/refunds and cancellation remain. No provider credential is invented.
- Private UUID/product unlimited-credit registry and owner-only grant helper. No automatic email-based runtime entitlement; owner-verified IDs must be inserted manually. UI says Unlimited credits only for the verified registry result. No admin, Studio Brain, paid-product or subscription upgrade. Actual regular balances and configured plan allowances remain separate per product.
- Optional recovery settings, no required questions in registration, unchanged password/session on question saving, preserved existing recovery codes and explicit opt-in replacement codes. Email reset remains available.
- Google/Apple PKCE sign-in and authenticated linking. Linking checks existing account identity; no application email-based merge. Password login remains. Provider failures have a clear fallback. Native Supabase passkey APIs are wired behind default-off per-site flags and browser support, including registration/sign-in/list/revoke. Hosted Auth version, RP/origin policy, native recent-auth policy and real device ceremonies remain unverified.
- Calendar preparation explicitly separated from login permissions. No calendar access, tokens, monitoring or event changes implemented or claimed.
- Earlier approved migration scope: editable custom groups (up to8 owned agents, no new group-count cap), bounded relevant-voice/mention routing, persistent histories, owned group images, style settings and protected permanent Dream Team. UNCs exact scripted/replay demo shared between marketing homepage and Agent Team pages; distinct fictional monogram demo profiles do not alter the eight permanent companions.
- Shared editorial styles on all50 public marketing routes, preserved public routes/navigation/Studio Brain customization, local photographic environments and approved diverse companion portraits. Existing four-theme authenticated design retained.
- Lazy shared page-aware DreamBox with same-origin isolation, explicit user-triggered streaming, agent-specific histories, minimized-state persistence, tab draft restoration across navigation, close/expand/keyboard dismissal and feature-detected browser voice input. Full-page navigation may interrupt a live stream; reopen saved history before retrying. No autonomous background messaging.

## Local verification

AELIO JavaScript checks, TypeScript, production build and public asset/link checks passed. PATHD's15 tests, TypeScript and production Next build passed. Twelve isolated PostgreSQL/PostgREST handler scenarios passed, including identity isolation, all permanent companions/Dream Team routing, stream persistence/retry/cancellation, recovery-code single use, owned portraits and multiple editable custom groups.

SQL07–09 parsed/executed only in disposable local PostgreSQL. Rolled-back assertions verified optional legacy-profile failure isolation, UUID-bound unlimited credits on both products, no deduction for approved IDs, regular paid-balance deduction, privilege isolation and preservation of existing backup codes. No production SQL ran and no real user credits were changed.

Responsive browser fixtures validated desktop/tablet/mobile behavior, exact demo/replay, widget open/minimize/close/expand, cross-route draft restoration, separate agent histories and no page overflow at1440/768/390/320px. A separate synthetic stream test checked exactly one explicit send with page metadata and private draft/history clearing on logout. Screenshots are local renders with labeled synthetic conversations; no live provider response was used.

The Worker compiled in Wrangler dry-run only, retaining AELIO_STORAGE and ASSETS bindings. Local route/security check passed82 URLs, including61 public routes and20 private-file denials. Public asset checker confirms no exported credentials/source/private files. There is no standalone AELIO lint script; PATHD's production build performs its configured lint/type stage (no new interactive lint setup introduced). Generated third-party Auth SDK string literals may contain intentional whitespace; source whitespace checks exclude generated bundles.

## Unverified / manual

Production account outage root cause, Cloudflare runtime secrets, real AI inference, OAuth console/provider configuration, identity linking on actual accounts, password email delivery, hosted passkey support/RP/user-verification/replay and recent-auth policy are unverified. Passkey flags stay off until owner validation. Apple/Google sign-in grants no calendar permission. There is no shared cross-domain browser session or cross-domain passkey credential assumption.

SQL order and runtime/OAuth/passkey instructions: ../../config/V1_0_7_REVIEW_SETUP.md. Credit grants: ../../config/GRANT_APPROVED_UNLIMITED.sql. Review screenshots: ../review/v1.0.7/README.md. Main remains on the separately authorized sign-in hotfix. No new main push or manual deployment is part of this review.

## Backend-priority follow-up

The owner reports the same outage in Safari and Edge and explicitly pauses additional visual/refinement work until backend response is restored. The new resizable-workspace assignment is retained at docs/assignments/AELIO_NEXT_UI_REFINEMENT_DEFERRED.md; it is not implemented in this iteration. Earlier authorized editorial/group/DreamBox work remains review-only.

The environment has no Cloudflare runtime-log connector or configured Cloudflare identity, and GitHub API authentication is unavailable (Git push access is separate). No production log, token, provider key or Auth account was read. The exact production cause is unconfirmed. Do not report the live outage resolved solely from fixture tests.

Added correlated stage diagnostics for credit reservation, provider adapter/stream, message persistence and cleanup, plus safe provider rejection codes/status and request IDs. Client errors preserve these references and offer Copy support reference; no message, password, key, recovery answer or account email is copied or logged. A visible optimistic message does not prove persistence. An authenticated health check tests account bootstrap and server database access separately without claiming live inference.

Full local handler regression passed for all eight permanent companions through the OpenAI adapter, NDJSON stream and PostgreSQL persistence using an explicitly synthetic provider. A Simone401 provider rejection returned a correlated error, saved no false reply and refunded the reserved credit. The test asserts logs contain neither the sentinel API key, message text nor email. This is not a real provider call.

A reproduced new-turn ordering defect was repaired by SQL10: transaction-stable now() gave user and agent messages identical timestamps; UUID tie-breaking could reorder them after reload. New turns receive strictly increasing timestamps. Existing history is untouched. Also corrected fragmented CRLF SSE parsing, retained provider refusals as actual responses, and added distinct empty-response/billing/request errors. No canned reply or alternative basic chatbot was substituted.

Final expected counts:60 AELIO unit checks,13 local integration scenarios,15 PATHD unit checks; TypeScript/build checks in both repositories. Run SQL07 if needed, then08,09,10 after review. Credit grants still require owner-verified UUIDs and manual SQL; no production grant has occurred. UI refinement is deferred.
