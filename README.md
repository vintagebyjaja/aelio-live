# aelio.live

One private repo for everything AELIO:

| Folder | What it is | Published? |
|---|---|---|
| `public/` | The website and Brain pages (built output) | **Yes: the only folder Cloudflare Pages uploads** |
| `_src/` | Page content, Brain app source, build and safety checks | No |
| `engine/` | The AELIO engine (Python): accounts, Brain API, wallet, Agent Transfer | No: runs on your server |
| `native/` | AELIO Native rebuild (Rust), independent research project | No |
| `functions/` | Cloudflare Pages Functions: the same-origin proxy for `/api/*` and `/webhooks/*` | Runs on Cloudflare; source never served |
| `cloudflare/` | The private `aelio-engine` Worker (no route, no public URL) | No |

Private folders are protected by never being uploaded, not by redirect rules (Cloudflare Pages ignores 404 rules in `_redirects`).

The public AELIO website, plus the **Brain**, all served by Cloudflare Pages.

| URL | What it is | Who sees it |
|---|---|---|
| `/` and ~50 pages (`/aelio/…`, `/technology/…`, `/agent-campus/…` …) | Public site with mega menus, mobile menu, search and breadcrumbs | Everyone |
| `/brain/` | **Brain button.** Not signed in, or not on the list: the SYNAPSE brain game. Signed in: sends you where you belong. | Everyone |
| `/brain/my/…` | **My AELIO**: agents, Agent Transfer import, chat, history, usage, credit wallet, billing | Member accounts (your personal account now; everyone once accounts open) |
| `/studiobrain/…` | **Studio Brain**: Engine, Intelligence (GPT / AELIO Native), Native Lab, Code Studio, Quality Lab, Voice/Vision/Live Labs, Agent Campus, Operations, Credits & Billing, Usage & Access, Agent Transfer, Settings | Founder only (jaja@vybr8.live + UID + authenticator code). **Engine** is the back-office hub: system health and links to every area |

The pages are static. All data comes from the **AELIO engine** (the `engine/` folder) at **`aelio.live/api/…`**: a Cloudflare Pages Function (`functions/`) forwards those requests privately to the engine, which checks every request on the server. There is no separate engine domain. Hiding a page is never the only protection.

## Cloudflare Pages settings
- Build command: **blank**
- Build output directory: **public**
- Root directory: **blank** (repo root)

The built pages are committed in `public/`, so Cloudflare serves them as-is.

**Changing the output directory (one time, needs founder approval):**
1. Push this branch (`phase0`) to GitHub. Cloudflare builds it as a *preview* at `https://phase0.<project>.pages.dev`; production is untouched.
2. Cloudflare dashboard → Workers & Pages → the aelio.live project → Settings → Build → Build configuration → set **Build output directory** to `public` → Save. This applies to new deployments only; the live site keeps running.
3. Retry the preview deployment, then run `node _src/checks/check-deploy.mjs https://phase0.<project>.pages.dev`. It must pass.
4. Only then merge `phase0` into `main`. Production redeploys from `public/`. Run the same check against `https://aelio.live`.
5. Rollback: Deployments → pick the previous production deployment → *Rollback to this deployment*.

Do **not** push the combined repo to `main` while the output directory is still `/`: that would upload `engine/` publicly.

`_redirects` makes `/brain/my/*` and `/studiobrain/*` load the app, and `_headers` adds security headers and keeps Brain pages out of search engines.

## Editing content
All page text lives in `_src/content.mjs` and the visuals in `_src/visuals.mjs`. After editing:
```bash
npm install          # once
npm run build        # regenerates public/ (pages + Brain app)
npm run check        # verifies public/ holds only website files: no engine, source, keys or .env
```
Commit only after `npm run check` passes.

## Connecting the Brain
1. Run the engine privately and connect it to aelio.live/api: see `engine/docs/DEPLOYMENT.md` (no public engine address; Cloudflare Workers VPC or Containers).
2. Firebase console (project **aelio-0820**) → Authentication → Settings → Authorized domains: add `aelio.live` and `www.aelio.live`.
3. `public/assets/config.js` holds the Firebase web config (public identifiers, not secrets). The engine is same-origin, so no engine URL is configured.

## Status labels
Every product page says whether it's **Live**, **Prototype**, **Planned** or a **Concept preview**. Proposed prices are labelled as proposed, and the early-access form says it doesn't collect emails yet. The original artwork (hero cloud, six personality portraits) comes from the previous site.
