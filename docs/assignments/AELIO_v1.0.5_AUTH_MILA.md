# CODEX — AELIO + PATHD AUTHENTICATION REPAIR & MILA INTERACTIVE EXPERIENCE

## PRIMARY OBJECTIVE

Fix the remaining production authentication and account-service failures across AELIO (aelio.live) and PATHD (mypathd.com).

Also enhance PATHD's existing marketing page with an interactive MILA conversation preview featuring six selectable communication styles.

**Do not redesign either website. Preserve the existing visual identity, layouts, branding, navigation, animations, and responsive behavior.**

Work within the existing GitHub repositories.

---

## PART 1 — FIX AELIO ACCOUNT CONNECTION

### Current production errors

AELIO displays:

"Account services need secure runtime configuration. Please contact the site owner."

"Account connection unavailable."

"Your sign-in session is independent of the Brain. Retry the account service configuration."

"Your Main Pal is still loading. Retry the account connection."

These errors occur despite Cloudflare environment variables being configured.

### Required fixes

1. Trace every error message to its originating code.
2. Identify the actual failing endpoint, missing binding, or initialization issue.
3. Verify that `AELIO_SESSION_SECRET` is accessible in the Cloudflare Worker runtime, not merely during build.
4. Inspect the session-signing implementation and confirm the expected secret format.
5. Verify Supabase client and server initialization.
6. Verify the shared Supabase project URL and public key.
7. Test account-service endpoints independently from AI endpoints.
8. Fix any Cloudflare runtime compatibility issues.
9. Ensure the original AELIO Main Pal loads correctly after authentication.
10. Prevent one failed service from unnecessarily disabling unrelated features.

Do not assume that adding more environment variables will resolve the problem.

### Important

The OpenAI API key, Supabase credentials, and session secret have already been configured in Cloudflare.

Inspect the existing implementation before requesting any additional credentials.

Never expose secrets in logs or browser responses.

---

## PART 2 — FIX PATHD LOGIN AND SHARED PROFILE SERVICE

### Current production error

PATHD displays:

"Sign-in succeeded, but the shared profile service is unavailable. Please retry."

This suggests authentication may be succeeding while subsequent profile initialization or retrieval is failing.

### Required fixes

- Trace the login request and profile-loading sequence.
- Determine whether Supabase authentication succeeds independently of profile retrieval.
- Inspect the shared profile service and database schema.
- Check Supabase Row Level Security policies.
- Verify profile creation and retrieval permissions.
- Check whether profile initialization depends on missing Cloudflare runtime bindings.
- Verify that `PATHD_SESSION_SECRET` is used only if the implementation requires it.
- Repair session persistence and refresh behavior.
- Ensure successful login routes users to their real PATHD dashboard.
- Eliminate demo-mode fallback for authenticated production users.
- Preserve existing user accounts and data.

If a profile record is missing, implement a safe, idempotent profile initialization process.

Do not create duplicate profiles or overwrite existing user information.

### Shared identity requirements

AELIO and PATHD must use the same Supabase identity project.

Users should be able to authenticate to both platforms with the same credentials.

Because these are separate root domains, implement appropriate secure authentication flows rather than assuming cookies can be shared across domains.

Keep subscription billing and entitlements separate.

---

## PART 3 — ACTIVATE REAL AI CONVERSATIONS

Both websites already have `OPENAI_API_KEY` configured as a Cloudflare secret.

Verify that the AI backend actually uses the key.

Requirements:

- Use secure server-side OpenAI API calls.
- Implement real-time streaming responses.
- Show response text as it arrives, similar to ChatGPT.
- Aim for fast first-visible-text latency.
- Avoid unnecessary waiting animations.
- Preserve conversation context.
- Save authenticated conversation history.
- Allow stopping generation and retrying failed responses.
- Support natural language, follow-up questions, and conversational memory where authorized.
- Add appropriate usage limits and error handling.
- Never expose API keys to browsers.

Maintain the modular AI gateway so OpenAI can eventually be replaced by AELIO Native.

Do not misrepresent the current backend as a proprietary model.

---

# PART 4 — PATHD MARKETING PAGE: MEET MILA

## Design direction

On mypathd.com, upgrade the existing purple "MEET MILA" section.

Keep PATHD's current cream, lavender, plum, and peach visual language.

The section should feel like a polished, premium introduction to a personal companion.

Think modern messaging experience, clean editorial design, subtle animations, and friendly human communication.

Do not turn the marketing page into a giant chatbot interface.

### Desktop layout

Use a two-column layout inside the existing MILA section.

**Left column:**

- Small heading: MEET MILA
- Main title: My Inspiration, Life & Ambition
- Short introduction explaining MILA's role
- Six selectable communication styles
- A concise invitation to start using MILA

**Right column:**

A compact, elegant chat preview showing a conversation between a user and MILA.

The preview should have:

- Rounded chat bubbles
- A subtle MILA avatar
- Smooth transitions
- Clear distinction between user and MILA messages
- A small animated typing indicator
- No unnecessary scrolling
- Consistent typography and spacing

The preview must be visually balanced and remain contained within the marketing section.

