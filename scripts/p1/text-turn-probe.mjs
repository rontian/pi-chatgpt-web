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
  COMPOSER_SELECTORS,
  SEND_SELECTORS,
  STOP_SELECTORS,
  USER_SELECTORS,
  countByCandidates,
  extractConversationId,
  latestText,
  normalizeText,
  sendViaUi,
  waitForAssistant,
} from "./page-session.mjs";

export {
  ASSISTANT_SELECTORS,
  COMPOSER_SELECTORS,
  SEND_SELECTORS,
  STOP_SELECTORS,
  USER_SELECTORS,
  countByCandidates,
  extractConversationId,
  firstVisible,
  latestText,
  normalizeText,
  sendViaUi,
  waitForAssistant,
} from "./page-session.mjs";

export function parseArgs(argv, env = process.env) {
  const { args, proxy } = extractProxyOption(argv, env);
  const result = {
    channel: env.PI_CHATGPT_WEB_BROWSER_CHANNEL || "chrome",
    profileDir: env.PI_CHATGPT_WEB_BROWSER_PROFILE || DEFAULT_PROFILE_DIR,
    proxy,
    headless: false,
    turns: 1,
    timeoutMs: 120_000,
    json: false,
    keepOpen: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--headless") result.headless = true;
    else if (arg === "--json") result.json = true;
    else if (arg === "--keep-open") result.keepOpen = true;
    else if (arg === "--channel") result.channel = args[++i];
    else if (arg === "--profile-dir") result.profileDir = resolve(args[++i]);
    else if (arg === "--turns") result.turns = Number.parseInt(args[++i], 10);
    else if (arg === "--timeout-ms") result.timeoutMs = Number.parseInt(args[++i], 10);
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

export const TEXT_TURN_UNAUTHENTICATED_MESSAGE =
  "ChatGPT profile is not authenticated. Run npm run p1:browser first.";

export function assertAuthenticatedForTextTurn(auth) {
  if (!auth?.authenticated) throw new Error(TEXT_TURN_UNAUTHENTICATED_MESSAGE);
}



function printHelp() {
  console.log(`P1 ChatGPT text-turn UI probe\n\nUsage:\n  npm run p1:turn\n  npm run p1:turn:continue\n  npm run p1:turn:five\n\nOptions:\n  --turns <1..5>\n  --channel <name>\n  --profile-dir <path>\n  --proxy <url>\n  --headless\n  --timeout-ms <ms>\n  --json\n  --keep-open\n\nEnvironment:\n  PI_CHATGPT_WEB_BROWSER_CHANNEL\n  PI_CHATGPT_WEB_BROWSER_PROFILE\n  PI_CHATGPT_WEB_PROXY\n  PI_CHATGPT_WEB_CHROME_EXECUTABLE\n`);
}

async function loadPlaywright() {
  return import("playwright-core");
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
    const page = await getOrOpenChatgptPage(browser);

    const auth = await probeAuthentication(page);
    assertAuthenticatedForTextTurn(auth);

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
      const beforeText = await latestText(page, ASSISTANT_SELECTORS);
      const startedAt = Date.now();
      const used = await sendViaUi(page, prompt);
      const response = await waitForAssistant(page, before.count, options.timeoutMs, beforeText);
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
      proxyConfigured: Boolean(options.proxy),
      proxyOverrideConfigured: Boolean(options.proxy),
      ...auth,
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
    if (!options.keepOpen) await closeNativeChromeSession(session);
  }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
