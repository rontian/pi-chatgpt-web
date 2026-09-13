import { BrowserRuntime, BrowserRuntimeError } from "./browser-runtime.mjs";

export class NativeChromeTurnDriver {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs ?? 180_000;
    this.runtime = options.runtime ?? new BrowserRuntime(options);
  }

  health() {
    return this.runtime.health();
  }

  login() {
    return this.runtime.login();
  }

  confirmLogin() {
    return this.runtime.confirmLogin();
  }

  logout() {
    return this.runtime.logout();
  }

  async send(request, signal) {
    const attached = await this.runtime.attach();
    const helpers = await loadTurnHelpers();
    const { executeTextTurn } = await import("../p1/page-session.mjs");
    return executeTextTurn(attached.page, request, helpers, {
      timeoutMs: this.timeoutMs,
      signal,
    });
  }

  close() {
    return this.runtime.close();
  }
}

async function loadTurnHelpers() {
  const auth = await import("../p1/browser-probe-helpers.mjs");
  const page = await import("../p1/page-session.mjs");
  return {
    probeAuthentication: auth.probeAuthentication,
    countByCandidates: page.countByCandidates,
    latestText: page.latestText,
    latestMessageId: page.latestMessageId,
    inspectGeneratingControls: page.inspectGeneratingControls,
    sendViaUi: page.sendViaUi,
    waitForAssistant: page.waitForAssistant,
    extractConversationId: page.extractConversationId,
    conversationUrl: page.conversationUrl,
    async openConversation(target, conversationId) {
      const url = page.conversationUrl(conversationId);
      if (typeof target.goto === "function") {
        await target.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        return;
      }
      const context = target.context?.();
      if (!context?.newPage) {
        throw new BrowserRuntimeError("PRODUCT_DRIFT", "Cannot reopen the requested ChatGPT conversation.");
      }
      const next = await context.newPage();
      if (typeof next?.goto === "function") {
        await next.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      }
    },
  };
}
