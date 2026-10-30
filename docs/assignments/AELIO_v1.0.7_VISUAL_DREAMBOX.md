# CODEX — AELIO SITE-WIDE VISUAL UNIFICATION + DREAMBOX

## Project
AELIO — https://aelio.live

**Reference attachment:** `AELIO_Visual_Direction_References.zip`

This is a focused design-system update and a functional site-wide DreamBox integration. Work with the existing codebase, components, routes, authentication, agents, and features. Do not rebuild the application from scratch.

The attached images establish the approved visual direction. Treat them as design references rather than exact screenshots to reproduce.

## 1. AELIO's unified visual identity

AELIO should feel like a premium lifestyle and AI companion platform, not a generic futuristic technology dashboard.

Visual character:
- Clean influencer aesthetic with sophisticated editorial design.
- Premium, modern, inviting, approachable, and cinematic.
- Elegant serif headlines paired with clear sans-serif interface typography.
- Cream, soft white, champagne, copper, muted gold, midnight navy, and occasional sage or ocean-blue accents.
- Photorealistic environments with natural lighting, depth, and warmth.
- Subtle glass effects, soft shadows, refined cards, and restrained animations.
- Diverse and welcoming imagery featuring Black women and men, white people, Asian people, and other backgrounds. Some pages can feature architecture, scenery, or products without people.
- Avoid cartoonish graphics, repetitive glowing portals, overly technical imagery, or unnecessary holographic decorations.

**Do not make every page look identical. Create consistency through typography, spacing, navigation, buttons, interaction patterns, and visual quality.**

## 2. Apply across ALL pages and nested routes

Audit and update the full public-facing website, including:

- AELIO homepage
- Dream Beyond
- Dream Spaces and related pages
- Technology
- AELIO Native
- Green Guardians
- Create
- Agent Team
- Our Values
- Agent Campus
- AELIO Live
- All nested feature pages
- Other public marketing routes discovered in the repository

Also maintain consistency in the authenticated AELIO experience, including Explore, Home, Chats, Agents, Projects, and Settings, without disrupting their existing functionality.

Do not stop at the main landing pages. Nested pages must feel like part of the same brand.

## 3. Page-specific visual direction

**Homepage:** Preserve the cinematic HEY AELIO identity, midnight atmosphere, warm lighting, and signature AELIO orb.

**Explore / Home:** Follow the approved oceanfront lifestyle layout, elegant greeting, clear chat input, minimal sidebar, and inspiring content cards.

**Dream Beyond:** Aspirational, warm, spacious, and uplifting. Use beautiful architectural and scenic imagery rather than flat illustrated landscapes.

**Technology:** Darker, refined, sophisticated, and advanced. Use cinematic architecture and subtle technology visuals rather than overwhelming server tunnels.

**Green Guardians:** Botanical, sustainable, natural, and contemporary. Use realistic greenery and architecture. Move technical diagrams into supporting content where useful.

**Agent Team:** Follow the clean influencer-style group-chat example. Retain The UNCs demonstration, realistic conversation bubbles, personalities, and the ability to create group chats.

**Create:** Premium creative-studio atmosphere. Clearly communicate what users can make, with attractive visual examples and accessible tools.

**Agent Campus:** Bright, welcoming, community-focused, and aspirational. Use diverse photography and simple learning pathways.

Keep all real features and approved brand elements. Do not invent working capabilities based solely on the mockups.

## 4. AELIO DreamBox — persistent site-wide assistant

Build a shared, reusable **AELIO DreamBox** component that is accessible throughout the website, like a premium customer-support chat widget, but powered by AELIO.

### Floating access

- Display a small, elegant AELIO orb button fixed near the lower-right corner.
- It must be available on all appropriate public and authenticated pages.
- On click, open a compact DreamBox conversation panel.
- Allow users to minimize, expand, and close the panel.
- The underlying page must remain accessible.
- Never force navigation to the main Chat page or open another tab for ordinary questions.
- Ensure the widget does not obstruct buttons, forms, menus, or mobile navigation.

### Conversation

