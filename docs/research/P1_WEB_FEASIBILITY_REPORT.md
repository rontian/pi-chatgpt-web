# P1 Web Feasibility Report

Date: 2026-09-12  
Repository HEAD at this report: local commit after expiry/ambiguous probes  
Decision: **P1 research path is feasible. P2 wired NativeChromeTurnDriver with DOM-stable research readback.**

## Runtime

- OS: macOS
- Chrome: installed Google Chrome 152
- Playwright: `playwright-core@1.63.0` as CDP client only
- Browser host: native Chrome + isolated profile + loopback CDP
- Network: workstation HTTP/HTTPS/SOCKS proxy `127.0.0.1:7890`; P1 used optional `PI_CHATGPT_WEB_PROXY` override

## Pass/fail

| Test | Result |
|---|---|
| Fresh interactive login without CDP | PASS |
| Restart reuse `p1:browser:check` | PASS (`authSource: session+ui`) |
| One text turn | PASS |
| Continuation memory turn | PASS |
| Five sequential turns | PASS |
| Tab close/recreate | PASS |
| Unauthenticated/empty-profile auth | PASS (`p1:expiry`, controlled `auth_expired_or_unauthenticated`) |
| Ambiguous write no-blind-retry | PASS (`p1:ambiguous`, policy only; no second send) |
| Production driver wired | YES (`NativeChromeTurnDriver`) |
| Opt-in live driver `p2:live` | PASS (`status: completed`) |

## Transport strategy frozen for remaining P1/P2 research

- Launch ordinary Google Chrome with `spawn(executable, argv)`.
- Interactive login has no `--remote-debugging-*`.
- Later probes attach with `connectOverCDP` on loopback.
- Proxy is a Chrome argv override, not a Playwright launch proxy.
- Research readback is DOM stability; production must still look for structured conversation state before freezing.

## Fragile points

- Cloudflare Turnstile loops if login Chrome is launched with CDP.
- Playwright `page.goto` can `ERR_CONNECTION_CLOSED` while Chrome's own startup navigation works.
- Assistant bubbles may update in place; wait logic cannot require count++ only.
- Restored conversation tabs need hydrate wait before DOM readback.
- Empty-profile unauthenticated session endpoint can still be HTTP 200; 200 is not proof of login.

## Go / no-go

- **Go** for P2 native Chrome + CDP transport.
- Production completion detection remains DOM-stable research readback until a structured conversation API is observed.
