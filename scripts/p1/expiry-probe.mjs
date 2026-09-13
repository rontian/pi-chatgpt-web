#!/usr/bin/env node
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import process from "node:process";
import { extractProxyOption, probeAuthentication } from "./browser-probe-helpers.mjs";
import {
  CHATGPT_URL,
  DEFAULT_PROFILE_DIR,
  closeNativeChromeSession,
  connectPlaywrightOverCdp,
  getOrOpenChatgptPage,
  launchNativeChromeSession,
} from "./native-chrome-host.mjs";
import { classifyExpiredAuthProbe } from "./safety-probes.mjs";

export function parseArgs(argv, env = process.env) {
  const { args, proxy } = extractProxyOption(argv, env);
  const result = {
    channel: env.PI_CHATGPT_WEB_BROWSER_CHANNEL || "chrome",
    profileDir: env.PI_CHATGPT_WEB_BROWSER_PROFILE || DEFAULT_PROFILE_DIR,
    proxy,
    headless: false,
    json: false,
    emptyProfile: true,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--headless") result.headless = true;
    else if (arg === "--json") result.json = true;
    else if (arg === "--use-existing-profile") result.emptyProfile = false;
    else if (arg === "--channel") result.channel = args[++i];
    else if (arg === "--profile-dir") result.profileDir = resolve(args[++i]);
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function printHelp() {
  console.log(`P1 expired/unauthenticated auth probe

Usage:
  npm run p1:expiry

Default: launch an empty isolated profile so the real logged-in P1
profile is not cleared. Expect authenticated=false and a controlled
error class instead of a crash or secret leak.
`);
}

async function loadPlaywright() {
  return import("playwright-core");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();

  const profileDir = options.emptyProfile
    ? await mkdtemp(join(tmpdir(), "pi-chatgpt-web-expiry-"))
    : options.profileDir;

  const { chromium } = await loadPlaywright();
  const require = createRequire(import.meta.url);
  const playwrightVersion = require("playwright-core/package.json").version;
  const session = await launchNativeChromeSession({
    channel: options.channel,
    profileDir,
    proxy: options.proxy,
    headless: options.headless,
    startUrl: CHATGPT_URL,
  });

  try {
    const browser = await connectPlaywrightOverCdp(chromium, session.endpoint);
    session.browser = browser;
    const page = await getOrOpenChatgptPage(browser);
    const auth = await probeAuthentication(page);
    const classified = classifyExpiredAuthProbe({
      sessionAuthenticated: auth.authenticated && auth.authSource !== "ui",
      uiAuthenticated: auth.authenticated && auth.authSource !== "session",
      sessionEndpointStatus: auth.sessionEndpointStatus,
    });
    const result = {
      phase: "P1",
      probe: "auth-expiry",
      playwrightVersion,
      channel: options.channel,
      emptyProfile: options.emptyProfile,
      proxyConfigured: Boolean(options.proxy),
      proxyOverrideConfigured: Boolean(options.proxy),
      pageUrlHost: safeHost(page.url()),
      ...classified,
    };
    console.log(JSON.stringify(result, null, 2));
    if (classified.authenticated) process.exitCode = 2;
  } finally {
    await closeNativeChromeSession(session);
  }
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
