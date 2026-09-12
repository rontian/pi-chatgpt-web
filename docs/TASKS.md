# Task Board

Status values: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `DEFERRED_VALIDATION`.

## P0 — Bootstrap / Architecture Freeze
- DONE — Package structure, `/chatgpt` namespace, architecture, security, CI and P0-P12 roadmap.
- DEFERRED_VALIDATION — Install the committed Git URL in a real Pi environment.

## P1 — Web Feasibility Gate
- DONE — Select `playwright-core@1.63.0` + branded Chrome + isolated persistent profile for research.
- DONE — Implement sanitized auth probe and research text-turn/continuation/five-turn probe harnesses.
- DEFERRED_VALIDATION — Fresh login, restart reuse, real text turns, canonical readback, continuation, five-turn, tab recreation, expiry and ambiguous-write experiments.

## P2 — Browser/Auth + Product Transport
- DONE — BrowserTurnDriver boundary and BrowserOwnedTransport integration point.
- DONE — Ambiguous-write invariant.
- DEFERRED_VALIDATION — Wire/approve real browser driver after P1 local evidence.

## P3 — ChatGPT Product / Conversation Runtime
- DONE — Per-workflow conversation state, conversation-id reuse and normalized runtime result flow.
- DEFERRED_VALIDATION — Validate real conversation/message identities and readback.

## P4 — Pi Command Integration
- DONE — `/chatgpt help|status|login|logout|doctor|ask` routes implemented.
- DONE — Actionable unavailable-driver behavior retained instead of fake success.
- DEFERRED_VALIDATION — Install/reload/real ask in Pi TUI.

## P5 — Configuration + Helper Model Adapter
- DONE — User-local config loader/validator and 0600 persistence.
- DONE — Pi/OpenCodex model-registry listing and explicit/auto helper selection.
- DONE — Vendor-independent helper adapter boundary and enabled/disabled configuration.
- DONE — `/chatgpt config show|models|assistant-model|assistant` command surface.
- DEFERRED_VALIDATION — Invoke a real configured helper model after local Pi integration.

## P6-P12
Implementation continues with basic/static/unit validation. Real-account/product-capability checks remain deferred until the repository is pulled to the user's workstation.
