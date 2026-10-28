# AELIO Native 1.0: delivery report

**Owner:** Grooveville LLC · **Build date:** 2026-10-27 · **Evidence:** `docs/first_run_report.json` (raw output of `python -m aelio.cli first-run`)

Three kinds of work appear in this build, and the studio labels each one:
- **Deterministic software:** router, git, diagnostics, test runner, gates, guardian rules.
- **AELIO Native models:** trained here from random initialisation.
- **External assistance:** this codebase was written with Claude (Anthropic) as a development assistant. The one external artifact *inside* the product, `benchmarks/external_reference/dashboard.js`, is labelled, used only for comparison, and excluded from training. No external model's weights or outputs were used to train AELIO.

## A. What was built
| Component | Location |
|---|---|
| Private studio web app with all 10 sections | `web/` (prebuilt in `web/dist`) |
| Server: studio API, app gateway, public published-models endpoint | `aelio/server.py` |
| Firebase sign-in + founder allow-list, TOTP MFA, sessions, CSRF, rate limits, secrets, audit | `aelio/firebase_auth.py`, `aelio/security.py`, `aelio/db.py` |
| Durable job queue | `aelio/jobs.py` |
| Native Orchestrator (state machine, task contracts, performer attribution) | `aelio/orchestrator.py` |
| Native training core: BPE tokenizer, transformer, AdamW, datasets with licensing, training/eval/inference, vision prototype, model registry | `aelio/native/` |
| Code Studio: projects, git branches, file editing, search, history, diagnosis | `aelio/codestudio/` |
| Sandbox (namespace + Docker backends) | `aelio/codestudio/sandbox.py`, `Dockerfile.sandbox` |
| Quality Lab: protected hash-locked suites + runner | `aelio/quality/`, `protected_suites/` |
| Voice Lab: six identities, profiles, synthesis jobs, approvals | `aelio/voice.py` |
| Green Guardians: five agents, telemetry, recommendations, learning history | `aelio/guardians.py` |
| Deployment workflow + approvals | `aelio/deploy.py` |
| App registry and gateway (scopes, quotas, audit) | `aelio/gateway.py` |
| Benchmark sample app | `samples/dashboard-benchmark/` |
| Tests (26) | `tests/` |
| Deploy files (systemd, Cloudflare Tunnel) | `deploy/` |

## B. What actually works (verified)
- `pytest -q tests`: **26 passed**. Covers the gradient check, tokenizer, training and checkpoint round-trip, rejection of foreign checkpoints, licence and origin rules, auth, MFA, CSRF, headers, rate limits, app-key scoping, production-approval guards, suite tamper detection, sandbox isolation, secret redaction, job retry/timeout/cancel, write policy, workflow honesty, guardians and voice.
- `first-run`: **12/12 checks passed** on the build host (2 vCPU, no GPU):

| First-run check | Result |
|---|---|
| Sandbox isolation | network blocked, secrets and DB invisible, no secrets in env (namespace backend) |
| Native text model | random init → 1,500 steps → saved → reloaded from disk → inference → evaluated |
| Native code model + protected code tasks | trained; evaluated on 8 protected tasks (score below) |
| Native vision prototype | 97.8% held-out accuracy |
| Quality Lab pass/fail | `test_passing_addition` PASS, `test_intentionally_failing` FAIL, both reported correctly |
| First coding benchmark | native attempt ran end-to-end and **failed**; recorded honestly (see D) |
| Green Guardians | real telemetry read; synthetic scenario flagged SIMULATED; recommendations only, no hardware changes |
| Voice Lab | six voices registered; synthesis job returned `awaiting_training` with no audio |
| Deployment | dry-run preview plan; production approval blocked for agent, app, and founder without fresh MFA |
| Security | 11 studio routes return 401 without auth; app keys get 401 on studio routes |
| Integration | test app: `GET /v1/voices` 200 (6 voices), synthesize without scope 403, no key 401, requests audited; no Grooveville app modified |
| Firebase verification | founder token accepted; other account, wrong project, expired and unverified-email tokens rejected (offline signing keys) |

- **UI:** signed in and visited every section in Chromium at 1400px and 390px. No console errors and no horizontal overflow.

## C. What remains untrained or unbuilt
| Engine | State | Needs |
|---|---|---|
| Reasoning Core | 0.8M-parameter prototype: produces word-like fragments, **no reasoning ability** | PyTorch/GPU backend, much more licensed text, larger models |
| Code Engine | 0.8M-parameter prototype: **0/8** protected tasks | Same, plus a large licensed code corpus and failure-conditioned repair training |
| Vision Engine | Digits classifier only | Labelled document, drawing and UI datasets |
| Voice Engine | **Untrained**. No voice can speak yet. | Consented voice-performer recordings (see `docs/VOICE.md`), GPU |
| Video + Live Engine | Browser capture test only; **no real-time understanding** | Speech recognition first (Milestone C), then streaming |
| Memory + Tools | Deterministic software by design | n/a |
| Not built yet | PyTorch backend, PostgreSQL/R2 adapters, production deploy executor, preview hosting, GitHub push/PRs | See `IMPLEMENTATION_PLAN.md` |

## D. First test results
**Native text model** (`psf-stdlib-docstrings` v1, PSF-2.0, 1.2 MB train / 0.13 MB held-out; 3 layers, 4 heads, width 128, context 64, vocab 768; 799,872 params; 1,500 steps; 418.6 s and 414 CPU-s):

