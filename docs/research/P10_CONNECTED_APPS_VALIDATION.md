# P10 Connected Apps Validation Runbook

Status: implementation complete; real-account validation deferred.

`pi-chatgpt-web` never marks GitHub, web search, or other ChatGPT account capabilities as available merely because the user is logged in or because a UI control exists.

## Capability states

- `unknown`: no reproducible evidence yet.
- `available`: a real product conversation produced evidence that satisfies a validation case.
- `unsupported`: the product explicitly reports the capability unsupported in the tested surface.
- `unimplemented`: the package has not wired the capability path yet.

## GitHub validation

Use a ChatGPT account where GitHub is already connected and authorized to a harmless test repository. Choose a fact that is stable and unambiguous, for example a unique token in the repository README.

Validation case shape:

```ts
{
  capability: "github",
  prompt: "Read the connected test repository and return the unique README validation token.",
  expectedSubstring: "KNOWN_SAFE_TOKEN"
}
```

PASS requires the final ChatGPT response to contain the expected repository fact, or a normalized product observation that independently proves GitHub activity. UI presence alone is insufficient.

## Web search validation

Use a time-sensitive public fact and require source/citation observations when the product surface exposes them. Text that merely sounds current is not enough to mark the capability available.

## Privacy

Do not use private secrets as validation facts. Do not log connected-app credentials, repository tokens, cookies, raw authorization headers, or private browser state.

## Reporting

After local validation, record OS/browser/Pi/package versions, ChatGPT plan/surface if relevant, the capability state, sanitized evidence type, and failure mode in the final P1/P10 validation report.
