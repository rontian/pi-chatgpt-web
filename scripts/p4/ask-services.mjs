import { NativeChromeTurnDriver } from "../p2/native-chrome-driver.mjs";
import { ChatGPTProductRuntime } from "../p3/conversation-runtime.mjs";

export function wrapDriverAsTransport(driver) {
  return {
    name: "browser-owned",
    health: () => driver.health(),
    async sendTurn(request, signal) {
      const result = await driver.send(request, signal);
      if (result.status === "ambiguous" && result.provenance.reconciledReadback) {
        throw new Error("Invalid transport result: ambiguous writes cannot already be marked reconciled.");
      }
      return result;
    },
  };
}

export class AskCommandServices {
  constructor(driver = new NativeChromeTurnDriver()) {
    this.driver = driver;
    this.transport = wrapDriverAsTransport(driver);
    this.runtime = new ChatGPTProductRuntime(this.transport, { persist: false });
  }

  async statusSummary() {
    const health = await this.runtime.health();
    return { health, helper: "disabled-in-probe" };
  }

  async ask(text) {
    if (!String(text ?? "").trim()) throw new Error("Usage: /chatgpt ask <request>");
    return this.runtime.sendTurn({ text, temporary: true }, "ask");
  }

  login() {
    return this.driver.login();
  }

  confirmLogin() {
    return this.driver.confirmLogin();
  }

  logout() {
    return this.driver.logout();
  }

  async doctor() {
    const health = await this.runtime.health();
    return {
      ok: health.ok,
      checks: {
        config: "ok",
        transport: health.ok ? "ok" : health.detail ?? "unavailable",
      },
      capabilities: this.runtime.capabilities.snapshot(),
    };
  }

  close() {
    return this.driver.close?.();
  }
}
