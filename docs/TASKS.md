# Task Board

Status values: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

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
- TODO — Verify package by installing the committed Git URL in a real Pi environment.

## P1 — Web Feasibility Gate

- DONE — Select prototype Chromium automation dependency: `playwright-core@1.63.0` + branded Chrome + isolated persistent profile.
- DONE — Implement interactive persistent-profile login/auth probe harness (implementation/unit validation only).
- TODO — Run fresh real-account interactive login probe and record evidence.
- TODO — Verify auth reuse after process restart.
- TODO — Observe one browser-owned ChatGPT text turn.
- TODO — Determine canonical conversation readback source.
- TODO — Determine completion detection.
- TODO — Verify same-conversation continuation.
- TODO — Test 5+ sequential turns.
- TODO — Test tab recreation.
- TODO — Test session expiry.
- TODO — Design/verify ambiguous-write reconciliation.
- TODO — Create P1 feasibility report and go/no-go decision.

## Later phases

See `docs/DEVELOPMENT_PLAN.md`. Tasks are expanded only when the preceding phase passes its exit gate.
