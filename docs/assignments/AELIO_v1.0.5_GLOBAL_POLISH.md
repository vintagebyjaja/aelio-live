# CODEX — AELIO GLOBAL EXPERIENCE POLISH, SMART FALLBACKS & CONNECTED APPS

## PRIMARY OBJECTIVE

Remove all developer-facing, technical, unfinished-product, and infrastructure language from the public AELIO experience.

AELIO should always feel polished, premium, intelligent, modern, and welcoming.

Users should see what they can do, not what developers haven't configured.

Apply these changes across the ENTIRE AELIO website, including the marketing pages, chat, agents, account settings, connected apps, projects, onboarding, search, creation tools, and all interactive features.

**This is a global product experience requirement, not a single-page fix.**

Preserve the existing visual design, colors, typography, navigation, themes, and layouts.

---

## 1. REMOVE DEVELOPER LANGUAGE EVERYWHERE

Audit every page, component, modal, tooltip, notification, banner, loading state, and error message.

Remove public-facing language such as:

- Planned / Coming soon / Not implemented
- API access not configured
- Account linking not configured
- Permissions granted: none
- Website handoff only
- Runtime configuration missing
- Contact the site owner
- Service-role or environment-variable errors
- Supabase / OpenAI / Cloudflare configuration details
- Backend unavailable
- Feature flag disabled
- Integration pending
- Developer setup required

Do not simply replace these messages with generic errors.

Rewrite them into helpful, natural, AELIO-branded communication that reflects the actual feature state.

Technical details must remain available in secure internal logs and founder-only diagnostics, not in consumer-facing screens.

Do not suppress critical security, billing, privacy, consent, or account-access information. Users must still receive clear explanations when those matters affect them.

---

## 2. GLOBAL AELIO RESPONSE SYSTEM

Create a centralized status and messaging system used throughout the entire platform.

Every feature should have a consistent experience for:

- Ready
- Loading
- Processing
- Needs user action
- Temporarily unavailable
- Not currently offered
- Connection interrupted
- Authentication required
- Completed
- Failed

Avoid displaying internal technical state names to users.

Use natural language based on what the user is trying to accomplish.

### Examples

| Situation | User-facing message |
|---|---|
| Account service temporarily unavailable | "I'm having a little trouble opening your space. Let's try again." |
| Agent still initializing | "Getting your space ready…" |
| Conversation connection interrupted | "We lost our connection for a moment. Want to pick up where we left off?" |
| Feature unavailable | "I can't do that here right now, but here's what we can do." |
| Navigation tool not connected | "Let's open Groove Guide and get you moving." |
| Experience loading | "One moment, I'm getting everything ready." |

Avoid repetitive, robotic, apologetic messages.

AELIO should communicate naturally while remaining truthful about what is and isn't possible.

---

## 3. AELIO BRANDED LOADING EXPERIENCE

Create one reusable loading component for the entire AELIO platform.

### Visual direction

- Existing AELIO orb
- Elegant, subtle animation
- Smooth glow and breathing effect
- Existing dark and light theme compatibility
- Premium futuristic appearance
- No excessive spinning indicators
- No disruptive full-page flashes
- Smooth transitions between states

### Loading messages

Rotate appropriate messages such as:

"Getting your space ready…"

"One moment, I've got you."

"Connecting the pieces…"

"Almost there…"

Use contextual messages rather than random phrases.

### Behavior

- Show immediately when an actual operation begins.
- Avoid unnecessary artificial delays.
- Replace loading with real content as soon as it is ready.
- Provide a retry action when appropriate.
- Provide an exit or back option if an operation takes too long.
- Never leave the user trapped on an infinite loading screen.
- Respect reduced-motion accessibility preferences.

**Important:** Loading screens are only for real loading operations. Never disguise permanently unavailable functionality with an endless animation.

---

## 4. GROOVE GUIDE — CONNECTED EXPERIENCE

Current website:

https://grooveville.org/guide/

The current AELIO card exposes unnecessary technical information.

Replace it with a polished consumer-facing integration card.

### Display

**Groove Guide**

"Your personal travel and navigation companion."

Available actions:

- Plan a trip
- Explore destinations
- Open Groove Guide

Primary action: **Open Groove Guide**

Secondary action: **Plan a Trip**

Remove:

- Website handoff only
- API access not configured
- Account linking not configured
- Permissions granted: none
- No synchronization or private data access

### Functional requirements

The Open Groove Guide action must navigate to the correct live website.

AELIO should help users prepare travel requests conversationally.

Where supported, pass non-sensitive trip information through a documented, safe integration.

Do not claim automatic synchronization, access to saved routes, or account linking until those capabilities actually work.

If direct integration is unavailable, provide a useful conversational planning experience and an option to open Groove Guide.

---

## 5. VYBR8 — CONNECTED EXPERIENCE

Current website:

https://vybr8.live/

### Display

**VYBR8**

"Discover places, experiences, and moments that match your vibe."

Available actions:

- Explore food and drinks
- Discover experiences
- Open VYBR8

Primary action: **Explore VYBR8**

Remove all developer-facing configuration details.

AELIO should be able to discuss dining preferences, activities, and experience ideas naturally.

