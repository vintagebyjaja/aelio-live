# AELIO Native Studio 1.0

The **AELIO engine**: the server behind the Brain on aelio.live (Studio Brain at `aelio.live/studiobrain/`, My AELIO at `aelio.live/brain/my/`, the brain game at `aelio.live/brain/`). Those pages live in the aelio-live repo and reach this engine at `aelio.live/api/…` through a private same-origin proxy. The engine has no public address of its own.

It also includes: account roles, usage limits and an AELIO Credit wallet with Stripe test-mode payments (`aelio/usage.py`, `aelio/payments.py`), and Agent Transfer (`aelio/transfer.py`).

> **Status (honest):** the platform foundation works and has been verified: auth, jobs, model registry, training pipeline, Code Studio, Quality Lab, sandbox, Voice Lab, Green Guardians, gateway and deployment approvals. The native models are **small prototypes trained from random initialisation**. They aren't yet capable of real coding, speech or reasoning tasks, and the studio reports that. See `docs/DELIVERY_REPORT.md`.

## What's inside

| Path | What it is |
|---|---|
| `aelio/server.py` | HTTP server: private studio API (`/api`), Grooveville app gateway (`/v1`), public published-models list (`/public/v1`) |
| `aelio/firebase_auth.py`, `aelio/security.py` | Firebase sign-in + founder allow-list, authenticator (TOTP) MFA, sessions, CSRF, rate limits, secrets |
| `aelio/jobs.py` | Durable job queue (priorities, retries, timeouts, cancellation, postponement) |
| `aelio/orchestrator.py` | Native Orchestrator state machine: Inspect → … → Deploy, records who did each step |
| `aelio/native/` | Tokenizer, transformer (NumPy, from scratch), datasets with licensing/provenance, training/eval jobs, vision prototype, model registry |
| `aelio/codestudio/` | Projects (git workspaces), self-diagnosis, sandboxed execution |
| `aelio/quality/` | Protected, hash-locked test suites and the test runner |
| `aelio/voice.py` | Six AELIO voice identities + synthesis jobs |
| `aelio/guardians.py` | Green Guardians (thermal, power, workload, cooling, resource), recommendation-only |
| `aelio/deploy.py`, `aelio/gateway.py` | Deployment approvals; app registry with scoped keys and quotas |
| `protected_suites/` | Acceptance tests the coding engine can't modify (`LOCKS.json` holds their hashes) |
| `samples/dashboard-benchmark/` | Isolated sample app for the first coding benchmark |
| `benchmarks/external_reference/` | **Labelled external** (Claude-written) reference solution, used only for comparison and never for training |
| `web/` | Legacy local studio UI, served at http://localhost:8787 for offline use. The main UI is now on aelio.live. |
| `tests/` | Automated tests for this repo (`pytest -q tests`) |
| `docs/` | Audit, plan, architecture, deployment, security, infrastructure, voice and delivery report |

## Quick start (your own computer or a server)

```bash
python3 -m venv venv && . venv/bin/activate
pip install -r requirements.txt
python -m playwright install --with-deps chromium     # browser tests in Quality Lab
python -m pytest -q tests                             # 71 tests
python -m aelio.cli first-run                         # trains the prototypes and runs every first-run check (~20 min on CPU)
```

Then sign in, either with Firebase (production) or locally (development):

```bash
# Development (local password + authenticator app)
AELIO_AUTH=local AELIO_SECURE_COOKIES=0 python -m aelio.cli create-founder you@example.com
AELIO_AUTH=local AELIO_SECURE_COOKIES=0 python -m aelio.cli serve     # http://localhost:8787
```

For production (everything on aelio.live; the engine has no public address of its own), follow **docs/DEPLOYMENT.md**.

Linux is required for the sandbox: Docker, or user namespaces via `unshare`. On macOS or Windows, run the studio inside Docker or a Linux VM. Code execution is refused when no sandbox is available.
