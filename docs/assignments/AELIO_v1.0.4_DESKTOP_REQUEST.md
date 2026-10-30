# AELIO — Cinematic Desktop Experience & Grooveville Ecosystem Integration

## CODEX IMPLEMENTATION INSTRUCTIONS

Upgrade the existing AELIO application with the approved cinematic desktop design and integrate Groove Guide and VYBR8 into the AELIO experience.

**Visual reference:** Use the attached approved desktop/mobile mockup as the primary design target.

**Connected platforms:**
- AELIO: https://aelio.live
- Groove Guide: https://grooveville.org/guide/
- VYBR8: https://vybr8.live/
- PATHD: https://mypathd.com

This is an enhancement of the current application. Do not rebuild it unnecessarily, delete existing features, or replace functional systems with demonstrations.

Implement the changes without asking for intermediate approval.

Do not deploy, publish, push code, or modify production databases.

---

## 1. CINEMATIC DESKTOP DESIGN

Recreate the desktop experience shown in the attached mockup.

The interface should feel like a luxury AI environment rather than a traditional software dashboard.

### Desktop layout

**Left navigation sidebar**

Use a refined, collapsible, dark translucent sidebar containing:

- AELIO logo and Never Say Never motto
- Home
- Chats
- Agents
- Discover
- Create
- Projects
- Connected Apps
- Settings

Show recent conversations below the main navigation.

Use compact icons, elegant typography, subtle hover effects, and warm accent lighting.

Allow the sidebar to collapse into a narrow icon rail.

**Main environment**

Use a cinematic full-screen background inspired by the approved waterfront luxury lounge.

Include atmospheric lighting, architectural depth, realistic imagery, and soft overlays.

Display:

"Your Space. Your Energy."

"Good Evening 🌙"

"What's on your mind today?"

The greeting should change with local time.

**Signature AELIO orb**

Position the glowing metallic orb prominently in the main experience.

Support idle, listening, thinking, and speaking visual states.

Keep animations subtle and performant.

**Primary chat**

Place a unified floating input beneath the orb.

Include:
- Attachments
- Text input
- Microphone
- Send
- Relevant contextual tools

Chat must be functional and connected to the existing AELIO conversation system.

**Quick actions**

Display:

Let's Talk | Create | Explore | More

Keep these elegant and compact.

**Discovery cards**

Use a restrained horizontal collection of cinematic cards for creativity, personal growth, travel, and other experiences.

These must connect to actual features.

Do not create decorative buttons with no functionality.

### Responsive behavior

Desktop, tablet, and mobile must share the same design identity but use layouts optimized for their screen sizes.

Desktop should not be a stretched mobile layout.

Preserve all four approved themes:
- OG Light
- OG Dark
- Ocean Fresh
- Chocolate Cream

---

## 2. AELIO CONNECT — ECOSYSTEM FOUNDATION

Build an extensible Connected Apps system inside AELIO.

Its purpose is to allow AELIO to work with external applications and the user's existing accounts through secure, permission-based integrations.

The first integrations are:

**Groove Guide and VYBR8.**

PATHD remains a separately integrated ecosystem product with its existing shared-identity requirements.

Future Grooveville products should be connectable through the same architecture.

### Connected Apps settings

Create a beautiful management screen showing:

- Application name and logo
- Connection status
- Available capabilities
- Account linking controls
- Granted permissions
- Disconnect action
- Last synchronization or activity, when available

Use states such as:

Available | Connect | Connected | Reconnect Required

Do not show Connected unless a valid connection has been verified.

### Account linking

Users should be able to connect existing platform accounts without unnecessarily creating new accounts.

Preserve each application's existing identity and user data.

Use secure OAuth/OIDC authorization or an appropriate server-mediated account-linking protocol when supported.

Do not assume the applications share a Supabase project.

Never match accounts based only on identical email addresses.

Never copy passwords, authentication cookies, or long-lived tokens into the frontend.

