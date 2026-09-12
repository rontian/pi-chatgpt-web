# pi-chatgpt-web

`pi-chatgpt-web` is a Pi package that bridges Pi workflows to a user's authenticated ChatGPT Web product session.

> Status: **P1 Web Feasibility in progress**. The browser automation decision and sanitized persistent-profile auth probe are implemented. A real authenticated ChatGPT text turn is intentionally not implemented until the remaining P1 evidence is observed and recorded.

## Goals

- Register a single top-level Pi command: `/chatgpt`.
- Preserve a subcommand hierarchy such as `/chatgpt status`, `/chatgpt ask`, and `/chatgpt prompt`.
- Treat ChatGPT Web as a **product bridge/tool**, not as a Pi provider or primary model.
- Support multi-turn ChatGPT conversations until a workflow reaches its final result.
- Keep Pi session context separate from ChatGPT conversation context.
- Optionally use a configurable helper model from Pi/OpenCodex's model registry for context extraction, compression, or fallback classification.
- Keep the core transport independent from workflow logic so future ChatGPT product capabilities (GitHub, web search, apps, files) can be observed without redesigning the Pi command layer.

## Non-goals for the first implementation

- No ChatGPT provider registration.
- No local Pi tool-calling bridge.
- No GitHub/Web/App control in v0.
- No bulk repository upload to ChatGPT.
- No blind retries of ambiguous ChatGPT writes.
- No credential or cookie export to project files.

## Planned command surface

```text
/chatgpt help
/chatgpt status
/chatgpt login
/chatgpt logout
/chatgpt doctor

/chatgpt ask <request>

/chatgpt prompt <request>
/chatgpt prompt show
/chatgpt prompt edit
/chatgpt prompt send
/chatgpt prompt retry
/chatgpt prompt inspect

/chatgpt config
```

Only `help` and the bootstrap `status` path are currently wired. Other commands deliberately report that their milestone is not implemented yet.

## Installation during development

From GitHub:

```bash
pi install git:github.com/rontian/pi-chatgpt-web
```

Or try without installing:

```bash
pi -e git:github.com/rontian/pi-chatgpt-web
```

Pi packages may declare extension entry points under the `pi` key in `package.json`; this repository uses `./src/index.ts`.

## P1 browser feasibility probe

P1 currently uses `playwright-core@1.63.0` with installed Chrome and an isolated persistent profile.

```bash
npm install
npm run p1:browser
```

After a successful login, a new process can check profile reuse with:

```bash
npm run p1:browser:check
```

See `docs/research/P1_BROWSER_PROBE_RUNBOOK.md`. The probe does not print cookies, access tokens, account identifiers, or raw session payloads.

## Architecture

```text
Pi Session
    │
    ▼
/chatgpt command
    │
    ▼
Workflow Layer ──────────────── Helper Model Adapter (optional)
    │                              │
    │                              └─ context extraction/compression only
    ▼
ChatGPT Product Runtime
    │
    ├─ Conversation Runtime
    ├─ Capability Observation
    └─ Execution Provenance
    │
    ▼
Product Transport
    │
    ▼
Browser/Auth Runtime
    │
    ▼
chatgpt.com
```

See:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/FEATURES.md`](docs/FEATURES.md)
- [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- [`docs/PROTOCOL.md`](docs/PROTOCOL.md)
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/WEB_FEASIBILITY.md`](docs/WEB_FEASIBILITY.md)
- [`docs/TASKS.md`](docs/TASKS.md)

## Development

```bash
npm install
npm run check
npm test
```

The browser research dependency is `playwright-core`, which does not download a bundled browser. The P1 probe uses an installed Chrome channel and a dedicated package profile.

## Project principles

1. **Core before workflow.** Prove authenticated ChatGPT Web text turns before implementing prompt orchestration.
2. **No guessed private protocol.** Capture and document observed behavior; do not encode speculative payloads.
3. **Browser-owned protected writes.** Prefer a real authenticated browser context for protected product writes unless testing proves a safer/stabler alternative.
4. **Canonical readback.** A successful write is not final until the resulting conversation state is read back and reconciled.
5. **Ambiguous writes are not retryable by default.** If a timeout happens after a possibly-successful write, reconcile first.
6. **Contexts remain separate.** Pi Session and ChatGPT Conversation are independent state machines.
7. **Helper model is optional.** The product bridge must remain usable without another model.
8. **Product capabilities are observed, not assumed.** Account-connected GitHub/web/apps are future capabilities to verify experimentally.

## License

MIT.
