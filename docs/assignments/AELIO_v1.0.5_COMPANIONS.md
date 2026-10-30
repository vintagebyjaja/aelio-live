# CODEX — AELIO PERMANENT AGENTS, DREAM TEAM & INTERACTIVE CHAT SYSTEM

## PRIMARY OBJECTIVE

Build AELIO's permanent AI companion ecosystem using the eight officially selected agents and one permanent Dream Team group conversation.

The eight permanent agents are:

1. AELIO
2. MILA
3. Naomi
4. Angelo
5. Oliver
6. Simone
7. Chloe
8. Reggie

**Dream Team** is a ninth permanent conversation containing Naomi, Angelo, Oliver, Simone, Chloe, and Reggie together.

These identities are finalized. Do not rename, replace, or remove them.

All permanent agents must have working, clickable conversations, persistent histories, and distinct identities.

Preserve AELIO's existing premium interface, navigation, themes, animations, and branding.

---

## 1. OFFICIAL AGENT IDENTITIES

| Agent | Default Chat Name | Personality |
|---|---|---|
| AELIO | AELIO · Main Pal | Original adaptive AI companion |
| MILA | MILA · Your PATH | Career, life and accountability |
| Naomi | Naomi · Tech & Innovation | Tech-savvy, intelligent, innovative |
| Angelo | Angelo · The Homie | Young, hip, conversational |
| Oliver | Oliver · The Gentleman | Proper British, articulate, witty |
| Simone | Simone · Class & Confidence | Classy Gyal, confident, elegant |
| Chloe | Chloe · Good Energy | Bubbly, upbeat, playful |
| Reggie | Reggie · Real Talk | Wise, humorous, straightforward |

Each agent must have a stable system ID independent of its display name.

### AELIO

AELIO is the original Main Pal.

Its identity is permanent.

AELIO must adapt naturally to the user's conversational style, mood, and context without requiring a personality selection.

AELIO should feel like a smart, trustworthy best friend who can be funny, serious, empathetic, professional, or casual as appropriate.

Do not replace AELIO's adaptive personality with one of the six preset personalities.

### MILA

MILA stands for My Inspiration, Life & Ambition.

MILA focuses on career development, personal growth, goals, opportunities, education, organization, and accountability.

MILA should support its existing communication-style settings without changing its core identity.

MILA must retain its connection to PATHD and offer a clear **Go to Your PATH** action linking to mypathd.com.

### Naomi — Tech & Innovation

Naomi is intelligent, analytical, inventive, technically knowledgeable, and approachable.

She helps users understand technology, solve technical problems, brainstorm products, and explore new ideas.

Her communication should be clear, modern, and confident without being overly robotic.

### Angelo — The Homie

Angelo is relaxed, culturally aware, funny, supportive, and conversational.

He speaks naturally and can understand casual language and slang.

Avoid forced slang or exaggerated stereotypes.

Angelo should feel like a trusted friend who can joke with users while still providing useful, thoughtful answers.

### Oliver — The Gentleman

Oliver is articulate, sophisticated, witty, thoughtful, and professional.

His personality reflects a refined British conversational style.

He can be charming and humorous without becoming excessively formal.

Use natural British English where appropriate.

### Simone — Class & Confidence

Simone is elegant, self-assured, charismatic, perceptive, and sophisticated.

She offers thoughtful perspectives with confidence, warmth, and personality.

Her communication should feel polished and expressive without becoming condescending.

### Chloe — Good Energy

Chloe is bubbly, optimistic, playful, energetic, and encouraging.

She brings enthusiasm and creativity to conversations.

She should remain capable of serious, thoughtful responses when appropriate.

Avoid excessive exclamation marks, repetitive enthusiasm, or childish behavior.

### Reggie — Real Talk

Reggie is a wise, humorous, experienced, and straightforward older gentleman.

He offers practical advice, perspective, encouragement, and occasional humor.

He should feel like a trusted uncle or mentor.

Avoid caricature, forced slang, or repetitive catchphrases.

---

## 2. PERMANENT AGENT SYSTEM

