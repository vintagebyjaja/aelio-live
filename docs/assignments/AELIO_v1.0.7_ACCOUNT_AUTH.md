# CODEX — AELIO + PATHD ACCOUNT REPAIR, UNLIMITED FOUNDER CREDITS & MODERN SIGN-IN

**Priority:** Critical functional repair and authentication improvement.

**Platforms:**
- AELIO — https://aelio.live
- PATHD — https://mypathd.com

The attached screenshots show that both AELIO and PATHD are experiencing account-loading failures. AELIO chat is also not functioning, and PATHD's recovery-question experience is not working correctly.

Fix these problems while introducing a modern, seamless sign-in experience shared across both platforms.

Do not redesign the websites, replace Supabase, or disrupt existing users.

## 1. Fix the shared account-loading problem

Both websites display:

"I'm having trouble opening your account right now. Please try again."

Investigate the underlying cause across both applications.

Check:
- Supabase authentication sessions and refresh tokens
- Shared identity configuration
- Profile creation and retrieval
- Account initialization
- Subscription and credit-service lookups
- Database permissions and RLS policies
- Server-side environment variables
- Cloudflare runtime configuration
- Authentication redirects and cookies
- API error handling

Identify the actual failing service, request, or database operation.

A failure to retrieve optional profile information, credits, or subscriptions should not automatically invalidate an otherwise valid authenticated session.

Provide clear logs for debugging without exposing passwords, tokens, recovery answers, or private user information.

## 2. Repair AELIO chat completely

Currently, selecting an agent and sending a message does not produce a working conversation.

Repair:
- Opening existing chats
- Creating new conversations
- Agent selection
- Message submission
- AI provider requests
- Streaming responses
- Message persistence
- Conversation history
- Credit entitlement checks
- Error recovery

Test AELIO, MILA, Naomi, and the other permanent agents.

Verify group-chat functionality where already implemented.

Do not simulate AI responses or hide the underlying problem.

## 3. Founder accounts — unlimited message credits

Grant unlimited AI message credits to these two accounts:

- vintagebyjaja@gmail.com
- jaja@vybr8.live

Requirements:
- Apply the entitlement across both AELIO and PATHD.
- Resolve founder identities to authenticated Supabase user IDs.
- Enforce the entitlement securely on the server.
- Display "Unlimited credits" in account and usage interfaces.
- Never deduct or block founder messages due to monthly message-credit limits.
- Do not grant unrelated paid products or administrator privileges.
- Preserve the separate AELIO and PATHD subscription systems.

**All other users must receive the credit allowance associated with their actual plan.**

Do not hardcode 100 credits for every account.

The founder entitlement must survive a change in login method, including linking Google or Apple to an existing founder account.

## 4. Add Google and Apple sign-in

Implement Supabase-supported OAuth sign-in for both platforms.

The authentication screens should offer:

- Continue with Google
- Continue with Apple
- Continue with email

Use the existing shared Supabase identity so users do not need separate accounts for AELIO and PATHD.

### Important account-linking behavior

- Existing users must retain their original accounts, data, subscriptions, and chat histories.
- Do not create duplicate profiles when someone uses a new login provider.
- Support secure linking of additional providers to an existing authenticated account.
- Do not automatically merge accounts merely because email addresses appear to match.
- Require appropriate verification before linking accounts.
- Support Apple's private relay email behavior.
- Use secure OAuth state, PKCE where applicable, and approved redirect URLs.
- Validate return destinations to prevent open redirects.

Configure the required OAuth providers and redirect URLs for both production domains and approved development environments.

If Google or Apple developer-console configuration is required, prepare the code and provide exact setup instructions. Do not claim the feature works until the provider configuration and sign-in flow have been tested.

## 5. Add passkeys for Face ID, Touch ID, and fingerprint sign-in

Investigate and implement a secure WebAuthn/passkey solution compatible with the existing Supabase authentication architecture.

The goal is to let users sign in using their device's built-in authentication.

Desired experience:

1. User signs in securely using Google, Apple, or email.
2. User is offered the option to create a passkey.
3. The passkey is registered to their existing account.
4. On future visits, the user can select "Sign in with a passkey."
5. Their device handles Face ID, Touch ID, fingerprint, or PIN authentication.
6. They return to the same AELIO/PATHD identity.

Requirements:
- Use standards-based WebAuthn with server-side challenge verification.
- Bind credentials to the correct user account and approved domain.
- Protect against replay attacks.
- Support multiple registered passkeys.
- Allow users to review and revoke passkeys.
- Require recent authentication before sensitive security changes.
- Preserve a secure account-recovery alternative.
- Do not store biometric information.
- Do not invent a passkey implementation if the selected auth infrastructure cannot support it securely.

If native passkey support is not available in the current Supabase setup, document the required architecture or supported authentication integration. Do not replace the shared identity system without approval.

## 6. Repair and simplify account recovery

The PATHD security page currently shows two recovery questions, answer fields, and a current-password confirmation.

