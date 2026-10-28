# Deploying AELIO: one platform at aelio.live

There is **no separate engine domain**. Everything is on aelio.live:

```
Browser ─▶ https://aelio.live
             ├─ /, /aelio/…, /brain/…, /studiobrain/…   static pages (Cloudflare Pages, folder public/)
             └─ /api/*, /webhooks/*                      Pages Function (functions/) ─ service binding ─▶ private "aelio-engine" Worker
                                                                                                          └─▶ AELIO engine (Python)
```
- The browser only ever talks to aelio.live. Founder login, Studio Brain, the engine hub (Studio Brain → Engine), My AELIO and chat are one site.
- The engine has **no public address**: no subdomain, no public tunnel hostname, no workers.dev URL. It also refuses any API request that doesn't carry the proxy secret (`AELIO_PROXY_SECRET`) only aelio.live's proxy knows.
- Firebase sign-in happens in the browser. The engine verifies the Firebase ID token on every protected request, and founder-only routes also need the founder's UID + email + authenticator code.

## Why the engine isn't just a Cloudflare Worker
Workers and Pages Functions handle the routing (done: `functions/`). The engine itself needs things Workers don't provide:
- a **persistent database** (accounts, wallet ledger, payments, conversations: SQLite today);
- **git workspaces** and a **sandbox** for Code Studio, **long-running jobs** (training, tests), and Python + NumPy.

So the engine runs as one long-lived process somewhere private, behind the same-origin proxy. There are two ways to do that.

| | **Option A: your machine + Workers VPC** (recommended now) | **Option B: Cloudflare Containers** |
|---|---|---|
| Where the engine runs | A computer or small server you control that stays on | Inside Cloudflare |
| Public exposure | None: Cloudflare Tunnel with **no public hostname**, reached via Workers VPC | None: reachable only through the Worker |
| Works with today's code | **Yes** | Not safely yet: container disks are wiped on restart, so the database must first move to persistent storage (D1 / Durable Object storage) or rely on filesystem snapshots (public beta since Sept 30, 2026) |
| Code Studio sandbox | Yes (Linux namespaces or Docker) | Needs testing inside Containers |
| Cloudflare cost | Workers VPC is free during its beta | Workers Paid plan + container usage |
| Status | Workers VPC is **beta** | Containers GA (April 2026); snapshots beta |

**Recommendation:** start with Option A (no rewrite, works today). Move to Option B later if you want no machine of your own; that needs a database-persistence project first, which I'll scope when you decide.

---

## 1. Cloudflare Pages (the site + the /api proxy)
Project settings for the aelio.live Pages project:

| Setting | Value |
|---|---|
| Build command | *(blank)* |
| Build output directory | `public` |
| Root directory | *(blank)* (the `functions/` folder at the repo root is picked up automatically) |
| Variables and secrets → **Secret** `AELIO_PROXY_SECRET` | a long random string (same value goes on the engine) |
| Bindings → **Service binding** `AELIO_ENGINE` | → Worker `aelio-engine` (after step 2) |

Until the binding exists, `aelio.live/api/*` answers `503 engine_not_connected`, the public site works normally, and the Brain shows "engine not connected". Nothing breaks.

Safe rollout: push to branch `phase0` → Cloudflare builds a preview → `node _src/checks/check-deploy.mjs https://phase0.<project>.pages.dev` must pass → merge to `main`.

## 2a. Option A: engine on your machine, connected privately
**Machine:** Linux (needed for the sandbox; on macOS/Windows run the engine in Docker). 2 CPU cores, 4 GB RAM, 20 GB disk minimum. It must stay on and online.

```bash
# 1. Install the engine
sudo useradd -m aelio && sudo mkdir -p /srv/aelio && sudo chown aelio /srv/aelio
# as aelio: put the repo at /srv/aelio/aelio-live
python3 -m venv /srv/aelio/venv && /srv/aelio/venv/bin/pip install -r /srv/aelio/aelio-live/engine/requirements.txt
cp /srv/aelio/aelio-live/engine/.env.example /srv/aelio/aelio-live/engine/.env && chmod 600 /srv/aelio/aelio-live/engine/.env
#    edit .env: AELIO_PROXY_SECRET (same as Pages), OPENAI_API_KEY, Stripe test keys, AELIO_SAFETY_ID_SALT
sudo cp /srv/aelio/aelio-live/engine/deploy/aelio-studio.service /etc/systemd/system/ && sudo systemctl enable --now aelio-studio
curl -s localhost:8787/api/health -H "x-aelio-proxy-secret: <your secret>"     # {"ok":true,...}
```
The engine listens only on `127.0.0.1:8787`. No ports are opened.

