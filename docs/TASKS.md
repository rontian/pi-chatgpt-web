# Task Board

Status values: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `DEFERRED_VALIDATION`.

## P0 — Bootstrap / Architecture Freeze

- DONE — Confirm repository `rontian/pi-chatgpt-web` and `/chatgpt` namespace.
- DONE — Create Pi package manifest and extension entrypoint.
- DONE — Add command parser/bootstrap help/status.
- DONE — Define runtime/transport/core result contracts.
- DONE — Define helper-model boundary.
- DONE — Define context/session separation.
- DONE — Define workflow envelope bootstrap parser.
- DONE — Add security policy.
- DONE — Add Web Feasibility plan.
- DONE — Add full P0-P12 development plan.
- DONE — Add bootstrap checks/tests/CI.
- DEFERRED_VALIDATION — Install committed Git URL in a real Pi environment.

## P1 — Web Feasibility Gate

- DONE — Select prototype Chromium automation dependency: `playwright-core@1.63.0` + branded Chrome + isolated persistent profile.
- DONE — Implement interactive persistent-profile login/auth probe harness.
- DONE — Implement research-only text-turn/continuation/five-turn probe harness.
- DEFERRED_VALIDATION — Fresh real-account interactive login.
- DEFERRED_VALIDATION — Auth reuse after process restart.
- DEFERRED_VALIDATION — One real browser-owned ChatGPT text turn.
- DEFERRED_VALIDATION — Canonical conversation readback decision.
- DEFERRED_VALIDATION — Production completion detection.
- DEFERRED_VALIDATION — Same-conversation continuation evidence.
- DEFERRED_VALIDATION — Five sequential turn evidence.
- DEFERRED_VALIDATION — Tab recreation/session expiry/ambiguous-write experiments.

## P2 — Browser/Auth + Product Transport

- DONE — Add reusable BrowserRuntime lifecycle/profile abstraction.
- DONE — Add BrowserTurnDriver boundary for production transport integration.
- DONE — Enforce ambiguous-write invariant in BrowserOwnedTransport.
- DEFERRED_VALIDATION — Wire the real browser driver after P1 local evidence.

## P3 — ChatGPT Product / Conversation Runtime

- DONE — Add per-workflow conversation state.
- DONE — Reuse conversation IDs across runtime turns.
- DONE — Preserve turn count/status/message identity state.
- DEFERRED_VALIDATION — Validate against real ChatGPT conversation IDs and canonical readback.

## P4-P12

Implementation proceeds with basic/static/unit validation. Real-account/product-capability checks are deferred until the repository is pulled to the user's workstation.