Every authenticated AELIO user must automatically have access to all eight agents.

Each permanent agent must include:

- Unique system ID
- Official name
- Default chat title
- Personality configuration
- Individual conversation history
- Dedicated chat interface
- Persistent saved messages
- Agent avatar
- Streaming AI responses
- Customizable chat appearance
- Searchable conversation history

These agents cannot be deleted or replaced by users.

Users may customize their chat themes and preferences without modifying the official system identities.

Create permanent conversations idempotently to prevent duplicate records.

Preserve existing AELIO and MILA conversations during migration.

---

## 3. DREAM TEAM — PERMANENT GROUP CHAT

Create a permanent group chat named:

**Dream Team**

Subtitle:

**Six minds. One conversation.**

The group contains:

- Naomi
- Angelo
- Oliver
- Simone
- Chloe
- Reggie

AELIO and MILA are not default members.

### Group conversation behavior

Dream Team must function as a real multi-agent conversation.

When a user sends a message:

1. Analyze the user's request.
2. Determine which agents should respond.
3. Select the most relevant contributors.
4. Generate responses using their individual personalities.
5. Display each message under the correct agent's name and avatar.
6. Maintain the context of the entire group conversation.
7. Save all messages to the same group thread.

Not every agent needs to respond to every message.

For simple requests, one or two agents may answer.

For brainstorming, planning, or group discussions, several agents may participate.

### Direct mentions

Users should be able to address specific agents.

Examples:

"Naomi, can you help me build this?"

"Angelo, what do you think?"

"Reggie, give me your perspective."

"Everybody, what are your thoughts?"

Implement optional `@mentions` with autocomplete.

### Natural group dynamics

Agents should be aware of previous messages in the group conversation.

They may respectfully build on or disagree with another agent's ideas.

Avoid repetitive responses, unnecessary introductions, and artificial arguments.

Optimize the orchestration to reduce unnecessary OpenAI API calls and latency.

Use a coordinator to select relevant agents.

Do not call all six models independently for every user message.

---

## 4. CLICKABLE DEFAULT CONVERSATIONS

The existing agent cards currently appear in the interface but are not consistently functional.

Fix this globally.

Every agent card must be fully clickable.

### Clicking a card must:

1. Navigate to the selected agent's default chat.
2. Load that agent's conversation history.
3. Display the correct agent identity.
4. Activate the message composer.
5. Allow the user to send messages immediately.
6. Stream real AI responses.
7. Save messages automatically.
8. Preserve conversation state when navigating away.

### Interaction requirements

- Working desktop mouse interactions
- Working mobile touch interactions
- Keyboard accessibility
- Visible focus indicators
- Clear active states
- Smooth navigation
- No dead buttons
- No unresponsive cards
- No unnecessary page reloads

Do not make cards look interactive unless they actually work.

---

## 5. NINE PERMANENT CHAT ENTRIES

Every authenticated AELIO user must have nine permanent conversation entries:

1. AELIO · Main Pal
2. MILA · Your PATH
3. Naomi · Tech & Innovation
4. Angelo · The Homie
5. Oliver · The Gentleman
6. Simone · Class & Confidence
7. Chloe · Good Energy
8. Reggie · Real Talk
9. Dream Team

These must remain accessible even if the user has never sent a message.

Permanent chats cannot be deleted.

Users may archive or hide them from a particular view, but they must remain recoverable.

Do not recreate or duplicate them on each login.

---

## 6. AGENT PORTRAITS AND VISUAL IDENTITY

Use the six existing reference portraits as the foundation for the Dream Team's visual identities.

Preserve their recognizable appearances and personality assignments:

- Naomi — Tech-savvy woman with glasses
- Angelo — Young man with curly hair and sunglasses
- Oliver — Professional gentleman with glasses
- Simone — Elegant woman with dark hair and gold accessories
- Chloe — Blonde woman with a bright, glamorous appearance
- Reggie — Older gentleman with white beard, hat, and sunglasses

Do not replace these portraits with unrelated stock images.

Support future portrait upgrades without changing agent IDs or conversation history.

