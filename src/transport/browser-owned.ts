import type { ChatGPTTurnRequest, ChatGPTTurnResult } from "../core/types.js";
import type { ProductTransport } from "./transport.js";

export interface BrowserTurnDriver {
  health(): Promise<{ ok: boolean; detail?: string }>;
  send(request: ChatGPTTurnRequest): Promise<ChatGPTTurnResult>;
  close?(): Promise<void>;
}

export class UnconfiguredBrowserTurnDriver implements BrowserTurnDriver {
  async health() {
    return { ok: false, detail: "real browser driver requires local P1 validation" };
  }

  async send(_request: ChatGPTTurnRequest): Promise<ChatGPTTurnResult> {
    throw new Error("Real ChatGPT Web browser driver is not configured. Run the P1 local validation first.");
  }
}

export class BrowserOwnedTransport implements ProductTransport {
  readonly name = "browser-owned";

  constructor(private readonly driver: BrowserTurnDriver = new UnconfiguredBrowserTurnDriver()) {}

  health() {
    return this.driver.health();
  }

  async sendTurn(request: ChatGPTTurnRequest): Promise<ChatGPTTurnResult> {
    const result = await this.driver.send(request);
    if (result.status === "ambiguous" && result.provenance.reconciledReadback) {
      throw new Error("Invalid transport result: ambiguous writes cannot already be marked reconciled.");
    }
    return result;
  }

  async close() {
    await this.driver.close?.();
  }
}
