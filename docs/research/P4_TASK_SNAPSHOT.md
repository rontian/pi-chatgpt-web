# P4 Task Snapshot

Evidence date: 2026-09-13
HEAD at evidence collection: uncommitted completion-detection fix on top of `a6f33d6`

## Automatic evidence

- Command parser: `/chatgpt login`, `/chatgpt login confirm`, `/chatgpt logout`, `/chatgpt doctor`, `/chatgpt ask`.
- Operational handler: mocked tests render completed ask text and actionable unauthenticated failures.
- Real command-path ask: PASS (`npm run p4:ask`, `status: completed`, conversation id observed, `renderedText: true`). This uses `AskCommandServices` + `NativeChromeTurnDriver`, not the Pi TUI.

## Completion-detection fix

Root cause of the earlier Pi TUI hang:

- `waitForAssistant()` treated any visible `button[aria-label*="Stop"]` as `generating=true`.
- ChatGPT UI can keep an unrelated Stop control visible after a stable assistant reply.
- Observed failure: `beforeCount=0 afterCount=1 generating=true latestLength=2 changed=true`, page already showed `OK`, TUI reported `ambiguous`.

Fix:

- Strong generation evidence: new `[data-testid="stop-button"]` after send.
- Weak evidence: `button[aria-label*="Stop"]`. Baseline-visible weak Stop is ignored.
- Send captures a generating-control baseline before `sendViaUi`.
- Timeout path is read-only: stable new turn + no strong generating evidence can complete with `reconciledReadback: true`. No second send.

Tests: `tests/page-session-completion.test.mjs`.

## Pi TUI exit gate

Real `pi -e .` session `p4-tui-fix`:

1. `/chatgpt help` → command list including `/chatgpt ask <request>`. PASS.
2. First `/chatgpt status` hit leftover isolated Chrome PID 29681 (`transport: not ready`). That process used `--user-data-dir=.../pi-chatgpt-web/browser-profile`. Closed it. Second `/chatgpt status` → `transport: ready`, `authenticated isolated Chrome session`. PASS.
3. `/chatgpt ask 只回复 P4FIX-4827，不要任何其他内容` → TUI rendered `P4FIX-4827`. PASS.
4. `/chatgpt ask 只回复 OK` → TUI rendered `OK`. PASS.
5. Immediate second `/chatgpt ask 只回复 OK` → TUI kept showing `OK` (identical notify may collapse). Persist store `ask.turns=3`, `lastStatus=completed`. PASS.

Do not treat `npm run p4:ask` as a Pi TUI proof. The TUI path is now proven.

## Exit gate

P4 plan exit gate: PASS.
