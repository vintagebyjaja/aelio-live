# Deploying the private studio at studio.aelio.live

Nothing here changes aelio.live. Each step only adds something new.

## 1. A machine to run it
Any Linux machine you control: a small VPS, a GPU box, or your own computer. Minimum 2 CPU cores, 4 GB RAM and 20 GB disk for v1. See `INFRASTRUCTURE.md` for training hardware.
```bash
sudo useradd -m aelio && sudo mkdir -p /srv/aelio && sudo chown aelio /srv/aelio
# as aelio: unzip aelio-studio.zip into /srv/aelio/aelio-studio
python3 -m venv /srv/aelio/venv && /srv/aelio/venv/bin/pip install -r requirements.txt
/srv/aelio/venv/bin/python -m playwright install --with-deps chromium
```
Optional but recommended: install Docker and build the sandbox image (`docker build -f Dockerfile.sandbox -t aelio-sandbox:latest .`), then set `AELIO_SANDBOX=docker`.

## 2. Firebase Authentication
1. Firebase console → create a project (for example `aelio-studio`), or use an existing one.
2. **Build → Authentication → Get started.** Enable **Google** and/or **Email/Password**.
3. **Authentication → Settings → Authorized domains:** add `studio.aelio.live`.
4. **Project settings → Your apps → Web app (</>):** register "AELIO Studio" and copy `apiKey`, `authDomain`, `projectId` and `appId` into `.env` (see `.env.example`). These values are public identifiers, not secrets.
5. `.env.example` already names the founder: `AELIO_FOUNDER_EMAILS=jaja@vybr8.live` and `AELIO_FOUNDER_UIDS=0RcUhRBDI4hGWisgzuyezqGVVZC3`. Both must match, so even another account in the same Firebase project can't get in. (The UID must come from the same Firebase project the studio uses.)
   Optional: deploy the rules in `firebase/` (see `firebase/README.md`).
6. Recommended: in Firebase, disable new-user sign-up after you've signed in once (Authentication → Settings → User actions).

The first time you sign in, the studio shows a one-time authenticator key. Add it to Google Authenticator, Authy or 1Password. After that, every sign-in asks for the 6-digit code. So do approving deployments, publishing models and changing secrets, if your last code is more than 10 minutes old.

## 3. Initialise and verify
```bash
cd /srv/aelio/aelio-studio && set -a && . ./.env && set +a
/srv/aelio/venv/bin/python -m pytest -q tests
/srv/aelio/venv/bin/python -m aelio.cli first-run      # ~20 min on CPU; results appear in Quality Lab
```

## 4. Run as a service
```bash
sudo cp deploy/aelio-studio.service /etc/systemd/system/ && sudo systemctl enable --now aelio-studio
```
The server listens only on `127.0.0.1:8787`.

## 5. Publish at studio.aelio.live with Cloudflare Tunnel
```bash
cloudflared tunnel login
cloudflared tunnel create aelio-studio
cloudflared tunnel route dns aelio-studio studio.aelio.live   # adds one new CNAME; nothing else in DNS changes
sudo cp deploy/cloudflared-config.yml /etc/cloudflared/config.yml && sudo cloudflared service install
```
No inbound ports are opened on the server.

**Optional extra layer:** Cloudflare Zero Trust → Access → Applications → add `studio.aelio.live`, with a policy that allows only your email. Bypass `/v1/*` and `/public/*` if Grooveville apps or aelio.live need to reach them.

## 6. Going further
- **GitHub:** Settings → Secrets → `GITHUB_TOKEN`. Use a fine-grained token with *read-only* Contents access on the repos you choose. The studio clones into isolated workspaces. Pushing isn't enabled in v1.
- **Production deployments:** v1 records approvals but holds no production credentials, so it doesn't execute releases. Adding an executor is a deliberate future change. It should use a separate deploy token, run only after founder approval with fresh MFA, and be added under review.
