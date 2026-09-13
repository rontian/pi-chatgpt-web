import type { ChatGPTTurnRequest, ChatGPTTurnResult } from "../core/types.js";
import type { ProductTransport } from "./transport.js";

export interface BrowserTurnDriver {
  health(): Promise<{ ok: boolean; detail?: string }>;
  send(request: ChatGPTTurnRequest, signal?: AbortSignal): Promise<ChatGPTTurnResult>;
  close?(): Promise<void>;
  login?(): Promise<{ ok: boolean; detail?: string }>;
  confirmLogin?(): Promise<{ ok: boolean; detail?: string }>;
  logout?(): Promise<{ ok: boolean; detail?: string }>;
}

export class UnconfiguredBrowserTurnDriver implements BrowserTurnDriver {
  async health() {
    return { ok: false, detail: "browser driver is unconfigured" };
  }

  async send(_request: ChatGPTTurnRequest): Promise<ChatGPTTurnResult> {
    throw new Error("BrowserTurnDriver is not configured.");
  }
}

export class BrowserOwnedTransport implements ProductTransport {
  readonly name = "browser-owned";
  private readonly driver: BrowserTurnDriver;

  constructor(driver: BrowserTurnDriver = new UnconfiguredBrowserTurnDriver()) {
    this.driver = driver;
  }

  health() {
    return this.driver.health();
  }

  async sendTurn(request: ChatGPTTurnRequest, signal?: AbortSignal): Promise<ChatGPTTurnResult> {
    const result = await this.driver.send(request, signal);
    if (result.status === "ambiguous" && result.provenance.reconciledReadback) {
      throw new Error("Invalid transport result: ambiguous writes cannot already be marked reconciled.");
    }
    return result;
  }

  login() {
    return this.driver.login?.() ?? Promise.resolve({ ok: false, detail: "login is not implemented by this driver" });
  }

  confirmLogin() {
    return this.driver.confirmLogin?.() ?? Promise.resolve({ ok: false, detail: "login confirm is not implemented by this driver" });
  }

  logout() {
    return this.driver.logout?.() ?? Promise.resolve({ ok: false, detail: "logout is not implemented by this driver" });
  }

  async close() {
    await this.driver.close?.();
  }
}
