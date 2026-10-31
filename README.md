# Migration review — AELIO1.0.9 / PATHD0.1.6 (2026-10-30)

The current user requested all remaining handoff work and selected60% allocation with a $10 minimum for eligible paid AI plans. Implemented router/ledger and signed subscription events, PATHD pricing/access separation, natural streamed response formatting, Image Library and compact navigation. Review only on migration; main remains unchanged. See [validation and boundaries](docs/releases/AELIO_v1.0.9_REVIEW.md), [visual gallery](docs/previews/v1.0.9/README.md) and [configuration/SQL13 prerequisites](config/V1_0_9_ROUTER.md). Owner must manually review/apply only the new13 after the reported11/12 before dependent release; no production SQL or credentials/settings changes occurred. Existing payment/checkout behavior remains intact; paid enrollment and live integrations are not activated or verified. Historical records follow.

---

# AELIO 1.0.8 — local restoration preview

ECHO, Brain and conversation projects are restored on the local migration branch using SQL11/12. [Setup](config/V1_0_8_RESTORATION.md) · [Validation and limits](docs/releases/AELIO_v1.0.8_RESTORATION.md). This preview is not pushed or deployed. Historical release records follow.

---

# AELIO 1.0.5 — approved update

The reviewed migration update is approved for main. The owner handles Supabase SQL; no production database changes or manual deployment were performed. [Preview gallery](docs/previews/v1.0.5/README.md) · [Setup and SQL order](config/V1_0_5_SETUP.md) · [Validation and limitations](docs/releases/AELIO_v1.0.5_VALIDATION.md).

Actual local browser render with synthetic test data; not a live deployment:

![AELIO migration preview](docs/previews/v1.0.5/home-desktop.png)

---

# AELIO

Existing Dream Beyond / Grooveville LLC platform, extended with the Dream Box messaging experience. **Local delivery candidate AELIO_v1.0.1** — not deployed or published.

Start with [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md), [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md), and [config/SETUP.md](config/SETUP.md). Full local validation and external blockers are in [the validation record](docs/releases/AELIO_v1.0.1_VALIDATION.md).

## Local development

Node 24 and Python 3.12 were used for validation.

```sh
npm ci
npm run build
npm test
npm run typecheck
npm run check
npm run dev
```

The public site serves committed output from **public/**; all engine/source/config files remain private. New chat is `/chat/`; account/settings are `/account/`. Studio remains `/studiobrain/`, with existing founder MFA/security restrictions.

Runtime accounts use Supabase. The Cloudflare Worker injects public identifiers at `/assets/config.js`; fill its exact runtime variables rather than arbitrary framework build names. Native R2 uses the existing AELIO_STORAGE binding, never external R2 credentials. The Brain still requires its private engine binding, Supabase PostgreSQL connection and configured real inference provider. Account access does not depend on engine health.

The maintained backend is `engine/aelio`; historical root Python entry points delegate there. Install Python dependencies in a venv using `engine/requirements.txt`. Production requires DATABASE_URL; explicit AELIO_DATABASE=sqlite/AELIO_AUTH=local is for isolated offline tests/export only. Do not point local development at production services.

PATHD is a separate repository (`vintagebyjaja/pathd-app`) in the combined delivery, with independent branding/deployment/subscriptions and the shared Supabase identity provider. See the per-repository ZIP manifests before uploading.

No automatic deployment or production SQL is part of setup. Follow the staging and owner-controlled rollout instructions. Historical README and data-migration context are retained in docs/migration-history/.
