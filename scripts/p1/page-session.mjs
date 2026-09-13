import { AUTH_COMPOSER_SELECTORS } from "./browser-probe-helpers.mjs";

export const COMPOSER_SELECTORS = AUTH_COMPOSER_SELECTORS;

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

export const STRONG_STOP_SELECTORS = [
  '[data-testid="stop-button"]',
];

export const WEAK_STOP_SELECTORS = [
  'button[aria-label*="Stop"]',
];

export const STOP_SELECTORS = [...STRONG_STOP_SELECTORS, ...WEAK_STOP_SELECTORS];

const MAX_GENERATING_MATCHES = 5;

export function normalizeText(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
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

export function conversationUrl(conversationId) {
  if (!conversationId) throw new Error("conversationId is required to reopen a ChatGPT tab.");
  if (/[/?#]/.test(conversationId)) throw new Error("conversation id is missing or unsafe.");
  return `https://chatgpt.com/c/${conversationId}`;
}

export async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      return { selector, locator };
    }
  }
  return null;
}

export async function countByCandidates(page, selectors) {
  let best = { selector: null, count: 0 };
  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    if (count > best.count) best = { selector, count };
  }
  return best;
}

export async function latestText(page, selectors) {
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

export async function latestMessageId(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count > 0) {
      const node = locator.nth(count - 1);
      const id = await node.getAttribute("data-message-id").catch(() => null);
      if (id) return id;
    }
  }
  return undefined;
}

export async function anyVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) return true;
  }
  return false;
}

function controlIdentity(match) {
  return [match.selector, match.tagName, match.testId, match.ariaLabel, match.title, match.disabled].join("|");
}

async function collectSelectorMatches(page, selector) {
  const locator = page.locator(selector);
  const totalCount = await locator.count().catch(() => 0);
  const visibleMatches = [];
  for (let i = 0; i < totalCount && visibleMatches.length < MAX_GENERATING_MATCHES; i += 1) {
    const node = locator.nth(i);
    const visible = await node.isVisible().catch(() => false);
    if (!visible) continue;
    visibleMatches.push({
      selector,
      tagName: String(await node.evaluate((el) => el.tagName).catch(() => "UNKNOWN")).toUpperCase(),
      ariaLabel: await node.getAttribute("aria-label").catch(() => null),
      testId: await node.getAttribute("data-testid").catch(() => null),
      title: await node.getAttribute("title").catch(() => null),
      disabled: Boolean(await node.getAttribute("disabled").catch(() => null)),
    });
  }
  return { selector, totalCount, visibleCount: visibleMatches.length, visibleMatches };
}

export async function inspectGeneratingControls(page, selectors = STOP_SELECTORS) {
  const items = [];
  for (const selector of selectors) {
    items.push(await collectSelectorMatches(page, selector));
  }
  return items;
}

export function classifyGeneratingEvidence(inspection, baseline = []) {
  const baselineIds = new Set(
    baseline.flatMap((item) => (item.visibleMatches ?? []).map(controlIdentity)),
  );
  const strongMatches = [];
  const weakMatches = [];
  const baselineMatches = [];
  for (const item of inspection) {
    const strength = STRONG_STOP_SELECTORS.includes(item.selector) ? "strong" : "weak";
    for (const match of item.visibleMatches ?? []) {
      const id = controlIdentity(match);
      if (baselineIds.has(id)) {
        baselineMatches.push({ ...match, strength });
        continue;
      }
      if (strength === "strong") strongMatches.push(match);
      else weakMatches.push(match);
    }
  }
  return {
    generating: strongMatches.length > 0,
    strongCount: strongMatches.length,
    weakCount: weakMatches.length,
    baselineCount: baselineMatches.length,
    strongMatches,
    weakMatches,
    baselineMatches,
  };
}

export async function snapshotGeneratingBaseline(page) {
  return inspectGeneratingControls(page);
}

export function hasNewAssistantTurn({ countAdvanced, textAdvanced, assistantMessageId, beforeMessageId }) {
  if (countAdvanced) return true;
  if (assistantMessageId && beforeMessageId && assistantMessageId !== beforeMessageId) return true;
  return Boolean(textAdvanced);
}

export function canCompleteAssistantTurn({ text, newTurn, stableMs, generating }) {
  return Boolean(text) && newTurn && !generating && Number(stableMs) >= 2_000;
}

export function canReconcileCompletedTurn({ text, newTurn, stableMs, generating, weakOnly }) {
  return Boolean(text) && newTurn && !generating && Number(stableMs) >= 2_000 && Boolean(weakOnly);
}

export async function sendViaUi(page, prompt) {
  const composer = await firstVisible(page, COMPOSER_SELECTORS);
  if (!composer) throw new Error("Could not find a visible ChatGPT composer. UI selectors may have changed.");

  await composer.locator.fill(prompt);
  const send = await firstVisible(page, SEND_SELECTORS);
  if (send) await send.locator.click();
  else await composer.locator.press("Enter");

  return { composerSelector: composer.selector, sendSelector: send?.selector ?? "<Enter>" };
}

