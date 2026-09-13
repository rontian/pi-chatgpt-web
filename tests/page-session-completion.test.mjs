import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyGeneratingEvidence,
  executeTextTurn,
  hasNewAssistantTurn,
  inspectGeneratingControls,
  reconcileTimedOutTurn,
  waitForAssistant,
} from "../scripts/p1/page-session.mjs";
import { handleOperationalCommand } from "../scripts/p4/command-handler.mjs";
import { parseChatGPTCommand } from "../src/extension/parse-command.ts";

function node({ visible = true, text = "", id = null, attrs = {}, tagName = "BUTTON" } = {}) {
  return {
    text,
    id,
    isVisible: async () => visible,
    innerText: async () => text,
    getAttribute: async (name) => {
      if (name === "data-message-id") return id ?? attrs["data-message-id"] ?? null;
      if (name === "data-testid") return attrs["data-testid"] ?? null;
      if (name === "aria-label") return attrs["aria-label"] ?? null;
      if (name === "title") return attrs.title ?? null;
      if (name === "disabled") return attrs.disabled ? "true" : null;
      return attrs[name] ?? null;
    },
    evaluate: async (fn) => fn({ tagName }),
  };
}

function fakePage(state) {
  let now = 0;
  return {
    now: () => now,
    sleep: async (ms) => {
      now += ms;
      await state.onTick?.(now);
    },
    url: () => state.url ?? "https://chatgpt.com/c/conv-1",
    waitForTimeout: async (ms) => {
      now += ms;
      await state.onTick?.(now);
    },
    locator(selector) {
      const nodes = state.nodes[selector] ?? [];
      return {
        count: async () => nodes.length,
        first: () => nodes[0] ?? node({ visible: false }),
        nth: (index) => nodes[index] ?? node({ visible: false }),
      };
    },
  };
}

function authHelpers(pageState, extra = {}) {
  let sent = 0;
  return {
    sent: () => sent,
    probeAuthentication: async () => ({ authenticated: true, authSource: "session+ui", sessionEndpointStatus: 200 }),
    countByCandidates: async (_page, selectors) => {
      const selector = selectors[0];
      return { selector, count: (pageState.nodes[selector] ?? []).length };
    },
    latestText: async (_page, selectors) => {
      const nodes = pageState.nodes[selectors[0]] ?? [];
      return nodes.at(-1)?.text ?? "";
    },
    latestMessageId: async (_page, selectors) => {
      const nodes = pageState.nodes[selectors[0]] ?? [];
      return nodes.at(-1)?.id;
    },
    inspectGeneratingControls: (target) => inspectGeneratingControls(target),
    sendViaUi: extra.sendViaUi ?? (async () => {
      sent += 1;
      extra.afterSend?.();
      return { composerSelector: "#prompt-textarea", sendSelector: '[data-testid="send-button"]' };
    }),
    waitForAssistant: extra.waitForAssistant,
    extractConversationId: () => "conv-1",
    conversationUrl: (id) => `https://chatgpt.com/c/${id}`,
  };
}

test("baseline weak Stop control is not strong generation evidence", () => {
  const baseline = [{
    selector: 'button[aria-label*="Stop"]',
    totalCount: 1,
    visibleCount: 1,
    visibleMatches: [{
      selector: 'button[aria-label*="Stop"]',
      tagName: "BUTTON",
      ariaLabel: "Stop something unrelated",
      testId: null,
      title: null,
      disabled: false,
    }],
  }];
  const current = structuredClone(baseline);
  const evidence = classifyGeneratingEvidence(current, baseline);
  assert.equal(evidence.generating, false);
  assert.equal(evidence.baselineCount, 1);
  assert.equal(evidence.weakCount, 0);
  assert.equal(evidence.strongCount, 0);
});

test("new stop-button is strong generation evidence", () => {
  const evidence = classifyGeneratingEvidence([{
    selector: '[data-testid="stop-button"]',
    totalCount: 1,
    visibleCount: 1,
    visibleMatches: [{
      selector: '[data-testid="stop-button"]',
      tagName: "BUTTON",
      ariaLabel: "Stop generating",
      testId: "stop-button",
      title: null,
      disabled: false,
    }],
  }], []);
  assert.equal(evidence.generating, true);
  assert.equal(evidence.strongCount, 1);
});

test("new assistant turn identity does not require text change", () => {
  assert.equal(hasNewAssistantTurn({
    countAdvanced: true,
    textAdvanced: false,
    assistantMessageId: "msg-2",
    beforeMessageId: "msg-1",
  }), true);
  assert.equal(hasNewAssistantTurn({
    countAdvanced: false,
    textAdvanced: false,
    assistantMessageId: "msg-2",
    beforeMessageId: "msg-1",
  }), true);
  assert.equal(hasNewAssistantTurn({
    countAdvanced: false,
    textAdvanced: false,
    assistantMessageId: "msg-1",
    beforeMessageId: "msg-1",
  }), false);
});

