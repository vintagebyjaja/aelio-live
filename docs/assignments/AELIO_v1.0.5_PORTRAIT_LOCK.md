# CODEX — AELIO OFFICIAL AGENT PORTRAITS, MILA & CUSTOM AGENT PROFILES

## PRIMARY OBJECTIVE

Finalize the permanent visual identities for AELIO's eight original AI companions, including MILA's newly approved portrait.

The eight permanent agents must have fixed, recognizable identities across the entire AELIO ecosystem.

Users may create additional agents with customizable names, personalities, and uploaded profile pictures, but the original eight agents must remain unchanged.

**IMPORTANT: This specification supersedes the previous instruction allowing users to replace permanent agents' profile pictures. Remove that capability.**

Preserve the existing AELIO design, chat functionality, themes, and permanent agent system.

---

## 1. OFFICIAL EIGHT PERMANENT COMPANIONS

| Agent | Chat subtitle | Identity |
|---|---|---|
| AELIO | Your Original Main Pal | Adaptive, intelligent, supportive AI companion |
| MILA | Your PATH | Career, life, ambition, and accountability |
| Naomi | Tech & Innovation | Smart, innovative, analytical, composed |
| Angelo | The Homie | Dominican, charismatic, funny, relaxed |
| Oliver | The Gentleman | British, refined, articulate, witty |
| Simone | Class & Confidence | Elegant, confident, charismatic |
| Chloe | Good Energy | Bubbly, playful, cheerful, encouraging |
| Reggie | Real Talk | Wise, humorous, grounded, straightforward |

All eight are permanent system agents.

Their official names, core personalities, and portraits are locked.

Users cannot rename, replace, delete, or visually modify these agents.

## 2. OFFICIAL PORTRAIT ASSETS

Use the attached approved images.

### Six Dream Team portraits

The supplied six-character image contains:

Top row, left to right:
- Naomi
- Angelo
- Oliver

Bottom row, left to right:
- Simone
- Chloe
- Reggie

Extract each character into an individual image asset.

Preserve the exact approved facial appearances, hairstyles, clothing, and cinematic visual quality.

Do not generate substitute portraits.

Do not use generic stock photography.

### MILA — new official portrait

Use the newly attached MILA business-casual image as her permanent official portrait.

MILA's appearance includes:

- Light, warm complexion
- Long honey-brown highlighted hair
- Elegant gold accessories
- Cream/beige tailored blazer and trousers
- Ivory fitted top
- Sophisticated, confident expression
- Cinematic amber lighting
- Upscale lounge or professional setting

The business-casual portrait is the official version.

Do not use the earlier flame-pattern outfit or casual cream two-piece as MILA's official image.

The earlier casual outfit may remain a separate reference for a user-selectable Homegirl-style custom agent template, without changing MILA's appearance.

### AELIO — original Main Pal

Preserve the approved AELIO metallic orb as its permanent official visual identity.

Do not replace the orb with a human portrait.

Retain the internal liquid-metal wave animation and existing interaction states.

## 3. PERMANENT IMAGE LOCK

Create a clear distinction between system agents and user-created agents.

For permanent system agents:

- Official images are immutable to ordinary users.
- No upload-image option.
- No replace-avatar option.
- No remove-avatar option.
- No per-chat picture override.
- No group-chat picture override that changes a permanent agent's identity.
- No renaming or identity replacement.

This applies everywhere, including individual chats, message bubbles, search results, agent cards, voice interfaces, and Dream Team.

Store the official portrait mapping in a protected system-agent configuration.

Use stable agent IDs rather than display names.

Do not allow users to overwrite global portrait assets through storage uploads, API calls, or database updates.

Any future official portrait replacement must require a deliberate founder-controlled application update.

## 4. CUSTOM AGENTS — USER PERSONALIZATION

Users can still create their own agents using the existing personality templates.

For example, a user can create a new agent inspired by Angelo's conversational style or Simone's confident style.

That new agent is independent of the official companion.

Users may:

- Give their custom agent a name.
- Select a personality template.
- Upload a profile picture.
- Crop or reposition the image.
- Replace the image later.
- Remove or reset the image.
- Assign a specialty or subtitle.
- Customize its chat theme.
- Start multiple conversations.
- Add the custom agent to user-created group chats.

The user-uploaded image belongs only to that custom agent and its owner.

Customizing an agent must never modify the official eight.

