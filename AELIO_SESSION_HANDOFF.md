# AELIO Session Handoff

**Read this, then `AELIO_PROGRESS.md`, then run `git status` and `git log --oneline -8`.**

## State
- Repo: aelio-live (one private repo: `public/` site, `_src/` source, `engine/` backend, `native/` Native research)
- Branch: `phase0` (based on `main` @ 80c8a5a). Recovery branch: `backup/pre-phase0` = original main.
- Commits on `phase0`: f0d1db1 boundary + Native crate · 6d5446d prices · f88df9d gateway · 6932257 chat UI + dashboard · 4c71fc0 Code Studio AI · (docs commit)
- Nothing pushed, nothing deployed.

## Verify the state (about 1 minute)
```bash
cd engine && python3 -m pytest -q tests        # expect 101 passed
cd ../native && cargo test -q                   # expect 10 passed
cd .. && npm run build && npm run check         # needs esbuild/react: npm install (or a symlinked node_modules)
```

## Working
Gateway (OpenAI Responses offline-tested, Native adapter, test provider), streaming chat with consent and personalities, wallet metering and caps, founder Intelligence dashboard, Code Studio AI proposals with diff review, public/ boundary checks. Full table in `AELIO_PROGRESS.md`.

## Current unfinished task
None in progress. The last milestone (Code Studio AI edits) is committed and tested.

## Next exact step
1. If the founder has added `OPENAI_API_KEY` and deployed the engine: run the live smoke test in `AELIO_DEPLOYMENT.md` §4 and record the real results in `AELIO_TEST_RESULTS.md`.
2. Otherwise continue with unblocked work, in order:
   a. Conversation search (`GET /api/my/conversations?q=`, SQLite LIKE over the user's own messages) + UI.
   b. Memory editing from chat (add/remove approved memories per agent).
   c. Code Foundry M2: ZIP project import (reuse Agent Transfer's safe-zip reader) → architecture + license report (extend `codestudio/diagnose.py`).

## Known issues
- Rate limiting is in-process (single engine process).
- `gpt-6-*` prices come from third-party surveys; confirm on OpenAI's pricing page.
- Agent Transfer's personality preview still uses the Native prototype (labelled experimental).
- Old docs in `engine/docs/` (DELIVERY_REPORT etc.) describe the pre-gateway state.

## Missing credentials or permissions
- `OPENAI_API_KEY` (AELIO project in the DrawUp org) on the engine server.
- GitHub access to the DrawUp repo for the read-only audit.
- Cloudflare dashboard access is the founder's (output directory change).

## Needs founder approval
1. Cloudflare Pages output directory → `public`, preview check, merge to main.
2. Creating the "AELIO Live" OpenAI project/key and budget (billable).
3. Where the engine runs: Option A (your machine + Workers VPC, works today) or Option B (Cloudflare Containers, needs database persistence work). See `engine/docs/DEPLOYMENT.md`.
4. Native rebuild decisions (Tier A sources, $100 Phase 1 cap, research gates).

## Relevant decisions
`AELIO_DECISIONS.md` D1–D16 (D15: one platform at aelio.live, no engine domain). The important ones: only `public/` is published; the Python engine is the single backend; `store:false` with history in AELIO's DB; consent before external AI; Native only through the product gate.
