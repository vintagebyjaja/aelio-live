# PATHD × AELIO Core

PATHD keeps its own domain (mypathd.com), brand and interface. Its AI features are answered by AELIO Core.

```
browser on mypathd.com ── signs in with the shared Supabase project (same account as aelio.live)
   │  fetch("/api/ai/respond", { Authorization: Bearer <Supabase access token> })
   ▼
mypathd.com Pages Function  (functions/api/ai/[[path]].js → aelio-core-proxy.js)
   │  service binding AELIO_ENGINE (inside Cloudflare; no public address)
   │  + Authorization: Bearer <PATHD product key>   + X-AELIO-User-Token: <user token>
   ▼
private aelio-engine Worker ──► AELIO engine /v1/core/respond
   reasoning · coding · memory (operational) | vision · voice · agents (refused honestly, 501, nothing charged)
```

## Accounts
- **One Supabase project** for both sites. A PATHD signup sends `options.data.signup_product = "pathd"`. The database
  trigger then gives the person an **AELIO identity** (`aelio` membership) plus `pathd`, and writes both into the token
  (`app_metadata.products`).
- **Same credentials on both sites.** Each site keeps its own session, so signing in on one doesn't sign you in on the other yet.
- **AELIO's checks on every call:** a valid PATHD product key, a valid user token from the shared project, and `pathd`
  in the user's products. PATHD users get the AELIO role `user`: AI, wallet, consent and memory, but never Brain or Studio.

## API (through mypathd.com/api/ai/…)
| Route | Body / query | Returns |
|---|---|---|
| `POST respond` | `{input, history?:[{role,content}], remember?:[text], task?:"auto"\|"code", instructions?}` | `{output, request_id, services, memories_used, memories_saved, credits_charged}` |
| `GET/POST consent` | POST `{accept:true}` | `{disclosure, consent_at}`. Show the disclosure before the first answer when `respond` returns `403 consent_required` |
| `GET/DELETE memories` | DELETE `?id=` (or all) | the person's PATHD memories (PATHD memories never mix with AELIO's) |
| `GET services` | n/a | live status of each Core service |

Errors are JSON `{error, code}` with plain messages: `signed_out`, `not_a_member`, `consent_required`, `feature_unavailable`
(plan), `limit_reached` (credits), `paused` (founder kill switch), `service_unavailable` (vision/voice/agents).

## Setup (founder, when PATHD's repo is connected)
1. `python -m aelio.cli register-app PATHD pathd core:respond,core:memory` (the key is shown once).
2. In mypathd.com's Pages project (same Cloudflare account): service binding `AELIO_ENGINE` → `aelio-engine`; secrets `AELIO_CORE_KEY`, `AELIO_PROXY_SECRET`.
3. Copy `aelio-core-proxy.js` and `functions/api/ai/[[path]].js` into PATHD's repo; use `_src/brain/supabase-auth.ts` with `product: "pathd"` for sign-in.
4. Add `https://<ref>.supabase.co` to PATHD's CSP connect-src.

## Later: "Continue with AELIO"
For one sign-in across both domains, mypathd.com can send people to aelio.live to sign in and come back signed in. Supabase's
OAuth 2.1 server ("Sign in with your app", PKCE + consent screen hosted on aelio.live) does this without sharing cookies
between domains. Not built yet; it needs the real Supabase project to test against.
