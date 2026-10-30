# Provider stream investigation — migration, 2026-10-30

Owner report: provider_unavailable / provider_stream / 1a0ae1dd-b98b-40b7-b213-3804c33bb92f.

Confirmed code defect: Responses response.failed events carry error under response.error. The adapter read event.error and passed a fabricated 502 into classification, hiding model, billing and rate errors. HTTP error bodies already had a separate classification path. Corrected nested and top-level stream errors; quota and rate-limit classification now works even after an HTTP200 stream handshake.

This explains lost diagnostics; the supplied generic code does NOT prove the provider's underlying live rejection. No production logs, runtime credential values, billing dashboard or model-access verification were available. Do not mark live recovery complete from local fixtures.

Lifecycle: authenticated/guest conversation ownership -> request-ID replay lookup -> credit reservation -> selected provider -> incremental SSE translated to NDJSON -> database commit -> saved acknowledgment. Failure finishes reservation unsuccessfully and closes stream. Frontend finally clears Writing/busy, preserves draft and marks Retry; retry reuses original request ID. No automatic provider replay was added, avoiding duplicated billed generation after partial output. Existing saved-turn replay remains intact.

Runtime configuration: OPENAI_API_KEY is server-only Worker secret; AELIO_AI_PROVIDER=openai selects this adapter (brain selects the separate private architecture). OPENAI_MODEL defaults to gpt-4.1-mini; availability depends on provider project access. Optional OPENAI_MAX_OUTPUT_TOKENS, OPENAI_CONTEXT_CHAR_LIMIT, OPENAI_DAILY_REQUEST_LIMIT are bounded. Supabase service-role remains server-only. A provider200 stream can later fail;200 is not completion. Existing90-second per-agent abort and browser Stop use standard Worker Fetch/ReadableStream/TextDecoder/AbortController APIs.

New structured openai_provider_failure log: application request_id, upstream http_status, allowlisted provider_request_id from x-request-id, provider_error_code, classified error_category and configured model. Never log raw error messages, prompts, response text, tokens or keys. For this incident correlate the application ID above with existing openai_request_rejected / openai_stream_failed logs; the next failure on updated code emits improved diagnostics. Provider account owner should use upstream request ID to investigate billing/model access if indicated. Do not blindly change models or retry quota/auth failures.

No production SQL, secret/settings changes, deployment or Git push performed for this repair. Existing pending ECHO/Brain changes remain separate uncommitted work in this checkout. No live preview deployment was created.

Validation:65 unit tests passed, TypeScript and production build passed. Added nested HTTP200 billing/rate/model/server-failure regression cases verifying terminal error, preserved partial delta, redacted logs and exactly one provider call. Targeted disposable-database test passed for all eight companion replies, persistence and failure refund. A broader repeated database suite was not clean (shared fixture state and429 rate-limit failures); do not report it as passed. No live inference or preview deployment verified.

Owner subsequently authorized pushing the completed repair; publish this isolated commit to migration only. Main remains unchanged. The pending ECHO/Brain iteration is excluded.
