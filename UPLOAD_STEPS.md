# Putting this version on aelio.live

This zip is the **whole repository**. It includes your GitHub `main`, plus:
- the site redesign;
- the Web Designer;
- Studio Brain security;
- the Supabase migration groundwork, which is **switched off** (sign-in stays on Firebase).

## 1. Upload to GitHub (replace, don't merge on top)
1. In your `aelio-live` repo, make a new branch, for example `redesign` (keep `main` as your fallback).
2. Upload the contents of this zip to that branch.
3. These old files are no longer used. **Delete them on the new branch** (your call; nothing breaks either way):
   - Screenshot images and the old patch files in `public/assets/`: `aelio-redesign.css`, `aelio-worlds-v4.css`, `aelio-entry-failsafe.js`, `img/aelio-atmosphere-*.webp`, `img/aelio-cinematic-home.webp`, `img/aelio-scene-1/2/3.webp`, `img/aelio-architecture-scene.webp`, `img/dream-beyond-entry.webp`.
   - The old copy of the site at the repo **root**: `index.html`, `404.html`, `_headers`, `_redirects`, the folders `aelio/`, `agent-campus/`, `assets/`, `brain/`, `create/`, `dream-beyond/`, `live/`, `studiobrain/`, `technology/`, `values/`, `web/`, and the root icon files. Cloudflare only publishes `public/`, so these were never live.
   - Patch notes that no longer apply: `DEPLOY_FIX_README.md`, `PATCH_INSTRUCTIONS.txt`, `README.txt`, `README_INSTALL.txt`.

## 2. Cloudflare (your project deploys as a Worker)
- Deploy command: `npx wrangler deploy --config wrangler.jsonc` (unchanged).
- `wrangler.jsonc` now also runs a small Worker for `/api/*` and for Brain deep links (`/studiobrain/web-designer`, `/brain/my/chat` and so on). Those links 404 on your current setup.
- Only `public/` is uploaded. Nothing else is published.
- Check the **preview** deployment of the `redesign` branch first:
  - the home intro (Skip works, it ends by 4 s);
  - each top menu page, on desktop and phone;
  - `/studio`, which still opens Studio Brain;
  - `/brain/`.
- Then merge `redesign` into `main`.

## 3. Web Designer needs the engine
Studio Brain → **Web Designer** saves designs and images in the AELIO engine. Until the engine is connected to aelio.live (the private engine Worker plus `AELIO_PROXY_SECRET`, see `AELIO_DEPLOYMENT.md`):
- The public site shows its built-in design. That's normal.
- Studio Brain pages that need the engine say it isn't connected.

## Still waiting on you (from before; nothing here depends on them)
1. Re-attach the architecture files (they never arrived).
2. Create the Supabase project (settings and script in `AELIO_MIGRATION_RUNBOOK.md`).
3. Export your Firebase users (`firebase auth:export`) for the user matching.
4. Give access to PATHD's code, and confirm mypathd.com is in the same Cloudflare account as aelio.live.
5. Connect GitHub to this workspace.
6. Approve moving AELIO's engine database to Supabase (built and tested in GitHub Actions).
