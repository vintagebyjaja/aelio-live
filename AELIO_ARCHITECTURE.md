# AELIO Architecture

## Topology
| Piece | Where it runs | Notes |
|---|---|---|
| Website + Brain app (`public/`) | Cloudflare Pages | Static. Built from `_src/`. Only `public/` is uploaded |
| Same-origin proxy (`functions/`, `_src/edge/engine-proxy.js`) | Cloudflare Pages Function on aelio.live | `/api/*` and `/webhooks/*` are forwarded privately; adds the proxy secret and client IP; strips spoofable headers; streams |
| Private engine Worker (`cloudflare/aelio-engine-worker`) | Cloudflare, no route, no workers.dev URL | Reached only via the Pages service binding `AELIO_ENGINE`; forwards to the engine through Workers VPC (or a Container) |
| AELIO Core Backend (`engine/`) | Private: a machine via a Tunnel with no public hostname (Option A) or a Cloudflare Container (Option B) | Python 3, Starlette, SQLite (WAL). Holds all secrets. Refuses API calls without the proxy secret |
| AELIO Intelligence Gateway | Inside the engine (`engine/aelio/intelligence`) | Only path from features to any model |
| OpenAI | api.openai.com (or a Cloudflare AI Gateway URL) | Responses API, `store: false` |
| AELIO Native research | `native/` (Rust) + engine Native Lab | Independent; not called by user features until product-approved |
| Sandbox | Engine host: Docker `--network none` or user namespaces | Runs untrusted code for Code Studio tasks |

## Intelligence Gateway
```
feature (chat / agent / Code Studio)
  -> GenRequest {user, purpose, instructions, messages, tools, json_schema, max_output_tokens}
  -> gateway.run(): pause? route (settings.choose) -> provider configured? consent (external)?
       spend caps -> per-user rate/concurrency -> wallet reserve (estimate) -> ai_requests row
  -> provider.stream(): TextDelta | ToolCall | Done(usage)  (retry/fallback only before output)
  -> settle real cost (<= reserve) | release on failure | charge delivered text if client disconnects
  -> events to caller: meta, delta, tool_call, notice, done | error
```
- **Routing:** `standard` tier for ordinary chat; `advanced` for code, long or code-heavy messages; advanced falls back to standard before output. Model IDs are settings (`kv: intelligence_settings`) with `ai_models` price rows.
- **Native rollout:** `native.stage` off → founder → percent, only for checkpoints with status `product_approved`; validated server-side.
- **Prompt assembly** (`context.py`): AELIO policy → provider statement → personality style → `<agent_profile>` and `<memories>` (data, not instructions). History comes from AELIO's `messages` table. Failed replies are excluded.
- **Personalities** (`personalities.py`): six styles plus default. A personality isn't a model; it's independent of agent, memory and provider.
- **Costs:** `cost_usd = (uncached_in × in + cached × cached_in + out × out) / 1M`; `credits = max(1, ceil(cost / usd_per_credit))`.

## Code Studio AI changes
`codestudio/assist.py`: propose (gateway, `code_change` JSON schema) → store `code_proposals` with per-file base hashes and diffs → founder applies (hash re-check, path policy, `aelio/*` branch for production repos) or rejects → founder commits. Denied paths: `.env*`, keys, `.github/workflows`, `.git`, `.aelio_protected`.

## Data (SQLite; additive migrations only)
Existing: users, sessions, audit_log, jobs, models, checkpoints, datasets, projects, tasks, plans, cost_config, usage_events, credit_ledger, reservations, credit_packages, payments, webhook_events, user_agents, agent_sources, conversations, messages, …
Added 2026-10-28:
- `ai_requests`: one row per model call: tokens, cost, credits, latency, status, error code. **No content.**
- `user_settings`: external-AI consent time, personality, preferences.
- `ai_models`: price list (USD per 1M tokens), enabled flag, source.
- `code_proposals`: AI-proposed code changes awaiting decision.
- Nullable columns: `messages.provider/model/status`, `conversations.personality_id`.

## Key API routes (added)
| Route | Who | Purpose |
|---|---|---|
| `GET /api/my/ai` | member | Disclosure, consent status, personalities, provider status |
| `PUT /api/my/settings` | member | Consent on/off, personality |
| `POST /api/my/agents/{aid}/chat/stream` | member | Streaming chat (SSE) |
| `POST /api/my/agents/{aid}/chat` | member | Same, non-streaming (unchanged response shape) |
| `GET /api/brain/intelligence` | founder | Dashboard data |
| `PUT /api/brain/intelligence/settings` | founder + fresh MFA | Routing, limits, caps, Native rollout |
| `POST /api/brain/intelligence/pause` | founder (resume needs fresh MFA) | Kill switch |
| `PUT /api/brain/intelligence/models/{id}` | founder + fresh MFA | Prices / enable |
| `POST /api/brain/intelligence/test` | founder | Internal test prompt |
| `POST /api/projects/{pid}/ai/propose` · `GET …/ai/proposals` · `POST …/ai/proposals/{id}/apply|reject` | founder | Code Studio AI changes |

## Security boundaries
- Secrets live only on the engine server (env or `var/secrets`, 0600). The browser never talks to OpenAI.
- Every route checks the role on the server; hidden UI is never the only protection.
- OpenAI receives a salted hash as `safety_identifier`, never an email or UID.
- Founder settings changes need a fresh authenticator code and are written to the append-only audit log.
- Rate limiting and concurrency are in-process. That's correct for one engine process and must move to a shared store before running several.

## Identity and AELIO Core (2026-10-28)
```
           aelio.live (Pages)                         mypathd.com (Pages, PATHD brand)
   browser ── Supabase Auth (shared project) ──────── browser
      │ /api/* (same origin)                              │ /api/ai/* (same origin)
      ▼                                                   ▼
   Pages Function ── service binding ─┐   ┌── service binding ── Pages Function (+ PATHD product key)
                                      ▼   ▼
                         private aelio-engine Worker (no route, no workers.dev)
                                      │  Workers VPC / Container
                                      ▼
   AELIO engine:  identity.verify (Supabase JWKS | Firebase during migration) → one AELIO user (identities table)
                  /api/*  aelio.live users        /v1/core/*  products (app key + user token + membership)
                  core.respond → plan → memory.recall → reasoning | coding (Intelligence Gateway) → memory.save
                                         vision | voice | agents → 501 until built
```
Supabase project: `auth.users` (shared) · `core.profiles`, `core.memberships` (products list mirrored into
`app_metadata.products`) · `aelio.*` (engine only) · `pathd.*` (RLS: own rows + PATHD membership).
Studio Brain permissions never come from Supabase: allow-listed UID + verified email + authenticator + security questions.
