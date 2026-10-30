# AELIO — Premium Mobile Experience Redesign
## Codex Development Instructions

Redesign the existing AELIO experience using the attached reference image as the primary visual direction.

This is a visual and UX upgrade to the existing application, **not a rebuild from scratch**. Preserve the existing functionality, backend architecture, Supabase integration, user accounts, conversations, and agent system.

The goal is to transform AELIO into a sophisticated, cinematic, modern AI companion experience that feels like a combination of Apple-level simplicity, luxury lifestyle design, and futuristic artificial intelligence.

**IMPORTANT: The attached image is the approved design direction. Recreate its overall atmosphere, composition, hierarchy, colors, and user experience as closely as practical while making the interface fully responsive and functional.**

## 1. Overall Design Direction

AELIO should feel like entering a beautiful personal digital space rather than opening a traditional AI dashboard.

Use:
- Cinematic luxury environments with realistic imagery.
- Dark charcoal, deep navy, warm copper, and soft orange accents.
- Elegant typography with a balance of refined editorial headings and clean modern interface text.
- Soft glassmorphism and subtle transparency.
- Sophisticated gradients, lighting, and shadows.
- Minimal buttons and clean spacing.
- Smooth, polished microanimations.
- High-quality, responsive layouts.

Avoid:
- Excessive cards and dashboard widgets.
- Large solid-colored containers.
- Cluttered interfaces.
- Cartoon-like illustrations.
- Overwhelming neon effects.
- Unnecessary borders and oversized buttons.
- Repeated imagery or identical layouts on every screen.

The experience must look premium on mobile first, then scale naturally to tablets and desktop.

## 2. AELIO Home Screen

Follow the attached reference image.

### Header

Create a sleek, minimal header featuring:
- Hamburger navigation on the left.
- AELIO wordmark in its signature orange.
- Small "Never Say Never" brand motto.
- Subtle discovery/sparkle shortcut.
- AELIO orb or user profile control on the right.

Keep the header lightweight and integrated with the background rather than placing it inside a large opaque navigation bar.

### Welcome Section

Display a time-aware greeting:

Good Morning ☀️

Good Afternoon ☀️

Good Evening 🌅

Good Night 🌙

Below the greeting, display:

"What's on your mind?"

Use beautiful typography with generous spacing.

The greeting should update according to the user's local time.

### Cinematic Background

Use the reference image's luxury waterfront atmosphere as the primary visual inspiration.

Include:
- Modern luxury interiors or terraces.
- Beautiful ocean or waterfront views.
- Distant city lights.
- Atmospheric skies.
- Warm architectural lighting.
- Realistic reflections and subtle depth.

The background should feel immersive without interfering with text readability.

Use responsive image cropping, carefully controlled overlays, and optimized assets.

Do not use the same background for every screen.

## 3. Signature AELIO Orb

Make the AELIO orb a recognizable centerpiece of the experience.

Design:
- Metallic bronze/copper appearance.
- Soft internal illumination.
- Elegant glowing outer ring.
- Subtle idle animation.
- Smooth breathing or pulsing effects.
- Responsive visual changes during voice interaction.

States:
- Idle: gentle ambient glow.
- Listening: reactive light pulses.
- Thinking: subtle rotating or flowing illumination.
- Speaking: synchronized visual activity where supported.
- Error: restrained visual feedback.

The orb must remain sophisticated and never resemble a cartoon character.

Use lightweight animation techniques and respect reduced-motion accessibility settings.

## 4. Primary Chat Interface

The chat interface is the most important part of the home screen.

Create one elegant floating glassmorphic input bar below the orb.

Include:
- Plus button for attachments and additional actions.
- Text field displaying "Talk to AELIO..."
- Microphone button for voice input.
- Send button with a warm orange accent.

All controls should exist within one unified input component.

Remove the current disconnected text boxes, separate Continue button, and oversized microphone containers.

The user should be able to begin chatting immediately.

When a conversation begins, transition smoothly into the full chat experience while maintaining the selected AELIO theme.

Preserve conversation history, streaming responses, attachments, and all existing supported capabilities.

## 5. Quick Actions

Under the chat input, create a minimal horizontal row of pill-shaped shortcuts:

- Let's Talk
- Create
- Explore
- More

Each shortcut should have a subtle line icon.

These should open the appropriate existing AELIO experiences.

The current collection of large cards, including Random Thoughts, Conspiracies, Bible Verse, Affirmations, Inspiration, and other prompts, should be reorganized into relevant categories or a secondary discovery interface.

**Do not delete these features. Only simplify how users discover them.**

The shortcuts must be touch-friendly, horizontally scrollable when necessary, and fully functional on mobile.

## 6. Featured Discovery Banner

Below the quick actions, add a premium cinematic feature banner.

Example headline:

"Turn your ideas into reality."

Use beautiful atmospheric photography, subtle text overlays, and a small arrow action.

This can rotate through different AELIO capabilities such as:
- Creative projects.
- Personal growth.
- Business development.
- Travel and exploration.
- Everyday conversations.

Keep the banner elegant and visually restrained.

Avoid turning it into a crowded promotional carousel.

## 7. Recent Conversations

Add a compact Recent Chats section beneath the featured banner.