Store credentials securely on the server with encryption, appropriate access controls, and token rotation where supported.

Provide explicit user consent and granular permission management.

---

## 3. GROOVE GUIDE INTEGRATION

**Platform:** https://grooveville.org/guide/

Groove Guide is the Grooveville travel and navigation experience.

AELIO should act as a conversational entry point to Groove Guide.

### User experience

Examples:

"Hey AELIO, plan my drive to Baltimore."

"How's the weather along my route?"

"Find somewhere to eat on my way."

"Show me the best route to my destination."

"Open my trip in Groove Guide."

### Capabilities

Where supported by the existing Groove Guide implementation, connect:

- Destination search
- Route planning
- Driving and walking directions
- Estimated travel duration
- Traffic-aware routing
- Weather along the route
- Saved destinations
- Route preferences
- Voice-guided travel experiences

Use existing Google Routes, Places, Weather, and Timezone integrations where they are already implemented and authorized.

Do not invent travel times, traffic information, or weather.

### AELIO interface

Create a compact travel result inside AELIO with:

- Origin and destination
- Travel mode
- Route summary
- Estimated duration when available
- Weather information when available
- Open in Groove Guide action

AELIO should explain a route conversationally and let the user continue in Groove Guide.

### Integration implementation

Inspect the available Groove Guide repository, APIs, and authentication architecture before choosing an integration method.

Prefer a secure documented API when available.

If an API is unavailable, implement a properly encoded deep-link handoff to Groove Guide using supported parameters.

Do not invent endpoint URLs or assume query parameters are supported.

Preserve the standalone Groove Guide experience.

---

## 4. VYBR8 INTEGRATION

**Platform:** https://vybr8.live/

VYBR8 is the Grooveville ecosystem's food, drink, lifestyle, and social discovery platform.

AELIO should help users discover experiences through natural conversation.

### Example requests

"Hey AELIO, what should I eat tonight?"

"Find somewhere for date night."

"Help me plan a night out with my friends."

"Show me some good food nearby."

"I'm craving something sweet."

"Find a place everybody in my group would enjoy."

### Discovery capabilities

Connect to supported VYBR8 experiences, including:

- Eat
- Drink
- Find My Vybe
- CraveZone
- Restaurants and lounges
- Chefs and food trucks
- Groups & Family
- Social recommendations
- Relevant creator content

Preserve VYBR8's existing data, filters, and discovery logic.

### AELIO results

Where structured VYBR8 data is available, show compact, beautiful result cards containing:

- Venue or experience name
- Image
- Category
- Location
- Relevant recommendation context
- Open in VYBR8 action

Only display ratings, hours, pricing, or availability when the underlying source provides reliable values.

### Cross-platform handoff

A user should be able to start discovery inside AELIO and continue the experience in VYBR8.

For example:

User: "Find a good date-night restaurant."

AELIO: Returns relevant VYBR8 discovery results.

User: "Show me how to get there."

AELIO: Offers to transfer the selected destination into Groove Guide.

This creates a connected experience between AELIO, VYBR8, and Groove Guide.

### Privacy

Do not automatically expose VYBR8 private posts, account details, friend activity, group membership, or personal preferences to AELIO.

Require explicit account linking and appropriate permission scopes.

---

## 5. CROSS-APP INTELLIGENCE

AELIO should recognize when a user's request would benefit from an integrated application.

Create an extensible tool-routing layer.

Example:

**User:** "Help me plan a night out."

AELIO can:
1. Ask about the desired experience.
2. Search supported VYBR8 discovery data.
3. Present relevant options.
4. Let the user choose a destination.
5. Send the destination to Groove Guide for directions.
6. Return to the conversation without losing context.

Use structured tool calls rather than relying on keyword matching alone.

Maintain a clear distinction between:

- Information retrieved from an application
- Actions that AELIO can perform
- Actions requiring user confirmation
- Features that are not yet available

Do not claim a reservation, purchase, invitation, or account change was completed without confirmation from the relevant service.

