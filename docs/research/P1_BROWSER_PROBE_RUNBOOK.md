# P1 Browser Probe Runbook

This runbook validates the first P1 browser/auth assumptions on a real workstation. It does **not** send a ChatGPT prompt yet.

## Architecture

P1 uses a native Chrome host with an isolated profile. Playwright attaches over loopback CDP; it does not launch the interactive authentication browser.

- executable: installed Google Chrome (macOS default `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`)
- profile: `~/.pi/agent/pi-chatgpt-web/browser-profile`
- CDP: `--remote-debugging-address=127.0.0.1` and `--remote-debugging-port=0`
- attach: `chromium.connectOverCDP(http://127.0.0.1:<port>)`

The host starts Chrome with `child_process.spawn(executable, argv)`. It does not use a shell string, `--no-sandbox`, `--disable-web-security`, or Playwright's `launchPersistentContext()` argument set.

## Prerequisites

- Node.js 22+
- Google Chrome installed
- repository dependencies installed

```bash
npm install
```

## Network

Native Chrome inherits the workstation's ordinary browser network: system proxy, TUN, or VPN. In the common case **do not** configure a pi-chatgpt-web proxy.

Use an explicit override only when the isolated Chrome window cannot reach ChatGPT on that default network:

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
> browser/system default
```

An unset or blank environment variable means Chrome is launched without `--proxy-server`. Empty explicit `--proxy` values, malformed URLs, and unsupported schemes are rejected before Chrome starts. Both browser-auth and text-turn probes share this native Chrome host.

## Fresh interactive login

Run:

```bash
npm run p1:browser
```

The probe spawns ordinary Google Chrome with the dedicated profile at:

```text
~/.pi/agent/pi-chatgpt-web/browser-profile
```

Interactive login opens `https://chatgpt.com/` in ordinary Chrome **without remote debugging**. Finish a normal ChatGPT login, including Cloudflare if shown, in that visible window. The probe never types passwords, OTPs, or CAPTCHA and does not solve Turnstile.

After the ChatGPT composer is visible, return to the terminal and confirm. The probe then closes that login window, relaunches the same isolated profile with loopback CDP, runs the sanitized auth check, and closes the Chrome process it started.

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

This is non-interactive. It spawns the same native Chrome host, attaches over CDP immediately, and prints sanitized JSON. It never prompts for login. It must report `authenticated: true` without another login prompt before the P1 restart-reuse task can be marked DONE.

Then use the same profile and optional proxy override for text-turn validation:

```bash
npm run p1:turn
npm run p1:turn:continue
npm run p1:turn:five
```

If the text-turn probe is not authenticated, it fails closed and asks you to run `npm run p1:browser` first.

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
PI_CHATGPT_WEB_PROXY
PI_CHATGPT_WEB_CHROME_EXECUTABLE
```

## Profile ownership

The isolated `--user-data-dir` cannot be written by two Chrome processes at once. The native host takes a profile lock. If another P1 probe or a Chrome window already owns the profile, the new probe fails clearly and does not kill unknown Chrome processes.

## Security checks

Do not commit or paste:

- the browser profile;
- cookies;
- access tokens;
- raw `/api/auth/session` payloads;
- user email addresses or account identifiers;
- browser/network captures containing session headers.

The probe intentionally emits only sanitized state such as `authenticated`, `authSource`, `sessionEndpointStatus`, and whether a proxy override was configured. It does not echo the proxy URL, which may contain credentials in some environments.

## Evidence to record for P1

Record non-secret facts only:

- OS and CPU architecture;
- Node version;
- Chrome version/channel;
- Playwright Core version;
- whether default system/TUN/VPN network was enough;
- whether an explicit proxy override was required;
- whether fresh login succeeded;
- whether a new process reused authentication;
- `authSource` used for the successful check;
- relevant failure class if either step failed.

The final evidence belongs in `docs/research/P1_WEB_FEASIBILITY_REPORT.md` once the full P1 matrix is completed.
