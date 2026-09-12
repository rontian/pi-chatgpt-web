# Troubleshooting

## `/chatgpt status` says transport not ready

Expected before local P1 validation and real BrowserTurnDriver wiring. Run the repository's P1 probes first and keep the browser profile isolated from your daily Chrome profile.

## Helper model is unresolved

Run:

```text
/chatgpt config models
```

Then choose an exact Pi/OpenCodex model key:

```text
/chatgpt config assistant-model provider/model
```

Or use `auto`. The package does not register a second provider catalogue.

## `/chatgpt prompt` fails immediately

Inspect:

```text
/chatgpt doctor
/chatgpt capabilities
```

Before real browser-driver wiring, prompt/ask workflows are expected to fail closed rather than return fake ChatGPT output.

## Prompt disappeared after reload

The last completed prompt is restored from the user-local prompt cache. Use:

```text
/chatgpt prompt show
/chatgpt prompt inspect
```

If there is no completed cache, generate a new prompt.

## Browser/login problems

Use the P1 runbook and sanitized probes:

```bash
npm run p1:browser
npm run p1:browser:check
```

Do not paste cookies, auth payloads, browser-profile files, or authorization headers into issues.

## ChatGPT UI/product changed

Treat selector/readback failures as product drift. Capture only redacted diagnostics and version information. Do not add blind fallback selectors that can accidentally submit or read the wrong conversation.

## Ambiguous write

Do not immediately retry. If a write may have reached ChatGPT, inspect/reconcile the conversation first. Duplicate messages are worse than a controlled failure.

## Connected GitHub/Web/App capability stays unknown

This is expected until a reproducible validation case passes. An account connection or visible UI control alone does not mark a capability available.
