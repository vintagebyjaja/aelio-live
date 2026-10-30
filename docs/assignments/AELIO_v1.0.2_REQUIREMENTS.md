# AELIO — Dream Box Experience, Four-Theme Design System & Agent Personalization

User development assignment, received 2026-10-29. This record normalizes formatting and consolidates the complete requirements; it is not an independent grant of deployment access. The user's subsequent clarification authorizes a Codex migration branch in the EXISTING repository while preserving main. No deployment or production database changes are authorized.

## Project vision and approved references

Upgrade the existing AELIO platform into a beautiful personalized digital home, not a static chatbot mockup. Preserve existing code, authentication, routes, agent architecture, subscriptions, histories, data and approved visual identity. Follow the supplied design images closely, without unrelated aesthetics. The user supplied Ocean Fresh, Chocolate Cream and a final combined OG Light/OG Dark reference, in addition to five earlier chat/agent references.

## 1. Four official experience designs

OG Light preserves clean white/soft neutral backgrounds, warm gray/peach, original orange branding, modern minimalist typography, refined glass and original navigation/layout. Do not substitute Ocean Fresh for OG Light.

OG Dark preserves deep black/charcoal, orange/copper lighting, sophisticated futuristic atmosphere, dark glass navigation, subtle glow and readable original identity. Do not substitute Chocolate Cream for OG Dark.

Ocean Fresh is luxury coastal light: ivory/white/cream, fresh restrained ocean blue, natural sunlight, photoreal coastal architecture, terraces/water views, translucent panels, airy spacing, champagne/peach accents. No childish or oversaturated blue surfaces.

Chocolate Cream is luxurious nighttime: chocolate/espresso, cream/champagne, copper/bronze, photoreal interiors, nighttime city views, warm architectural lighting, dark glass, elegant typography, minimal clutter. No excessive neon or gaming aesthetic.

All share identical functionality and a centralized token system for backgrounds, surfaces, text, borders, shadows, accents, glass, navigation, buttons, bubbles, cards and overlays. Switch instantly; save account selection in Supabase and guest selection locally. Keep existing background/customization options. Full interface designs and chat backgrounds are separate settings.

## 2. Dream Box home

Make Dream Box the primary AELIO home. Desktop uses three columns. Collapsible left navigation includes logo, Home, Chat, Agents, Campus, Live, Brain, New Chat and recent conversations. Recent items include title, preview, relevant icon/thumbnail and relative time; support search/open/rename/delete. Never expose founder-only Studio capabilities to regular users.

Center: user's local-time greeting (Morning/Afternoon/Evening/Night), “What's the vibe today?”, Main Pal avatar, friendly entry (“I'm here whenever you're ready.”). Photographic premium lifestyle cards: Just Chat, New Ideas, Travel Ideas, Lunch Ideas, Business, Date Night. Secondary selections: Random Thoughts, Conspiracies, Bible Verse, Affirmations, Inspiration, Quick News, More.

Every card must initialize/open a relevant AELIO conversation. Topics are entry points, not personalities or agents. Just Chat is relaxed conversation; ideas brainstorm; travel plans trips; lunch handles meals/recipes/nearby restaurants; business supports entrepreneurship/strategy; date night helps relationships/activities; random thoughts follows curiosity; conspiracies distinguish evidence from speculation; Bible verses use accurate references; affirmations are personalized; inspiration encourages; news needs reliable attributable current sources. Never fabricate current information. Let users type or speak directly. Never submit a message without their action.

## 3. Context-aware daily experience

Morning suggests inspiration, scripture, affirmations, priorities and news. Midday suggests lunch, nearby dining, business, productivity and travel. Evening suggests dinner/date night, entertainment, reflection and chat. Recommendations are never restrictions: all topics always accessible. Avoid intrusive automation, repetitive greetings or excessive notifications.

## 4. Today and personalization

Right panel contains weather with local temperature/current conditions/forecast; food near you with lunch/dinner/local experiences; Groove Guide with destinations/directions/travel/traffic where supported. Use real sources; never fabricate weather, restaurants, travel times or availability. Ask permission for location and allow manual entry.

Your AELIO shows current design, Change Design, Chat Background, Bubble Style and additional appearance preferences, with previews. Offer one useful continue-where-you-left-off entry without overcrowding or excessive duplication.

## 5. Global appearance