The user reports that this experience is not working.

First, diagnose and repair any existing recovery settings so users do not lose access to their accounts.

Then simplify the security experience.

### Preferred account security options

- Connected sign-in providers
- Registered passkeys
- Change password
- Recovery methods
- Active sessions
- Sign out of other devices

Recovery questions should not be required for new registrations or ordinary sign-in.

Do not use knowledge-based security questions alone to authorize password resets or account takeover.

If existing recovery answers are retained temporarily for compatibility, ensure they are securely handled and are not exposed in the UI or logs.

### Forgotten password flow

- Email/password users should have a working secure reset flow.
- Google and Apple users should be able to sign in using their connected providers.
- Passkey users should be able to use a registered passkey.
- Users must have a safe fallback if they lose access to a device or provider.
- Protect sensitive account changes with appropriate reauthentication.

Do not remove an existing recovery method until a tested replacement is available.

## 7. Prepare Google Calendar and Apple Calendar integrations

Design AELIO Connect so users can eventually connect their calendars without creating additional platform accounts.

**Important: Calendar permissions must remain separate from login permissions.**

### Google Calendar

- Support a separate Google Calendar connection flow.
- Request the minimum OAuth scopes necessary.
- Explain why permissions are needed.
- Support revoking access.
- Store tokens securely on the server.
- Do not request calendar access merely because the user selected Google sign-in.

### Apple Calendar

Investigate supported, secure approaches for Apple Calendar integration.

Do not assume Sign in with Apple provides calendar access.

Apple Calendar may require a different integration approach, such as a supported calendar protocol or a companion-device integration.

Document the feasible options and limitations before implementing any Apple Calendar access.

### AELIO agent access

Eventually, AELIO and authorized agents should be able to help users:

- Understand upcoming events
- Find free time
- Plan schedules
- Prepare for meetings
- Organize personal tasks

Any calendar reading or editing must be permission-based. Editing events requires explicit authorization and appropriate scopes.

Do not implement background calendar monitoring or automatic event changes without user consent.

## 8. Unified authentication, separate subscriptions

AELIO and PATHD share one identity.

Users should be able to move between the two platforms without creating another account.

However:
- AELIO subscriptions remain separate.
- PATHD subscriptions remain separate.
- Usage allowances remain separate for regular accounts.
- Founder unlimited-credit entitlements apply to both.
- Data access between platforms must follow explicit permissions.

Do not assume that signing into one site automatically makes cross-domain browser sessions available on the other. Implement a secure, supported cross-site sign-in experience.

## 9. Keep the visual experience premium

Follow the existing approved AELIO design system.

Authentication should feel:
- Clean
- Elegant
- Minimal
- Mobile-friendly
- Familiar
- Secure
- Easy to understand

Avoid developer terminology, technical configuration messages, or overwhelming security forms in the public interface.

Use clear messages such as:

"Welcome back."

"Continue with Google."

"Continue with Apple."

"Use your passkey."

"Choose how you'd like to sign in."

Make authentication feel like a natural part of the AELIO and PATHD experiences.

## 10. Testing

Verify all of the following:

- Existing email/password login
- Google OAuth login
- Apple OAuth login
- Secure account linking
- Passkey registration and authentication, if supported
- Password recovery
- Session persistence and logout
- Cross-platform identity
- Founder unlimited credits
- Regular free-plan credits
- Paid-plan allowances
- AELIO chat and streaming
- PATHD account settings
- Mobile sign-in and account recovery

Do not mark external OAuth or passkey functionality as complete without end-to-end testing.

## 11. Implementation priorities

Work in this order:

**Phase 1 — Restore functionality**
- Fix shared account loading.
- Repair AELIO chat.
- Correct founder credits and regular plan allowances.
- Repair existing account recovery.

**Phase 2 — Modernize authentication**
- Add Google and Apple OAuth.
- Add secure provider linking.
- Add passkeys where supported.
- Simplify security settings.

**Phase 3 — Prepare connected calendars**
- Implement supported consent-based connections where practical.
- Document any Apple Calendar limitations.
- Do not expand scope into unrelated integrations.

Prioritize getting the existing websites functional before introducing additional dependencies.

## 12. GitHub review and deployment

Work in the `migration` branch.

**Before you push these changes, show the GitHub preview in the secondary branch `migration`. Once I've reviewed the changes, I'll give approval to push to `main`.**

Do not deploy to production or modify the live database without explicit approval.

Do not request approval to begin the work.

Prepare the changes and provide a reviewable implementation summary.

Clearly identify:
- The root cause of the shared account failure
- The cause of the broken chat
- Founder-credit implementation
- Recovery-question problems
- OAuth configuration requirements
- Passkey implementation status
- Any SQL migrations
- Any required secrets or environment variables
- Which changes belong to AELIO versus PATHD
- What was tested and what still needs external configuration

**Final goal:** AELIO and PATHD should feel like one seamless ecosystem where users can securely sign in, recover access, communicate with their agents, and manage connected services without unnecessary friction.
