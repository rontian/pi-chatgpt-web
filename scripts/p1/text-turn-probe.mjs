#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import process from "node:process";

const CHATGPT_URL = "https://chatgpt.com/";
const DEFAULT_PROFILE_DIR = join(homedir(), ".pi", "agent", "pi-chatgpt-web", "browser-profile");

export const COMPOSER_SELECTORS = [
  "#prompt-textarea",
  '[contenteditable="true"][role="textbox"]',
  'textarea[placeholder*="Ask"]',
];

export const SEND_SELECTORS = [
  '[data-testid="send-button"]',
  "#composer-submit-button",
  'button[aria-label="Send prompt"]',
];

export const ASSISTANT_SELECTORS = [
  '[data-message-author-role="assistant"]',
  '[data-role="assistant"]',
  '[data-message-author="assistant"]',
];

export const USER_SELECTORS = [
  '[data-message-author-role="user"]',
  '[data-role="user"]',
  '[data-message-author="user"]',
];

export const STOP_SELECTORS = [
  '[data-testid="stop-button"]',
  'button[aria-label*="Stop"]',
];

export function parseArgs(argv) {
  const result = {
    channel: process.env.PI_CHATGPT_WEB_BROWSER_CHANNEL || "chrome",
    profileDir: process.env.PI_CHATGPT_WEB_BROWSER_PROFILE || DEFAULT_PROFILE_DIR,
    headless: false,
    turns: 1,
    timeoutMs: 120_000,
    json: false,
    keepOpen: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--headless") result.headless = true;
    else if (arg === "--json") result.json = true;
    else if (arg === "--keep-open") result.keepOpen = true;
    else if (arg === "--channel") result.channel = argv[++i];
    else if (arg === "--profile-dir") result.profileDir = resolve(argv[++i]);
    else if (arg === "--turns") result.turns = Number.parseInt(argv[++i], 10);
    else if (arg === "--timeout-ms") result.timeoutMs = Number.parseInt(argv[++i], 10);
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(result.turns) || result.turns < 1 || result.turns > 5) {
    throw new Error("--turns must be an integer between 1 and 5.");
  }
  if (!Number.isInteger(result.timeoutMs) || result.timeoutMs < 5_000) {
    throw new Error("--timeout-ms must be an integer >= 5000.");
  }
  return result;
}

export function normalizeText(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function buildProbeToken(seedHex, turn = 1) {
  if (!/^[a-f0-9]{8,64}$/i.test(seedHex)) throw new Error("invalid probe seed");
  if (!Number.isInteger(turn) || turn < 1) throw new Error("invalid turn");
  return `PI_CHATGPT_WEB_${seedHex.toUpperCase()}_${turn}`;
}

export function buildPrompt({ turn, firstToken, token }) {
  if (turn === 1) {
    return `Reply with exactly this token and nothing else: ${token}`;
  }
  if (turn === 2) {
    return "Repeat your immediately previous assistant reply exactly. Output only that token and nothing else.";
  }
  return `Reply with exactly this token and nothing else: ${token}`;
}

export function expectedReply({ turn, firstToken, token }) {
  return turn === 2 ? firstToken : token;
}

export function summarizeTurn({ turn, expected, actual, conversationId, elapsedMs }) {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);
  return {
    turn,
    exactMatch: normalizedActual === normalizedExpected,
    responseLength: normalizedActual.length,
    responseSha256: createHash("sha256").update(normalizedActual).digest("hex"),
    conversationId: conversationId ?? null,
    elapsedMs,
  };
}

export function extractConversationId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/c\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      return { selector, locator };
    }
  }
  return null;
}

async function countByCandidates(page, selectors) {
  let best = { selector: null, count: 0 };
  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    if (count > best.count) best = { selector, count };
  }
  return best;
}

async function latestText(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count > 0) {
      const node = locator.nth(count - 1);
      if (await node.isVisible().catch(() => false)) {
        return normalizeText(await node.innerText().catch(() => ""));
      }
    }
  }
  return "";
}

async function anyVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) return true;
  }
  return false;
}

async function probeAuth(page) {
  return page.evaluate(async () => {
    try {
      const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
      if (!response.ok) return { authenticated: false, status: response.status };
      const body = await response.json().catch(() => null);
      return { authenticated: Boolean(body && typeof body === "object" && (body.user || body.accessToken)), status: response.status };
    } catch {
      return { authenticated: false, status: null };
    }
  });
}

