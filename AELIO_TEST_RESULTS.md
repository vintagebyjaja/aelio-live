# AELIO Test Results

Run on 2026-10-28 in the development container (no network access to OpenAI, Cloudflare or GitHub).

| Command | Result |
|---|---|
| **Redesign + Web Designer (2026-10-29)** | |
| `cd engine && python3 -m pytest -q tests` | **164 passed** (adds 13 Web Designer tests) |
| `npm test` | **20 passed** (adds 4 Worker routing tests: deep links, no loops, /api to engine) |
| Browser sweep, all 50 public pages at 1440 px and 390 px | 0 script errors, 0 broken requests, 0 horizontal overflow; every page has its environment. Google Fonts blocked in the test sandbox; `/api/public/models` 503 because no engine (expected, shown as a message) |
| Entrance tests (Playwright) | Ends at 4.07 s after navigation; Skip and Escape close it; once per session; never shown with reduced motion or when `intro.js` is blocked; with all JS timers broken, CSS still hides it at 4 s and clicks pass through; mobile Skip works; scrolling and navigation work after |
| Web Designer E2E (engine behind the same-origin proxy) | 12/12: page opens from the Studio Brain nav; upload + place image; draft preview in the iframe shows it with the "Draft preview" bar; live site unchanged before publish; publish; a new visitor sees the image, gold colour and pill buttons; history row; anonymous gets 401 on the editor API |
| **Supabase migration (2026-10-28 evening)** | |
| `cd engine && python3 -m pytest -q tests` | **151 passed** (adds 14 identity, 2 backup, 14 Core, 1 full migration rehearsal) |
| `npm test` | **16 passed** (6 proxy incl. /v1 not public, 6 Supabase Auth client vs mock /auth/v1, 4 PATHD bridge) |
| `supabase/tests/run.sh` (local PostgreSQL 16 + mock Supabase auth) | **9/9 groups pass**: signup provisioning, own-row isolation, AELIO data hidden from browsers, no self-granting, product isolation + join, anonymous, suspension, deletion cascade; migration safe to re-run |
| CLI on a scratch database | `backup` (integrity ok, 42 tables) → `backup-verify` ok → `identity-plan` (1 mapped, 1 missing) → `identity-import` dry run |
| `npm run check` negatives | Blocks `auth:"supabase"` without URL, URL missing from CSP, and a service_role key in config.js |
| `cd engine && python3 -m pytest -q tests` | **106 passed** (71 existing + 24 gateway + 6 Code Studio AI + 5 same-origin/proxy guard) |
| `npm test` (same-origin proxy, Node) | **6 passed** |
| `pytest tests/test_studio_security.py` | **14 passed** (engine total now **120**) |
| Browser E2E: Studio Brain security + recovery | **14/15**: first login → setup → Studio opens; /studio/security short address; link recovery; personal account Founder badge; recovery MFA + test → active; personal can't open Studio; lock → challenge; 5 wrong → locked screen; recovery request; personal verifies → session → reset; founder must answer new challenge → unlocked; tamper check passed. The 15th check was a test-script selector mismatch (locked screen verified by screenshot) |
| Same-origin stack (Pages emulator running the real Pages Function → engine with proxy secret) | Direct engine call `/api/health` → **404**; through the site → `{"ok":true}`; `check-deploy` passes (82 URLs, 20 private paths unreachable, engine connected) |
| Browser E2E on one origin | **11/11**: founder lands in Studio Brain, Engine hub renders, "Reached through aelio.live" ok, OpenAI check ok, 9 back-office links, hub → Intelligence, Operations renders, chat streams through the proxy, personal account blocked from the Engine page; the browser contacted only the site (plus Google Fonts) |
| `cd native && cargo test` | **10 passed** (parameter accounting) |
| `python3 native/tools/param_count_check.py` | Rust and the independent closed form agree on every field |
| `npm run build && npm run check` | 50 pages + Brain app built; public/ check passed: 70 files, 8,198 internal links resolved, no engine/source/secret files |
| `node_modules/.bin/tsc --noEmit -p _src/tsconfig.json` | 0 errors |
| Negative tests for `check-public.mjs` | Caught: engine folder in public/, `.env`, OpenAI-style key in JS, unsupported 404 redirect rule |
| `check-deploy.mjs` vs local Pages emulator | New layout (`public/`): **pass**, 61 public URLs load, 16 private paths unreachable. Old repo-root layout: **fail**, engine source served (expected) |
| Browser E2E (Playwright) chat + dashboard | **14/14**: disclosure first, streaming visible (Stop button), "GPT via AELIO" label, personality applied, history reload, mobile overflow 0 px, dashboard counts, founder consent prompt, founder test prompt, Native tab, personal account blocked |
| Browser E2E Code Studio AI | **Pass**: diff shown, file untouched before apply, applied, editor shows change |

## What these tests do NOT prove
- **No real Supabase or Firebase project was used.** Supabase tokens were signed with a local key published as a JWKS; the schema ran on local PostgreSQL with a stand-in `auth` schema; the browser client ran against a mock `/auth/v1`.
- **PATHD's code wasn't available**, so the PATHD bridge was tested on its own, not inside mypathd.com.
- **No real OpenAI call was made.** The gateway was tested against a local server that emits the Responses API streaming format. The first live call happens after the key is added (see `AELIO_DEPLOYMENT.md` smoke test).
- **Real Firebase (Google) sign-in wasn't exercised.** Tests use offline signing keys and local dev login.
- **Cloudflare Pages Functions, the service binding, Workers VPC and Containers weren't run on Cloudflare.** The proxy ran in Node with the same code.
- **No Cloudflare preview was deployed.** The boundary was tested against a local emulator of Pages behaviour.
- **DrawUp was not inspected or tested** (no access).
- **Model prices** come from third-party surveys of OpenAI's rate card, not OpenAI's page directly. Confirm them.

## Unresolved
- In-process rate limiting works for a single engine process only.
- Personality preview in Agent Transfer still uses the AELIO Native prototype (labelled experimental), by design.
