#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createRequire } from "node:module";

const CHATGPT_URL = "https://chatgpt.com/";
const DEFAULT_PROFILE_DIR = join(
  homedir(),
  ".pi",
  "agent",
  "pi-chatgpt-web",
  "browser-profile"
);

export function parseArgs(argv) {
  const result = {
    channel: process.env.PI_CHATGPT_WEB_BROWSER_CHANNEL || "chrome",
    profileDir:
      process.env.PI_CHATGPT_WEB_BROWSER_PROFILE || DEFAULT_PROFILE_DIR,
    headless: false,
    checkOnly: false,
    json: false,
    keepOpen: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--headless") result.headless = true;
    else if (arg === "--check-only") result.checkOnly = true;
    else if (arg === "--json") result.json = true;
    else if (arg === "--keep-open") result.keepOpen = true;
    else if (arg === "--channel") result.channel = argv[++i];
    else if (arg === "--profile-dir") result.profileDir = resolve(argv[++i]);
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!result.channel) throw new Error("Browser channel must not be empty.");
  if (!result.profileDir) throw new Error("Profile directory must not be empty.");
  return result;
}

export function sanitizeSessionProbe(payload) {
  if (!payload || typeof payload !== "object") {
    return { authenticated: false, sessionEndpointStatus: null };
  }

  return {
    authenticated: Boolean(payload.authenticated),
    sessionEndpointStatus:
      Number.isInteger(payload.sessionEndpointStatus)
        ? payload.sessionEndpointStatus
        : null,
  };
}

async function probeAuth(page) {
  const result = await page.evaluate(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
      });

      let authenticated = false;
      if (response.ok) {
        const body = await response.json().catch(() => null);
        authenticated = Boolean(
          body &&
            typeof body === "object" &&
            (body.user || body.accessToken)
        );
      }

      return {
        authenticated,
        sessionEndpointStatus: response.status,
      };
    } catch {
      return {
        authenticated: false,
        sessionEndpointStatus: null,
      };
    }
  });

  return sanitizeSessionProbe(result);
}

function printHelp() {
  console.log(`P1 browser feasibility probe

Usage:
  npm run p1:browser
  npm run p1:browser:check
  node scripts/p1/browser-probe.mjs [options]

Options:
  --channel <name>       Playwright browser channel (default: chrome)
  --profile-dir <path>   Isolated persistent profile directory
  --headless             Run Chrome without a visible window
  --check-only           Do not pause for interactive login
  --json                 Print the final result as JSON
  --keep-open            Keep the browser open after the probe
  -h, --help             Show this help

Environment:
  PI_CHATGPT_WEB_BROWSER_CHANNEL
  PI_CHATGPT_WEB_BROWSER_PROFILE
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  await mkdir(options.profileDir, { recursive: true });

  const { chromium } = await loadPlaywright();
  const require = createRequire(import.meta.url);
  const playwrightVersion = require("playwright-core/package.json").version;

  const context = await chromium.launchPersistentContext(options.profileDir, {
    channel: options.channel,
    headless: options.headless,
    viewport: null,
  });

  try {
    const pages = context.pages();
    const page = pages[0] ?? (await context.newPage());

    await page.goto(CHATGPT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    let auth = await probeAuth(page);

    if (!auth.authenticated && !options.checkOnly && !options.headless) {
      console.log(
        "ChatGPT is not authenticated in the isolated profile. Complete login in the opened Chrome window."
      );
      const rl = readline.createInterface({ input, output });
      try {
        await rl.question("After login is complete, press Enter to probe again...");
      } finally {
        rl.close();
      }

      await page.goto(CHATGPT_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      auth = await probeAuth(page);
    }

    const result = {
      phase: "P1",
      probe: "browser-auth",
      playwrightVersion,
      channel: options.channel,
      profileDir: options.profileDir,
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
    await context.close();
  }
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
