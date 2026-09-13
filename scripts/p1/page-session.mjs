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

export const STOP_SELECTORS = [
  '[data-testid="stop-button"]',
  'button[aria-label*="Stop"]',
];

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

export async function sendViaUi(page, prompt) {
  const composer = await firstVisible(page, COMPOSER_SELECTORS);
  if (!composer) throw new Error("Could not find a visible ChatGPT composer. UI selectors may have changed.");

  await composer.locator.fill(prompt);
  const send = await firstVisible(page, SEND_SELECTORS);
  if (send) await send.locator.click();
  else await composer.locator.press("Enter");

  return { composerSelector: composer.selector, sendSelector: send?.selector ?? "<Enter>" };
}

export async function waitForAssistant(page, beforeCount, timeoutMs, beforeText = "", signal) {
  const startedAt = Date.now();
  let lastText = "";
  let stableSince = 0;
  let observedSelector = null;
  const normalizedBefore = normalizeText(beforeText);

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) {
      const error = new Error("ChatGPT turn wait was cancelled.");
      error.code = "TURN_CANCELLED";
      throw error;
    }
    const current = await countByCandidates(page, ASSISTANT_SELECTORS);
    const text = await latestText(page, ASSISTANT_SELECTORS);
    const countAdvanced = current.count > beforeCount;
    const textAdvanced = Boolean(text) && text !== normalizedBefore;
    if (countAdvanced || textAdvanced) {
      observedSelector = current.selector ?? observedSelector;
      if (text && text === lastText) {
        if (!stableSince) stableSince = Date.now();
      } else {
        lastText = text;
        stableSince = text ? Date.now() : 0;
      }

      const generating = await anyVisible(page, STOP_SELECTORS);
      if (text && !generating && stableSince && Date.now() - stableSince >= 2_000) {
        return {
          text,
          assistantSelector: observedSelector,
          assistantMessageId: await latestMessageId(page, ASSISTANT_SELECTORS),
        };
      }
    }
    await page.waitForTimeout(250);
  }

  const final = await countByCandidates(page, ASSISTANT_SELECTORS);
  const finalText = await latestText(page, ASSISTANT_SELECTORS);
  const generating = await anyVisible(page, STOP_SELECTORS);
  const error = new Error(
    `Timed out waiting for a stable assistant response. beforeCount=${beforeCount} afterCount=${final.count} generating=${generating} latestLength=${finalText.length} changed=${finalText !== normalizedBefore}`
  );
  error.code = "TURN_TIMEOUT";
  error.assistantObserved = Boolean(finalText) && finalText !== normalizedBefore;
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
  let sendAttempted = false;

  try {
    if (signal?.aborted) {
      const error = new Error("ChatGPT turn was cancelled before send.");
      error.code = "TURN_CANCELLED";
      throw error;
    }
    await helpers.sendViaUi(page, text);
    sendAttempted = true;
    const response = await helpers.waitForAssistant(page, before.count, timeoutMs, beforeText, signal);
    return {
      conversationId: helpers.extractConversationId(page.url()) ?? request.conversationId ?? "unknown",
      assistantMessageId: response.assistantMessageId ?? (await helpers.latestMessageId?.(page, ASSISTANT_SELECTORS)),
      status: "completed",
      text: response.text,
      observations: [
        { type: "auth", status: "ok", data: { authSource: auth.authSource } },
        { type: "readback", status: "dom-stable", data: { assistantSelector: response.assistantSelector } },
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
