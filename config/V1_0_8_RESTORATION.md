# AELIO 1.0.8 restoration setup

Use the existing isolated checkout; do not create a worktree unless requested. Node24, `npm ci`, `npm test`, and `npm run typecheck` prepare the source workflow. Preserve injected proxy/CA settings. The command sandbox can block network/listening sockets; use supported elevated execution as needed.

For a build that preserves tracked public output:

```bash
mkdir -p /workspace/.onboarding
AELIO_BUILD_DIR=$(mktemp -d /workspace/.onboarding/aelio-restore.XXXXXX)
cd /workspace/aelio-live
tar --exclude=.git --exclude=node_modules -cf - . | tar -xf - -C "$AELIO_BUILD_DIR"
ln -s /workspace/aelio-live/node_modules "$AELIO_BUILD_DIR/node_modules"
cd "$AELIO_BUILD_DIR"
npm run build
npm run check
node _src/checks/pages-emulator.mjs public 8091
```

In the source checkout run `AELIO_BROWSER_BASE=http://127.0.0.1:8091 python _src/checks/browser_workspaces.py` with Python Playwright and `/usr/bin/chromium`. Browser fixtures are synthetic; they intercept account/data calls and never verify live service behavior. Optional preview output goes to `AELIO_SCREENSHOT_DIR` (default `/workspace/.onboarding/previews`).

For database validation use PostgreSQL17 (16 is also the repository runner's documented default): set `PG_BIN` and prepend its binaries to PATH, then run `bash supabase/tests/run_tests.sh test_workspaces_echo_projects.sql`. The runner creates and removes an isolated local cluster, applies migrations twice, runs assertions in a rolled-back transaction, and does not contact Supabase. Local package extraction used `/workspace/.onboarding/pg/usr/lib/postgresql/17/bin` in this environment.

Brain uses `/api/platform/workspace`; ECHO uses `/api/platform/echo`; conversation project assignment extends the existing conversation PATCH. No new production configuration is required beyond the existing working Auth/database/provider settings and migrations11/12. Owner reports those two migrations were run. Do not apply SQL, copy production credentials into local files, or enable provider access during startup. Do not manually deploy from these instructions.

Private Brain bridge regression (synthetic local provider):

```bash
python -m venv /workspace/.onboarding/engine-venv
/workspace/.onboarding/engine-venv/bin/python -m pip install -r /workspace/aelio-live/engine/requirements.txt
cd /workspace/aelio-live
/workspace/.onboarding/engine-venv/bin/python -m pytest engine/tests/test_messaging_bridge.py -q
```

The test client requires local socket access; use supported elevated execution if the sandbox blocks it. It does not start or connect development to a production engine.
