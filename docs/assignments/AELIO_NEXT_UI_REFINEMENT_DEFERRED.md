# AELIO — Premium UI Refinement & Resizable Workspace Update

**Website:** https://aelio.live/chat/#home

## Primary Objective

Refine the existing AELIO interface to make it more polished, interactive, responsive, and customizable while preserving the current visual identity.

**IMPORTANT: Do not redesign or replace the existing interface.** The current Mediterranean-inspired cinematic homepage, cream-colored sidebar, sophisticated typography, teal accents, companion portraits, and overall layout are approved.

This update focuses on usability, visual polish, smoother interactions, and flexible workspace controls.

## 1. Resizable, Expandable & Collapsible Sidebar

Implement a fully interactive sidebar that users can resize horizontally.

**Desktop behavior:**
- Users can click and drag the sidebar's right edge to expand or shrink its width.
- Minimum expanded width: approximately 220px.
- Maximum width: approximately 420px.
- Default width: approximately 250px.
- Add a subtle draggable divider with a visual hover indicator.
- Double-click the divider to restore the default width.
- Add a collapse/expand button that allows the sidebar to become a compact icon-only navigation rail, approximately 64–72px wide.
- In compact mode, show navigation icons and companion avatars with tooltips.
- Clicking a companion avatar must still open the correct conversation.
- Animate collapse and expansion smoothly, without excessive motion.
- The main content area must automatically resize without overlapping or clipping.
- Preserve the user's sidebar width and collapsed state between sessions using appropriate local preferences.

**Mobile behavior:**
- Sidebar becomes an off-canvas navigation drawer.
- Open using the menu button and close using the close button, backdrop tap, or swipe gesture.
- Prevent the drawer from blocking interactions after dismissal.
- Keep scrolling smooth and independent.
- Avoid accidental horizontal page scrolling.
- Ensure all companions and group chats remain accessible.

**Accessibility:**
- Provide keyboard-operable resizing controls.
- Support visible focus states and screen readers.
- Respect reduced-motion settings.

## 2. Sidebar Visual Cleanup

Maintain the warm cream color palette and existing companion portraits.

Improve the following:
- Increase spacing between companion cards slightly.
- Reduce unnecessary border thickness.
- Use subtle hover and selected states.
- Keep companion avatars circular and consistently sized.
- Maintain the existing names, personality subtitles, and companion order.
- Visually distinguish the currently active companion.
- Make section headings more refined and consistent.
- Avoid duplicate search interfaces where they serve the same purpose.
- Preserve both global search and conversation search only if their functions are meaningfully different, and label them clearly.

The sidebar should feel like a premium navigation experience, not a crowded settings panel.

## 3. Improve AELIO's Floating Orb

Preserve the existing bronze/copper AELIO orb and its identity.

Add subtle, premium animation states:

**Idle:** Gentle floating movement and soft reflections.

**Listening:** A restrained pulsing glow that responds to actual microphone input.

**Thinking:** Slow, elegant changes in the orb's surface illumination.

**Speaking:** Subtle movement synchronized with real audio playback when available.

Requirements:
- Do not use exaggerated bouncing or cartoon animations.
- Do not replace the orb with a character or human avatar.
- Keep animations GPU-friendly and optimized.
- Provide a static fallback for reduced-motion preferences.
- Never show fake listening, speaking, or processing states when the corresponding system action is not occurring.

AELIO should feel present, intelligent, and alive.

## 4. Refine the Chat Input

The main chat composer should feel modern, simple, and effortless.

- Remove the unnecessary up/down browser-style controls currently appearing inside the composer.
- Investigate and fix the underlying input styling or element behavior causing them.
- Maintain the rounded, translucent design.
- Properly align attachment, microphone, text, and send controls.
- Support multiline messages with automatic height expansion.
- Press Enter to send; Shift + Enter for a new line on desktop.
- Disable sending empty messages.
- Show appropriate loading and processing states.
- Ensure attachments, microphone controls, and message sending remain functional.
- Keep the composer accessible and responsive on smaller screens.
- Support safe-area spacing on mobile devices.

