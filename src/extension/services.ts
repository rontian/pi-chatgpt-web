import { NativeChromeTurnDriver } from "../browser/driver.js";
import { loadConfig } from "../config/loader.js";
import { ChatGPTProductRuntime } from "../runtime/chatgpt-runtime.js";
import { BrowserOwnedTransport, type BrowserTurnDriver } from "../transport/browser-owned.js";

export class ChatGPTCommandServices {
  readonly transport: BrowserOwnedTransport;
  readonly runtime: ChatGPTProductRuntime;

  constructor(driver: BrowserTurnDriver = new NativeChromeTurnDriver()) {
    this.transport = new BrowserOwnedTransport(driver);
    this.runtime = new ChatGPTProductRuntime(this.transport);
  }

  async status() {
    const config = await loadConfig();
    const health = await this.runtime.health();
    return { config, health };
  }

  async ask(text: string) {
    if (!text.trim()) throw new Error("Usage: /chatgpt ask <request>");
    const config = await loadConfig();
    return this.runtime.sendTurn({ text, temporary: config.chatgpt.temporary }, "ask");
  }

  login() {
    return this.transport.login();
  }

  confirmLogin() {
    return this.transport.confirmLogin();
  }

  logout() {
    return this.transport.logout();
  }

  async doctor() {
    const { config, health } = await this.status();
    return {
      ok: health.ok,
      checks: {
        config: "ok",
        transport: health.ok ? "ok" : health.detail ?? "unavailable",
        helperModel: config.assistant.enabled ? config.assistant.model : "disabled",
      },
    };
  }
}