---

## 6. DESKTOP FEATURE EXPERIENCES

The cinematic home screen should remain simple.

More complex functionality should open in dedicated, well-designed workspaces.

### Chats

A distraction-free conversational workspace with conversation history, attachments, voice capabilities, and agent switching.

### Agents

A dedicated agent library.

The original AELIO Main Pal remains permanently available and cannot be renamed.

Custom agents retain their own names, personalities, specialties, and appearance settings.

### Discover

A curated environment for conversation starters, lifestyle discovery, learning, creativity, and connected experiences.

### Create

A creative workspace connecting to existing AELIO creation capabilities.

Do not fabricate creative-generation capabilities that the backend does not support.

### Projects

A workspace for organizing existing user projects, generated outputs, and relevant conversations.

Reuse existing storage and project systems where available.

### Connected Apps

The central place for Groove Guide, VYBR8, PATHD, and future ecosystem connections.

Each workspace should preserve the approved cinematic luxury aesthetic without forcing the same large background image onto every page.

---

## 7. CONTEXTUAL ACTIONS

Allow relevant connected actions to appear naturally within chat.

For example:

When discussing travel:
- Plan Route
- Open Groove Guide

When discussing food:
- Explore on VYBR8
- Find My Vybe

When discussing career or personal accountability:
- Talk to MILA
- Go to Your PATH

Do not clutter the home screen with permanent buttons for every integration.

Surface actions only when relevant.

---

## 8. AUTHENTICATION AND ACCOUNT CONTINUITY

Preserve AELIO's existing Supabase architecture.

AELIO and PATHD are intended to share account identity, with separate paid subscriptions.

Groove Guide and VYBR8 may have different authentication infrastructure.

Inspect the actual implementations rather than assuming shared identity across all products.

Do not merge databases or authentication systems merely to create integrations.

AELIO currently has an unresolved secure-session configuration issue.

Investigate and fix the root cause.

Check Cloudflare environment configuration, Supabase initialization, session handling, authentication routes, and client/server environment variable usage.

Do not hide the error or silently fall back to fictional demo accounts.

Report external configuration steps when they cannot be completed from the repository.

---

## 9. DEVELOPMENT AND TESTING

Preserve the existing AELIO application and all functional features.

Implement reusable components and maintainable integration interfaces.

Test:

- Desktop and mobile layouts
- Navigation
- Chat and agent switching
- Theme persistence
- Authentication
- Connected Apps states
- Consent and account linking
- API authorization
- Error handling
- Cross-app navigation
- Browser back navigation
- Mobile keyboard behavior
- Loading and empty states

Where an integration requires unavailable external code, credentials, API documentation, or platform changes, implement only the verifiable portions and document the blocker.

Do not manufacture successful test results or fake live integration data.

---

## 10. VERSIONED DELIVERABLES

Use the latest AELIO repository.

Do not deploy, publish, push to GitHub, or make production changes.

Return downloadable versioned ZIP files.

Separate application changes, SQL migrations, and configuration instructions when applicable.

Only include necessary changed files unless a complete project is needed.

Split packages exceeding 100 files into clearly labeled parts.

Include:

- Version number
- Changelog
- Changed file list
- Test results
- Deployment instructions
- Required environment variables
- Integration status for each connected platform
- Outstanding blockers

Distinguish between fully working integrations, partial integrations, and external handoffs.

Do not describe a deep link as a complete API integration.

## FINAL EXPECTATION

AELIO should become the intelligent personal gateway to the Grooveville ecosystem.

Users should be able to talk naturally, discover experiences, plan travel, work with their agents, and access connected applications without feeling like they are navigating unrelated websites.

The experience should remain cinematic, modern, elegant, personal, and intuitive.

**AELIO is the companion. Groove Guide handles the journey. VYBR8 helps users discover the experience.**

Build the desktop experience to match the approved graphic while preserving the mobile design and preparing the architecture for future ecosystem integrations.