- Use the existing AELIO chat infrastructure and model integration.
- Support real streaming replies.
- Preserve the conversation when the widget is minimized or the user navigates between internal pages.
- Logged-in users should have appropriate persistent conversation history.
- Guest behavior must respect existing public-chat limits and authentication requirements.
- Provide voice input only when the existing voice infrastructure supports it.
- Do not create fake responses or nonfunctional controls.

### Agent switching

The DreamBox should allow the user to ask AELIO or choose an available agent.

- AELIO remains the permanent default Main Pal.
- Users can switch to their available agents without leaving the page.
- Respect existing agent identities, personalities, permissions, and subscriptions.
- Do not rename, replace, or delete permanent agents.
- Preserve agent-specific context and conversation identity.
- If an agent is unavailable, explain it naturally instead of showing technical errors.

### Page-aware assistance

DreamBox should understand which page the user is currently viewing and provide relevant help.

Example: On Green Guardians, it might offer:

- Explain this page
- Summarize the key ideas
- How does this work?
- Ask another agent

On Create, it might offer:

- Help me get started
- Explain these tools
- Help plan a project

On Agent Team, it might offer:

- Explain group chats
- Help me choose agents
- How do agents collaborate?

Use route metadata and available page content to provide grounded assistance. Do not imply access to private data, hidden content, or unavailable capabilities.

### Mobile behavior

- Compact floating orb by default.
- Expand into a responsive bottom sheet or appropriately sized panel.
- Respect safe areas and the mobile keyboard.
- Allow easy dismissal and return to the underlying page.
- Prevent scrolling, focus, overlay, and z-index bugs.
- Never trap the user inside the widget.

### Performance

- Load the DreamBox interface efficiently.
- Do not initiate AI requests merely because a page loaded.
- Avoid duplicate sessions, repeated requests, unnecessary token usage, or multiple floating widgets.
- Reuse existing authentication, chat, and agent services wherever possible.

## 5. Preserve the existing platform

Do not break or replace:

- AELIO and MILA identities
- Permanent agent portraits and personalities
- Dream Team and custom group chats
- Existing conversations and saved history
- Supabase authentication and shared PATHD identity
- Subscription and access controls
- Existing AI provider configuration
- Connected Apps and Groove Guide / VYBR8 integrations
- Existing functional Create, Campus, and other tools

Use nondestructive database changes only if necessary. Do not reset or overwrite user data.

## 6. Design and quality requirements

- Build reusable design tokens and shared components.
- Keep desktop, tablet, and mobile layouts visually consistent.
- Ensure readable text contrast and accessible controls.
- Support keyboard navigation and reduced-motion preferences.
- Avoid generic placeholder photography where approved assets exist.
- Use optimized image formats and lazy loading where appropriate.
- Ensure all buttons and links work.
- Avoid layout shifts and overlapping interface elements.
- Preserve light/dark theme behavior where supported.
- Do not introduce fake functionality simply to match a visual reference.

## 7. Testing and handoff

Run the existing build, type-check, lint, and relevant tests.

Verify:
- Every public route and nested route uses the unified design system.
- Existing navigation and links remain functional.
- DreamBox opens, minimizes, expands, and closes.
- DreamBox works across internal navigation.
- Agent switching respects permissions and conversation context.
- Mobile DreamBox does not obstruct the interface.
- Existing chat and authentication continue working.
- No production data or settings are unintentionally changed.

Provide a concise implementation summary identifying completed work, any limitations, and remaining tasks.

## 8. GitHub workflow — IMPORTANT

**Before you push these changes, show the GitHub preview in the secondary branch `migration`. Once I've reviewed the changes, I'll give approval to push to `main`.**

Work only in `migration` or an appropriate review branch based on it. Do not merge into `main`, deploy to production, or alter the live site without my explicit approval.

Do not ask for approval to begin implementation. Proceed with the work, then provide the review preview.

## Final design principle

**AELIO should feel like one beautifully designed world, not a collection of unrelated websites.**

Different pages may have different atmospheres, but every page must share the same premium, clean, inviting AELIO identity.

And DreamBox should make AELIO feel present throughout that world—ready to help without interrupting what the user is doing.
