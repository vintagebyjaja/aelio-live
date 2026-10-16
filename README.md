# ΛELIO — Never Say Never

Static website **preview** for `aelio.live`, prepared for GitHub and Cloudflare Pages.

## What's included

- Interactive entry screen and homepage
- AELIO, Dream Beyond, Technology, Create, Our Values, Agent Campus and AELIO Live sections
- Agent recruitment / home team, optional university, marketplace price illustration, and bring-your-own-agent preview
- Self-contained HTML with embedded imagery; no build tools or dependencies

## Publish with GitHub + Cloudflare Pages

1. Create a new GitHub repository (e.g. `aelio-live`).
2. Upload **the contents of this folder** to the repository root: `index.html`, `favicon.webp`, `README.md`, and `.gitignore`.
3. In Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git**.
4. Select the GitHub repository and use the following settings:
   - Framework preset: **None**
   - Build command: **leave blank**
   - Build output directory: **/** (repository root)
5. Deploy and open the Cloudflare-provided `*.pages.dev` URL.
6. Under the Pages project's **Custom domains**, add `aelio.live` and follow Cloudflare's DNS prompts. Add `www.aelio.live` if desired.
7. Subsequent GitHub commits will trigger new Cloudflare Pages deployments.

## Important limitations

This is a **visual and interactive frontend prototype**, not a production application. Authentication, subscriptions, checkout, agent messaging, training, agent imports, marketplace payouts, user data storage, and waitlist forms require a secure backend and additional implementation. The import input **does not upload any file**. Market prices and creator payouts are illustrative.

Do not collect real customer payments or private conversation exports until those features and their security/privacy controls have been built and tested.
