# AELIO Decisions

| # | Date | Decision | Why |
|---|---|---|---|
| D1 | 2026-10-28 | Cloudflare Pages publishes only `public/` | `_redirects` can't return 404s (only 200/301–308), so rules can't hide private folders. Not uploading them is the only reliable boundary |
| D2 | 2026-10-28 | Keep the Python engine as the one backend, running privately behind aelio.live; Workers do the routing | It already holds auth, wallet, agents, Code Studio and the sandbox, all tested. Workers can't run the sandbox or long jobs. Rewriting in another language adds risk with no product gain |
| D3 | 2026-10-28 | OpenAI key lives with the engine (env or secrets store); the proxy secret lives in Cloudflare Pages secrets | The engine, not a Worker, calls OpenAI. If a Worker ever calls OpenAI, use `wrangler secret put OPENAI_API_KEY` |
| D4 | 2026-10-28 | Responses API with `store: false`; history in AELIO's DB | The spec requires AELIO-controlled state. It also makes provider switching (to Native) a routing change |
| D5 | 2026-10-28 | OpenAI client written with the Python standard library | No dependency to vet or pin; the streaming format is simple; fully tested against a local fake |
| D6 | 2026-10-28 | Retry and fallback only before any text is produced | Prevents duplicated or spliced replies; failures after output are errors and aren't charged |
| D7 | 2026-10-28 | Credits = ceil(provider cost / $0.01), minimum 1; reserve the worst case, settle actual | Uses the existing atomic wallet. Users are never charged more than the reserve; failures cost nothing |
| D8 | 2026-10-28 | Founder and unlimited accounts are exempt from credits but capped at $5/day each; all accounts $25/day | The spec forbids unlimited paid calls just because of founder permissions |
| D9 | 2026-10-28 | Explicit consent before content goes to an external provider | Spec: no routing user data to an external model without disclosure and privacy controls |
| D10 | 2026-10-28 | AELIO Native can serve users only via a `product_approved` checkpoint and staged rollout | Keeps GPT and Native interchangeable without letting a research model reach users |
| D11 | 2026-10-28 | Default models `gpt-6-luna` (standard) and `gpt-6.1-sol` (advanced) | Cheapest and mid-tier current OpenAI models per Oct 2026 price surveys. Both are editable settings. DrawUp's models couldn't be checked |
| D12 | 2026-10-28 | AI code changes are full-file proposals, reviewed as diffs, applied by the founder | The model never writes files. A hash check prevents overwriting newer edits |
| D13 | 2026-10-28 | Code Foundry extends Code Studio rather than being a new service | The spec says no duplicate auth, billing, memory or agent systems |
| D14 | 2026-10-28 | AELIO Native 0.1 is a research model with pre-registered gates | Founder correction: no replacing production on a "0 of 8" coding bar |
| D15 | 2026-10-28 | **No separate engine domain.** Everything is on aelio.live: `/api/*` and `/webhooks/*` go through a Pages Function to a private engine Worker (service binding), then to the engine via Workers VPC or a Container. The engine refuses API calls without the proxy secret | Founder correction: an engine subdomain was never authorized. One origin also removes cross-site CORS and gives one login and one back office |
| D16 | 2026-10-28 | Engine hosting: Option A (own machine + Workers VPC, no public hostname) recommended now; Option B (Cloudflare Containers) after database persistence work | Container disks are wiped on restart; the wallet ledger and accounts must never be lost. Option A runs today's tested code unchanged |
