# Security and Privacy

## Threat model

This package runs inside Pi with the user's system permissions and may control an authenticated browser. Treat it as high-trust local software.

## Hard rules

- Never commit cookies, session tokens, access tokens, browser profiles, or auth exports.
- Never print authentication headers/cookies in normal logs.
- Diagnostic bundles must redact secrets before persistence.
- Browser profile lives under user-local state, not project root.
- Do not accept arbitrary remote debugging endpoints by default.
- Do not automatically upload full Pi sessions or repositories to ChatGPT.
- Context sent to ChatGPT must be inspectable and bounded.
- A timeout after a write is not permission to resend blindly.
- Connected app availability must be observed/verified, not inferred from account login alone.

## Browser profile

The planned profile directory is private local state. Permissions should be user-only where the platform permits. Logout/reset must be explicit because deleting this profile changes authentication state.

## Public repository policy

The repository may contain protocol observations and fixtures only after removing account identifiers, conversation contents, cookies, tokens, URLs containing secrets, and personal data.

## Terms/product compatibility

ChatGPT Web automation relies on product behavior rather than a stable public API. Before release, documentation must clearly state compatibility limitations and the distinction between this package and an official OpenAI API integration.