export async function waitForAssistant(
  page,
  beforeCount,
  timeoutMs,
  beforeText = "",
  signal,
  options = {},
) {
  const nowFn = options.now ?? Date.now;
  const sleepFn = options.sleep ?? ((ms) => page.waitForTimeout(ms));
  const startedAt = nowFn();
  let lastText = "";
  let stableSince = 0;
  let observedSelector = null;
  const normalizedBefore = normalizeText(beforeText);
  const beforeMessageId = options.beforeMessageId;
  const baseline = options.generatingBaseline ?? [];

  while (nowFn() - startedAt < timeoutMs) {
    if (signal?.aborted) {
      const error = new Error("ChatGPT turn wait was cancelled.");
      error.code = "TURN_CANCELLED";
      throw error;
    }
    const current = await countByCandidates(page, ASSISTANT_SELECTORS);
    const text = await latestText(page, ASSISTANT_SELECTORS);
    const assistantMessageId = await latestMessageId(page, ASSISTANT_SELECTORS);
    const countAdvanced = current.count > beforeCount;
    const textAdvanced = Boolean(text) && text !== normalizedBefore;
    const newTurn = hasNewAssistantTurn({
      countAdvanced,
      textAdvanced,
      assistantMessageId,
      beforeMessageId,
    });
    if (newTurn) {
      observedSelector = current.selector ?? observedSelector;
      if (text && text === lastText) {
        if (!stableSince) stableSince = nowFn();
      } else {
        lastText = text;
        stableSince = text ? nowFn() : 0;
      }

      const inspection = await inspectGeneratingControls(page);
      const evidence = classifyGeneratingEvidence(inspection, baseline);
      const stableMs = stableSince ? nowFn() - stableSince : 0;
      if (canCompleteAssistantTurn({
        text,
        newTurn,
        stableMs,
        generating: evidence.generating,
      })) {
        return {
          text,
          assistantSelector: observedSelector,
          assistantMessageId,
          generatingEvidence: evidence,
        };
      }
    }
    await sleepFn(250);
  }

  const final = await countByCandidates(page, ASSISTANT_SELECTORS);
  const finalText = await latestText(page, ASSISTANT_SELECTORS);
  const assistantMessageId = await latestMessageId(page, ASSISTANT_SELECTORS);
  const inspection = await inspectGeneratingControls(page);
  const evidence = classifyGeneratingEvidence(inspection, baseline);
  const countAdvanced = final.count > beforeCount;
  const textAdvanced = Boolean(finalText) && finalText !== normalizedBefore;
  const newTurn = hasNewAssistantTurn({
    countAdvanced,
    textAdvanced,
    assistantMessageId,
    beforeMessageId,
  });
  const error = new Error(
    `Timed out waiting for a stable assistant response. beforeCount=${beforeCount} afterCount=${final.count} generating=${evidence.generating} strong=${evidence.strongCount} weak=${evidence.weakCount} baseline=${evidence.baselineCount} latestLength=${finalText.length} changed=${finalText !== normalizedBefore}`
  );
  error.code = "TURN_TIMEOUT";
  error.assistantObserved = newTurn && Boolean(finalText);
  error.snapshot = {
    beforeCount,
    afterCount: final.count,
    text: finalText,
    assistantSelector: observedSelector ?? final.selector,
    assistantMessageId,
    newTurn,
    stableMs: lastText && lastText === finalText && stableSince ? nowFn() - stableSince : 0,
    generatingEvidence: evidence,
    generatingInspection: inspection,
  };
  throw error;
}

function nowIso() {
  return new Date().toISOString();
}

function failedTurn(request, startedAt, message, extra = {}) {
  return {
    conversationId: request.conversationId ?? "unknown",
    status: "failed",
    text: message,
    observations: extra.observations ?? [{ type: "error", status: "failed", data: { message } }],
    provenance: {
      transport: "browser-owned",
      browserOwnedWrite: false,
      reconciledReadback: false,
      startedAt,
      completedAt: nowIso(),
    },
  };
}

