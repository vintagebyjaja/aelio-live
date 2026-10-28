# AELIO Deployment

**Nothing here has been deployed.** Every production step needs founder approval. Secret values never appear in this repo.

## 1. Cloudflare Pages (website + Brain pages)
| Setting | Value |
|---|---|
| Build command | *(blank)* |
| Build output directory | `public` (**changing this is the Phase 0 approval**) |
| Root directory | *(blank)* |
| Environment variables | none (nothing secret is in the static site) |

Steps:
1. Push branch `phase0` (not main). Cloudflare builds a preview at `https://phase0.<project>.pages.dev`.
2. Dashboard → Workers & Pages → aelio.live project → Settings → Build → Build output directory = `public` → Save. Retry the preview deployment.
3. `node _src/checks/check-deploy.mjs https://phase0.<project>.pages.dev` must pass.
4. Merge `phase0` → `main`. Then `node _src/checks/check-deploy.mjs https://aelio.live`.
5. Rollback: Deployments → previous production deployment → *Rollback to this deployment*.

Do **not** push this repo to `main` while the output directory is still `/`: that would publish `engine/`.

## 2. OpenAI (shared with DrawUp's organization and billing, separate key)
Safest way to share DrawUp's billing without touching DrawUp:
1. platform.openai.com → the organization DrawUp already bills to → **Projects → Create project "AELIO Live"**. Projects share the org's billing but have their own keys, limits and usage reports. DrawUp's project, keys and settings are untouched.
2. In "AELIO Live": set a **monthly budget** (suggested $50 to start) and, if offered, restrict allowed models to the two AELIO uses.
3. Create an API key in that project (a service-account key if available). Copy it once.
4. Put it only on the engine server: `OPENAI_API_KEY=` in `engine/.env` (file mode 600), or Studio Brain → Settings → Secrets. Also set `OPENAI_PROJECT_ID` and `AELIO_SAFETY_ID_SALT` (any long random string).
5. Never paste the key into chat, the repo, the website or DrawUp.

To let me audit DrawUp's existing integration (which models, where the key is stored, how usage is tracked), connect GitHub to Claude and give me read access to the DrawUp repo, or attach its backend code. I'll only read it and won't change DrawUp.

## 3. The engine (no separate domain)
The engine is reached only at `aelio.live/api/*`: a Pages Function forwards to the private `aelio-engine` Worker, which reaches the engine through Workers VPC (a Tunnel with **no public hostname**) or a Cloudflare Container. Full steps, the two hosting options and their trade-offs: `engine/docs/DEPLOYMENT.md`.
Secrets on the engine (names only): `AELIO_PROXY_SECRET` (same value as the Pages secret), `OPENAI_API_KEY`, `OPENAI_PROJECT_ID`, `OPENAI_ORG_ID` (optional), `AELIO_SAFETY_ID_SALT`, Stripe keys. Pages project: secret `AELIO_PROXY_SECRET`, service binding `AELIO_ENGINE` → `aelio-engine`. Never set `AELIO_ALLOW_TEST_PROVIDER` in production.

## 4. Live smoke test (after the key is added; founder only)
1. Studio Brain → Intelligence: OpenAI shows **connected**.
2. Intelligence → Test → Run test (standard, then advanced). Check the tokens and cost shown.
3. My AELIO → Chat with the founder account. Then the personal account: accept the disclosure, send one message, confirm it streams and History shows it.
4. Intelligence → Overview: the requests appear; errors are 0.
5. Optional: Pause all AI requests → chat shows "paused" → resume (needs an authenticator code).

## 5. Rollback
- **AI:** Studio Brain → Intelligence → Pause all AI requests (instant, no charges). Or switch the model under Routing & limits.
- **Engine connection:** remove the Pages `AELIO_ENGINE` binding to disconnect instantly (site keeps working).
- **Engine code:** redeploy the previous commit; schema changes are additive, so the old code runs on the new database.
- **Website:** Cloudflare Pages deployment rollback (above).

## 6. Estimated operating costs (estimates, from the price list in Studio Brain)
| Item | Estimate |
|---|---|
| Chat message on `gpt-6-luna` (~1,500 in + 400 out tokens) | ~$0.00035 → 1,000 messages/day ≈ **$10/month** |
| Code change on `gpt-6.1-sol` (~6,000 in + 2,000 out) | ~$0.032 → 100/day ≈ **$95/month** |
| Engine host | Option A: your own always-on machine ($0 extra) or a small server ($5–$40/month). Option B: Cloudflare Containers usage (needs database persistence work first) |
| Cloudflare Pages, Functions, private Worker, Tunnel, Workers VPC (beta) | $0 on current plans within free limits |
| Daily caps (defaults) | $25/day all accounts; $5/day per founder/unlimited account |
