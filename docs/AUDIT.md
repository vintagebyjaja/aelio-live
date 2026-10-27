# Repository audit: aelio.live (recorded before any work)

**Date:** 2026-10-27  **Source:** `aelio-live-main.zip` supplied by the founder

## Current state
| Item | Finding |
|---|---|
| Files | `index.html` (1,167,135 bytes, one self-contained page with inline CSS/JS and embedded images), `favicon.webp`, `README.md` |
| Framework | None. Static HTML. No build step, no `package.json`, no dependencies. |
| Hosting | Cloudflare Pages, connected to GitHub (per README). Build command blank, output directory `/`. |
| Backend / Firebase / auth | None in the repo. The README says auth, checkout, agent messaging and storage aren't implemented. |
| Environment variables / secrets | None referenced. |
| Routes | One page with client-side section switching (AELIO, Dream Beyond, Technology, Create, Our Values, Agent Campus, AELIO Live). |
| DNS | `aelio.live` (+ optional `www`) on Cloudflare. Not inspected directly: no DNS access from this session. |

## Deployment dependencies
GitHub repo → Cloudflare Pages auto-deploy on commit → custom domain `aelio.live`.

## Decision
- **The public site isn't modified.** No file in `aelio-live-main` was changed, and no ZIP of it is delivered.
- AELIO Native Studio is a **separate project** (`aelio-studio`) with its own runtime, auth, permissions and deployment. It needs Python and CPU/GPU compute, so it can't run on Cloudflare Pages.
- Additive infrastructure only: one new DNS record (`studio.aelio.live`, created by Cloudflare Tunnel), one new Firebase project (or a new Auth configuration in an existing one), one new server. Existing DNS records, Pages projects, Firebase integrations, environment variables and routes are left alone.
- Optional later step, not done now: aelio.live can read `https://studio.aelio.live/public/v1/models` to show founder-published models. See `docs/PUBLIC_SITE_INTEGRATION.md`.
