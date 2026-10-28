# AELIO Master Plan

The authoritative plan for AELIO Live, Brain, Code Studio / Code Foundry and AELIO Native.
Live status is in `AELIO_PROGRESS.md`; how to resume is in `AELIO_SESSION_HANDOFF.md`.

## Objective
AELIO becomes Grooveville's own AI platform and software development ecosystem:
- **Now:** AELIO Live works with GPT through AELIO's own Intelligence Gateway.
- **Ongoing:** AELIO Brain holds conversations, manages agents, writes and changes real code, runs and tests it, previews it, and prepares approved deployments, including changes to AELIO itself.
- **Long term:** AELIO Native, trained independently from scratch, replaces GPT once it passes a separately approved product gate.

## Architecture (one backend)
```
aelio.live (Cloudflare Pages, public/ only)
  /api/* -> Pages Function (same origin) -> private aelio-engine Worker -> AELIO Core Backend (engine/, Python; no public address)
       accounts, roles, wallet, agents, memory, Code Studio projects, jobs, audit
       -> AELIO Intelligence Gateway (engine/aelio/intelligence)
            -> OpenAI GPT (Responses API)       today
            -> AELIO Native (product-approved)  later, staged rollout
       -> Code Runner (isolated sandbox)  -> previews -> Deployment Controller (founder approval)
AELIO Native research (native/, Rust) -> independent; never trained on chats or GPT output
```
Details: `AELIO_ARCHITECTURE.md`. Decisions and their reasons: `AELIO_DECISIONS.md`.

## Non-negotiables
- Don't deploy, spend money, delete code or data, change Cloudflare/DNS, change security or payment policy, or grant external permissions without founder approval.
- Never commit or expose keys, `.env`, customer data or private source. Cloudflare publishes `public/` only.
- Never label something working without a passing test. Never present mock functionality as real.
- GPT is a replaceable provider. Tools, files, permissions, agents, memory and publishing are AELIO-owned.
- AELIO Native stays independent: no pretrained weights, no training on GPT output or user conversations without explicit, separate permission.
- DrawUp Arch Coach is a separate product: only the OpenAI organization and billing are shared, never code, prompts or keys.

## Implementation phases (from the master backend spec)
| Phase | Scope | State |
|---|---|---|
| 0 Security & repo audit | Public boundary, inventory, dev branch | Done locally; Cloudflare setting change needs approval |
| 1 Core backend + GPT | Gateway, streaming chat, history, memory, usage | Core done; live OpenAI key needed |
| 2 Code Studio foundation | Projects, editor, AI multi-file edits, diffs, snapshots, GitHub | AI edits + diffs done; GitHub App, ZIP import next |
| 3 Execution & previews | Code Runner service, builds, tests, logs, previews, limits | Existing sandbox runs tests in tasks; Code Runner + previews not started |
| 4 Coding agents | Architect, Developer, Design, Debug, QA, Security, Deployment | Not started (existing orchestrator is Native-only) |
| 5 Publishing | Cloudflare preview deploys, approval, rollback, artifact scans | Scans done (`_src/checks`); deploy integration not started |
| 6 Self-development | Founder-only AELIO workspace, isolated branches, separate controller | Not started |
| 7 Native readiness | Native adapter, eval reports, controlled routing | Adapter + gate enforcement done; no eligible model |

## AELIO Code Foundry (added 2026-10-28)
Code Foundry extends Code Studio. It is **not** a second backend: same accounts, wallet, gateway, project store, sandbox and agent system.

| Milestone | Builds on | First acceptance test |
|---|---|---|
| M1 Foundation: service contracts, persistent project records, gateway integration | `projects` table, git workspaces, `codestudio/assist.py` | Documented API schema; project CRUD with per-owner isolation |
| M2 Import & analysis: GitHub (GitHub App, repo-scoped), ZIP upload, architecture report, license + dependency inventory | `connect_git`, `diagnose.py`, Agent Transfer's safe-zip code | Test B (import, change, diff, save) |
| M3 Real coding: AI multi-file edits, diffs, snapshots, sandboxed tests, Code Studio UI | `assist.py` (done for founder), `sandbox.py`, tasks | Test A (describe app -> files -> build -> preview) |
| M4 Code Fusion: compatibility analysis, integration plan, adapters, merge on a branch, integration tests | M2 reports, M3 runner | Test C (two codebases -> combined project, tests pass) |
| M5 Verified Code Library: component registry with provenance, license, tests, security status, re-verification on version change | M2 license inventory | Test D (add approved component to a project) |
| M6 Developer platform: external developer workspaces, scoped API, Wallet quotas, publishing | roles, wallet, gateway limits | Test E (no cross-developer access) |
| M7 Advanced: visual editing, multi-agent collaboration, self-development, marketplace prep | M3-M6 | Test F (self-development change can't deploy itself) |

Rules carried from the spec: never blindly concatenate code; never overwrite originals (branches + snapshots); "verified" requires defined checks; rewriting third-party code doesn't remove license obligations; don't claim a platform supports export/API access without checking; marketplace sales and payouts stay off until payment infrastructure and policies exist.

## AELIO Native track
Separate plan: "AELIO Native Rebuild: Architecture Proposal" (revision 2, Claude Doc). Phase 0 deliverables are in `native/` (parameter-count crate, budget model). Native 0.1 is a research model. It can serve users only after a separately approved product gate, through the gateway's staged rollout.

## Founder approvals pending
See `AELIO_SESSION_HANDOFF.md` → "Needs founder approval".
