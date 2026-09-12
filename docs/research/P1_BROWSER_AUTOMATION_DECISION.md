# P1 Browser Automation Decision

Status: **ACCEPTED for P1 research**  
Date: 2026-09-12

## Decision

Use `playwright-core@1.63.0` with the branded Chrome `channel: "chrome"` and an isolated persistent user-data directory.

Default profile:

```text
~/.pi/agent/pi-chatgpt-web/browser-profile
```

This is a P1 research dependency and does not yet implement `BrowserOwnedTransport.sendTurn()`.

## Why Playwright Core

- `launchPersistentContext()` directly models the persistent browser profile needed for one-time interactive login and later reuse.
- The Chrome channel can use the user's installed Chrome without downloading a second browser runtime.
- Page lifecycle and network/DOM observation APIs are available for P1 research.
- Playwright documents `connectOverCDP()` as lower fidelity than its native protocol, so attaching to a daily-driver browser is not the default architecture.
- `playwright-core` is the no-browser package, keeping installation smaller and preventing automatic browser downloads.

## Isolation rules

The probe must not use the user's normal Chrome profile. A dedicated profile keeps ChatGPT session material scoped to this package and reduces accidental interference with daily browsing.

The probe currently reports only:

- whether the page-local session probe appears authenticated;
- the session endpoint HTTP status;
- browser channel/version metadata;
- page URL/title.

It must not print or persist cookies, access tokens, account identifiers, email addresses, Turnstile/Sentinel material, or raw network captures.

## Auth probe

The P1 probe evaluates `/api/auth/session` inside the authenticated `chatgpt.com` page context and reduces the response immediately to a boolean plus HTTP status. The full payload never crosses the browser boundary into logs/results.

This endpoint is an observed product detail, not a stable public API. P2 must isolate any retained product-specific assumptions behind browser/runtime interfaces.

## External research evidence

Normative browser API references:

- https://playwright.dev/docs/api/class-browsertype
- https://www.npmjs.com/package/playwright-core

Non-normative comparison/reference implementation:

- https://github.com/kymuco/chatgpt-web-adapter

The reference implementation supports the same broad architectural direction (persistent browser session and browser-owned protected writes), but `pi-chatgpt-web` does not depend on it and will not copy undocumented request payloads without independent observation.

## Validation completed for this decision

- probe script syntax checked with Node 22-compatible ESM;
- argument/profile policy unit tested;
- session-result sanitization unit tested;
- repository structure check updated to pin the chosen research dependency;
- no ChatGPT private send protocol was introduced.

## Still required before P1 closure

- fresh real-account interactive login;
- process restart auth reuse;
- one real text turn;
- canonical assistant readback/completion source;
- same-conversation continuation;
- 5+ sequential turns;
- tab recreation;
- expired-session behavior;
- cancellation and ambiguous-write reconciliation.
