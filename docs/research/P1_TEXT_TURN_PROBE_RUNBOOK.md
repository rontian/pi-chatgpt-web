# P1 Text Turn Probe Runbook

Status: **real-account 1/2/5-turn evidence collected; tab recreation is a separate probe**.

This probe uses the authenticated ChatGPT page UI to perform a research-only text turn. It deliberately does **not** implement the production `BrowserOwnedTransport` and it does **not** decide the final canonical readback plane.

It reuses the same native Chrome host as the browser-auth probe: isolated profile, optional proxy override, loopback CDP, then `connectOverCDP()`. It does not call `launchPersistentContext()`.

## Prerequisite

First complete the auth probe:

```bash
npm run p1:browser
npm run p1:browser:check
```

The second command must report authenticated state before running text-turn tests.

## One text turn

```bash
npm run p1:turn
```

The probe creates a random non-secret marker and asks ChatGPT to return it exactly. The output does not print the prompt or assistant body; it records exact-match status, response length/hash, elapsed time, observed conversation identity when available, and selector family used.

## Same-conversation continuation

```bash
npm run p1:turn:continue
```

Turn 1 asks for a random marker. Turn 2 does not repeat that marker; instead it asks ChatGPT to repeat its immediately previous assistant reply. Therefore a successful exact match demonstrates previous-turn conversation context rather than merely two independent requests.

PASS requires two exact matches and no observed conversation change.

## Five sequential turns

```bash
npm run p1:turn:five
```

This exercises five sequential page-owned sends in one conversation. Turn 2 is the explicit continuation-memory check; later turns use independent exact-response markers to detect missing/duplicate turns.

## Readback limitation

The current probe reads the rendered assistant message and uses response stability plus absence of a visible stop control to decide when the research response appears complete.

Research completion uses DOM stability. The accepted P1 research decision is in `docs/research/P1_READBACK_DECISION.md`. Production transport still must not freeze on rendered text alone.

A mature reference implementation (`kymuco/chatgpt-web-adapter`) similarly separates browser-owned product mutation from canonical conversation readback; this repository uses that only as architectural comparison, not as a private-protocol source of truth.

References:

- https://github.com/kymuco/chatgpt-web-adapter
- https://github.com/owenkleinmaier/glassbox/blob/main/SELECTORS.md

## Tab recreation

```bash
npm run p1:tab
```

This sends one exact-token turn, closes the ChatGPT tab, reopens `/c/<id>`, and checks that the hashed assistant reply is still visible. It does not send a second turn.

## Expiry and ambiguous write

```bash
npm run p1:expiry
npm run p1:ambiguous
```

`p1:expiry` launches an **empty temporary profile** and expects `authenticated: false` with `errorClass: auth_expired_or_unauthenticated`. It does not log out of the real P1 profile.

`p1:ambiguous` does not send a ChatGPT turn. It records the fail-closed policy: a timeout after a possible accepted write is `ambiguous` and must not be retried automatically.

## Failure handling

Do not blindly re-run after an uncertain send timeout. If the page may have accepted a turn but local observation failed, treat the result as ambiguous and inspect the conversation before another send.

The research probe fails closed on missing composer, authentication failure, response timeout, response mismatch, or conversation change during a multi-turn run.

## Evidence to retain

Safe evidence includes sanitized JSON output, OS/Node/Chrome/Playwright versions, pass/fail status, selector names, and elapsed timing.

Do not retain cookies, auth payloads, access tokens, raw request headers, Sentinel/Turnstile values, or browser-profile contents.
