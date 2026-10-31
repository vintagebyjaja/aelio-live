# AELIO 1.0.15 — Native Brain, Dolphin campus and Character Creator

Foundation: approved main `129ce3b`. Prepared on local `migration`. The owner subsequently authorized completing checks and pushing directly to main without another review, and waived preview delivery. Push main only; remote migration and PATHD stay unchanged. Existing Git-triggered builds are permitted. No production SQL, provider activation, payment settings, secrets or role changes were performed or authorized.

## Native Brain foundation

Five collapsible navigation groups expose the requested technology workspace. Owner-scoped projects support safe text/directory import, code editing, static sandboxed previews, export, version snapshots, conflict detection, deployment configuration and project memory. Drafts survive Native section switching and require a discard decision before exiting. Limits: 20 projects, 64 files/project, 64 KiB/file, 450 KB text, 50 retained versions/project. Browser previews cannot execute scripts, fetch remote resources or run builds.

Dream Cloud reuses private uploads. Image Studio and its confirmed credit flow are reused. Wallet uses actual account message entitlements and existing private-engine balances/packages/confirmed receipts when connected; creator cash is a separate owner-scoped private ledger, never simulated credits. A missing connection is shown as unavailable. Checkout requires an explicit package review and confirmation and uses the existing server payment integration. Test-mode checkout is labelled. Client monetary writes, withdrawals and fake marketplace earnings are unavailable.

Creative Lead/Code Engineer roles, AI coding execution, command runners, GitHub authorization, automatic builds/tests/deployment, animation generation, production 3D generation, marketplace transactions, publishing and payouts remain setup-gated. Their controls do not pretend to run jobs. University currently connects learning goals and project context, not courses/exams/graduation. No Voice Studio public navigation; voice APIs also require the existing verified founder/email/role/aal2 boundary. No duplicate providers, new keys or external services.

## AUREVIA map and location loading

The supplied Dolphin map is the geography reference. A derived clean map image supports 15 real selectable anchors, previews, search, map/list views, keyboard pan, drag/pinch zoom and reset. The map is explicitly a 2D navigation surface; it mounts no world canvas. Travel is short and skippable, with immediate navigation for reduced motion.

Orb Plaza retains real interactive geometry and camera/walking controls. The office retains real room geometry, shared materials/coast lighting and working thread selectors, invitations, transcripts and Dream Team access. Only the selected location's geometry is constructed. Residence opens its existing private settings; University opens its learning workspace. Other mapped locations are honestly marked in development and cannot be entered as completed worlds. These are procedural benchmarks, not a finished reference-level world restoration.

## Character Creator

A reference-led black/gold interface retains four actual steps: Appearance, Personality, Knowledge and Preview. Live Three.js geometry responds to body/presentation, skin/face, hair/color/texture, eyes, outfits, shoes, accessories and proportions. Orbit and zoom work; named humanoid parts prepare later rig mapping. Appearance presets persist inside each owned custom agent's configuration. New agents use existing creation APIs; appearance-only edits send only configuration and a rendered portrait, preserving personality, memories and thread histories. Portraits are captured from the actual model and stored through existing private R2 file ownership checks. Existing shared avatar rendering reuses the result in chats, groups and AUREVIA meeting attendees.

Dreambox exposes Create Agent, My Agents → Character Creator, and Edit Agent → Customize Appearance. AUREVIA links to the same creator and saved identities. The eight permanent companions remain locked in both UI and server mutation rules. Account changes clear private editor state; saving rechecks the authenticated owner around upload/save.

**Asset limitation:** the supplied ZIP contains three PNG concepts and no character mesh, textures, skeleton or animation assets. Current characters are functional code-authored geometry, visibly simpler than the supplied production-quality reference. Production likeness, authored outfits/hair, skin shading, skeletal rigs, animation, cloth and Sims-style movement/location interactions remain development work. Reference guide thumbnails are explicitly illustrative; no static portrait is represented as editable 3D. The generated room backdrop is stage decoration, not playable AUREVIA geometry. Physical iOS/Safari and live provider behavior are not established by local Chromium checks.

## Owner SQL

After previously required migrations through 16, run the **complete** scripts individually, in order:

1. `supabase/migrations/20261031000017_native_workspace.sql`
2. `supabase/migrations/20261031000018_agent_characters.sql`

Both are additive transaction-wrapped migrations, tested against a disposable local PostgreSQL instance with all migrations applied twice. They do not activate paid features or grant roles. Do not select isolated PL/pgSQL fragments such as `IF ... THEN`; execute each entire file, including its function definitions and transaction boundaries. No production execution was performed.

## Validation evidence

- TypeScript and production build passed; public output validation passed.
- 121 JavaScript tests passed, including project safety/ownership, payment confirmation, founder boundary, Core 8 mutation denial, character validation and appearance-only preservation.
- New SQL17/18 tests passed after applying the complete migration chain twice: owner CRUD/version conflict checks, cross-account/RLS isolation, financial-write denial, custom-only characters and conversation/knowledge preservation.
- Actual local Chromium renders are captured under `docs/previews/native-v1.0.15` and `docs/previews/character-campus-v1.0.15`; APIs/accounts/payment data are synthetic and labelled. These are internal evidence, not a request for another owner review.
- Native browser scenarios passed at desktop1440 and mobile320/390/430, including themes, projects, sandbox preview, export, wallet review and navigation. Character/campus scenarios are recorded by `_src/checks/browser_character_campus.py`; final results are included in the companion validation note.
- Hosted deployment, production Auth/R2/SQL setup and payment/provider execution require actual hosted verification; no fixture result is represented as live verification.
