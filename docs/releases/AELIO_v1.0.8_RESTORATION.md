# AELIO 1.0.8 restoration preview — 2026-10-30

Local implementation on `migration`, based on remote SQL-only commit `e4b652b2454c5bc1f6cfa18a3b2a0db7109aed52`. Main remains unchanged. The original lost application changes were not recovered; the selected features were rebuilt against SQL11/12. Owner reports running 11 and12; production state is not independently verified. No new migration or production configuration is required by this implementation.

## Restored behavior

- Experience selector offers DreamBox and Brain. Existing founder-only Studio Brain entry is shown only for a founder account; Studio's independent authorization and source stay intact.
- Seven Brain sections save owner-scoped private notes, tasks, goals, plans, projects and HTTPS links. Entries can be edited, marked done/archived and deleted. No tools, telemetry or dashboards are fabricated. Connected website links explicitly do not link accounts.
- Memory, Personality and Original ECHOs use migration11's atomic creation function. Disclosure acknowledgement, realistic living-person consent, reserved names and valid communication styles are enforced on the server. Permanent companions cannot become or be deleted as ECHOs.
- Supplied memories enter pending. Review explicitly approves/rejects them. TXT/JSON imports are staged for inspection before saving as pending, never automatically approved. Photo references use existing private storage; photo content is never sent to inference. Individual memories can be deleted without deleting their files.
- Only migration11's `app_echo_context` supplies reviewed inference context. Both conversation memory and ECHO memory must be enabled. Ordinary agent-memory fields cannot bypass ECHO review. Both the existing OpenAI adapter and private Brain payload receive the reviewed context; working provider selection/stream parsing remains intact. ECHOs cannot be published.
- ECHO deletion uses the existing owner-scoped function. It removes solo ECHO conversation history and ECHO memories, removes the agent from groups, and retains uploaded files. Active replies block deletion at the API check.
- Conversation settings add Move to Project and Remove from Project. Projects lists real conversation assignments; assignment does not move or delete stored files. Existing rename/pin/archive/appearance/delete controls remain. Conversation deletion copy explicitly states files are retained.
- Mobile chat hides persistent bottom navigation; the drawer still provides access to other sections. The 320px header accommodates the experience switcher. Private Brain/ECHO component state is reset across account identity changes.

## Validation in this environment

- `npm test`: **69 passed**, zero failed/skipped (61 existing, eight new). Includes ownership, forged owner IDs, validation/consent, pending-memory enforcement, reviewed inference context, both memory switches, permanent-companion protection and conversation project persistence.
- `npm run typecheck`: passed.
- Private Brain bridge: **five Python tests passed**, including the new ECHO simulation guard above editable profile data and memory-off behavior. Existing private-secret, permanent-identity, scoped career/memory and structured-tool checks remain passing. One third-party Starlette/httpx deprecation warning.
- Full production build: passed in an isolated local copy to preserve tracked public output.
- `npm run check` against that output: passed, 136 public files, 9,181 internal links and eight redirect rules; no private source/secret files in public output.
- PostgreSQL17.11 disposable local cluster: every migration applied twice; all seven groups in `test_workspaces_echo_projects.sql` passed. Covers RLS, server-only writes, consent/style/name constraints, memory review/isolation, photo ownership, permanent companions, ECHO deletion retaining Library files, project validation and existing history preservation. Synthetic records rolled back and the cluster removed. No production connection.
- New synthetic browser regression passed at **320,375,390,430,768,1024,1440px**: Brain save and reload persistence, section isolation, ECHO consent and review, project assignment/browsing, hidden Studio option for members, no JS errors or horizontal overflow. All screenshots contain local fixture data.
- Existing chat browser regression passed at 1440/390: thread switching, isolated drafts/replies, appearance persistence, account dashboard and no overflow/JS errors. Its obsolete `button.permanent` selector was corrected to the current companion navigation.
- Existing companion browser regression passed at 1440/390/320: eight official identities, default chats, Dream Team, mention input, synthetic streaming and retries. Its mobile navigation now uses the drawer when bottom navigation is hidden in chat.
- Existing embedded DreamBox streaming browser check passed: one explicit send, grounded page metadata, streamed reply and logout clearing history/drafts.

## Limits and pending work

No live Supabase/Auth/provider/R2/Cloudflare requests were used to validate these features. Local mocks and SQL assertions do not prove production behavior or consent provenance. Physical-device Safari/iPhone/Android behavior is unverified. No pushes, merges, deployments, production SQL or secret changes were performed. PATHD source remains unchanged.

Brain currently lists up to 500 entries; ECHO management lists up to 200 supplied memories while inference uses SQL11's maximum 60 approved text memories. Pagination remains future work. SQL11's existing creation-cap concurrency behavior is unchanged. Photo analysis/OCR, family invitations, sharing, voice and video are not implemented. Full Library restoration, the broader sidebar redesign, natural prefix cleanup, provider routing and subscription/accounting changes remain pending. Resolve the conflicting historical budget documents before implementing financial formulas.

Only source deltas are delivered; public bundles must be rebuilt from the source before any separately authorized release. Keep the approved avatars and all existing public assets. Do not rerun SQL11/12 merely to upload the source delta. See `config/V1_0_8_RESTORATION.md` and the delivery inventory/checksums.