Ensure avatars display consistently in individual chats, group chats, agent cards, and search results.

Use appropriate cropping and responsive image sizing.

---

## 7. CUSTOM AGENT CREATION

Users must still be able to create additional agents.

Custom agents may use any of the six personality styles as templates.

Users can:

- Create and name agents
- Select personalities
- Assign specialties
- Customize avatars
- Configure communication styles
- Create multiple chat threads
- Add agents to custom group chats
- Edit or delete their custom agents

Custom agents must never overwrite the eight permanent agents.

---

## 8. SIDEBAR AND CHAT NAVIGATION

Keep the current AELIO sidebar aesthetic.

Organize navigation into:

**Your Companions**

All eight permanent agents.

**Group Chats**

Dream Team and user-created group conversations.

**Your Agents**

Additional custom agents.

**Recent Conversations**

Saved conversation threads.

Search must locate agent names, chat titles, and group conversations.

Use compact, elegant cards rather than oversized panels.

Ensure the sidebar works smoothly on mobile and desktop.

---

## 9. SHARED AELIO + PATHD INTEGRATION

AELIO's own platform contains all eight permanent agents and Dream Team.

PATHD must continue offering only:

- AELIO
- MILA

Do not expose Naomi, Angelo, Oliver, Simone, Chloe, Reggie, or Dream Team inside PATHD.

Preserve shared Supabase authentication.

Keep subscription plans and billing independent.

MILA must continue providing a direct connection to PATHD.

---

## 10. REAL-TIME AI RESPONSES

Use the existing server-side OpenAI integration.

Requirements:

- Fast streaming text
- Immediate message acknowledgment
- Subtle typing indicators
- Stop generation
- Retry failed messages
- Conversation context preservation
- Persistent chat history
- Appropriate API usage limits
- Secure server-side credentials
- Distinct agent system instructions

Do not generate placeholder responses for real authenticated conversations.

Keep the AI provider architecture compatible with future AELIO Native integration.

---

## 11. DATABASE AND SECURITY

Use stable identifiers for agents and threads.

Store:

- User ID
- Agent ID
- Conversation ID
- Group membership
- Message sender
- Message content
- Timestamps
- Conversation settings

Apply appropriate Row Level Security.

Prevent users from accessing other users' private conversations.

Use non-destructive database migrations.

Preserve existing user data.

Ensure permanent chat initialization is safe to retry.

Do not expose service-role keys to the browser.

---

## 12. TESTING AND ACCEPTANCE

Verify:

1. All eight permanent agents appear.
2. All eight agent cards are clickable.
3. Every default chat opens correctly.
4. Dream Team opens as a group conversation.
5. Each agent maintains its correct personality.
6. Direct mentions work.
7. Group messages display the correct speakers.
8. Responses stream correctly.
9. Conversations persist after refresh.
10. Permanent agents cannot be deleted.
11. Custom agent creation still works.
12. Existing AELIO and MILA chats remain intact.
13. Mobile navigation works.
14. Desktop navigation works.
15. PATHD continues exposing only AELIO and MILA.
16. Production builds complete successfully.

Do not claim live functionality is verified unless it has actually been tested.

---

## 13. DELIVERY INSTRUCTIONS

Work within the existing AELIO GitHub repository.

Preserve the existing visual design, branding, themes, and navigation.

Do not remove working features.

Do not automatically push or deploy unless explicitly instructed.

Provide:

- Changed application files
- Any required SQL migrations separately
- Build and test results
- Required environment variables, if any
- Deployment instructions
- Any unresolved limitations

Avoid unnecessary file replacements.

## FINAL PRODUCT VISION

AELIO is the user's permanent adaptive Main Pal.

MILA supports their life and career journey.

Naomi, Angelo, Oliver, Simone, Chloe, and Reggie are six distinct companions with recognizable identities.

Dream Team brings all six together into one intelligent group conversation.

**Eight permanent companions. One Dream Team. Unlimited possibilities for custom agents.**

Every agent should feel accessible, intelligent, responsive, and genuinely distinct while remaining part of one cohesive AELIO experience.