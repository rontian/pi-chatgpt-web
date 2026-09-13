# Feature Specification

## Product vision

Use ChatGPT Web from inside Pi as a specialized analysis and content-generation capability while keeping Pi responsible for the developer workflow and final execution.

## F1. Package/command integration

- Package name: `pi-chatgpt-web`.
- Repository: `rontian/pi-chatgpt-web`.
- One top-level command: `/chatgpt`.
- Subcommands are internally routed and extensible.

## F2. Browser authentication

Planned behaviors:

- `/chatgpt login` opens isolated ordinary Chrome without CDP; `/chatgpt login confirm` closes that window so later commands can attach over loopback CDP.
- authentication survives process restart when the ChatGPT account/session permits it;
- `/chatgpt logout` clears local product authentication state intentionally;
- `/chatgpt doctor` distinguishes browser, login, product, transport, and workflow failures.

## F3. ChatGPT text turns

Core MVP must support:

- fresh conversation;
- send text;
- wait for terminal response;
- read final assistant text;
- continue the same conversation;
- multiple turns with no fixed round count;
- timeout/cancel handling;
- ambiguous-write reconciliation.

## F4. `/chatgpt ask`

Goal: send a bounded task/context to ChatGPT and return the final textual answer to Pi.

Expected actions later:

- show result;
- copy/result insertion if Pi UI allows;
- inspect conversation metadata.

## F5. `/chatgpt prompt`

Goal: produce a final executable prompt for the current Pi agent.

Flow:

1. Build a bounded initial Pi Session snapshot.
2. Optionally use helper model for context extraction/compression.
3. Start ChatGPT workflow conversation.
4. Continue as many turns as required.
5. Satisfy workflow-level context requests according to policy.
6. Detect a final result.
7. Preserve final prompt as `lastPrompt`.
8. Allow show/edit/send/retry/inspect actions.

Planned subcommands:

```text
/chatgpt prompt <request>
/chatgpt prompt show
/chatgpt prompt edit
/chatgpt prompt send
/chatgpt prompt retry
/chatgpt prompt inspect
```

## F6. Pi Session projection

The initial projection may include:

- current user request;
- bounded recent user/assistant messages;
- current cwd/project metadata;
- selected stable session constraints;
- optional task summary.

It must not automatically include the entire Pi Session or large tool outputs.

## F7. Helper model

Configuration requirements:

- disabled/enabled;
- model = `auto` or an OpenCodex/Pi registered model id;
- optional fallback model;
- future profile map: `fast`, `normal`, `deep`.

Use cases:

- extract relevant session context;
- compress oversized context;
- normalize non-structured intermediate response only as fallback;
- classify whether content is final when deterministic parsing fails.

The helper model must never be required for browser authentication or core ChatGPT turn transport.

## F8. Workflow protocol

Intermediate ChatGPT replies should use a deterministic envelope when the workflow requires orchestration:

```text
<pi-chatgpt>
{"status":"need_context","requests":[]}
</pi-chatgpt>
```

Final:

```text
<pi-chatgpt>
{"status":"final"}
</pi-chatgpt>

<final content>
```

Code parser first; helper-model fallback only when necessary.

## F9. State/cache

Planned user-local state:

```text
~/.pi/agent/pi-chatgpt-web/
  config.json
  browser-profile/
  state/
  cache/
```

Possible cache record per workflow:

```text
request.md
session-snapshot.json
turns.jsonl
observations.jsonl
final.md
```

Retention must be configurable. Authentication material is never copied into diagnostic artifacts.

## F10. Product capability observation

Future capability observation (not control) should normalize:

- web search activity;
- citations/sources;
- GitHub connected-app activity;
- other ChatGPT app activity;
- required-action state;
- product warnings/errors.

The initial consumer may ignore these observations while still preserving them for diagnostics.

## F11. GitHub connected app

Future research target:

- verify whether the same product conversation created through our browser-owned path can use the account's already-connected GitHub capability;
- do not reimplement GitHub access locally merely to simulate the ChatGPT product behavior;
- capability is marked `unknown` until a reproducible test proves it.

## F12. Safety/diagnostics

- redact secrets/cookies/tokens from logs;
- no browser profile under repository root;
- explicit ambiguous-write status;
- workflow turn limits;
- context budgets;
- inspect command shows what context was sent without leaking auth data;
- structured error taxonomy.

## Final-state user experience

```text
/chatgpt prompt 根据当前会话和项目状态，生成下一轮只读 Implementation Review 提示词
```

The package projects the relevant Pi context, drives a multi-turn ChatGPT Web conversation, obtains the final prompt, then offers editing/sending/inspection without requiring the user to open ChatGPT Web manually.