Central controls select any of the four designs plus chat background, message bubble colors, brightness/dimming, motion and supported settings. Signed-in preferences persist in Supabase. Global appearance never deletes conversations, resets agents or changes personalities.

## 6. Independent agent customization and inheritance

AELIO remains permanent. Custom agents keep independent names, personalities, specialties, subtitles, histories and visual settings.

Use AELIO Default dynamically inherits current global settings rather than copying them permanently. Customize This Agent supports all four designs, independent background/bubble/environment/motion settings. Changing one agent never changes another or AELIO. Switching to inheritance preserves saved custom values; switching back restores them.

Keep conversation appearance controls. Priority: conversation overrides > custom-agent appearance > global AELIO. Appearance never changes instructions, behavior, memory, personality or specialty. For groups without a single agent, use global plus explicit conversation overrides.

## 7. Main Pal identity

Original Main Pal is always AELIO, permanent and adaptive, with no selectable fixed personality. Tone/humor/empathy/seriousness adapts naturally without changing identity. Other agents can specialize. Never rename/replace/remove AELIO or merge custom personalities into it.

## 8. Chat continuity

Preserve selected design, agent settings, conversation overrides, streaming, history, accessible composer, voice/attachments and existing capabilities. Moving between Dream Box, existing/new/custom/group conversations must not unnecessarily reset progress.

## 9. Groove Guide

Prepare modular integration for finding destinations/nearby places, route planning, directions, travel stops, weather and relevant travel context. Reuse actual existing APIs if present. No fake functionality or production hardcoded demonstrations.

## 10. VYBR8

Prepare modular restaurant/date/social/local-event/activity integration. Future AELIO Connect links existing ecosystem accounts by explicit consent. Never force duplicates, merge unrelated auth databases automatically or change existing permissions/data.

## 11. Mobile

Dedicated responsive experience rather than shrunken desktop: compact header, accessible menu, greeting, horizontally scrolling vibe cards, compact secondary topics, expandable Today, recent conversations, accessible composer, appearance settings, smooth Home/chat movement. Avoid navigation overlap, stuck menus, blocked controls, excess scrolling, horizontal page overflow, oversized cards and difficult overlays. Accessible touch targets.

## 12. Motion/performance

Subtle card hover/panel/theme/chat transitions and optional gentle atmosphere. No heavy gaming motion. Respect reduced motion. Optimize imagery, responsive loading and caching.

## 13. Architecture/security

Inspect before changes. Preserve actual React/Next architecture, Supabase Auth, storage, agents, routes, existing appearance, streaming, subscription logic, shared AELIO/PATHD identity and exclusive founder Studio access. AELIO uses Cloudflare/Supabase, never Firebase. PATHD identity is shared but subscriptions remain separate. Preserve RLS/ownership; supply secured SQL migrations if needed. Never deliver real secrets.

## 14. Functional implementation and validation

Every supported control works. Reusable components, central tokens/inheritance, no duplicate theme pages or unrelated rewrites/dependencies. Preserve routes/features. Run available build/type/lint/relevant tests and report actual results, blockers and unverified features honestly.

## 15. Versioned delivery

No deployments, Cloudflare publishing, production SQL/live database mutations, previews, DNS or live infrastructure changes. Original pasted request prohibited pushes; subsequent direct user clarification authorizes only a migration branch preserving main.

GitHub ZIP includes only necessary new/modified update files, repository-relative paths, no dependencies/build outputs/caches/secrets/unrelated/unchanged files. Split more than 100 files into Part1, Part2 etc, each at most100. Provide deletion list. SQL ZIP only when needed, with ordered migrations/RLS/setup. Config ZIP only when needed, with templates/setup/integration requirements and no credentials. Changelog records version/features/files/deletions/SQL/config/tests/limitations/manual steps. Preserve earlier delivery versions.

## 16. Final rules

Implement all four themes, preserve OG Light/Dark, add supplied Ocean/Chocolate direction, make Dream Box the home, preserve conversations, functional topics, permanent AELIO, independent/inherited agent visuals, existing Auth/features, premium responsive interface, modular Groove/VYBR8, no deployment. Ask only for essential missing details, never routine approvals.

## Final vision

A beautiful personalized digital home: OG Light clean/minimal/familiar; OG Dark futuristic/refined/original; Ocean Fresh bright/coastal/luxurious; Chocolate Cream warm/sophisticated/intimate. Chat with AELIO, explore interests, resume conversations, interact with independent agents. Build, validate, package and leave deployment decisions to the owner.