export async function executeTextTurn(page, request, helpers, options = {}) {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const signal = options.signal;
  const startedAt = nowIso();
  const text = String(request?.text ?? "").trim();
  if (!text) return failedTurn(request ?? {}, startedAt, "ChatGPT turn text must not be empty.");

  const auth = await helpers.probeAuthentication(page);
  if (!auth?.authenticated) {
    return failedTurn(request, startedAt, "ChatGPT profile is not authenticated. Run /chatgpt login first.", {
      observations: [{
        type: "auth",
        status: "auth_expired_or_unauthenticated",
        data: { authSource: auth?.authSource ?? null, sessionEndpointStatus: auth?.sessionEndpointStatus ?? null },
      }],
    });
  }

  if (request.conversationId) {
    const current = helpers.extractConversationId(page.url());
    if (current !== request.conversationId && helpers.openConversation) {
      await helpers.openConversation(page, request.conversationId);
    }
  }

  const before = await helpers.countByCandidates(page, ASSISTANT_SELECTORS);
  const beforeText = await helpers.latestText(page, ASSISTANT_SELECTORS);
  const beforeMessageId = await helpers.latestMessageId?.(page, ASSISTANT_SELECTORS);
  const generatingBaseline = helpers.inspectGeneratingControls
    ? await helpers.inspectGeneratingControls(page)
    : await snapshotGeneratingBaseline(page);
  let sendAttempted = false;

  try {
    if (signal?.aborted) {
      const error = new Error("ChatGPT turn was cancelled before send.");
      error.code = "TURN_CANCELLED";
      throw error;
    }
    await helpers.sendViaUi(page, text);
    sendAttempted = true;
    const response = await helpers.waitForAssistant(page, before.count, timeoutMs, beforeText, signal, {
      beforeMessageId,
      generatingBaseline,
      now: options.now,
      sleep: options.sleep,
    });
    return {
      conversationId: helpers.extractConversationId(page.url()) ?? request.conversationId ?? "unknown",
      assistantMessageId: response.assistantMessageId ?? (await helpers.latestMessageId?.(page, ASSISTANT_SELECTORS)),
      status: "completed",
      text: response.text,
      observations: [
        { type: "auth", status: "ok", data: { authSource: auth.authSource } },
        { type: "readback", status: "dom-stable", data: { assistantSelector: response.assistantSelector, generating: response.generatingEvidence ?? null } },
      ],
      provenance: {
        transport: "browser-owned",
        browserOwnedWrite: true,
        reconciledReadback: false,
        startedAt,
        completedAt: nowIso(),
      },
    };
  } catch (error) {
    const code = error?.code;
    if (sendAttempted && (code === "TURN_TIMEOUT" || code === "TURN_CANCELLED" || /timed out waiting for a stable assistant response/i.test(String(error)))) {
      const snapshot = error.snapshot ?? await readOnlyAssistantSnapshot(page, helpers, {
        beforeCount: before.count,
        beforeText,
        beforeMessageId,
        generatingBaseline,
      });
      const reconciled = reconcileTimedOutTurn(snapshot);
      if (reconciled.status === "completed") {
        return {
          conversationId: helpers.extractConversationId(page.url()) ?? request.conversationId ?? "unknown",
          assistantMessageId: snapshot.assistantMessageId,
          status: "completed",
          text: snapshot.text,
          observations: [
            { type: "auth", status: "ok", data: { authSource: auth.authSource } },
            { type: "readback", status: "reconciled", data: { assistantSelector: snapshot.assistantSelector } },
          ],
          provenance: {
            transport: "browser-owned",
            browserOwnedWrite: true,
            reconciledReadback: true,
            startedAt,
            completedAt: nowIso(),
          },
        };
      }
      return {
        conversationId: helpers.extractConversationId(page.url()) ?? request.conversationId ?? "unknown",
        status: "ambiguous",
        text: error instanceof Error ? error.message : String(error),
        observations: [{ type: "write", status: "ambiguous", data: { reason: "timeout_after_possible_accepted_write" } }],
        provenance: {
          transport: "browser-owned",
          browserOwnedWrite: true,
          reconciledReadback: false,
          startedAt,
          completedAt: nowIso(),
        },
      };
    }
    throw error;
  }
}

export function reconcileTimedOutTurn(snapshot = {}) {
  const evidence = snapshot.generatingEvidence ?? {
    generating: false,
    strongCount: 0,
    weakCount: 0,
    baselineCount: 0,
  };
  const weakOnly = !evidence.generating && Number(evidence.strongCount ?? 0) === 0;
  if (canReconcileCompletedTurn({
    text: snapshot.text,
    newTurn: snapshot.newTurn,
    stableMs: snapshot.stableMs,
    generating: evidence.generating,
    weakOnly,
  })) {
    return { status: "completed", text: snapshot.text, reconciled: true };
  }
  return { status: "ambiguous", reconciled: false };
}

async function readOnlyAssistantSnapshot(page, helpers, { beforeCount, beforeText, beforeMessageId, generatingBaseline }) {
  const current = await helpers.countByCandidates(page, ASSISTANT_SELECTORS);
  const text = await helpers.latestText(page, ASSISTANT_SELECTORS);
  const assistantMessageId = await helpers.latestMessageId?.(page, ASSISTANT_SELECTORS);
  const inspection = helpers.inspectGeneratingControls
    ? await helpers.inspectGeneratingControls(page)
    : await inspectGeneratingControls(page);
  const evidence = classifyGeneratingEvidence(inspection, generatingBaseline);
  const normalizedBefore = normalizeText(beforeText);
  const countAdvanced = current.count > beforeCount;
  const textAdvanced = Boolean(text) && text !== normalizedBefore;
  return {
    beforeCount,
    afterCount: current.count,
    text,
    assistantSelector: current.selector,
    assistantMessageId,
    newTurn: hasNewAssistantTurn({
      countAdvanced,
      textAdvanced,
      assistantMessageId,
      beforeMessageId,
    }),
    stableMs: 2_000,
    generatingEvidence: evidence,
    generatingInspection: inspection,
  };
}
