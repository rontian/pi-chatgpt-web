# Development Plan — From Zero to Final State

This document is the execution roadmap. Each phase has an explicit gate; later phases must not silently absorb unresolved work from earlier phases.

## P0 — Bootstrap / Architecture Freeze

**Goal:** establish package structure, stable boundaries, documentation, command namespace, CI/bootstrap checks.

Deliverables:

- Pi package manifest;
- `/chatgpt` command registration;
- architecture interfaces for runtime/transport/workflow/context/helper model;
- security rules;
- Web Feasibility test plan;
- zero-to-final roadmap;
- task board.

Exit gate:

- repository installs as a Pi package structurally;
- `/chatgpt help` and bootstrap `/chatgpt status` load;
- `npm run check` and `npm test` pass;
- no fake ChatGPT Web protocol implementation exists.

## P1 — Web Feasibility Gate

**Goal:** prove a reproducible authenticated ChatGPT Web text conversation path before productizing anything.

Research questions:

1. Which Chromium automation/control method is used?
2. Can one persistent browser profile survive process restarts?
3. How is authenticated state detected without exporting raw secrets?
4. What browser-owned operation sends a turn?
5. What is the canonical source for conversation/message readback?
6. How is turn completion determined?
7. How are conversation IDs and parent/current message IDs represented?
8. What happens on timeout after a possible successful write?
9. Can a reusable tab be recreated after browser/page loss?
10. What product metadata/observations are visible around tool/app activity?

Mandatory real tests:

- interactive login;
- restart and auth reuse;
- `只回复 OK` text turn;
- second turn references first turn;
- 5+ sequential turns;
- tab recreation;
- session expiry behavior;
- timeout/ambiguous-write experiment;
- duplicate prevention/reconciliation.

Exit gate:

- feasibility report records observed protocol/lifecycle;
- one stable text-turn prototype passes the matrix;
- known fragile points are documented;
- transport strategy is frozen for P2.

Failure rule:

If P1 cannot establish a safe/reproducible text path, stop. Do not compensate by building workflow complexity on an unstable transport.

## P2 — Browser/Auth + Product Transport

**Goal:** turn the P1 prototype into maintainable core infrastructure.

Deliverables:

- BrowserRuntime lifecycle;
- persistent profile management;
- login/logout/status/doctor primitives;
- ProductTransport implementation;
- canonical readback and reconciliation;
- cancellation/timeouts;
- error taxonomy;
- redacted diagnostics.

Exit gate:

- deterministic integration tests around mocked boundaries;
- real opt-in browser tests pass;
- no duplicate turn on timeout/recovery suite.

## P3 — ChatGPT Product Runtime / Conversation Runtime

**Goal:** expose a stable API independent of browser mechanics.

Deliverables:

- create/resume conversation;
- send/continue turn;
- terminal state normalization;
- `ChatGPTTurnResult` provenance;
- capability registry;
- observations container;
- conversation persistence metadata.

Exit gate:

- multi-turn runtime usable without Pi UI;
- transport may be replaced behind interface;
- callers do not consume browser-private structures.

## P4 — Pi Command Integration

**Goal:** make the runtime operational from Pi.

Deliverables:

```text
/chatgpt help
/chatgpt status
/chatgpt login
/chatgpt logout
/chatgpt doctor
/chatgpt ask <request>
```

Exit gate:

- install from `git:github.com/rontian/pi-chatgpt-web` works;
- `/reload` development flow works;
- `ask` completes a real ChatGPT conversation and renders text;
- errors are actionable.

## P5 — Configuration + Helper Model Adapter

**Goal:** connect optional helper-model functionality to Pi/OpenCodex registered models.

Deliverables:

- user config loader/validation;
- `assistant.enabled`;
- explicit registered model id;
- `auto` selection strategy;
- fallback model;
- future profile map (`fast`, `normal`, `deep`);
- adapter API independent of model vendor.

Model policy:

- default class: GPT Luna/fast GPT or GLM Flash;
- DeepSeek is a strong alternative for code-heavy summarization;
- high-reasoning Sol/Reasoner models are optional, not default.

