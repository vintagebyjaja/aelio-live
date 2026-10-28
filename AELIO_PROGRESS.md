# AELIO Progress

Updated 2026-10-28 · branch `phase0` · latest commit `4c71fc0` (plus this docs commit)

Legend: **WORKING** = implemented and passed a test · **PARTIAL** = implemented but not fully tested or connected · **BLOCKED** = needs approval, credentials or infrastructure · **NOT STARTED**

## Functional status
| Area | Status | Evidence / what's missing |
|---|---|---|
| Public site + Brain pages | WORKING | 50 pages + Brain app build; `npm run check` passes |
| **One platform at aelio.live** (same-origin `/api` proxy, no engine domain) | WORKING locally · BLOCKED for production | Node tests 6/6 (forwarding, header stripping, secret, streaming, binding mode, engine down). Engine refuses direct calls (404) and accepts proxied ones. Browser E2E 11/11 on one origin: founder → Studio Brain → Engine hub → Intelligence; streamed chat; only aelio.live contacted. Needs: Pages secret + binding, and the engine hosted (Option A or B) |
| Founder back office hub (Studio Brain → Engine) | WORKING | Health checks, counts, links to every area, recent activity; founder-only (tested) |
| Firebase login on aelio.live | PARTIAL | Token verification, founder UID+email allow-list and MFA tested with offline signing keys; real Google sign-in can't be tested in this environment |
| Code deployment permissions | WORKING | Production approval needs founder + fresh authenticator code; agents and apps refused (test_security). AI code changes need founder apply. A deploy executor doesn't exist yet |
| Engine hosting | BLOCKED (your decision) | Option A: your machine + Workers VPC (works with today's code). Option B: Cloudflare Containers after database persistence work |
| Public deployment boundary (`public/` only) | WORKING locally · BLOCKED for production | Local Pages emulator: new layout passes `check-deploy`, old layout fails (engine leak detected). Needs the Cloudflare output-directory change + preview check |
| Accounts, roles (founder / personal / game) | WORKING | Existing tests (test_brain_roles, test_security) |
| Wallet: allowances, credits, reservations, Stripe test mode | WORKING | test_credits (21) |
| Agent Transfer | WORKING | test_transfer (17) |
| Intelligence Gateway: routing, tiers, fallback, retries, timeouts, kill switch | WORKING | test_intelligence (24) against a local fake Responses endpoint |
| OpenAI Responses provider (streaming, tools, structured output, store=false) | WORKING (offline) · BLOCKED live | Real HTTP + SSE path tested with a fake server. No real key here, so never called OpenAI |
| AI usage metering into Wallet (tokens, cost, credits, refunds on failure) | WORKING | Tests: real-token settlement, release on failure, no double spend under 8 parallel requests |
| Rate limits, concurrency, daily spend caps, founder safety cap | WORKING | Tests |
| Consent before sending content to OpenAI + disclosure | WORKING | API test + browser E2E |
| Streaming Brain chat, history, delete, personalities (6) | WORKING | E2E 14/14 (fake endpoint); history reload; mobile no overflow |
| Conversation search | NOT STARTED | |
| File attachments in chat | NOT STARTED | |
| Tool execution with permission checks | PARTIAL | Tool calls defined and parsed; no tools exposed to models yet |
| Authorized memory | PARTIAL | Approved agent memories feed context; no memory add/edit from chat yet |
| Founder Intelligence dashboard | WORKING | E2E: renders usage, cost, latency, test prompt, Native status; personal account blocked |
| AELIO Native adapter + product gate enforcement | PARTIAL | Refuses unapproved checkpoints (tested); no approved model; Rust runtime not connected |
| Dream Agent Team conversations | PARTIAL | Each agent has its own conversations and memories; no team orchestration |
| Coding agent roles (Architect … Deployment) | NOT STARTED | Existing orchestrator runs the Native-only workflow |
| Code Studio: projects, files, branches, commit, diff, diagnose | WORKING | Existing tests + E2E |
| Code Studio: AI-proposed changes → diff → apply/reject | WORKING (founder) | test_code_assist (6) + browser E2E |
| Code Studio: terminal, live preview | NOT STARTED | Needs the Code Runner service |
| GitHub integration | PARTIAL | Read-only clone exists; no GitHub App, PRs or push |
| ZIP project import | NOT STARTED | Agent Transfer's safe-zip code is reusable |
| Publishing to Cloudflare from Studio | NOT STARTED | Artifact scans exist (`_src/checks`); deploy approvals are dry-run |
| AELIO self-development workspace | NOT STARTED | |
| Code Foundry M1–M7 | NOT STARTED as a product | Foundations above are reused (see master plan) |
| DrawUp OpenAI audit | BLOCKED | No access to the DrawUp repo or its configuration in this session |
| Voice | NOT STARTED | No speech service connected; voices untrained |
| AELIO Native rebuild, Phase 0 | PARTIAL | Parameter crate (10 tests), budget model, data audit (preliminary), boundary fix done; CI + benchmark gates next |

## Completed this session
1. Public boundary: site moved to `public/`; pre-deploy scan and post-deploy probe with negative tests.
2. Native: parameter counts verified and pinned (Rust + independent Python); budget model; proposal revised.
3. Intelligence Gateway with OpenAI, Native and test providers; wallet metering; limits; caps; audit.
4. Streaming Brain chat with disclosure and consent, personalities, provider labels.
5. Founder Intelligence dashboard.
6. Code Studio AI change proposals with diff review.

## Next priorities
1. Founder: approve the Cloudflare change; choose engine hosting (Option A or B in `engine/docs/DEPLOYMENT.md`); create the AELIO OpenAI key.
2. Live smoke test with the real key: `/api/brain/intelligence/test`, then one chat (founder), then personal account.
3. Conversation search and memory editing from chat.
4. Code Foundry M2: ZIP import + GitHub App (repo-scoped) + architecture/license report.
5. Code Runner service design (isolated, resource-limited previews).
