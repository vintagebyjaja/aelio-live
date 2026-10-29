# AELIO Cloudflare deploy fix — small patch

Merge these files into the ROOT of your EXISTING GitHub repository, preserving all existing files. Do not deploy this ZIP as a standalone website.

## What this fixes
The failed Workers deploy automatically selected `assets.directory: "."` and attempted to publish node_modules/workerd/bin/workerd (137 MiB), over Cloudflare’s 25 MiB asset limit. `wrangler.jsonc` sets the assets directory to `./public` instead.

## Cloudflare Workers build settings
- Root directory: repository root
- Build command: leave blank unless your source build files exist and are required
- Deploy command: `npx wrangler deploy --config wrangler.jsonc`
- Do not use `wrangler init` or point assets at `.`

## If this is actually a Cloudflare Pages project
Use the Pages deployment pipeline instead: output directory `public`, root directory repository root, and leave build command blank for this already-generated static site. Pages Functions in `/functions` are NOT automatically deployed by a Workers static-asset deployment. Verify `/api/*`, `/webhooks/*`, authentication, and Studio Brain on a preview URL before promoting.

## Notes
- This patch changes only the Workers asset directory configuration. It does not modify Studio Brain, the engine, or visual assets.
- No live deployment or verification has been performed.
- If Cloudflare uses a custom deploy command, explicitly point it to the config file.
