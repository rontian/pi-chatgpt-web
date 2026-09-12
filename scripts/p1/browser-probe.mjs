#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createRequire } from "node:module";
import {
  extractProxyOption,
  probeAuthentication,
  sanitizeAuthProbe,
  sanitizeSessionProbe,
} from "./browser-probe-helpers.mjs";
import {
  CHATGPT_URL,
  DEFAULT_PROFILE_DIR,
  closeNativeChromeSession,
  connectPlaywrightOverCdp,
  getOrOpenChatgptPage,
  launchNativeChromeSession,
} from "./native-chrome-host.mjs";

export function parseArgs(argv, env = process.env) {
  const { args, proxy } = extractProxyOption(argv, env);
  const result = {
    channel: env.PI_CHATGPT_WEB_BROWSER_CHANNEL || "chrome",
    profileDir: env.PI_CHATGPT_WEB_BROWSER_PROFILE || DEFAULT_PROFILE_DIR,
    proxy,
    headless: false,
    checkOnly: false,
    json: false,
    keepOpen: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--headless") result.headless = true;
    else if (arg === "--check-only") result.checkOnly = true;
    else if (arg === "--json") result.json = true;
    else if (arg === "--keep-open") result.keepOpen = true;
    else if (arg === "--channel") result.channel = args[++i];
    else if (arg === "--profile-dir") result.profileDir = resolve(args[++i]);
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!result.channel) throw new Error("Browser channel must not be empty.");
  if (!result.profileDir) throw new Error("Profile directory must not be empty.");
  return result;
}

export { sanitizeAuthProbe, sanitizeSessionProbe };

export function browserProbeAttachPolicy(options) {
  return options.checkOnly || options.headless
    ? "attach-immediately"
    : "login-without-cdp-then-reattach";
}

function printHelp() {
  console.log(`P1 browser feasibility probe

Usage:
  npm run p1:browser
  npm run p1:browser:check
  node scripts/p1/browser-probe.mjs [options]

Options:
  --channel <name>       Installed Chrome channel (default: chrome)
  --profile-dir <path>   Isolated native Chrome profile directory
  --proxy <url>          Optional native Chrome proxy override
  --headless             Run Chrome without a visible window
  --check-only           Do not pause for interactive login
  --json                 Print the final result as JSON
  --keep-open            Keep the browser open after the probe
  -h, --help             Show this help

Environment:
  PI_CHATGPT_WEB_BROWSER_CHANNEL
  PI_CHATGPT_WEB_BROWSER_PROFILE
  PI_CHATGPT_WEB_PROXY
  PI_CHATGPT_WEB_CHROME_EXECUTABLE
`);
}

async function loadPlaywright() {
  try {
    return await import("playwright-core");
  } catch (error) {
    throw new Error(
      "playwright-core is not installed. Run npm install before the P1 browser probe.",
      { cause: error }
    );
  }
}

async function waitForInteractiveLoginConfirmation() {
  console.log(
    [
      `Opened ordinary Google Chrome with the isolated P1 profile.`,
      `This login window does not enable remote debugging.`,
      `If ChatGPT composer is already visible, return here and confirm.`,
      `If not signed in, finish login, Cloudflare, password, and OTP in that window.`,
      `This probe will not type a password, OTP, or CAPTCHA.`,
      `After the composer is visible, return to this terminal and confirm.`,
      `The probe will then close that window and reopen the same profile over loopback CDP.`,
    ].join("\n")
  );
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question("After ChatGPT composer is visible, press Enter to reopen over CDP and probe...");
  } finally {
    rl.close();
  }
}

async function attachAndProbe({ chromium, session }) {
  const browser = await connectPlaywrightOverCdp(chromium, session.endpoint);
  session.browser = browser;
  const page = await getOrOpenChatgptPage(browser);
  const auth = await probeAuthentication(page);
  return { page, auth };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const { chromium } = await loadPlaywright();
  const require = createRequire(import.meta.url);
  const playwrightVersion = require("playwright-core/package.json").version;
  const interactiveLogin = !options.checkOnly && !options.headless;
  let session = await launchNativeChromeSession({
    channel: options.channel,
    profileDir: options.profileDir,
    proxy: options.proxy,
    headless: options.headless,
    startUrl: CHATGPT_URL,
    enableCdp: !interactiveLogin,
  });

  try {
    if (interactiveLogin) {
      await waitForInteractiveLoginConfirmation();
      await closeNativeChromeSession(session);
      session = await launchNativeChromeSession({
        channel: options.channel,
        profileDir: options.profileDir,
        proxy: options.proxy,
        headless: options.headless,
        startUrl: CHATGPT_URL,
        enableCdp: true,
      });
    }

    const { page, auth } = await attachAndProbe({ chromium, session });
    const result = {
      phase: "P1",
      probe: "browser-auth",
      playwrightVersion,
      channel: options.channel,
      profileDir: options.profileDir,
      proxyConfigured: Boolean(options.proxy),
      proxyOverrideConfigured: Boolean(options.proxy),
      pageUrl: page.url(),
      pageTitle: await page.title(),
      ...auth,
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("P1 browser probe result:");
      for (const [key, value] of Object.entries(result)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    if (options.keepOpen) {
      const rl = readline.createInterface({ input, output });
      try {
        await rl.question("Press Enter to close the browser...");
      } finally {
        rl.close();
      }
    }

    if (!result.authenticated) process.exitCode = 2;
  } finally {
    await closeNativeChromeSession(session, { keepOpen: false });
  }
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
