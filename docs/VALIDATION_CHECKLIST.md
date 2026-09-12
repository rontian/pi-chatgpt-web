# Workstation Validation Checklist

This checklist is intentionally deferred until the repository is pulled to the user's real Pi/Chrome/ChatGPT environment.

## A. Package / Pi

- [ ] `npm install`
- [ ] `npm run validate`
- [ ] `npm run pack:check`
- [ ] `pi -e .` loads the extension
- [ ] `/chatgpt help`
- [ ] `/chatgpt status`
- [ ] `/chatgpt doctor`
- [ ] `/chatgpt config models`

## B. Browser authentication

If normal Chrome depends on a proxy extension, remember that the isolated P1 profile does not automatically inherit it. Configure the equivalent explicit proxy first, for example:

```bash
export PI_CHATGPT_WEB_PROXY=http://127.0.0.1:7890
```

`--proxy <url>` overrides the environment value. Leave the environment variable unset/blank for direct access.

- [ ] `npm run p1:browser` fresh login succeeds
- [ ] `npm run p1:browser:check` succeeds in a new process
- [ ] output reports `authSource` as `session`, `ui`, or `session+ui`
- [ ] browser profile is isolated from normal Chrome
- [ ] proxy-dependent setup works with explicit `PI_CHATGPT_WEB_PROXY`
- [ ] expired login produces a controlled error
- [ ] no cookies, access tokens, raw session payloads, email addresses, or account identifiers appear in probe output
- [ ] Chromium sandbox remains enabled

## C. Text turns

Use the same `PI_CHATGPT_WEB_PROXY` value, when required, for all text-turn commands:

```bash
npm run p1:turn
npm run p1:turn:continue
npm run p1:turn:five
```

- [ ] `npm run p1:turn`
- [ ] `npm run p1:turn:continue`
- [ ] `npm run p1:turn:five`
- [ ] text-turn probe reports sanitized authentication evidence before sending
- [ ] tab close/recreate test
- [ ] uncertain/timeout write does not blind retry
- [ ] canonical readback approach is selected and documented

## D. Pi workflows

After the real BrowserTurnDriver is wired:

- [ ] `/chatgpt ask 只回复 OK`
- [ ] `/chatgpt prompt <real project request>`
- [ ] generated prompt appears in Pi editor
- [ ] `/chatgpt prompt inspect`
- [ ] `/chatgpt prompt edit`
- [ ] `/chatgpt prompt send`
- [ ] `/reload`, then `/chatgpt prompt show` restores cached prompt

## E. Helper model

- [ ] `/chatgpt config models` includes OpenCodex/custom provider models
- [ ] explicit helper model resolves
- [ ] `auto` chooses an appropriate fast model
- [ ] helper disabled path still works
- [ ] large-session compression test preserves constraints

## F. Connected capabilities

- [ ] `/chatgpt capabilities` starts unknown except proven text capability
- [ ] GitHub validation uses a harmless known repository fact
- [ ] web search validation uses reproducible current/source evidence
- [ ] capability state does not become available from UI presence alone

## G. Reliability

- [ ] diagnostics redact sensitive-looking fields
- [ ] browser/Pi/package version signature recorded
- [ ] drift case fails closed
- [ ] prompt cache file permissions are private
- [ ] no credentials are committed or written into project files

Record sanitized results in a follow-up validation report before removing the alpha designation.
