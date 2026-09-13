# P4 Task Snapshot

Evidence date: 2026-09-12
HEAD at evidence collection: after `135e62d`

## Automatic evidence

- Command parser: `/chatgpt login`, `/chatgpt login confirm`, `/chatgpt logout`, `/chatgpt doctor`, `/chatgpt ask`.
- Operational handler: mocked tests render completed ask text and actionable unauthenticated failures.
- Real ask path: PASS (`npm run p4:ask`, `status: completed`, conversation id observed, `renderedText: true`). This uses `AskCommandServices` + `NativeChromeTurnDriver`, not the Pi TUI.

## Exit gate still needing Pi TUI

P4 plan exit gate is not fully proven until:

1. `pi -e .` or `pi install git:github.com/rontian/pi-chatgpt-web` loads the extension.
2. `/chatgpt help` and `/chatgpt status` work after `/reload`.
3. `/chatgpt ask 只回复 OK` renders in the Pi TUI.

Do not treat `npm run p4:ask` as a Pi TUI proof.