## 5. DREAM TEAM GROUP CHAT

Dream Team remains a permanent group conversation featuring:

- Naomi
- Angelo
- Oliver
- Simone
- Chloe
- Reggie

Each agent uses their locked official portrait.

Display the correct portrait beside each message.

Preserve the group's existing orchestration, direct mentions, conversation history, and streaming functionality.

The Dream Team's official group identity must remain consistent.

Users may create separate custom group chats with their own agents, but cannot replace the original Dream Team members or portraits.

## 6. MILA ACROSS AELIO AND PATHD

MILA must use the same official portrait on both platforms.

Display it consistently in:

- AELIO agent selection
- MILA's individual chat
- PATHD's MILA experience
- PATHD marketing previews
- Conversation lists
- Message avatars
- Appropriate voice and loading interfaces

Preserve MILA's established career, life, and accountability focus.

MILA's communication style can adapt to the user's selected conversational approach, including Homegirl, CEO, Auntie, Advisor, Teacher, and Mom, without changing her official name or portrait.

Keep the shared Supabase identity between AELIO and PATHD.

PATHD continues exposing only AELIO and MILA.

Do not introduce the other six Dream Team personalities into PATHD.

## 7. IMAGE PROCESSING AND DISPLAY

Optimize official portrait assets for performance.

Requirements:

- High-quality WebP or equivalent optimized format.
- Consistent facial framing.
- Responsive image dimensions.
- Circular and rounded-square avatar support.
- Appropriate object positioning.
- High-resolution source preservation.
- Graceful fallback if an asset fails to load.
- No distortion or stretching.
- Lazy loading where appropriate.

Use the original portrait assets rather than repeatedly generating new versions.

Keep the premium warm cinematic quality from the approved reference images.

## 8. DATABASE AND SECURITY

Ensure system agents and custom agents are clearly distinguished.

Suggested fields:

```ts
type AgentProfile = {
  id: string;
  name: string;
  subtitle: string;
  personalityId: string;
  isSystemAgent: boolean;
  officialAvatarUrl?: string;
  customAvatarUrl?: string;
  ownerId?: string;
};
```

Enforce authorization on the server and in the database.

For system agents, reject unauthorized avatar, name, or personality modifications.

For custom agents, allow authorized owners to edit their own settings and images.

Use non-destructive migrations.

Preserve existing conversations, user profiles, and chat histories.

## 9. USER EXPERIENCE

Do not expose technical implementation details to ordinary users.

Permanent agent profiles should simply appear as complete, polished companions.

Custom agents should display their available personalization controls.

Keep avatar management intuitive, responsive, and visually consistent with AELIO's design.

Do not show disabled image-upload buttons on permanent agents.

## 10. ACCEPTANCE TESTS

Verify that:

1. All eight permanent agents display their correct official identities.
2. Naomi, Angelo, Oliver, Simone, Chloe, and Reggie use their approved portraits.
3. MILA uses the new business-casual portrait.
4. AELIO retains its original metallic orb.
5. Permanent agent portraits cannot be modified by users.
6. Permanent agent identities cannot be deleted or renamed.
7. Dream Team displays the six correct portraits.
8. Custom agents can upload and replace their own images.
9. Customization does not affect permanent agents.
10. MILA's portrait remains consistent across AELIO and PATHD.
11. Existing conversations remain intact.
12. Desktop and mobile layouts display correctly.
13. Production builds and relevant tests pass.

## 11. GITHUB MIGRATION BRANCH REVIEW

**Before you push these changes, show the GitHub preview in the secondary branch `migration`. Once I've reviewed the changes, I'll give approval to push to `main`.**

Use the following workflow:

1. Implement the changes in the existing repository.
2. Prepare the changes for review on the `migration` branch.
3. Provide the GitHub diff and a working preview deployment if available.
4. Explain any required migrations or configuration changes.
5. Wait for my explicit approval.
6. Only after approval may changes be merged or pushed to `main`.

Do not automatically deploy to production.

Do not modify `main` without approval.

Apply this review process separately to AELIO and PATHD if both repositories require changes.

## FINAL REQUIREMENT

AELIO's eight original companions must have permanent, recognizable identities.

Their official names, personalities, and portraits are part of the AELIO brand and must not be user-editable.

Users are free to create additional personalized agents with their own names, pictures, and personalities.

**The original eight stay original. Custom agents belong to the user. Dream Team stays Dream Team.**