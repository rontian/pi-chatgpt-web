import type { ChatGPTTurnRequest, ChatGPTTurnResult } from "../core/types.js";
import type { ProductTransport } from "./transport.js";

export class BrowserOwnedTransport implements ProductTransport {
  readonly name = "browser-owned";

  async health() {
    return { ok: false, detail: "Web Feasibility Gate not implemented yet" };
  }

  async sendTurn(_request: ChatGPTTurnRequest): Promise<ChatGPTTurnResult> {
    throw new Error("BrowserOwnedTransport.sendTurn is intentionally unimplemented until the Web Feasibility Gate is completed.");
  }
}
