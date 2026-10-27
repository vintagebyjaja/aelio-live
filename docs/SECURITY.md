# Security model

| Requirement | Implementation | Verified by |
|---|---|---|
| Founder authentication | Firebase ID token verified server-side (RS256 against Google certs, `aud`/`iss`/`exp`/`iat`, verified email) **and** founder allow-list. Local mode: scrypt password + TOTP. | `first_run` firebase check; `tests/test_security.py` |
| MFA | TOTP (RFC 6238) required to finish every sign-in. A fresh code (≤10 min old) is needed to approve production, publish or promote models, approve voices, and change secrets. | tests |
| Sessions | Random 256-bit token, stored hashed, HttpOnly + Secure + SameSite=Strict cookie, 12 h expiry | tests |
| CSRF | Per-session token required in the `X-CSRF-Token` header on every write | `test_csrf_required_for_writes` |
| Server-side authorization | Every `/api` route calls `founder()`. App keys work only on `/v1` routes, scoped. | `test_unauthenticated_cannot_reach_studio`, `test_app_keys_scoped…` |
| Rate limiting | Login: 8 failures per 15 min per IP. API: 600/min per IP. Gateway: 300/min + daily quota per app. | `test_login_requires_totp_and_rate_limits` |
| Headers | CSP, `frame-ancestors 'none'`, X-Frame-Options DENY, HSTS, nosniff, no-referrer, no-store on API | `test_security_headers` |
| Audit | Append-only `audit_log`. There's no API to edit or delete it. | Settings → Audit log |
| Secret isolation | Server-side files (0600), names only via API, redacted from logs and agent-visible output, invisible inside the sandbox | `test_secrets_redacted`, sandbox self-test |
| Sandbox | No network, studio data dir and home dirs hidden, CPU/file-size/process limits, timeout, scrubbed env. Refuses to run when no sandbox exists. | `test_sandbox_isolation` |
| Evaluation integrity | Protected suites are hash-locked in git and in the DB. They're re-verified and freshly copied before every run. Scoring rules live in the suite. The server unit has suites read-only. | `test_protected_suite_tamper_detected` |
| No silent rewrites | A task can write only its contract's `allowed_files`. Changes to any other file abort the step. `.git` and `.aelio_protected` can't be written. | `test_write_policy` |
| No self-escalation | No route exists for agents to change permissions, policies, suites or deployments | code review: `server.py` route list |
| Production protection | Approval needs a founder session + fresh MFA. Agent/app actors are refused. No production credentials are stored. | `test_production_approval…`, first-run deployment check |
| Prompt injection | Repository and document text is data only. No agent executes instructions found in files. Generated code runs only in the sandbox. | design |
| Training data | Licence allow-list, required origin declaration, external-AI output never trainable | `test_external_ai_output_never_training_eligible` |

## Known limits (v1)
- The **namespace sandbox** hides sensitive paths and blocks the network, but it shares the host kernel and can still read other world-readable system files. Use the **Docker backend** in production.
- SQLite plus in-process rate limiting assume a single server instance.
- The Firebase sign-in has been verified against locally generated keys only. Verify again after configuring the real project: signing in with a non-allow-listed account must be refused.