async function sendViaUi(page, prompt) {
  const composer = await firstVisible(page, COMPOSER_SELECTORS);
  if (!composer) throw new Error("Could not find a visible ChatGPT composer. UI selectors may have changed.");

  await composer.locator.fill(prompt);
  const send = await firstVisible(page, SEND_SELECTORS);
  if (send) await send.locator.click();
  else await composer.locator.press("Enter");

  return { composerSelector: composer.selector, sendSelector: send?.selector ?? "<Enter>" };
}

async function waitForAssistant(page, beforeCount, timeoutMs) {
  const startedAt = Date.now();
  let lastText = "";
  let stableSince = 0;
  let observedSelector = null;

  while (Date.now() - startedAt < timeoutMs) {
    const current = await countByCandidates(page, ASSISTANT_SELECTORS);
    if (current.count > beforeCount) {
      observedSelector = current.selector;
      const text = await latestText(page, ASSISTANT_SELECTORS);
      if (text && text === lastText) {
        if (!stableSince) stableSince = Date.now();
      } else {
        lastText = text;
        stableSince = text ? Date.now() : 0;
      }

      const generating = await anyVisible(page, STOP_SELECTORS);
      if (text && !generating && stableSince && Date.now() - stableSince >= 2_000) {
        return { text, assistantSelector: observedSelector };
      }
    }
    await page.waitForTimeout(250);
  }

  throw new Error("Timed out waiting for a stable assistant response.");
}

function printHelp() {
  console.log(`P1 ChatGPT text-turn UI probe\n\nUsage:\n  npm run p1:turn\n  npm run p1:turn:continue\n  npm run p1:turn:five\n\nOptions:\n  --turns <1..5>\n  --channel <name>\n  --profile-dir <path>\n  --headless\n  --timeout-ms <ms>\n  --json\n  --keep-open\n`);
}

async function loadPlaywright() {
  return import("playwright-core");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();

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
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(CHATGPT_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const auth = await probeAuth(page);
    if (!auth.authenticated) throw new Error("ChatGPT profile is not authenticated. Run npm run p1:browser first.");

    const seed = randomBytes(5).toString("hex");
    const firstToken = buildProbeToken(seed, 1);
    const results = [];
    let canonicalConversationId = null;
    let selectors = null;

    for (let turn = 1; turn <= options.turns; turn += 1) {
      const token = buildProbeToken(seed, turn);
      const prompt = buildPrompt({ turn, firstToken, token });
      const expected = expectedReply({ turn, firstToken, token });
      const before = await countByCandidates(page, ASSISTANT_SELECTORS);
      const startedAt = Date.now();
      const used = await sendViaUi(page, prompt);
      const response = await waitForAssistant(page, before.count, options.timeoutMs);
      const conversationId = extractConversationId(page.url());
      canonicalConversationId ??= conversationId;
      selectors ??= { ...used, assistantSelector: response.assistantSelector };

      if (canonicalConversationId && conversationId && canonicalConversationId !== conversationId) {
        throw new Error("Conversation URL changed during the multi-turn probe.");
      }

      const summary = summarizeTurn({
        turn,
        expected,
        actual: response.text,
        conversationId,
        elapsedMs: Date.now() - startedAt,
      });
      results.push(summary);
      if (!summary.exactMatch) throw new Error(`Turn ${turn} reply did not match the probe expectation.`);
    }

    const result = {
      phase: "P1",
      probe: "text-turn-ui",
      playwrightVersion,
      channel: options.channel,
      authenticated: true,
      turnsRequested: options.turns,
      turnsPassed: results.filter((item) => item.exactMatch).length,
      sameConversation: results.every((item) => !canonicalConversationId || item.conversationId === canonicalConversationId),
      conversationIdObserved: Boolean(canonicalConversationId),
      selectors,
      turns: results,
      note: "DOM readback is research-only and is not the production canonical readback decision.",
    };

    console.log(JSON.stringify(result, null, 2));
    if (options.keepOpen) await new Promise(() => {});
  } finally {
    if (!options.keepOpen) await context.close();
  }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
