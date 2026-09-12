import type { ChatGPTTurnRequest, ChatGPTTurnResult } from "../core/types.js";
import type { ProductTransport } from "../transport/transport.js";

export class ChatGPTProductRuntime {
  constructor(private readonly transport: ProductTransport) {}

  health() {
    return this.transport.health();
  }

  sendTurn(request: ChatGPTTurnRequest): Promise<ChatGPTTurnResult> {
    return this.transport.sendTurn(request);
  }
}
