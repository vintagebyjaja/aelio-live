# Firebase → Supabase migration runbook

Status 2026-10-28: **everything below is built and rehearsed locally. Nothing has been run against real Firebase or
Supabase**, because this workspace has no credentials for either. Steps marked **(founder)** need you.

## What actually moves
Inventory of the current code (`git grep -i firebase`):

| Firebase piece | Used for | Moves? |
|---|---|---|
| Firebase Auth (Google + email/password), project `aelio-0820` | Sign-in on aelio.live; the engine verifies its ID tokens | **Yes**: sign-in moves to Supabase Auth |
| Firestore | Not used | No |
| Firebase Storage | Not used | No |
| `engine/firebase/` rules folder | Unused leftovers | No (keep until cutover is done) |
| Firebase UIDs in the allow-lists (`AELIO_FOUNDER_UIDS` …) | Founder, personal and recovery accounts | Add the Supabase UIDs **next to** them |

All AELIO data (accounts, wallet, agents, conversations, Studio Brain security, audit log) is in the **engine's own
database**, not in Firebase. The migration therefore changes how people sign in, not where their data is. Every
person keeps the same AELIO account: the engine's `identities` table links each person's Firebase and Supabase sign-ins
to that one account.

## The switches
| Switch | Where | Values |
|---|---|---|
| Which sign-ins the engine accepts | engine env `AELIO_AUTH_PROVIDERS` | `firebase` (today) → `supabase,firebase` (dual-run) → `supabase` (cutover) |
| Which sign-in the site shows | `public/assets/config.js` `auth` | `"firebase"` → `"supabase"` |
| Supabase project | engine env `SUPABASE_URL`; config.js `supabase.url` + publishable key; `_headers` connect-src | `npm run check` blocks a half-done switch |

## Steps
### 0. Backup (verified)
```bash
python -m aelio.cli backup --label pre-supabase      # prints file, sha256, row counts, integrity "ok"
python -m aelio.cli backup-verify <file>              # re-check at any time
firebase auth:export firebase-users.json --format=json --project aelio-0820   # (founder) Firebase user export
```
Keep both files outside the repo. The Firebase export includes password hashes: treat it as a secret.

### 1. Create the Supabase project (founder)
One project for AELIO and PATHD. Settings:
- Authentication → **Confirm email: on**. Google provider: on.
- Authentication → URL configuration: site URL `https://aelio.live`. Redirect URLs `https://aelio.live/brain/` and `https://mypathd.com/**`.
- JWT signing keys: **asymmetric (ECC P-256)**. The engine refuses HS256 tokens.
- SQL editor: run `supabase/migrations/20261028000001_platform_identity.sql`.

The schema gives every signup an AELIO identity, keeps PATHD data behind Row Level Security, and gives browsers no
access to AELIO data. It was tested locally with `supabase/tests/run.sh`.

### 2. Bring users across
- **Google users:** nothing to do. Their first Supabase sign-in with the same Google account links automatically (same verified email).
- **Email/password users:** passwords can't be read back from Firebase. Either import the Firebase scrypt hashes with Supabase's
  migration tooling (`firebase-to-supabase`, then test one account before all), **or** ask them to use "Forgot password" once.
  With today's handful of accounts, the second is simpler and safer.
- Founder and personal accounts **(founder)**: sign up in Supabase with jaja@vybr8.live and vintagebyjaja@gmail.com, then add their
  Supabase UIDs to the engine env, keeping the Firebase UIDs:
  `AELIO_FOUNDER_UIDS=<firebase>,<supabase>` · `AELIO_MEMBER_UIDS`/`AELIO_UNLIMITED_UIDS`/`AELIO_RECOVERY_UID` the same way.
- Map and link:
```bash
# Supabase dashboard → Authentication → Users → export, or SQL: select id, email from auth.users
python -m aelio.cli identity-plan --firebase-export firebase-users.json --supabase-users supabase-users.json > plan.json
python -m aelio.cli identity-import plan.json            # dry run: shows what would be linked
python -m aelio.cli identity-import plan.json --apply    # takes a backup first, then links
```
The founder account can never be claimed by email alone: a Supabase identity only becomes the founder if its UID is in the allow-list.

### 3. Dual-run
Engine: `SUPABASE_URL=https://<ref>.supabase.co`, `AELIO_AUTH_PROVIDERS=supabase,firebase`. Site: still `auth: "firebase"`.
Test on a Cloudflare **preview** with `auth: "supabase"` (preview deployments don't affect aelio.live).

### 4. Acceptance (must all pass before cutover)
| Check | How |
|---|---|
| Authentication | Sign in with Supabase (password and Google) on aelio.live and mypathd.com with the same account; refresh; sign out |
| Authorization | Founder: Studio Brain opens only after authenticator + security questions. Personal: founder perks, 403 on Studio. Regular user: no challenge, no Studio. PATHD user: AI works, no Brain |
| Recovery | Personal account recovery flow works from a Supabase session |
| Data integrity | `backup-verify` ok; wallet balances, agents and conversations identical before and after (the rehearsal test checks exactly this) |
| AI functionality | aelio.live chat streams; PATHD `/api/ai/respond` answers; founder pause stops both |

### 5. Cutover
Site `auth: "supabase"` (publish after preview check); engine `AELIO_AUTH_PROVIDERS=supabase`. **Firebase stays untouched.**

### 6. Rollback
- **Fast (seconds):** engine `AELIO_AUTH_PROVIDERS=firebase` (or `supabase,firebase`), site `auth: "firebase"`. No data changes, so nothing to undo.
- **Full:** `python -m aelio.cli restore <pre-supabase backup>`. It verifies the backup, backs up the current state first, then restores. Supabase links disappear and Firebase works as before.

Both rollbacks are rehearsed in `engine/tests/test_migration_rehearsal.py`.

### 7. Retire Firebase (founder approval, later)
Only after Supabase has passed every check in production for an agreed period. Then remove the Firebase script and CSP entries,
and drop the Firebase UIDs from the allow-lists. Firebase project data is deleted only on your explicit instruction.

## What is not done
- Real Supabase/Firebase runs (no credentials here).
- Moving the engine's own database to Supabase Postgres. Separate step, needs approval. The `psycopg` driver can't be installed in this workspace, so the Postgres backend for `db.py` must be built and tested in CI.
- Seamless "already signed in" across the two domains. Today the same credentials work on both; signing in once for both needs a redirect flow (Supabase's OAuth 2.1 server, "Continue with AELIO"). Planned; see `integrations/pathd/README.md`.
