# AELIO1.0.9 / PATHD0.1.6 — review and activation guide

Migration review only. Do not merge main, manually deploy, run production SQL or change production credentials/settings as part of development. The owner reports SQL11/12 applied. Review **only** `supabase/migrations/20261030000013_ai_subscriptions_router.sql` next; owner applies it manually and confirms success before any dependent release. Do not rerun historical migrations.

## Development checks

Node24: `npm ci`, `npm test`, `npm run typecheck` in each repository. AELIO builds in a local copy as described in V1_0_8_RESTORATION.md, preserving tracked public output. PATHD: stop only your own dev server before `npm run build`, then restart dev with `AELIO_PLATFORM_LOCAL_ORIGIN=http://127.0.0.1:8092` to avoid its fixed production fallback. No production credentials are needed for fixture tests.

Database: `PG_BIN=/workspace/.onboarding/pg/usr/lib/postgresql/17/bin` with that directory prepended to PATH; run `bash supabase/tests/run_tests.sh test_ai_subscriptions_router.sql test_workspaces_echo_projects.sql`. It uses a disposable local cluster and rolls back fixtures. Never point this runner at Supabase.

Browser: `AELIO_BROWSER_BASE=http://127.0.0.1:8092 python _src/checks/browser_remaining.py`. The actual PATHD pricing page must run locally on3000. Prepare its isolated member-component harness with `node _src/checks/pathd-component-preview.mjs`, then run `python -m http.server 3001 --bind 127.0.0.1 --directory /workspace/.onboarding/pathd-component-preview` in another local process. The PATHD member-component preview runs from an isolated static harness on3001 containing the actual `Companions` component bundled with esbuild and the generated PATHD CSS. It has synthetic intercepted API responses; it does not bypass application Auth or verify real memberships. Do not add this harness as an application route. The browser script labels sample account/usage data and saves screenshots under docs/previews/v1.0.9. Earlier browser_workspaces.py and browser_messaging.py continue to test restoration/chat behavior.

## Router configuration — server only, after review

Existing OpenAI/private Brain remains unchanged until the new route is selected. `AELIO_AI_PROVIDER=router` enables the new router; `AELIO_SUBSCRIPTIONS_ENABLED=true` also selects it for shared paid accounting. Keep this flag off until13, verified mappings and provider controls are ready. When enabled, it selects the Worker router for subscription-funded inference; legacy private Brain remains available with subscription mode disabled. Account data and stored histories are never migrated to another provider/account.

Server credentials: GEMINI_API_KEY (generativelanguage.googleapis.com), GROQ_API_KEY (api.groq.com), OPENAI_API_KEY (api.openai.com). Use existing Cloudflare secrets; never put values in Git, public variables or screenshots. Those hosts must be permitted in any environment used for actual live-provider checks. This task did not add credentials or make billable requests.

Set model IDs and verified positive USD-per-million-token prices centrally for each enabled provider:

- GEMINI_MODEL, GROQ_MODEL, OPENAI_MODEL.
- Each provider prefix: `_INPUT_USD_PER_MILLION`, `_OUTPUT_USD_PER_MILLION`.
- Optional `_COMPLEX_MODEL` and its own `_COMPLEX_INPUT_USD_PER_MILLION` / `_COMPLEX_OUTPUT_USD_PER_MILLION`; no guessed complex-model tariff.
- Optional prefix `_TIMEOUT_MS` (1000–90000), `_DAILY_BUDGET_USD`, `_MONTHLY_BUDGET_USD`.
- AELIO_PRIMARY_PROVIDER=gemini, AELIO_SECONDARY_PROVIDER=groq, AELIO_EMERGENCY_PROVIDER=openai.
- AELIO_DAILY_AI_BUDGET_USD and AELIO_MONTHLY_AI_BUDGET_USD are required positive platform ceilings. AELIO_OPENAI_EMERGENCY_BUDGET_USD is a separate emergency monthly ceiling; zero disables emergency spending.
- AELIO_GEMINI_ENABLED / AELIO_GROQ_ENABLED / AELIO_OPENAI_ENABLED may disable providers. Provider data handling is controlled by the allowed/enabled adapters; all calls remain server-side with existing external-AI consent.
- AELIO_PRIMARY_TIMEOUT_MS / AELIO_SECONDARY_TIMEOUT_MS are supported aliases. Defaults15s; timeout aborts without silently replaying an ambiguous paid request. AELIO_CIRCUIT_BREAKER_MS defaults30s. Conservative PDF token bounds may be set via AELIO_PDF_INPUT_TOKEN_BOUND.

