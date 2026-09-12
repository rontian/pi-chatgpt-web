# P1 Browser Probe Runbook

This runbook validates the first P1 browser/auth assumptions on a real workstation. It does **not** send a ChatGPT prompt yet.

## Prerequisites

- Node.js 22+
- Google Chrome installed
- repository dependencies installed

```bash
npm install
```

## Fresh interactive login

Run:

```bash
npm run p1:browser
```

The probe opens a dedicated Chrome profile at:

```text
~/.pi/agent/pi-chatgpt-web/browser-profile
```

If the profile is not authenticated, finish the normal ChatGPT login in the opened browser and return to the terminal. The probe then rechecks authentication and closes the browser.

Expected success:

```text
authenticated: true
sessionEndpointStatus: 200
```

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

## Alternate browser channel/profile

```bash
node scripts/p1/browser-probe.mjs \
  --channel chrome-beta \
  --profile-dir ~/.pi/agent/pi-chatgpt-web/browser-profile-beta
```

Environment equivalents:

```text
PI_CHATGPT_WEB_BROWSER_CHANNEL
PI_CHATGPT_WEB_BROWSER_PROFILE
```

## Security checks

Do not commit or paste:

- the browser profile;
- cookies;
- access tokens;
- raw `/api/auth/session` payloads;
- browser/network captures containing session headers.

The probe intentionally emits only sanitized state.

## Evidence to record for P1

Record non-secret facts only:

- OS and CPU architecture;
- Node version;
- Chrome version/channel;
- Playwright Core version;
- whether fresh login succeeded;
- whether a new process reused authentication;
- relevant failure class if either step failed.

The final evidence belongs in `docs/research/P1_WEB_FEASIBILITY_REPORT.md` once the full P1 matrix is completed.
