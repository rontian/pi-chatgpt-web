# Architecture

## 1. Purpose

`pi-chatgpt-web` is a product bridge between Pi workflows and a user's authenticated ChatGPT Web account. It is not a model provider and should not be coupled to Pi's primary inference loop.

The design optimizes for four properties:

1. ChatGPT Web protocol changes are isolated below a stable runtime interface.
2. Pi workflow code never directly manipulates browser tabs, cookies, or private product payloads.
3. Pi Session state and ChatGPT Conversation state remain independent.
4. Future ChatGPT product capabilities can be observed without forcing them into Pi-local tool calling.

## 2. Layer model

```text
Pi Extension
  └─ /chatgpt command router
       └─ Workflow Layer
            ├─ ask workflow
            ├─ prompt workflow
            └─ future workflows
                 │
                 ├─ Context Pipeline
                 │    └─ Helper Model Adapter (optional)
                 │
                 └─ ChatGPT Product Runtime
                      ├─ Conversation Runtime
                      ├─ Capability Registry
                      ├─ Observation Normalizer
                      └─ Provenance/Reconciliation
                           │
                           └─ Product Transport
                                └─ Browser/Auth Runtime
                                     └─ chatgpt.com
```

## 3. Pi Extension layer

Responsibilities:

- Register **only** the `/chatgpt` top-level command.
- Parse and route subcommands internally.
- Render status/errors/results through Pi UI APIs.
- Never own ChatGPT authentication or network protocol details.

Initial namespace:

```text
/chatgpt help
/chatgpt status
/chatgpt login
/chatgpt logout
/chatgpt doctor
/chatgpt ask ...
/chatgpt prompt ...
/chatgpt config
```

## 4. Workflow layer

A workflow defines a user-facing goal, not transport behavior.

Examples:

- `ask`: obtain an analysis/result from ChatGPT and show it.
- `prompt`: continue a ChatGPT conversation until a final Pi-executable prompt is produced, then allow show/edit/send/retry/inspect actions.

A workflow may perform multiple ChatGPT turns. No workflow is allowed to assume a fixed number of rounds.

## 5. Context pipeline

The context pipeline projects a bounded subset of Pi Session state into the initial ChatGPT workflow turn.

Default policy:

- include the user's current `/chatgpt` request;
- include a bounded recent-message window;
- exclude large tool results by default;
- include project/cwd metadata when available;
- never resend the full Pi Session on every ChatGPT turn.

The optional helper model is used only for semantic extraction/compression/fallback classification. Mechanical data collection and protocol parsing remain code responsibilities.

## 6. Helper model adapter

The helper model is deliberately outside the ChatGPT runtime.

Required qualities:

- reliable instruction following;
- reliable structured output;
- strong Chinese and code-context comprehension;
- moderate reasoning is sufficient;
- no tool calling is required.

Model selection is configured by Pi/OpenCodex model identifiers. Planned profiles are `fast`, `normal`, and `deep`; workflows request a profile rather than hard-coding a vendor.

Recommended default class: fast GPT/Luna-class or GLM Flash-class. DeepSeek-class models are suitable alternatives, especially for code-heavy context. High-end reasoning models are not required for the default helper role.

## 7. ChatGPT Product Runtime

Stable public contract:

```ts
sendTurn(request: ChatGPTTurnRequest): Promise<ChatGPTTurnResult>
```

The result is richer than a string from day one. It carries:

- conversation identity;
- message identity when known;
- terminal/in-progress/ambiguous status;
- final text when available;
- normalized product observations;
- execution provenance.

This avoids redesign when ChatGPT product capabilities later expose web search, GitHub, apps, files, citations, or required actions.

## 8. Transport layer

The initial candidate is a **browser-owned write transport** backed by an authenticated reusable ChatGPT tab/profile.

The architecture does not assume that all reads must also be browser DOM reads. The Web Feasibility phase must determine the most stable combination of:

- browser-owned protected write;
- conversation/status readback;
- completion detection;
- message-tree reconciliation.

No private payload will be implemented from documentation guesses alone.

## 9. Authentication/browser runtime

The browser runtime owns:

- persistent profile location;
- interactive login bootstrap;
- authenticated-state health checks;
- reusable product tab/session;
- explicit logout/reset;
- browser lifecycle recovery.

Secrets/cookies must remain in user-local state, never repository/project configuration.

## 10. Two independent state machines

### Pi Session

May be long-lived and contain tool calls, edits, summaries, and unrelated tasks.

### ChatGPT Workflow Conversation

Created or resumed for one `/chatgpt` workflow. It contains the initial projected Pi context plus subsequent ChatGPT turns and context replies.

They are linked by IDs but never merged automatically.

## 11. Ambiguous write rule

A protected write may succeed remotely even when the local caller times out. Therefore timeout != safe retry.

Required state:

```text
write started
  ├─ confirmed + reconciled -> completed
  ├─ confirmed but not terminal -> in_progress
  ├─ provably failed -> failed/retryable
  └─ outcome unknown -> ambiguous
```

`ambiguous` must trigger reconciliation before any resend.

## 12. Capability model

Capabilities are recorded independently:

```text
text
web_search
github
apps
files
images
```

Each has one state:

```text
available | unsupported | unknown | unimplemented
```

At bootstrap only the architecture for `text` exists; even text remains unimplemented until Web Feasibility passes. Account-connected GitHub/web/apps are not assumed simply because login succeeds.
