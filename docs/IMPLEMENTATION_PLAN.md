# Dependency-aware implementation plan and status

Status key: ✅ built and verified by tests · 🟡 built, verification limited (reason given) · ⛔ blocked (reason given)

## Phase 1: Working foundation
| Item | Depends on | Status |
|---|---|---|
| Repo audit | n/a | ✅ `docs/AUDIT.md` |
| Private studio app shell (10 sections) | auth | ✅ `web/` |
| Authentication: Firebase ID token + founder allow-list + TOTP MFA | n/a | 🟡 Verified with locally generated signing keys. A live Firebase project isn't configured yet. |
| Local auth (dev / break-glass): scrypt password + TOTP | n/a | ✅ |
| Sessions, CSRF, rate limiting, security headers, audit log | auth | ✅ |
| Database schema | n/a | ✅ SQLite with portable SQL (PostgreSQL migration documented) |
| Model registry | schema | ✅ |
| Durable job queue | schema | ✅ retries, timeouts, cancel, postpone, crash recovery |
| Observability | jobs | ✅ job logs, audit log, API usage, telemetry. 🟡 No external tracing (OpenTelemetry) yet. |
| Security controls | all | ✅ see `docs/SECURITY.md` |

## Phase 2: Code Studio + Quality Lab
| Item | Status |
|---|---|
| Projects from sample; GitHub connect (read clone via server-side token) | ✅ sample · 🟡 GitHub clone untested here (no GitHub access from the build sandbox) |
| File browser, editor, search, history, branches (`aelio/*` only), diffs | ✅ |
| Task entry → orchestrator → visible workflow stages | ✅ |
| Deterministic self-diagnosis | ✅ |
| Sandboxed runner (namespace backend; Docker backend) | ✅ namespace verified · 🟡 Docker backend written, not run here (no Docker daemon) |
| Protected hash-locked suites; tamper detection | ✅ |
| Bounded repair loop (max 3) | ✅ |
| Development previews | 🟡 dry-run plans only. No preview host credentials configured. |

## Phase 3: Native training core
| Item | Status |
|---|---|
| Byte-level BPE tokenizer (trained from scratch) | ✅ |
| Decoder-only transformer, hand-written backprop (gradient-checked) | ✅ NumPy backend |
| Training pipeline, checkpoints, reload, inference | ✅ |
| Dataset registry with licence allow-list, provenance, validation, versioning | ✅ |
| Held-out evaluation with baselines; protected code tasks | ✅ |
| PyTorch/GPU backend | ⛔ PyTorch couldn't be installed in the build environment. This is the next engineering milestone. |

## Phase 4: Voice Lab + Green Guardians
| Item | Status |
|---|---|
| Six voice identities, registry, profile editor, synthesis jobs, approval workflow, gateway access | ✅ |
| Native speech prototype (Milestone C) | ⛔ needs a consented, licensed speech dataset + GPU |
| Telemetry readers (psutil, thermal zones, RAPL, nvidia-smi) | ✅ (this host exposes CPU/memory only) |
| Five Guardian agents, recommendation-only, approval + learning history | ✅ |

## Phase 5: Multimodal expansion
| Item | Status |
|---|---|
| Vision Lab with a real native prototype (digits, Milestone D) | ✅ |
| Live Lab capture-pipeline test (camera, mic, screen) | ✅ browser-side · real-time understanding ⛔ not started |
| Cross-engine orchestration contracts; app gateway | ✅ |
| Multimodal training (Milestone F) | ⛔ not started |

## Phase 6: Deployment + validation
| Item | Status |
|---|---|
| Deployment stages, approval workflow, production block | ✅ |
| Rollback infrastructure | 🟡 Designed (stage + record), but nothing deploys in v1, so there's nothing to roll back |
| Security verification | ✅ |
| First native coding benchmark | ✅ executed. The native model **failed**, and that was recorded honestly. |
| Final readiness report | ✅ `docs/DELIVERY_REPORT.md` |

**Native 1.0 completion rule:** every first-run test in the specification has been run and passed (see the delivery report). "Passed" means the system behaved correctly and reported truthfully. It doesn't mean the native models are capable.
