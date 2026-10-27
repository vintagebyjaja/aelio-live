# Architecture

```
                 Grooveville apps (Groove Guide, DrawUp, VYBR8, PATHD, …)
                          │  Bearer app key + scopes + quota
 aelio.live (public) ─────┼──────── GET /public/v1/models (published only)
                          ▼
  Browser ──Firebase sign-in──▶ studio.aelio.live (Cloudflare Tunnel → 127.0.0.1:8787)
                                 │
                       ┌─────────┴───────────────────────────────────────────┐
                       │ AELIO Studio server (Python, Starlette)             │
                       │  /api  founder-only (Firebase + allow-list + TOTP)  │
                       │  /v1   app gateway        /public/v1  read-only     │
                       ├─────────────────────────────────────────────────────┤
                       │ Orchestrator (state machine, task contracts)        │
                       │ Job queue (durable, DB-backed, worker threads)      │
                       │ Native engines: Reasoning · Code · Vision · Voice · │
                       │   Live · Memory/Tools                               │
                       │ Code Studio · Quality Lab · Guardians · Deploy      │
                       ├──────────────┬──────────────────────┬───────────────┤
                       │ SQLite (→PG) │ artifacts/ (→R2)     │ secrets/ 0700 │
                       └──────────────┴──────────────────────┴───────────────┘
                                 │ untrusted code only via
                                 ▼
                       Sandbox (Docker --network none | user namespaces)
```

## Who does what (attribution model)
Every task step records a **performer**:
- `deterministic:<tool>`: ordinary software (router, git, static analysis, test runner, acceptance gate).
- `native:<model>/<checkpoint>`: inference by an AELIO Native model trained from random initialisation.
- `external:<provider>`: work by an outside system, used only in **labelled comparison** mode. Never counted as native success, never training-eligible.

## Native model design
- `aelio-native-decoder-v1`: pre-LN decoder-only transformer, multi-head causal attention, GELU MLP, untied LM head. Config: layers, heads, width, context, vocab.
- Tokenizer: byte-level BPE trained on each run's training split.
- Checkpoint: `.npz` with a `__meta__` block (`arch`, `config`, `init: random-normal(seed)`, `external_weights: false`, dataset id and hash). The loader rejects anything else.
- Backend: NumPy (CPU). **Next step:** a PyTorch backend that loads and saves the same format, for GPU training. The platform, registry, jobs and evaluation don't change.
- Vision prototype: 2-layer MLP on 8×8 digits (Milestone D). It's deliberately narrow and measurable.

## Data and storage
- **Database:** SQLite in WAL mode, accessed through `aelio/db.py`. The schema uses portable types. To move to PostgreSQL, replace `_connect()` with a psycopg pool, translate `INSERT … ON CONFLICT` (already PG-compatible) and `AUTOINCREMENT` → `GENERATED ALWAYS AS IDENTITY`.
- **Artifacts:** `var/artifacts/{datasets,checkpoints,logs,audio}`. For Cloudflare R2, sync this directory or add an S3-compatible writer. Keep checkpoints private: R2 bucket without public access.
- **Secrets:** `var/secrets/` (directory 0700, files 0600). Never returned by the API, scrubbed from logs, hidden from the sandbox.

## Memory + Tools Engine
History, retrieval and tool permissions are deterministic software and are **kept separate from model weights**. Agents reach tools only through server functions guarded by permission checks. Repository content and documents are treated as data, never as instructions: no code path executes text from a repository as an instruction to an agent.
