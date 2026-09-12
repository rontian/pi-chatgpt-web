# P1 Browser Probe Runbook

This runbook validates the first P1 browser/auth assumptions on a real workstation. It does **not** send a ChatGPT prompt yet.

## Prerequisites

- Node.js 22+
- Google Chrome installed
- repository dependencies installed

```bash
npm install
```

## Proxy-dependent Chrome setups

The P1 probe uses an isolated Chrome profile at `~/.pi/agent/pi-chatgpt-web/browser-profile`. If normal Chrome reaches ChatGPT through a proxy extension, that extension is not automatically available in the isolated profile. Configure the proxy explicitly:

```bash
export PI_CHATGPT_WEB_PROXY=http://127.0.0.1:7890
```

The value above is only an example. Use the proxy server that is valid on the workstation; the probe does not hard-code a port. A command-line override has higher priority:

```bash
node scripts/p1/browser-probe.mjs --proxy http://127.0.0.1:7890
```

Proxy precedence is:

```text
--proxy <url>
> PI_CHATGPT_WEB_PROXY
> no proxy
```

An unset or blank environment variable means no proxy. Empty explicit `--proxy` values, malformed URLs, and unsupported schemes are rejected before Chrome starts. The same proxy parsing and Playwright launch helper is used by both the browser-auth and text-turn probes.

## Fresh interactive login

Run:

```bash
npm run p1:browser
```

The probe opens the dedicated Chrome profile at:

```text
~/.pi/agent/pi-chatgpt-web/browser-profile
```

If the profile is not authenticated, finish the normal ChatGPT login in the opened browser and return to the terminal. The probe then rechecks authentication and closes the browser.

Expected success includes:

```text
authenticated: true
authSource: session|ui|session+ui
sessionEndpointStatus: 200
```

Authentication is based on sanitized positive evidence. The probe accepts known positive `/api/auth/session` evidence, logged-in UI evidence such as the composer/account controls with no visible login control, or both. A `200` response alone is not treated as authenticated, so a session schema change can fall back to UI evidence rather than forcing a false negative.

Exit codes:

- `0`: authenticated probe succeeded;
- `2`: browser opened but authenticated state was not confirmed;
- `1`: runtime/browser error.

## Restart reuse check

After a successful fresh login, start a new process:

```bash
npm run p1:browser:check
```

This is non-interactive and prints sanitized JSON. It must report `authenticated: true` without another login prompt before the P1 restart-reuse task can be marked DONE.

Then use the same profile and proxy configuration for text-turn validation:

```bash
npm run p1:turn
npm run p1:turn:continue
npm run p1:turn:five
```

## Alternate browser channel/profile

```bash
node scripts/p1/browser-probe.mjs \
  --channel chrome-beta \
  --profile-dir ~/.pi/agent/pi-chatgpt-web/browser-profile-beta \
  --proxy http://127.0.0.1:7890
```

Environment equivalents:

```text
PI_CHATGPT_WEB_BROWSER_CHANNEL
PI_CHATGPT_WEB_BROWSER_PROFILE
PI_CHATGPT_WEB_PROXY
```

Both P1 probes launch Chromium with `chromiumSandbox: true`; they do not opt into `--no-sandbox`.

## Security checks

Do not commit or paste:

- the browser profile;
- cookies;
- access tokens;
- raw `/api/auth/session` payloads;
- user email addresses or account identifiers;
- browser/network captures containing session headers.

The probe intentionally emits only sanitized state such as `authenticated`, `authSource`, `sessionEndpointStatus`, and whether a proxy was configured. It does not echo the proxy URL, which may contain credentials in some environments.

## Evidence to record for P1

Record non-secret facts only:

- OS and CPU architecture;
- Node version;
- Chrome version/channel;
- Playwright Core version;
- whether an explicit proxy was required;
- whether fresh login succeeded;
- whether a new process reused authentication;
- `authSource` used for the successful check;
- relevant failure class if either step failed.

The final evidence belongs in `docs/research/P1_WEB_FEASIBILITY_REPORT.md` once the full P1 matrix is completed.