test("baseline unrelated Stop does not keep generating true after stable OK", async () => {
  const assistant = node({
    visible: true,
    text: "OK",
    id: "msg-1",
    tagName: "DIV",
    attrs: { "data-message-id": "msg-1" },
  });
  const unrelated = node({
    visible: true,
    tagName: "BUTTON",
    attrs: { "aria-label": "Stop something unrelated" },
  });
  const state = {
    nodes: {
      '[data-message-author-role="assistant"]': [assistant],
      'button[aria-label*="Stop"]': [unrelated],
    },
  };
  const page = fakePage(state);
  const result = await waitForAssistant(page, 0, 5_000, "", undefined, {
    generatingBaseline: await inspectGeneratingControls(page),
    now: page.now,
    sleep: page.sleep,
  });
  assert.equal(result.text, "OK");
  assert.equal(result.generatingEvidence.generating, false);
  assert.equal(result.generatingEvidence.baselineCount, 1);
});

test("strong stop-button blocks completion until it disappears", async () => {
  const assistant = node({
    visible: true,
    text: "OK",
    id: "msg-1",
    tagName: "DIV",
    attrs: { "data-message-id": "msg-1" },
  });
  const stop = node({
    visible: true,
    tagName: "BUTTON",
    attrs: { "data-testid": "stop-button", "aria-label": "Stop generating" },
  });
  const state = {
    nodes: {
      '[data-message-author-role="assistant"]': [assistant],
      '[data-testid="stop-button"]': [stop],
    },
  };
  const page = fakePage(state);
  state.onTick = (now) => {
    if (now >= 1_000) state.nodes['[data-testid="stop-button"]'] = [];
  };
  const result = await waitForAssistant(page, 0, 8_000, "", undefined, {
    generatingBaseline: [],
    now: page.now,
    sleep: page.sleep,
  });
  assert.equal(result.text, "OK");
  assert.equal(result.generatingEvidence.generating, false);
});

test("timeout reconcilies completed OK when only weak/baseline Stop remains", async () => {
  const snapshot = {
    text: "OK",
    newTurn: true,
    stableMs: 2_000,
    generatingEvidence: { generating: false, strongCount: 0, weakCount: 1, baselineCount: 1 },
  };
  const reconciled = reconcileTimedOutTurn(snapshot);
  assert.equal(reconciled.status, "completed");
  assert.equal(reconciled.text, "OK");

  const timeout = Object.assign(new Error("Timed out waiting for a stable assistant response."), {
    code: "TURN_TIMEOUT",
    snapshot,
  });
  const pageState = {
    nodes: {
      '[data-message-author-role="assistant"]': [node({ text: "OK", id: "msg-1" })],
    },
  };
  const h = authHelpers(pageState, {
    waitForAssistant: async () => {
      throw timeout;
    },
  });
  const result = await executeTextTurn(fakePage(pageState), { text: "只回复 OK" }, h, { timeoutMs: 5_000 });
  assert.equal(result.status, "completed");
  assert.equal(result.text, "OK");
  assert.equal(result.provenance.reconciledReadback, true);
  assert.equal(result.observations.some((item) => item.type === "readback" && item.status === "reconciled"), true);
  assert.equal(h.sent(), 1);
});

test("timeout stays ambiguous when strong stop-button remains", async () => {
  const timeout = Object.assign(new Error("Timed out waiting for a stable assistant response."), {
    code: "TURN_TIMEOUT",
    snapshot: {
      text: "OK",
      newTurn: true,
      stableMs: 2_000,
      generatingEvidence: { generating: true, strongCount: 1, weakCount: 0, baselineCount: 0 },
    },
  });
  const pageState = {
    nodes: {
      '[data-message-author-role="assistant"]': [node({ text: "OK", id: "msg-1" })],
    },
  };
  const h = authHelpers(pageState, {
    waitForAssistant: async () => {
      throw timeout;
    },
  });
  const result = await executeTextTurn(fakePage(pageState), { text: "只回复 OK" }, h, { timeoutMs: 5_000 });
  assert.equal(result.status, "ambiguous");
  assert.equal(result.provenance.reconciledReadback, false);
  assert.equal(h.sent(), 1);
});

test("identical OK on a new assistant turn still completes", async () => {
  const first = node({
    visible: true,
    text: "OK",
    id: "msg-1",
    tagName: "DIV",
    attrs: { "data-message-id": "msg-1" },
  });
  const second = node({
    visible: true,
    text: "OK",
    id: "msg-2",
    tagName: "DIV",
    attrs: { "data-message-id": "msg-2" },
  });
  const state = {
    nodes: {
      '[data-message-author-role="assistant"]': [first],
    },
  };
  const page = fakePage(state);
  const helpers = authHelpers(state, {
    afterSend: () => {
      state.nodes['[data-message-author-role="assistant"]'] = [first, second];
    },
  });
  const result = await executeTextTurn(page, { text: "只回复 OK" }, {
    ...helpers,
    waitForAssistant: (...args) => waitForAssistant(...args),
  }, {
    timeoutMs: 8_000,
    now: page.now,
    sleep: page.sleep,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.text, "OK");
  assert.equal(result.assistantMessageId, "msg-2");
});

test("P4 command handler notifies reconciled completed OK", async () => {
  const notes = [];
  await handleOperationalCommand(
    parseChatGPTCommand("ask 只回复 OK"),
    {
      ask: async () => ({
        conversationId: "c1",
        status: "completed",
        text: "OK",
        observations: [{ type: "readback", status: "reconciled" }],
        provenance: {
          transport: "browser-owned",
          browserOwnedWrite: true,
          reconciledReadback: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      }),
    },
    (message, level) => notes.push({ message, level }),
  );
  assert.equal(notes.at(-1).message, "OK");
  assert.equal(notes.at(-1).level, "info");
});