Display:
- Conversation title.
- Small contextual thumbnail or icon.
- Short message preview.
- Optional last activity indicator.
- View All shortcut.

Users must be able to reopen existing conversations directly.

Do not create fictional conversation history for signed-in users.

When there is no history, display a polished empty state.

For public visitors, preserve the existing limited guest-chat experience.

## 8. Bottom Navigation

Introduce a refined mobile bottom navigation bar.

Four destinations:

**Home | Agents | Discover | Settings**

Use subtle icons and clear active-state highlighting.

The active icon can glow softly in the selected theme's accent color.

Keep the navigation fixed or appropriately persistent without covering content.

Account for iPhone safe areas, browser UI, and mobile keyboard behavior.

### Agents

Preserve the permanent original AELIO Main Pal.

AELIO must always remain available and cannot be renamed or replaced.

AELIO is naturally adaptive, responding to the user's tone, mood, and conversation context without requiring a selected personality.

Other agents retain their own selectable personalities, specialties, names, and chat settings.

Preserve custom agents, group chats, and agent-specific appearance settings.

### Discover

Move the larger collection of conversation starters, suggestions, and exploration features into a beautifully organized Discover experience.

### Settings

Include account controls, personalization, themes, voice preferences, and existing settings.

## 9. Preserve the Four AELIO Themes

The application must continue supporting these four approved themes:

1. **OG Light:** Bright, elegant, airy, modern, and sophisticated.
2. **OG Dark:** The primary cinematic dark luxury experience shown in the attached reference.
3. **Ocean Fresh:** Clean ocean blues, soft cream, refreshing coastal atmosphere.
4. **Chocolate Cream:** Warm chocolate, soft cream, rich neutral tones, and elegant lighting.

All four themes must use the same underlying UX architecture.

However, each should feel visually distinctive through its background, lighting, accent colors, and atmosphere.

Theme changes should apply consistently across the home screen, navigation, chat interface, and shared components.

Individual agents may use their own theme or inherit the main AELIO theme.

Persist the user's selected theme using the existing preference system.

## 10. Mobile Responsiveness and Usability

Mobile usability is a top priority.

Ensure:
- No horizontal page overflow.
- No clipped buttons or text.
- No overlapping controls.
- Smooth scrolling.
- Correct keyboard handling.
- Functional menus and overlays.
- Proper touch targets.
- Consistent safe-area spacing.
- No trapped modal states.
- No layout jumps during chat streaming.
- Smooth transitions between home and conversation screens.

The design must work beautifully on iPhones and Android devices.

Desktop should feel like a premium expanded version of the same experience, not a stretched mobile screen.

## 11. Authentication and Supabase

Preserve the existing Supabase architecture.

AELIO and PATHD are intended to share the same Supabase identity system while maintaining separate paid subscriptions.

The current AELIO application displays this error:

"The secure session service needs configuration."

Investigate and fix the underlying configuration or code issue.

Check:
- Supabase URL and public key configuration.
- Client initialization.
- Server-side session handling.
- Authentication callback routes.
- Cookie and session persistence.
- Cloudflare environment variable configuration.
- Shared account authentication compatibility with PATHD.

Do not merely hide the error banner.

If a missing secret or external environment setting prevents a complete fix, document exactly what is needed without exposing secrets.

Do not claim authentication works unless it has been verified.

Do not introduce fictional member accounts or demo sessions as a substitute for working authentication.

Preserve the intended seamless, on-site signup and account experience.

## 12. Performance and Visual Quality

Use production-quality implementation.

Optimize:
- Background image loading.
- Mobile performance.
- Animation frame rates.
- Responsive image delivery.
- Component reuse.
- Accessibility.
- Page transitions.
- Layout stability.

Avoid unnecessary dependencies or heavy animation libraries when CSS and existing tools can achieve the same result.

Preserve existing functional APIs and backend integrations.

## 13. Deliverables and File Packaging

Work directly from the latest provided AELIO repository.

Implement the redesign rather than only providing recommendations or mockups.

Do not ask for approval before making the requested code changes.

Do not deploy, publish, push to GitHub, modify production services, or change live infrastructure.

I will handle all deployment and uploads myself.

Provide downloadable ZIP files named by version.

For every version, separate deliverables when applicable:

- GitHub/application code ZIP.
- Supabase SQL ZIP or SQL file, only if database changes are necessary.
- Configuration or setup instructions for any external changes.

Only include files needed for the update, unless a complete project package is required for a functional build.

If a GitHub upload package contains more than 100 files, divide it into clearly named Part 1, Part 2, Part 3 packages without missing or duplicating files.

Provide a concise changelog and clear deployment instructions.

Run available linting, type checks, and build verification. Report actual results and any remaining blockers.

## Final Design Standard

AELIO should feel like a luxury digital companion.

The user should open the application and immediately experience:

**Beauty. Calm. Intelligence. Personality. Possibility.**

The cinematic background creates the atmosphere.

The orb gives AELIO its identity.

The chat creates the connection.

The minimal navigation makes everything feel effortless.

Do not sacrifice the sophistication of the attached reference image by reverting to generic dashboard components.

**The attached mobile design is the visual target. Build the actual AELIO experience around it while preserving everything already developed.**
