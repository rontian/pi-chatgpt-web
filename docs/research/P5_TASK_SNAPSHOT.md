# P5 Task Snapshot

Evidence date: 2026-09-13
HEAD at evidence collection: after `8a2ab18`

## Implementation

- Config loader/validation: DONE (`scripts/p5/config.mjs`, TS re-export).
- `assistant.enabled` disable path: DONE (`DisabledAssistantAdapter`).
- Explicit registered model id: DONE (`resolveAssistantModel`).
- `auto` selection: DONE (Luna/Flash over Sol/reasoner; DeepSeek next).
- `fallbackModel`: DONE (missing/unauthenticated primary, then runner failure).
- Profile map `fast` / `normal` / `deep`: DONE (`profileForContext`).
- Vendor-neutral adapter: DONE (`ModelRegistry.complete` via `createRegistryAssistantRunner`).
- Prompt path wiring: DONE (`PromptController` passes `createAssistantAdapter`).

## Exit gate

- Helper disabled has no effect on ChatGPT transport construction: PASS (`tests/p5-assistant.test.mjs`).
- Missing model / missing auth errors are explicit: PASS.
- Chinese + code-heavy extraction preserves constraints: PASS (`maybeCompressContext`).

## Not in P5

- Live helper-model invocation in Pi TUI.
- Large-session compression against a real Pi session (P6).