| step | 0 | 150 | 300 | 600 | 900 | 1200 | 1500 |
|---|---|---|---|---|---|---|---|
| val loss (nats/token) | 6.658 | 4.312 | 4.106 | 3.788 | 3.545 | 3.377 | 3.303 |

Final held-out: **loss 3.260, perplexity 26.1, 2.14 bits/byte.** Baselines: uniform 6.644, unigram 5.637, so the model beats both. Sample from the prompt "The function returns": *"turtle. Base following stop. Geparam sections a file, which is a defined as a string."* That's fluent-looking fragments with no meaning.

**Native code model** (`psf-stdlib-code` v1, PSF-2.0; same architecture, 1,500 steps): held-out loss **3.315**, perplexity 27.5, 1.93 bits/byte (unigram baseline 5.880). **Protected code tasks: pass@3 = 0.0 (0/8).**

**Vision prototype** (UCI digits, CC BY 4.0, 359 held-out images): **accuracy 97.77%** (chance 10%), 4,810 params, 0.15 s training.

**First coding benchmark: "Create a simple responsive dashboard component…"**
- *AELIO Native:* the orchestrator ran inspect → diagnose → plan → build → test → evaluate → repair ×2 → review. The native code model generated `src/dashboard.js` three times, and each attempt was invalid JavaScript. Protected suite: **0 passed / 10 failed**. Status **failed**, stopped at review after the bounded retries. The only performers recorded were deterministic tools and `native:…`. No external help was involved or credited.
- *External-assisted comparison (labelled):* the same pipeline and suite, with the labelled reference file, passed **17/17** (build, 6 unit/security tests, 10 browser checks at 375px and 1280px). That created a dry-run preview deployment awaiting founder review.
- **Baseline for measuring independence: native 0/10 vs external 17/17.**

## E. Infrastructure requirements
See `docs/INFRASTRUCTURE.md`. In short: a small Linux server ($0–40/month), Cloudflare Tunnel ($0) and Firebase Auth ($0 at this scale) run v1 today. Real model progress needs GPUs, roughly $0.71/h (L4) to $3.29/h (H100) on demand, and recordings from voice performers.

## F. Deployment status
| Environment | Status |
|---|---|
| Development | Ready. Runs locally and on any Linux host. All tests pass. |
| Preview | Workflow works in **dry-run**. No preview host is configured. |
| Production (aelio.live, engine behind /api) | **Not deployed.** Needs your server, Firebase project values and the Cloudflare Tunnel (`docs/DEPLOYMENT.md`). Nothing was deployed and no DNS was changed. |
| aelio.live | Unchanged |

## G. Security verification
Private studio isolated (all `/api` routes need a founder session and MFA; app keys can't reach them). Secrets are server-only and redacted. Sandbox verified: no network, data hidden, limits applied. Production approval needs a founder with fresh MFA. Agents and apps are refused, and no production credentials exist. Protected suites are hash-locked with tamper detection. Details and known limits are in `docs/SECURITY.md`. **Still to do after deployment:** sign in with a non-allow-listed Firebase account and confirm it's refused.

## H. Next training milestone
**Milestone B, round 2: the first native code-task pass.** Build the PyTorch/GPU backend for `aelio-native-decoder-v1`. Train a ~20–50M-parameter code model on a larger permissively licensed Python corpus, with function/docstring formatting. Success means **pass@3 > 0 on `code_tasks_v1`**, measured by the existing protected suite. After that, rerun the dashboard benchmark against the 0/10 baseline above.

---

## Update (2026-10-27, late): the Brain on aelio.live, credits, Agent Transfer
- **Brain:** Studio Brain moved to `aelio.live/studiobrain/…`, plus My AELIO (`/brain/my/…`) and the SYNAPSE brain game (`/brain/`), all in the aelio-live repo. The engine is reached at aelio.live/api through a private same-origin proxy (updated 2026-10-28: no separate engine domain), with Firebase Bearer tokens.
- **Roles (server-enforced):**
  - Founder `jaja@vybr8.live`: Studio Brain, needs both UID and email to match, plus an authenticator code.
  - Personal `vintagebyjaja@gmail.com`: My AELIO with unlimited usage, refused on every Studio Brain route.
  - Everyone else: the brain game.
- **Usage limits and credits** (`aelio/usage.py`, `aelio/payments.py`): rolling 5-hour allowances, an append-only ledger, reservations, Stripe test-mode checkout with signed and idempotent webhooks, refund reconciliation, founder controls, and Guardians/operations restrictions. Packages start unapproved and live charges are off.
- **Agent Transfer** (`aelio/transfer.py`): TXT, Markdown, JSON, PDF, DOCX and ZIP imports, plus conversation exports (consent required). Includes safe archive handling, injection and contact flagging, memory review, an experimental native preview, export and delete, encrypted optional source storage, and content-free founder stats.
- **Verified:** 71 engine tests pass, including the 20 credit scenarios from the spec. An end-to-end browser run against a local engine confirmed: signed-out → game, other account → game, personal → My AELIO and blocked from Studio Brain, import → review → save → preview → chat, founder → Studio Brain pages, and mobile with no overflow.
- **Not verified here:** live Firebase sign-in (needs your project, tested with stand-in keys), real Stripe calls (no network access to Stripe, so webhooks are tested with signed sample events), and deployment to Cloudflare.
