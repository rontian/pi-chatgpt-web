# Reliability and Recovery

`pi-chatgpt-web` treats ChatGPT Web as a changing product surface. Reliability therefore means controlled failure, evidence, and recovery rather than assuming private product details are stable.

## Rules

1. Never automatically retry an `ambiguous` write.
2. Reconcile remote conversation state before any resend after an uncertain write.
3. Keep Pi Session state separate from ChatGPT workflow conversation state.
4. Treat connected capabilities as evidence-driven and revocable.
5. Redact secrets from all diagnostic artifacts.
6. Preserve the last completed generated prompt in a user-local cache so Pi reloads do not destroy it.

## Compatibility signature

Diagnostics may record non-secret version/signature data:

- package version;
- Pi version;
- Node version;
- Playwright version;
- browser channel/version;
- transport name;
- readback mode.

A changed signature is a warning, not proof of failure. Local validation should be repeated after significant browser/ChatGPT/Pi changes.

## Recovery classes

### Browser unavailable / login expired

Fail closed and report an actionable health error. Do not silently switch to another account, provider, or API.

### Stale tab / browser restart

The production browser driver should recreate its page/context from the isolated persistent profile, then run an auth/health probe before allowing writes.

### Ambiguous write

A timeout or local exception after the send commit point must return `ambiguous`. Automatic retry is forbidden until reconciliation proves the prior write did not land.

### Product drift

Missing selectors, changed message structures, or unexpected completion behavior should produce a diagnosable failure. The package must not fabricate a successful response from partial UI state.

## Prompt cache

The last completed prompt is stored at:

```text
~/.pi/agent/pi-chatgpt-web/cache/last-prompt.json
```

The file is written with mode `0600`. It contains generated prompt text and workflow metadata, but no browser credentials.

## Diagnostic bundles

Diagnostic helpers recursively redact fields whose names suggest tokens, cookies, credentials, sessions, authorization headers, or API keys. Review any bundle before sharing it publicly.
