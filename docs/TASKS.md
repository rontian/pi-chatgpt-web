# Task Board

Status values: `DONE` (exit gate passed), `SKELETON` (code exists, gate not proven), `DEFERRED_VALIDATION`.

## Implementation status

- DONE — P0 Bootstrap / Architecture Freeze.
- DONE — P1 research probe implementation and workstation evidence.
- DONE — P2 NativeChromeTurnDriver + BrowserRuntime + mocked suite + opt-in `npm run p2:live`.
- DONE — P3 ChatGPT product/conversation runtime (`create`/`resume`/`continue`, mocked multi-turn, replaceable transport).
- SKELETON — P4 Pi command integration (command path + `npm run p4:ask` PASS; Pi TUI install/reload/ask not proven).
- SKELETON — P5 configuration and helper-model catalog/adapter boundary.
- SKELETON — P6 bounded Pi Session context pipeline.
- SKELETON — P7 multi-round prompt workflow.
- SKELETON — P8 prompt show/edit/send/retry/inspect UX and persistent prompt cache.
- SKELETON — P9 product observation normalization and capability registry.
- SKELETON — P10 evidence-based connected capability validation API/runbook.
- SKELETON — P11 reliability, redacted diagnostics, drift detection and retry safety.
- SKELETON — P12 alpha packaging/release/troubleshooting/validation documentation.

## Deferred workstation validation

The codebase is intentionally `0.1.0-alpha.0` until the following are run in the target environment:

- DEFERRED_VALIDATION — Install/reload as a real Pi package.
- DONE — Fresh ChatGPT browser login and restart reuse (workstation 2026-09-12).
- DONE — Real text turn, continuation and five-turn probe (workstation 2026-09-12).
- DONE — P1 research readback decision documented; production completion detection still deferred.
- DONE — Tab recreation probe (`npm run p1:tab`, workstation 2026-09-12).
- DONE — Session expiry/unauthenticated controlled error (`npm run p1:expiry`).
- DONE — Ambiguous-write no-blind-retry policy probe (`npm run p1:ambiguous`).
- DONE — Wire NativeChromeTurnDriver into `/chatgpt` services (mocked P2 suite; opt-in `npm run p2:live`).
- DEFERRED_VALIDATION — `/chatgpt ask` and multi-round `/chatgpt prompt` in Pi TUI.
- DEFERRED_VALIDATION — Helper-model invocation and large-session compression.
- DEFERRED_VALIDATION — Prompt edit/send/reload-cache behavior in Pi.
- DEFERRED_VALIDATION — GitHub, web search and other connected capability evidence matrix.
- DEFERRED_VALIDATION — Browser/product drift and ambiguous-write recovery exercises.

Use `docs/VALIDATION_CHECKLIST.md` for the complete local validation sequence. Stable release/npm publication is gated on those results.