Exit gate:

- helper model can be disabled with no effect on core ChatGPT transport;
- configured model existence/availability errors are clear;
- structured extraction tests cover Chinese + code-heavy context.

## P6 — Pi Session Context Pipeline

**Goal:** create a bounded one-time projection from Pi Session to a ChatGPT workflow.

Deliverables:

- recent-message collector;
- tool-result filtering;
- context budgets;
- project/cwd metadata;
- helper-model semantic extraction/compression;
- inspectable SessionSnapshot.

Rules:

- never resend the entire Pi Session each ChatGPT turn;
- never silently exceed budgets;
- preserve important user constraints verbatim where needed.

Exit gate:

- large-session fixtures remain bounded;
- snapshot inspection explains included/excluded context.

## P7 — Prompt Workflow MVP

**Goal:** implement `/chatgpt prompt` end to end.

Deliverables:

- start workflow from user request + SessionSnapshot;
- multi-round conversation loop;
- deterministic envelope parser;
- context request loop;
- max-round safeguards;
- final-prompt extraction;
- `lastPrompt` state.

Subcommands:

```text
/chatgpt prompt <request>
/chatgpt prompt show
/chatgpt prompt retry
/chatgpt prompt inspect
```

Exit gate:

- no fixed assumption about number of ChatGPT turns;
- workflow terminates deterministically on final/error/limit;
- transcript and sent context are inspectable.

## P8 — Prompt UX / Editing / Send

**Goal:** make generated prompts operational in Pi without copy/paste.

Deliverables:

```text
/chatgpt prompt edit
/chatgpt prompt send
```

Preferred behavior:

- edit in Pi multiline editor when API permits;
- insert into current input editor as safe default;
- explicit direct send path;
- preserve final prompt in cache until replaced/cleared.

Exit gate:

- generated prompt can be reviewed before execution;
- direct send cannot accidentally send a stale/unknown prompt.

## P9 — Product Observation Layer

**Goal:** normalize ChatGPT product activity without making workflow code depend on private event formats.

Research/implementation:

- web search observations;
- citations/sources;
- connected GitHub app observations;
- generic app/tool activity;
- required-action states;
- warning/error observations.

Exit gate:

- unknown observations are preserved safely;
- text-only workflow remains functional if observation parsing fails.

## P10 — Connected Apps Capability Validation

**Goal:** verify account-scoped ChatGPT product capabilities in our conversation path.

Priority:

1. GitHub connected app;
2. web search;
3. other ChatGPT apps as useful.

For GitHub:

- use an account with an already-connected, read-authorized test repository;
- ask for a known repository fact;
- prove whether the product conversation invokes the account capability;
- document plan/model/surface prerequisites and failure modes;
- do not mark capability available based on UI presence alone.

Exit gate:

- reproducible capability matrix with `available/unsupported/unknown` states.

## P11 — Reliability / Recovery / Compatibility

**Goal:** harden for daily usage and ChatGPT frontend changes.

Deliverables:

- browser restart recovery;
- stale tab recovery;
- login expiry recovery;
- schema/behavior drift detection;
- diagnostic bundles with secret redaction;
- compatibility signatures/version probes;
- safe cache cleanup;
- opt-in verbose trace mode.

Exit gate:

- controlled failure rather than silent wrong results when product behavior changes.

## P12 — Packaging / Public Release

**Goal:** release as a public Pi package.

Deliverables:

- npm-ready metadata if npm publication is chosen;
- tagged GitHub release;
- complete install/update/uninstall docs;
- privacy/security disclosure;
- troubleshooting matrix;
- compatibility statement;
- examples/screenshots only after behavior is stable.

Final-state acceptance:

- fresh install;
- authenticated browser setup;
- `/chatgpt ask` works;
- `/chatgpt prompt` works across multi-turn analysis;
- context stays bounded;
- helper model is optional/configurable from Pi registered models;
- final prompt can be edited/sent;
- ambiguous writes never blind-retry;
- connected app capabilities are truthfully reported;
- product drift produces diagnosable failure.
