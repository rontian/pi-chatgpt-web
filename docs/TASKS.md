# Task Board

Status values: `DONE`, `DEFERRED_VALIDATION`.

## Implementation status

- DONE — P0 Bootstrap / Architecture Freeze.
- DONE — P1 research probe implementation.
- DONE — P2 Browser/Auth transport boundary.
- DONE — P3 ChatGPT product/conversation runtime.
- DONE — P4 Pi command integration.
- DONE — P5 configuration and helper-model catalog/adapter boundary.
- DONE — P6 bounded Pi Session context pipeline.
- DONE — P7 multi-round prompt workflow.
- DONE — P8 prompt show/edit/send/retry/inspect UX and persistent prompt cache.
- DONE — P9 product observation normalization and capability registry.
- DONE — P10 evidence-based connected capability validation API/runbook.
- DONE — P11 reliability, redacted diagnostics, drift detection and retry safety.
- DONE — P12 alpha packaging/release/troubleshooting/validation documentation.

## Deferred workstation validation

The codebase is intentionally `0.1.0-alpha.0` until the following are run in the target environment:

- DEFERRED_VALIDATION — Install/reload as a real Pi package.
- DONE — Fresh ChatGPT browser login and restart reuse (workstation 2026-09-12).
- DONE — Real text turn, continuation and five-turn probe (workstation 2026-09-12).
- DONE — P1 research readback decision documented; production completion detection still deferred.
- DONE — Tab recreation probe (`npm run p1:tab`, workstation 2026-09-12).
- DONE — Session expiry/unauthenticated controlled error (`npm run p1:expiry`).
- DONE — Ambiguous-write no-blind-retry policy probe (`npm run p1:ambiguous`).
- DEFERRED_VALIDATION — Wire the final real BrowserTurnDriver after P1 evidence.
- DEFERRED_VALIDATION — `/chatgpt ask` and multi-round `/chatgpt prompt` in Pi TUI.
- DEFERRED_VALIDATION — Helper-model invocation and large-session compression.
- DEFERRED_VALIDATION — Prompt edit/send/reload-cache behavior in Pi.
- DEFERRED_VALIDATION — GitHub, web search and other connected capability evidence matrix.
- DEFERRED_VALIDATION — Browser/product drift and ambiguous-write recovery exercises.

Use `docs/VALIDATION_CHECKLIST.md` for the complete local validation sequence. Stable release/npm publication is gated on those results.