When a verified integration is available, use it.

Otherwise, direct users to VYBR8 without implying that private account data is connected.

Do not fabricate restaurant availability, reservations, prices, or live venue information.

---

## 6. CONNECTED APPS PAGE REDESIGN — CONTENT ONLY

Keep the existing AELIO visual design but simplify the information hierarchy.

Each connected-app card should contain:

1. App icon
2. App name
3. Short, inviting description
4. Two or three useful capabilities
5. One clear primary action
6. Optional secondary action

Remove infrastructure explanations, configuration notes, and permission-debugging text.

Do not expose internal connection architecture.

If an account connection is actually supported, provide a clear Connect Account action and explain what information will be shared before authorization.

If it is not supported, do not display a fake connection button.

The page should feel like an ecosystem of useful experiences rather than an integration-status dashboard.

---

## 7. APPLY THE SAME STANDARD TO EVERY FEATURE

Audit and update:

- Main Pal AELIO
- Custom agents
- Group chats
- Agent creation
- Discover
- Projects
- Connected Apps
- Settings
- Account and profile
- Chat history
- Search
- Voice features
- Uploads
- Creator tools
- Onboarding
- Subscription and wallet screens
- Marketing pages
- Mobile navigation
- Desktop navigation
- All empty and error states

### When a feature is available

Let the user use it immediately.

### When a feature requires authentication

Explain naturally and offer Sign In or Create Account.

### When a feature is loading

Show the AELIO loading experience.

### When a feature is temporarily unavailable

Provide a clear explanation and a working retry or alternative action.

### When a feature is not currently supported

Do not advertise it as functional. Offer an existing alternative or omit the action entirely.

Never pretend an unavailable feature is working.

---

## 8. AELIO'S PERSONALITY MUST EXTEND BEYOND CHAT

AELIO is more than an AI conversation window.

Its personality should be reflected in the entire product.

Examples:

Instead of "No agents found":

"Your team starts here. Create an agent whenever you're ready."

Instead of "No conversations":

"What's on your mind today?"

Instead of "Integration unavailable":

"I can help you get started here, or we can open the experience directly."

Instead of "Profile service failed":

"I'm having trouble opening your profile right now. Let's try again."

Keep messages concise, sophisticated, and conversational.

Do not overuse slang, jokes, or overly familiar language.

AELIO should remain adaptable to different users.

---

## 9. GLOBAL ERROR HANDLING AND RECOVERY

Create reusable error boundaries and fallback components.

Requirements:

- Prevent individual feature errors from crashing the entire application.
- Preserve unsent messages and form input.
- Allow users to retry failed operations.
- Keep navigation accessible during errors.
- Provide clear offline and reconnecting states.
- Avoid infinite retry loops.
- Use appropriate timeout handling.
- Never show stack traces or raw API responses to consumers.
- Preserve diagnostic information in secure logs.
- Do not silently swallow errors.
- Do not show a success state when an operation failed.

Authentication and account failures must be fixed at their source, not hidden behind branded messages.

---

## 10. SECURITY AND PRIVACY

Maintain transparent user consent.

Do not conceal material information about:

- Account connections
- Personal-data access
- Payment authorization
- Subscription charges
- Privacy permissions
- Security warnings
- Failed transactions

Remove unnecessary developer terminology, but preserve information users genuinely need to make informed decisions.

Never automatically link external accounts without consent.

Never imply access to external services that AELIO does not possess.

---

## 11. PERFORMANCE

Keep AELIO fast and responsive.

- Avoid unnecessary loading screens.
- Use skeleton states for lightweight content loading.
- Use the animated orb for meaningful operations.
- Avoid unnecessary network requests.
- Stream AI responses immediately.
- Keep interactions responsive on mobile.
- Prevent layout shifts.
- Avoid blocking the entire page for a single failed feature.

The loading experience should feel smooth, not slow.

---

## 12. TESTING

Test the entire website, including mobile and desktop.

Verify:

- No developer-facing configuration language remains in consumer screens.
- Every visible action works.
- All external links open correctly.
- Loading states terminate.
- Retry buttons perform real retries.
- Error states are understandable.
- Authentication failures are not disguised as success.
- Connected-app descriptions accurately reflect available capabilities.
- User inputs survive recoverable failures.
- The original design remains consistent.

Perform a repository-wide search for hardcoded technical error messages and unfinished-feature labels.

Review all replacements for accuracy.

---

## 13. DELIVERY REQUIREMENTS

Work within the existing AELIO GitHub repository.

Do not redesign the website.

Do not modify unrelated backend architecture unless necessary to fix broken functionality.

Do not delete working features.

Do not automatically deploy or push changes unless explicitly instructed.

Provide changed files, test results, and any necessary deployment instructions.

If a feature cannot be completed, document the limitation privately in the development summary rather than presenting it as a functioning consumer feature.

## FINAL PRODUCT STANDARD

AELIO should feel like a complete, premium digital companion.

The user should experience:

**Ask → Understand → Act → Complete**

Not:

**Ask → Configuration Error → Contact Developer**

Every screen should be inviting, every action should be meaningful, and every limitation should be handled gracefully, honestly, and intelligently.

AELIO is a consumer experience, not a developer console.