Founder + Supabase aal2 are required for `/api/platform/billing/operations`. The protected Studio Brain links to it. Controls save allowlisted non-secret model/price/timeout/budget/provider settings in Supabase and record an audit event. They cannot save credentials. Credential presence/circuit status is not proof of provider availability; costs are estimates from configured prices and observed token usage, with conservative estimates for uncertain attempts.

## Subscription mappings and signed events

The existing private-engine Stripe credit-purchase route `/webhooks/stripe` stays intact. No subscription checkout, new charges, automatic purchases or plan upgrades are created by this code. Paid enrollment remains labeled unavailable until the owner configures it.

New independent receiver: `/webhooks/ai-subscriptions`. Set server-only AELIO_SUBSCRIPTION_WEBHOOK_SECRET and AELIO_BILLING_MODE=test or live deliberately. It verifies raw-body HMAC signatures, timestamps and live/test mode before service-only SQL. Configure the Stripe subscription endpoint only after SQL review. Never reuse arbitrary user-editable metadata as entitlement authority.

The SQL owner must bind existing verified subscription IDs, Auth UUIDs and real price IDs through `core.bind_ai_subscription(...)`. It is not callable by browser or service-role clients. Register additional verified upgrade/downgrade price IDs in `core.ai_plan_prices` using the SQL owner. The repository does not invent AELIO prices, UUIDs or Stripe price IDs.

Accepted invoice.paid events allocate **max($10,60% of the successfully paid monthly amount)** for paid AELIO and PATHD Pro/Local/Employer/Recruiter. PATHD+ gets no independent AI allowance. Annual payments are split into monthly periods without changing any annual price; the floor is applied to each monthly portion and its subsidy is recorded. One invoice/event cannot replenish twice. No rollover by default; an SQL-owner-only `core.ai_policy.rollover_enabled` setting enables one-time transfer of unused expired-period allowance when the new period is first used.

Active paid AELIO funds companion use inside PATHD first. Otherwise an eligible paid PATHD plan funds it. Both balances stay separate; only one is reserved/debited for an attempt. UUID-bound unlimited overrides remain independent of administrative roles; platform/provider caps still apply. Paid funded chats bypass the separate legacy message debit. Free AELIO/guest trials retain their existing message limits and use platform-funded requests.

Failed payments, expiration, cancellation, refunds and verified price changes update access without deleting profiles/history/files. Cancel-at-period-end preserves paid access until expiry. Out-of-order lifecycle events cannot reactivate a newer suspended state. Cumulative refunds reduce relevant allowances, including future annual slices. No unpaid invoice mints the $10 floor. Complex/multi-line/prorated or unsupported-currency invoices are deliberately left for operator review rather than guessing a grant; configure/test actual subscription invoice shapes before enabling live enrollment.

## Safety behavior and prerequisites

Money reservations and settlements are atomic and idempotent in PostgreSQL. Every provider attempt has one request ID, application, funding source and invoice allocation. Explicitly rejected401/403/404/429 requests can fall through to the next configured provider. A timeout, ambiguous network failure, HTTP5xx or a partial/successful accepted stream is not automatically replayed. Unknown usage keeps a conservative estimated reservation; do not automatically release it as zero. Review pending/estimated attempts using actual provider records.

PDF input is dispatched only to the configured OpenAI Responses adapter before any incompatible paid request. Gemini/Groq use their documented OpenAI-compatible text/tool SSE endpoints; missing models/prices/caps fail closed. Prompt compaction is deterministic and scoped to the thread; relevant approved ECHO memory is selected without storing generated dialogue as memory. No shared personalized-response cache is introduced.

SQL13 also prepares file deletion before R2 removal and removes obsolete ECHO photo-reference rows. Without13, deletion fails before touching R2. Text memories and conversation history are retained when only an image is deleted. Existing account deletion checks inspect restrictive foreign keys and preserve financial records/files by refusing an unsafe self-service close.

Activation remains unverified until actual mapped subscriptions, signed Stripe events, providers, Auth/MFA and R2 are tested in the intended hosted environment. Cloud environment draft saving and migration-branch pushes do not activate or publish production configuration.
