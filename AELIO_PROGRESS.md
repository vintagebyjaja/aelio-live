# AELIO Progress

Updated 2026-10-28 · branch `phase0` · latest commit `4c71fc0` (plus this docs commit)

Legend: **WORKING** = implemented and passed a test · **PARTIAL** = implemented but not fully tested or connected · **BLOCKED** = needs approval, credentials or infrastructure · **NOT STARTED**

## Public redesign and Web Designer (2026-10-29)
| Component | Status | Evidence / what's missing |
|---|---|---|
| Cinematic environments for every section (code-drawn), distinct section layouts, all 50 pages | WORKING locally | Sweep: no errors or overflow, desktop and mobile. Photoreal photos still to be generated (specs in VISUAL_ASSETS.md) |
| 4-second silent entrance with the official emblem | WORKING locally | 8 behaviour checks incl. script failure and broken timers |
| Official icons, manifest | WORKING | Generated from the uploaded emblem without changes |
| Studio Brain → Web Designer | WORKING locally · needs engine hosted | 13 API tests + 12-step browser E2E |
| Workers deploy (wrangler.jsonc + Worker for /api and deep links) | WORKING in tests · not deployed | 4 Worker tests; preview deploy pending |

## Supabase migration and AELIO Core (2026-10-28)
| Component | Status | Evidence / what's missing |
|---|---|---|
| Firebase inventory | WORKING | Only Firebase **Auth** is used; no Firestore/Storage. All AELIO data is in the engine DB |
| Verified backup + restore (CLI) | WORKING | sha256 + integrity + row counts; tamper detected; restore makes a safety backup first |
| User mapping Firebase → Supabase | WORKING (offline) | `identity-plan` (dry run) / `identity-import --apply`; needs your real exports |
| Engine accepts Supabase tokens (JWKS, ES256/RS256) alongside Firebase | WORKING (offline) | 14 tests incl. founder look-alike, anon/service_role/HS256 refused, cutover + rollback switch |
| Founder / personal / recovery permissions across providers | WORKING (offline) | Same AELIO account, Studio security carries over, personal still 403 on Studio |
| Supabase schema (shared auth, AELIO identity on every signup, isolated AELIO/PATHD data) | WORKING on local Postgres · BLOCKED on Supabase | 9/9 SQL test groups; needs the project created |
| Browser sign-in via Supabase (password, signup, Google PKCE, refresh, reset) | WORKING (mock) · off by default | `auth:"firebase"` until cutover; 6 Node tests |
| Rollback plan | WORKING (rehearsed) | Full rehearsal test: backup → map → dual-run → cutover → switch back → restore; data fingerprint identical |
| AELIO Core router: reasoning, coding, memory | WORKING (test provider) | 14 tests; real answers need OPENAI_API_KEY on a hosted engine |
| AELIO Core: vision, voice | NOT STARTED | Refused with 501, nothing charged |
| AELIO Core: agents for products | PARTIAL | Brain agents work on aelio.live; not offered to products |
| PATHD bridge (mypathd.com → service binding → Core) | WORKING (isolated test) · BLOCKED | 4 tests; needs PATHD repo, same Cloudflare account, product key |
| One sign-in across both domains ("Continue with AELIO") | NOT STARTED | Same credentials work on both today |
| CI (GitHub Actions: engine, site, Supabase SQL, Native) | WRITTEN, not run | Runs once the repo is on GitHub |
| Engine database on Supabase Postgres | NOT STARTED · needs approval | psycopg can't be installed here; build/test in CI |

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
| Three access levels (founder · personal with founder perks + recovery · regular) | WORKING | test_studio_security (14): only jaja@vybr8.live opens Studio Brain; personal gets 403 on every Studio route; regular users never see the challenge |
| Studio Brain challenge (5 questions + passphrase + authenticator), lockout | WORKING | Case-insensitive answers, exact numbers, hashed with scrypt; 5 wrong → 1 h lock; 3 locks/24 h → locked until recovery. Browser E2E 14/15 checks pass (the 15th was a test-script selector; screen verified by screenshot) |
| Emergency recovery via personal account | WORKING (offline) | Linked + own MFA + tested before active; request (3/day) → personal MFA → single-use 10-min authorization → 15-min session that can only reset the questions/passphrase → founder must sign in and answer the new challenge. Expiry, single use, denial and restrictions tested |
| Security notifications to both emails | PARTIAL | Recorded in Studio Brain → Security; email delivery needs an email-sending endpoint (AELIO_NOTIFY_WEBHOOK_URL) |
| Passkeys / optional MFA for regular users | NOT STARTED | Spec offers them; regular users currently use Firebase sign-in only |
| Tamper-evident security log | WORKING | Hash chain; tampering detected in test; status shown in Studio Brain → Security |
| Short addresses /login /my-aelio /studio /backoffice /settings/security | WORKING | Redirects; tested in the Pages emulator |
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