### Mobile layout

- Stack introduction above the chat preview.
- Display communication styles in a horizontally scrollable selector.
- Keep the preview compact.
- Avoid horizontal page overflow.
- Make every style easy to select.
- Preserve the existing mobile navigation.
- Never block scrolling or trap touch interactions.

---

# PART 5 — SIX MILA COMMUNICATION STYLES

Create six selectable communication styles:

### 1. Homegirl

Warm, relatable, encouraging, conversational, and playful.

Example:

User: "I feel like I'm falling behind in life."

MILA: "Girl, you're not behind. You're building something. Now tell me what's been weighing on you, and we're gonna figure out your next move together."

### 2. CEO

Confident, polished, ambitious, direct, and results-focused.

Example:

User: "I feel like I'm falling behind in life."

MILA: "Let's look at the bigger picture. Your progress isn't defined by someone else's timeline. Let's identify your top three priorities and build a plan."

### 3. Auntie

Wise, nurturing, humorous when appropriate, and gently firm.

Example:

User: "I feel like I'm falling behind in life."

MILA: "Baby, everybody's journey has its own timing. Now, we aren't going to sit here comparing ourselves all day. Tell Auntie what you want to accomplish."

### 4. Advisor

Thoughtful, practical, strategic, and balanced.

Example:

User: "I feel like I'm falling behind in life."

MILA: "Let's separate what you're feeling from what the evidence shows. What goals are you measuring yourself against, and which ones matter most to you?"

### 5. Teacher

Patient, educational, structured, and encouraging.

Example:

User: "I feel like I'm falling behind in life."

MILA: "Let's break that feeling into smaller pieces. First, we'll identify your goals. Then we'll look at your progress and create achievable next steps."

### 6. Mom

Caring, reassuring, supportive, and gently protective.

Example:

User: "I feel like I'm falling behind in life."

MILA: "Sweetheart, you don't have to have everything figured out today. I'm proud of the effort you're making. Let's work through what's worrying you, one thing at a time."

These are communication styles, not separate AI agents.

MILA remains the same core companion with the same capabilities, safety standards, and authorized PATHD information.

Avoid stereotypes or exaggerated caricatures.

---

# PART 6 — INTERACTIVE DEMO BEHAVIOR

The marketing preview should work immediately without requiring login.

### Default state

- Homegirl selected.
- Display a sample user message.
- Animate MILA's response naturally.
- Keep the conversation short and engaging.

### When selecting another style

- Update the active style.
- Replay the same sample user question.
- Show the corresponding MILA response.
- Animate the response with a smooth transition.
- Do not reload the page.
- Do not lose scroll position.

### Additional preview examples

Allow visitors to switch between three preset topics:

1. Career — "I want a better job, but I don't know where to start."
2. Life — "I feel like I'm falling behind."
3. Goals — "Help me get my life organized."

Each topic should demonstrate how MILA communicates differently across the six styles.

Use curated, prewritten example responses for the public marketing preview so it loads instantly and does not generate unnecessary OpenAI API charges.

Clearly identify the preview as a demonstration.

Do not imply that these are live AI-generated conversations.

### Call to action

Below the preview, add:

**"Your journey. Your MILA."**

Button: **Start Your PATH**

Link the button to PATHD's real signup or onboarding flow.

If already authenticated, take the user to their actual MILA conversation.

---

# PART 7 — MILA SETTINGS FOR REAL USERS

Once authenticated, users should be able to select their preferred MILA communication style.

Requirements:

- Save the preference to the user's profile or agent settings.
- Apply it to MILA's real AI conversations.
- Allow changing styles at any time.
- Preserve conversation history when switching.
- Do not create separate accounts or duplicate agents.
- Keep MILA's core purpose consistent.

MILA remains PATHD's career, life, and accountability companion.

PATHD should expose only MILA and the original AELIO Main Pal.

Do not add AELIO's other custom agents to PATHD.

---

# PART 8 — TESTING AND DEPLOYMENT

Before completing the work, verify:

1. AELIO's secure account service initializes.
2. PATHD's shared profile service loads.
3. Both applications authenticate against the same Supabase project.
4. Existing accounts remain accessible.
5. User profiles persist.
6. Real AI responses stream successfully.
7. MILA's marketing preview works without login.
8. All six styles display the correct sample responses.
9. Mobile and desktop layouts remain responsive.
10. No secrets are exposed.
11. Production builds pass.
12. Existing designs and features remain intact.

Provide a clear distinction between locally verified behavior and functionality requiring production verification.

If SQL migrations are required, provide them separately and make them non-destructive.

## DELIVERY

Use the existing AELIO and PATHD GitHub repositories.

Do not automatically push or deploy unless explicitly instructed.

Return the changed files, necessary migrations, build results, and deployment instructions.

Avoid unnecessary file replacements.

**FINAL GOAL**

Both websites must have reliable shared authentication and working, fast AI conversations.

PATHD's marketing page should also give visitors an immediate, polished introduction to MILA through six distinct communication styles, encouraging them to create an account and begin their journey.

Preserve the existing AELIO and PATHD visual identities throughout.