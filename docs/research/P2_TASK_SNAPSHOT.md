# P2 Task Snapshot

Evidence date: 2026-09-12  
HEAD at evidence collection: uncommitted work on top of `1908586`

## Implementation

- `BrowserRuntime` lifecycle: DONE (`scripts/p2/browser-runtime.mjs`).
- Isolated persistent profile: DONE (same `~/.pi/agent/pi-chatgpt-web/browser-profile`).
- Login without CDP / confirm / logout cookies: DONE (`/chatgpt login`, `/chatgpt login confirm`, `/chatgpt logout`).
- `NativeChromeTurnDriver` wired into `ChatGPTCommandServices`: DONE.
- DOM-stable research readback reused for production text turns: DONE.
- Ambiguous timeout after possible accepted write: DONE (`status: ambiguous`, no automatic retry).
- Redacted diagnostics in health: DONE.

## Exit gate

- Deterministic mocked tests: PASS (`tests/p2-browser-runtime.test.mjs`, `npm run validate` 57/57).
- Opt-in live browser test: PASS (`npm run p2:live`, `status: completed`, conversation id observed, no secret fields).
- No duplicate turn on timeout/recovery: PASS (mocked timeout returns `ambiguous`; `mayAutomaticallyRetry` is false).

## Not in P2

- Structured conversation API freeze.
- Pi TUI `/chatgpt ask` (P4).
- Helper-model invocation (P5).
