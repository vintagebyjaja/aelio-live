# AELIO Test Results

Run on 2026-10-28 in the development container (no network access to OpenAI, Cloudflare or GitHub).

| Command | Result |
|---|---|
| `cd engine && python3 -m pytest -q tests` | **106 passed** (71 existing + 24 gateway + 6 Code Studio AI + 5 same-origin/proxy guard) |
| `npm test` (same-origin proxy, Node) | **6 passed** |
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
- **No real OpenAI call was made.** The gateway was tested against a local server that emits the Responses API streaming format. The first live call happens after the key is added (see `AELIO_DEPLOYMENT.md` smoke test).
- **Real Firebase (Google) sign-in wasn't exercised.** Tests use offline signing keys and local dev login.
- **Cloudflare Pages Functions, the service binding, Workers VPC and Containers weren't run on Cloudflare.** The proxy ran in Node with the same code.
- **No Cloudflare preview was deployed.** The boundary was tested against a local emulator of Pages behaviour.
- **DrawUp was not inspected or tested** (no access).
- **Model prices** come from third-party surveys of OpenAI's rate card, not OpenAI's page directly. Confirm them.

## Unresolved
- In-process rate limiting works for a single engine process only.
- Personality preview in Agent Transfer still uses the AELIO Native prototype (labelled experimental), by design.
