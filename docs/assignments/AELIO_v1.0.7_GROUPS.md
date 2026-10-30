# CODEX — AELIO AGENT GROUP CHATS + MARKETING DEMO
**Quick Feature Update | Preserve Current Build**

## OBJECTIVE

Expand AELIO's existing Agent Team functionality to support natural, personality-driven group conversations and add a cinematic group chat demonstration to the marketing website.

This is a focused update. Do not redesign the website, rebuild the agent system, or interfere with the current implementation.

Reuse existing chat components, agent profiles, authentication, database infrastructure, and streaming response architecture.

## 1. Unlimited Custom Group Chats

Allow users to create as many group chats as they desire with their existing agents.

Users should be able to:

- Create and name group chats.
- Add permanent and custom agents.
- Give each group a custom title and image.
- Remove or add participants in custom groups.
- Search existing groups.
- Save conversations and return later.
- Mention specific agents using `@Name`.
- Request everyone's opinion when desired.

The original **Dream Team** group remains permanent and contains Naomi, Angelo, Oliver, Simone, Chloe, and Reggie.

Its official membership and portraits cannot be modified.

## 2. Authentic Agent-to-Agent Conversations

Every agent must retain its individual identity, personality, expertise, and communication style.

Agents should not simply take turns answering the user.

Instead, implement intelligent participation:

- Respond directly when mentioned.
- Participate when their expertise is relevant.
- React to another agent's message when appropriate.
- Naturally agree, disagree, joke, or challenge ideas.
- Ask follow-up questions when meaningful.
- Avoid unnecessary or repetitive messages.
- Allow some agents to remain silent.
- Keep conversations flowing without requiring all agents to respond.

Agents must be capable of addressing one another, not just the user.

For example, Reggie can joke with Big Dre while Marcus provides a business recommendation.

Maintain each agent's personality across different groups.

### Group chemistry

Support conversational styles ranging from serious and professional to relaxed and humorous.

Do not force every group into one tone.

A business strategy group can be formal, while a group called "The UNCs" can mix business advice with jokes and casual conversation.

The group setting may influence conversational tone, but must never overwrite an agent's core personality.

### Performance

Use the existing streaming architecture.

Display responses as they become available rather than waiting for all participating agents.

Use lightweight participation routing to avoid unnecessary model calls, excessive latency, repetitive agent responses, or uncontrolled agent-to-agent loops.

Keep responses concise and conversational by default.

Use reasonable per-turn limits and allow users to request deeper discussion.

Do not implement autonomous background group messaging in this update.

## 3. Marketing Page — The UNCs Demo

Add a polished demonstration to the existing AELIO marketing experience.

Feature headline:

**Different minds. Different personalities. One group chat.**

Supporting headline:

**Your people. Your conversations. Your kind of chaos.**

Supporting description:

"Business plans, random debates, serious advice, and jokes that go completely off topic. Build your own AI group chat with companions who bring different perspectives."

### Demonstration group

**Group name:** The UNCs 🥃

**Participants:** You, Reggie, Big Dre, Marcus

Reggie uses his existing permanent official portrait.

Big Dre and Marcus are fictional demonstration agents with their own distinct profile pictures and personalities. They are not additional permanent system agents.

### Exact conversation script

**YOU:**
"Fellas, I'm thinking about opening a lounge. What y'all think?"

**REGGIE:**
"First thing I'm asking is who's paying that rent when the lounge empty on a Tuesday? 😂 We gotta talk numbers before we talk velvet couches."

**BIG DRE:**
"Man Reggie, you ain't even let him finish the pitch! 😂 But he right though. What's the concept? Jazz lounge or somewhere folks can watch the game?"

**MARCUS:**
"See, I'm thinking we do both. Live music on Fridays, sports on Sundays. But we need to figure out who we trying to attract."

Preserve this exact conversation.

### Visual experience

Use a premium, modern messaging interface consistent with AELIO's current design system.

- Warm chocolate, copper, and champagne accents.
- Clean, rounded message bubbles.
- Individual agent profile pictures.
- Agent names above messages.
- Smooth sequential message appearance.
- Subtle typing indicators.
- Natural conversational pacing.
- Elegant desktop presentation.
- Fully responsive mobile layout.
- Replay conversation option.

Keep the animation short, polished, and lightweight.

Respect reduced-motion preferences.

Do not autoplay audio.

Do not require visitors to log in to view the demonstration.

Make it clear this is an example conversation rather than a live exchange.

## 4. Marketing Placement

Add the demonstration to:

**AELIO marketing homepage:** As a featured Agent Teams section.

**Dream Beyond → Agent Team:** As the primary example of how collaborative agent conversations work.

Reuse the same demonstration component in both locations.

Avoid duplicating implementation or loading unnecessary assets.

Provide a clear CTA:

**Create Your Group Chat**

Route the CTA to the appropriate group creation experience for signed-in users, or the existing sign-in flow for visitors.

Do not create a dead-end button.

## 5. Existing Agent Team Features

Preserve and integrate the existing concepts:

**Specialists:** Agents contribute their unique expertise.

**Debate:** Agents can respectfully challenge each other's opinions.

**You Decide:** The user remains in control of decisions.

These should work within both the permanent Dream Team and custom groups.

Do not replace the original Dream Team with The UNCs.

The UNCs is a marketing example and an illustration of what users can create.

## 6. Scope and Implementation

Keep this update focused.

- Reuse existing components and services.
- Do not alter approved agent portraits.
- Do not change the eight permanent agents.
- Do not redesign the marketing site.
- Do not change existing subscription plans.
- Do not interfere with the current AELIO/PATHD shared authentication.
- Preserve existing chat histories.
- Avoid unnecessary dependencies.
- Use non-destructive database changes only if required.

Do not claim features are functional until their corresponding interactions are implemented.

If full multi-agent orchestration cannot be completed safely in this small update, complete the marketing demo and existing group-chat integration first, then clearly identify the remaining implementation work in the developer handoff.

## 7. Testing

Verify:

1. Existing Dream Team conversations still work.
2. Users can create multiple custom groups.
3. Agents retain distinct personalities.
4. Direct mentions route to the correct agent.
5. Multiple agents can respond to one conversation.
6. Agent-to-agent replies work without uncontrolled loops.
7. Group history persists after refresh.
8. The marketing demo displays the exact scripted conversation.
9. Replay works.
10. Desktop and mobile layouts remain polished.
11. Existing authentication and chat functionality are unaffected.

## 8. GITHUB REVIEW — REQUIRED

**Before you push these changes, show the GitHub preview in the secondary branch `migration`. Once I've reviewed the changes, I'll give approval to push to `main`.**

Wait for the current implementation to finish before integrating this update.

Work from the latest completed code on `migration`.

Provide:

- A summary of changed files.
- GitHub diff for review.
- Working preview link if available.
- Screenshots of the desktop and mobile marketing demonstration.
- Any required database changes.
- Test results and remaining limitations.

Do not push or merge to `main` without my explicit approval.

Do not automatically deploy to production.

## FINAL DIRECTION

AELIO group chats should feel like conversations between recognizable individuals, not multiple copies of the same chatbot.

Agents can bring expertise, humor, disagreements, personality, and useful perspectives into the same conversation.

The marketing demonstration should communicate this experience immediately.

**Different minds. Different personalities. One group chat.**