Do not introduce decorative buttons that do not perform real actions.

## 5. Homepage Visual Hierarchy

Preserve the approved cinematic background photography and the elegant "Good Afternoon" greeting.

Refine spacing so the homepage feels more balanced.

**Priority order:**
1. Personalized greeting.
2. AELIO orb.
3. Main chat composer.
4. Quick actions.
5. Inspiration and discovery cards.

Adjust spacing, sizing, and contrast without replacing the existing design.

The background should remain visible and immersive, but foreground content must always be readable.

Do not remove the existing lifestyle imagery, cards, or cinematic atmosphere.

## 6. Conversation Experience

Ensure the transition from the homepage to an active conversation feels seamless.

- Preserve the selected AELIO theme throughout the experience.
- Keep the current background or use a complementary treatment rather than abruptly switching to an unrelated design.
- Make conversation messages readable using tasteful translucent or solid surfaces as appropriate.
- Keep the message composer accessible.
- Allow users to switch companions without losing their existing conversation history.
- Maintain individual companion identities, portraits, and personality behavior.
- Preserve group chats, including Dream Team.
- Ensure conversations are properly isolated and saved for authenticated users.
- Provide clear active conversation indicators.

AELIO must remain the permanent original Main Pal. Other companions must not replace or rename AELIO.

## 7. Responsive Desktop, Tablet & Mobile Layouts

Optimize the entire interface across screen sizes.

**Desktop:** Spacious cinematic layout, draggable sidebar, balanced content.

**Tablet:** Flexible sidebar with compact navigation options and properly scaled content.

**Mobile:** Clean single-column experience with an accessible navigation drawer, touch-friendly buttons, and no overlapping interface elements.

Avoid:
- Text overflowing containers.
- Navigation panels getting stuck.
- Horizontal scrolling caused by layout errors.
- Buttons appearing behind overlays.
- Cards overlapping the composer.
- Menus that cannot be dismissed.
- Unexpected page jumps during transitions.

## 8. Interaction & Performance Polish

- Add subtle hover and focus feedback.
- Use smooth, restrained transitions.
- Avoid excessive blur effects that reduce performance.
- Prevent layout shifts when opening navigation.
- Maintain scroll position where appropriate.
- Optimize imagery without noticeably reducing visual quality.
- Ensure the page remains responsive while AI responses are streaming.
- Respect accessibility and reduced-motion preferences.

## 9. Preserve Existing AELIO Features & Integrations

Do not remove, rename, or break existing functional systems.

Preserve:
- AELIO Main Pal.
- MILA and her PATHD connection.
- All existing companion agents and personalities.
- Dream Team group chat.
- Chat history and saved threads.
- Discover, Create, Projects, and Connected Apps.
- Existing themes and personalization.
- Existing authentication and Supabase integration.
- Groove Guide and VYBR8 integrations wherever already configured.
- Existing routes and navigation.
- Current brand colors, typography, photography, and overall identity.

This is a front-end experience improvement, not a backend migration.

## 10. Implementation & Delivery

Work directly from the latest existing AELIO codebase.

- Inspect the current component structure before editing.
- Reuse existing components and design tokens wherever possible.
- Make targeted changes instead of rebuilding unrelated pages.
- Do not introduce unnecessary dependencies.
- Preserve all existing working features.
- Verify TypeScript, linting, and production build where supported.
- Test sidebar resizing, collapse/expand, navigation, chat composer, and mobile drawer behavior.
- Verify desktop, tablet, and mobile layouts.
- Report any existing issues that could not be resolved.
- Provide a concise summary of changed files and functionality.

**Deployment:** Do not deploy, push, or modify production unless explicitly instructed. Prepare the changes for review using the existing project delivery workflow.

## Final Design Standard

AELIO should feel like a combination of:

- Apple's clean and intuitive interface design.
- A luxury lifestyle digital environment.
- A futuristic, emotionally intelligent AI companion.
- A customizable personal workspace.

The experience should feel sophisticated, effortless, immersive, and genuinely enjoyable to use.

**Keep what makes the current design beautiful. Improve how it works. Do not start over.**