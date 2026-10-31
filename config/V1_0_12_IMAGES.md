# In-chat images — local review and activation boundaries

This is an additive capability inside existing Chat/AUREVIA conversations, not a separate service. No deployment, production configuration, real price, provider activation or SQL execution was performed.

## Existing integrations inspected

The Worker already has a server-side OpenAI/Gemini/Groq text router, founder-only persisted router settings, private `AELIO_STORAGE` R2 binding, owner-checked file download/upload APIs, Library and SQL13 credit/allowance accounting. Those are reused. The local cloud environment exposes no usable OpenAI/Gemini API-key bindings or image model configuration. Hosted Worker secrets/models are not readable here. We cannot verify which hosted account/model has image permissions or billing access from source code alone.

- OpenAI: `POST /v1/images/generations` and multipart `/v1/images/edits`, configured GPT Image model, original image included for edits.
- Gemini: `generateContent` with TEXT/IMAGE response modalities and inline original image for edits, configured Gemini image model.
- Groq: existing supported text routes remain; image generation is excluded unless a future adapter/model is explicitly verified. No assumption that a vision/text model generates images.
- Model-family validation establishes only a configuration candidate, not live entitlement/capability. Account-level permissions, quota and model availability require live calls.

Use existing `OPENAI_API_KEY` and/or `GEMINI_API_KEY` server secrets. Never put keys into Git/browser settings/chat. No new image-service key or third-party provider is required by default.

## Owner-controlled settings

In founder Studio Brain → AI Operations, image model/pricing controls use the existing verified founder + aal2 guard and router configuration RPC. SQL15 extends that RPC's allowlist; private configuration never enters member responses.

Image-specific model/task settings (not duplicate provider credentials):

- `AELIO_IMAGE_PRIMARY_PROVIDER`: gemini or openai; falls back to existing primary when suitable.
- `OPENAI_IMAGE_MODEL`, `GEMINI_IMAGE_MODEL`: a supported, account-enabled GPT Image/Gemini image model; no default model is invented.
- `{OPENAI,GEMINI}_IMAGE_MAX_COST_USD`: approved conservative per-image ceiling covering the chosen resolution/model.
- Optional verified `{OPENAI,GEMINI}_IMAGE_INPUT_USD_PER_MILLION` / `IMAGE_OUTPUT_USD_PER_MILLION`: without accurate prices, full conservative ceiling is recorded as an estimated cost, not an invoice.
- Existing platform/provider daily/monthly limits and OpenAI spending ceiling still apply. A zero OpenAI ceiling prevents that spending.

Image access/pricing is a separate private capability policy, default **disabled**, with no seeded prices or included plans. Founder chooses create/edit credit prices and explicit eligible active plan IDs. Editing/variation uses the edit price. Browsing/quoting/capability questions do not spend credits. No checkout or paid enrollment is activated.

## Accounting and reliability

SQL15 follows reported SQL13 and owner-supplied SQL14; the owner must review/apply it personally. It adds image request records, policy, file/message version links and restricted service-only RPCs. Existing current-platform `app_entitlements` credits and SQL13 AI allocations are reused. It does not bridge or mint balances in the separate legacy engine wallet, create subscriptions or change the 60%/$10 allocation policy.

A request spends exactly one member funding path: approved credits OR an included active-plan AI allowance. Exact credits and the maximum allowance reservation are shown before confirmation. Policy-version/price and allowance-ceiling changes require a new confirmation. Null/missing confirmations are rejected. The private request ledger records charge/refund/period and deduplicates owner + conversation + fingerprint + request UUID. A fresh explicit regeneration is a new action.

Known safe provider rejections (permissions/billing/model/rate) may fall back. Safety refusals, uncertain network/timeout outcomes and unknown/partial output do not trigger a second paid request. Failed usable-output delivery refunds member credits/allowance while preserving actual/estimated provider costs in the platform ledger. Overspend above a confirmed allowance reservation remains a platform expense, not an unexpected member charge. Stale abandoned requests expire via the existing cron after 15 minutes, settling unknown attempts conservatively. A lost database acknowledgement is reconciled; a possibly committed saved image is preserved for Library/status checks rather than deleted/reissued.

Originals are never overwritten. Output is validated, quota-reserved, stored in the existing private R2 bucket, marked ready, linked into the existing transcript and automatically listed in Library. No arbitrary provider image URL is fetched. Only verified owners may supply an original, download output or read job status. Cross-user, subscription or client metadata cannot grant founder access.

## Actual live acceptance — blocked, NOT operationally verified

Local transport, database and browser tests use labeled synthetic fixtures. They do not prove a provider generated or edited an image.

`node _src/checks/live-chat-images.mjs` intentionally reports **BLOCKED** when its secure test setup is missing. To run against a separately authorized configured application, provide secure `AELIO_IMAGE_TEST_BASE`, `AELIO_IMAGE_TEST_ACCESS_TOKEN`, owned `AELIO_IMAGE_TEST_CONVERSATION_ID` and explicit `AELIO_IMAGE_TEST_MAX_CREDITS` (plus `AELIO_IMAGE_TEST_MAX_ALLOWANCE_USD` when using an included plan). The application must already have existing provider credentials, a supported image model, approved policy/limits and SQL15. No secrets should be pasted in chat. The runner confirms actual generation, an actual edit, authenticated downloads, separate versions, persistent transcript and Library. It makes billable requests only after checking an approved quote and test cap.

Do not mark image creation/editing operational or claim provider savings until both live requests and the hosted authorization/storage/accounting path succeed. Missing permissions, billing/quota access, unsupported model, credentials or spending configuration have specific member-safe errors; detailed provider information remains founder-only. AI-generated/disclosure notices are preserved.
