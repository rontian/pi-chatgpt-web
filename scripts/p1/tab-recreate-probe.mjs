#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
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
import {
  ASSISTANT_SELECTORS,
  assertAuthenticatedForTextTurn,
  buildProbeToken,
  countByCandidates,
  extractConversationId,
  latestText,
  sendViaUi,
  summarizeTurn,
  waitForAssistant,
} from "./text-turn-probe.mjs";

export function parseArgs(argv, env = process.env) {
  const { args, proxy } = extractProxyOption(argv, env);
  const result = {
    channel: env.PI_CHATGPT_WEB_BROWSER_CHANNEL || "chrome",
    profileDir: env.PI_CHATGPT_WEB_BROWSER_PROFILE || DEFAULT_PROFILE_DIR,
    proxy,
    headless: false,
    timeoutMs: 120_000,
    json: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--headless") result.headless = true;
    else if (arg === "--json") result.json = true;
    else if (arg === "--channel") result.channel = args[++i];
    else if (arg === "--profile-dir") result.profileDir = resolve(args[++i]);
    else if (arg === "--timeout-ms") result.timeoutMs = Number.parseInt(args[++i], 10);
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(result.timeoutMs) || result.timeoutMs < 5_000) {
    throw new Error("--timeout-ms must be an integer >= 5000.");
  }
  return result;
}

export function conversationUrl(conversationId) {
  if (!conversationId) throw new Error("conversationId is required to reopen a ChatGPT tab.");
  return `https://chatgpt.com/c/${conversationId}`;
}

function printHelp() {
  console.log(`P1 ChatGPT tab recreation probe

Usage:
  npm run p1:tab

The probe sends one exact-token turn, closes the ChatGPT tab, reopens the
same conversation URL, and checks that the hashed assistant reply is still
visible. It does not send a second turn.
`);
}

async function loadPlaywright() {
  return import("playwright-core");
}

async function runOneTurn(page, timeoutMs) {
  const seed = randomBytes(5).toString("hex");
  const token = buildProbeToken(seed, 1);
  const prompt = `Reply with exactly this token and nothing else: ${token}`;
  const before = await countByCandidates(page, ASSISTANT_SELECTORS);
  const beforeText = await latestText(page, ASSISTANT_SELECTORS);
  const startedAt = Date.now();
  const used = await sendViaUi(page, prompt);
  const response = await waitForAssistant(page, before.count, timeoutMs, beforeText);
  const conversationId = extractConversationId(page.url());
  if (!conversationId) throw new Error("Conversation URL was not observed after the first turn.");
  const summary = summarizeTurn({
    turn: 1,
    expected: token,
    actual: response.text,
    conversationId,
    elapsedMs: Date.now() - startedAt,
  });
  if (!summary.exactMatch) throw new Error("Turn 1 reply did not match the probe expectation.");
  return {
    tokenHash: createHash("sha256").update(token).digest("hex"),
    summary,
    selectors: { ...used, assistantSelector: response.assistantSelector },
    responseSha256: summary.responseSha256,
  };
}

export async function recreateConversationTab(page, conversationId) {
  const context = page.context();
  await page.close();
  const restored = await context.newPage();
  await restored.goto(conversationUrl(conversationId), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  return { restored };
}

export async function waitForRestoredAssistant(page, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const text = await latestText(page, ASSISTANT_SELECTORS);
    if (text) return text;
    await page.waitForTimeout(250);
  }
  return "";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();

  const { chromium } = await loadPlaywright();
  const require = createRequire(import.meta.url);
  const playwrightVersion = require("playwright-core/package.json").version;
  const session = await launchNativeChromeSession({
    channel: options.channel,
    profileDir: options.profileDir,
    proxy: options.proxy,
    headless: options.headless,
    startUrl: CHATGPT_URL,
  });

  try {
    const browser = await connectPlaywrightOverCdp(chromium, session.endpoint);
    session.browser = browser;
    let page = await getOrOpenChatgptPage(browser);
    const auth = await probeAuthentication(page);
    assertAuthenticatedForTextTurn(auth);

    const first = await runOneTurn(page, options.timeoutMs);
    const { restored } = await recreateConversationTab(page, first.summary.conversationId);
    page = restored;

    const restoredAuth = await probeAuthentication(page);
    assertAuthenticatedForTextTurn(restoredAuth);
    const restoredConversationId = extractConversationId(page.url());
    const restoredText = await waitForRestoredAssistant(page, options.timeoutMs);
    const restoredHash = createHash("sha256").update(restoredText).digest("hex");
    const restoredExact = restoredHash === first.responseSha256;

    const result = {
      phase: "P1",
      probe: "tab-recreate",
      playwrightVersion,
      channel: options.channel,
      proxyConfigured: Boolean(options.proxy),
      proxyOverrideConfigured: Boolean(options.proxy),
      ...restoredAuth,
      conversationId: first.summary.conversationId,
      conversationIdRestored: restoredConversationId === first.summary.conversationId,
      firstTurnExactMatch: first.summary.exactMatch,
      restoredExactMatch: restoredExact,
      restoredResponseLength: restoredText.length,
      restoredResponseSha256: restoredHash,
      selectors: first.selectors,
      note: "Tab recreation reopens the conversation URL after closing the product tab. DOM readback remains research-only.",
    };

    console.log(JSON.stringify(result, null, 2));
    if (!result.conversationIdRestored || !result.restoredExactMatch) process.exitCode = 2;
  } finally {
    await closeNativeChromeSession(session);
  }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
