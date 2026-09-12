# pi-chatgpt-web

`pi-chatgpt-web` is a Pi package that treats an authenticated ChatGPT Web session as a **product bridge/tool**, not as Pi's primary model provider.

> Version: **0.1.0-alpha.0**
> Implementation status: P0-P12 architecture/workflow code is present with basic/static/unit validation. Real ChatGPT browser behavior, real Pi TUI operation, helper-model calls, and connected capabilities are intentionally marked **deferred validation** until tested on the user's workstation.

## Intended workflow

```text
Pi Session
   │
   ▼
/chatgpt
   │
   ├─ ask workflow
   └─ prompt workflow
        │
        ├─ bounded SessionSnapshot
        ├─ optional helper-model adapter
        └─ multi-round ChatGPT conversation
                 │
                 ▼
        final Pi execution prompt
                 │
          show / edit / send
```

The package keeps Pi Session context and ChatGPT conversation context as separate state machines. It never resends the entire Pi session on every ChatGPT turn.

## Command surface

```text
/chatgpt help
/chatgpt status
/chatgpt login
/chatgpt logout
/chatgpt doctor
/chatgpt capabilities

/chatgpt ask <request>

/chatgpt prompt <request>
/chatgpt prompt show
/chatgpt prompt edit
/chatgpt prompt send
/chatgpt prompt retry
/chatgpt prompt inspect

/chatgpt config
/chatgpt config models
/chatgpt config assistant <on|off>
/chatgpt config assistant-model <provider/model|auto>
```

Generated prompts are inserted into the Pi editor by default. They are **not** automatically executed; `/chatgpt prompt send` is explicit.

## Installation

From GitHub:

```bash
pi install git:github.com/rontian/pi-chatgpt-web
```

Development / one-shot load:

```bash
pi -e git:github.com/rontian/pi-chatgpt-web
```

For local development:

```bash
npm install
npm run validate
npm run pack:check
```

## Browser feasibility probes

P1 research uses a native Google Chrome host with an isolated profile. Playwright attaches over loopback CDP; it does not launch the interactive authentication browser.

Default network is whatever ordinary Chrome already uses on this machine, including macOS system proxy, TUN, or VPN routing. Do **not** set `PI_CHATGPT_WEB_PROXY` unless that isolated Chrome window cannot reach ChatGPT on the default network.

Optional override, only when needed:

```bash
export PI_CHATGPT_WEB_PROXY=http://127.0.0.1:7890
```

`--proxy <url>` overrides `PI_CHATGPT_WEB_PROXY`. An unset/blank environment variable means no `--proxy-server` flag is passed to Chrome. The proxy belongs to the native Chrome process, not to Playwright `connectOverCDP()`.

```bash
npm run p1:browser
npm run p1:browser:check
npm run p1:turn
npm run p1:turn:continue
npm run p1:turn:five
```

Authentication is confirmed from sanitized positive evidence from `/api/auth/session`, the logged-in ChatGPT UI, or both. Probe output reports only `authenticated`, `authSource`, endpoint status, and other non-secret diagnostics; it never prints raw session payloads, cookies, access tokens, email addresses, or account identifiers.

These probes exist to collect real workstation evidence. Do not interpret repository-only tests as proof that ChatGPT's current Web product protocol works.

## Helper model

The helper model is optional and comes from Pi/OpenCodex's existing model registry. `pi-chatgpt-web` does not create another provider system.

Default `auto` ranking favors fast/structured-output-friendly model classes such as Luna/Flash, then general DeepSeek-class models. High-reasoning models are deliberately not the default helper choice.

The helper role is limited to context extraction/compression/classification. Core ChatGPT Web analysis remains separate.

## Context model

A `/chatgpt prompt` run receives a one-time bounded projection of the current Pi Session:

- current user request;
- recent user/assistant messages;
- optional system/tool results according to config;
- cwd/project metadata;
- character budget metadata;
- optional helper-model compression when wired.

The snapshot is inspectable with `/chatgpt prompt inspect`.

## Multi-round protocol

Prompt workflows do not assume one or two ChatGPT calls. ChatGPT can request more context using the package envelope protocol:

```text
<pi-chatgpt>{"status":"need_context","requests":[]}</pi-chatgpt>
```

and terminate with:

```text
<pi-chatgpt>{"status":"final"}</pi-chatgpt>
```

followed by the final execution prompt. A configurable `maxRounds` prevents unbounded loops.

## Product capabilities

The package models these independently:

```text
text
web_search
github
apps
files
images
```

States are evidence-based:

```text
available | unsupported | unknown | unimplemented
```

GitHub/Web/Apps are **not** marked available merely because the ChatGPT account has a connection or the UI shows a control. Real validation must prove the capability in this conversation path.

## Reliability principles

1. No guessed success from partial browser/UI state.
2. No blind retry after an `ambiguous` write.
3. Product observations are normalized and sensitive-looking fields are redacted.
4. The last completed generated prompt is cached privately under `~/.pi/agent/pi-chatgpt-web/cache/` for reload recovery.
5. Product/browser/Pi drift should fail closed and be diagnosable.
6. Browser credentials/profile state never belongs in the project repository.

## Current limitation

The production `BrowserOwnedTransport` is intentionally driver-injected. The repository includes P1 real-browser research probes, but the final real `BrowserTurnDriver` is not wired until those probes are validated on the target workstation. Until then, `/chatgpt ask` and `/chatgpt prompt` fail closed instead of fabricating ChatGPT output.

This boundary is intentional: it lets all workflow/config/context/capability/reliability layers be implemented and tested without encoding an unverified private ChatGPT Web protocol.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/FEATURES.md`](docs/FEATURES.md)
- [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- [`docs/PROTOCOL.md`](docs/PROTOCOL.md)
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/WEB_FEASIBILITY.md`](docs/WEB_FEASIBILITY.md)
- [`docs/RELIABILITY.md`](docs/RELIABILITY.md)
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
- [`docs/VALIDATION_CHECKLIST.md`](docs/VALIDATION_CHECKLIST.md)
- [`docs/RELEASE.md`](docs/RELEASE.md)
- [`docs/TASKS.md`](docs/TASKS.md)

## Validation status

Repository validation covers structure, source contracts, workflow invariants, secret-redaction rules, package metadata, and research-probe logic. The full workstation matrix is in `docs/VALIDATION_CHECKLIST.md`.

A stable/non-alpha release should not be cut until that real environment matrix passes.

## License

MIT.