**Connect it to Cloudflare without a public hostname:**
1. Cloudflare dashboard → **Workers VPC → Tunnels → Create** (name: `aelio-engine`). Run the install command it shows on the machine (`cloudflared` 2025.7.0 or newer; outbound UDP 7844 must be allowed). **Don't add a public hostname.**
2. Create the VPC service (needs the Connectivity Directory Admin role):
   `npx wrangler vpc service create aelio-engine --type http --tunnel-id <TUNNEL_ID> --hostname localhost --http-port 8787`
3. Put the returned service id in `cloudflare/aelio-engine-worker/wrangler.vpc.toml`, then deploy the private Worker:
   `cd cloudflare/aelio-engine-worker && npx wrangler deploy -c wrangler.vpc.toml`
   It has no route and no workers.dev URL.
4. Pages project → Bindings → Service binding `AELIO_ENGINE` → `aelio-engine`. Redeploy the preview.

## 2b. Option B: Cloudflare Containers (after persistence work)
`engine/Dockerfile` and `cloudflare/aelio-engine-worker/wrangler.container.toml` are ready, but **don't run accounts or the wallet on it yet**: a container restart would wipe the database. Remaining work before it's safe: move the database to persistent storage and validate the sandbox inside Containers. Then: `npm i @cloudflare/containers` in the Worker folder, Docker running, `npx wrangler deploy -c wrangler.container.toml`, and pass secrets as container environment variables.

## 3. Firebase (existing project aelio-0820)
- Authentication → Settings → **Authorized domains**: `aelio.live`, `www.aelio.live`, and your preview domain (`<project>.pages.dev`) for testing.
- Engine `.env` already has the project id and the role allow-lists: founder `jaja@vybr8.live` + UID `0RcUhRBDI4hGWisgzuyezqGVVZC3` (Studio Brain); personal `vintagebyjaja@gmail.com` (My AELIO, unlimited); everyone else gets the brain game.
- First founder sign-in shows a one-time authenticator key (Google Authenticator / Authy / 1Password). Sensitive actions need a code from the last 10 minutes.

## 4. OpenAI (shared billing with DrawUp, separate key)
In the OpenAI organization DrawUp bills to: create the project **"AELIO Live"**, set its monthly budget, create a key, and put it only in the engine's `.env` as `OPENAI_API_KEY` (plus `OPENAI_PROJECT_ID`). DrawUp's project and keys are untouched.

## 5. Stripe (test mode)
Webhook endpoint: **`https://aelio.live/webhooks/stripe`** (same origin, forwarded privately). Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`. Put `sk_test_…` and the signing secret in the engine's `.env`. Live charges stay off until you set `AELIO_PAYMENTS_LIVE=1`.

## 6. Verify (after deploying)
1. `node _src/checks/check-deploy.mjs https://aelio.live` → passes and prints `engine through …/api: connected`.
2. Sign in as the founder → you land in Studio Brain → **Engine** shows every check: Database, Reached through aelio.live, Firebase, OpenAI, sandbox, jobs.
3. Engine → Intelligence → Test → Run test (real OpenAI call).
4. Personal account → My AELIO → Chat: accept the disclosure, send a message, and watch it stream.
5. From any other network: `curl https://<anything>/api/health` gets nothing back from the engine except through aelio.live.

## Rollback
- **Site:** Cloudflare Pages → Deployments → previous deployment → Rollback.
- **Disconnect the engine instantly:** remove the `AELIO_ENGINE` binding (the site keeps working; the Brain shows "engine not connected").
- **AI only:** Studio Brain → Intelligence → Pause all AI requests.
- **Engine code:** run the previous commit; database changes are additive only.

## Not used (on purpose)
No separate engine subdomain, no public tunnel hostname, no workers.dev URL, no cross-site CORS. Adding any public endpoint needs the founder's approval.
