import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executeTextTurn } from "../scripts/p1/page-session.mjs";
import { BrowserRuntime } from "../scripts/p2/browser-runtime.mjs";
import { mayAutomaticallyRetry, assertRetrySafe } from "../src/reliability/drift.ts";
import { parseChatGPTCommand } from "../src/extension/parse-command.ts";

function helpers({
  authenticated = true,
  conversationId = "conv-1",
  replies = ["OK"],
  sendImpl,
  waitImpl,
} = {}) {
  let replyIndex = 0;
  let sent = 0;
  return {
    sent: () => sent,
    probeAuthentication: async () => ({
      authenticated,
      authSource: authenticated ? "session+ui" : null,
      sessionEndpointStatus: authenticated ? 200 : 401,
    }),
    countByCandidates: async () => ({ selector: '[data-message-author-role="assistant"]', count: replyIndex }),
    latestText: async () => replies[Math.max(0, replyIndex - 1)] ?? "",
    latestMessageId: async () => (replyIndex ? `msg-${replyIndex}` : undefined),
    sendViaUi: sendImpl ?? (async () => {
      sent += 1;
      replyIndex += 1;
      return { composerSelector: "#prompt-textarea", sendSelector: '[data-testid="send-button"]' };
    }),
    waitForAssistant: waitImpl ?? (async () => ({
      text: replies[Math.min(replyIndex, replies.length) - 1] ?? replies.at(-1),
      assistantSelector: '[data-message-author-role="assistant"]',
      assistantMessageId: `msg-${replyIndex}`,
    })),
    extractConversationId: () => conversationId,
    conversationUrl: (id) => `https://chatgpt.com/c/${id}`,
  };
}

function fakePage(url = "https://chatgpt.com/") {
  return {
    url: () => url,
    waitForTimeout: async () => {},
    locator: () => ({
      first: () => ({ count: async () => 0, isVisible: async () => false, innerText: async () => "" }),
      nth: () => ({ count: async () => 0, isVisible: async () => false, innerText: async () => "", getAttribute: async () => null }),
      count: async () => 0,
    }),
  };
}

function fakeHost() {
  const launches = [];
  const pages = [fakePage("https://chatgpt.com/")];
  const browser = {
    close: async () => {},
    contexts: () => [{
      pages: () => pages,
      clearCookies: async () => { browser.cleared = true; },
    }],
  };
  browser.cleared = false;
  return {
    launches,
    browser,
    CHATGPT_URL: "https://chatgpt.com/",
    DEFAULT_PROFILE_DIR: "/tmp/pi-chatgpt-web-test-profile",
    findChromeExecutable: () => "/tmp/Google Chrome",
    launchNativeChromeSession: async (options) => {
      launches.push(options);
      return {
        endpoint: options.enableCdp === false ? null : "http://127.0.0.1:9",
        cdpEnabled: options.enableCdp !== false,
        profileDir: options.profileDir,
        browser: null,
      };
    },
    closeNativeChromeSession: async () => {},
    connectPlaywrightOverCdp: async () => browser,
    getOrOpenChatgptPage: async () => pages[0],
  };
}

test("executeTextTurn completes a mocked authenticated send", async () => {
  const result = await executeTextTurn(fakePage("https://chatgpt.com/c/conv-1"), { text: "只回复 OK" }, helpers());
  assert.equal(result.status, "completed");
  assert.equal(result.text, "OK");
  assert.equal(result.conversationId, "conv-1");
  assert.equal(result.provenance.browserOwnedWrite, true);
  assert.equal(result.provenance.reconciledReadback, false);
});

test("unauthenticated executeTextTurn fails closed without sending", async () => {
  const h = helpers({ authenticated: false });
  const result = await executeTextTurn(fakePage(), { text: "hello" }, h);
  assert.equal(result.status, "failed");
  assert.equal(h.sent(), 0);
  assert.match(result.text, /not authenticated/i);
});

test("timeout after send is ambiguous and never retried automatically", async () => {
  const timeout = Object.assign(new Error("Timed out waiting for a stable assistant response."), { code: "TURN_TIMEOUT" });
  const h = helpers({
    waitImpl: async () => {
      throw timeout;
    },
  });
  const result = await executeTextTurn(fakePage("https://chatgpt.com/c/conv-1"), { text: "hello" }, h);
  assert.equal(result.status, "ambiguous");
  assert.equal(h.sent(), 1);
  assert.equal(result.provenance.browserOwnedWrite, true);
  assert.equal(mayAutomaticallyRetry(result.status), false);
  assert.throws(() => assertRetrySafe(result.status), /reconciled before retry/);
});

test("BrowserOwnedTransport still rejects already-reconciled ambiguous writes", () => {
  const source = readFileSync(new URL("../src/transport/browser-owned.ts", import.meta.url), "utf8");
  assert.match(source, /status === "ambiguous" && result.provenance.reconciledReadback/);
  assert.match(source, /cannot already be marked reconciled/);
});

test("login confirm is a distinct command", () => {
  assert.equal(parseChatGPTCommand("login").action, "start");
  assert.equal(parseChatGPTCommand("login confirm").action, "confirm");
});

test("BrowserRuntime login does not enable CDP and status does not attach while waiting", async () => {
  const host = fakeHost();
  const runtime = new BrowserRuntime({ host });
  const login = await runtime.login();
  assert.equal(login.ok, true);
  assert.equal(host.launches.at(-1).enableCdp, false);
  const health = await runtime.health();
  assert.equal(health.ok, false);
  assert.match(health.detail, /login confirm/);
  assert.equal(host.launches.filter((item) => item.enableCdp).length, 0);
});

test("BrowserRuntime attach uses loopback CDP after login confirm", async () => {
  const host = fakeHost();
  const runtime = new BrowserRuntime({
    host,
    playwrightLoader: async () => ({ chromium: { connectOverCDP: async () => host.browser } }),
  });
  await runtime.login();
  await runtime.confirmLogin();
  const attached = await runtime.attach();
  assert.ok(attached.page);
  assert.equal(host.launches.at(-1).enableCdp, true);
  assert.equal(host.launches.filter((item) => item.enableCdp === false).length, 1);
  assert.equal(host.launches.filter((item) => item.enableCdp).length, 1);
});
