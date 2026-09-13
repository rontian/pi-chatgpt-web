# Troubleshooting

## `/chatgpt status` says transport not ready

Usually the isolated profile is not authenticated, Chrome is missing, or `/chatgpt login` is waiting for `/chatgpt login confirm`. Login still happens in ordinary Chrome without CDP. Daily Chrome is not the P1/P2 profile.

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

If the isolated profile is not authenticated, prompt/ask fail closed rather than return fake ChatGPT output. Command-path proof is `npm run p4:ask`; Pi TUI `/chatgpt ask` is a separate validation.

## Prompt disappeared after reload

The last completed prompt is restored from the user-local prompt cache. Use:

```text
/chatgpt prompt show
/chatgpt prompt inspect
```

If there is no completed cache, generate a new prompt.

## Browser/login problems

Use `/chatgpt login` then `/chatgpt login confirm`, or the P1 runbook:

```bash
npm run p1:browser
npm run p1:browser:check
npm run p2:live
```

Do not paste cookies, auth payloads, browser-profile files, or authorization headers into issues.

## ChatGPT UI/product changed

Treat selector/readback failures as product drift. Capture only redacted diagnostics and version information. Do not add blind fallback selectors that can accidentally submit or read the wrong conversation.

## Ambiguous write

Do not immediately retry. If a write may have reached ChatGPT, inspect/reconcile the conversation first. Duplicate messages are worse than a controlled failure.

## Connected GitHub/Web/App capability stays unknown

This is expected until a reproducible validation case passes. An account connection or visible UI control alone does not mark a capability available.
