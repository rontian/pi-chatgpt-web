import type { ChatGPTTurnRequest, ChatGPTTurnResult } from "../core/types.js";

export interface ProductTransport {
  readonly name: string;
  health(): Promise<{ ok: boolean; detail?: string }>;
  sendTurn(request: ChatGPTTurnRequest): Promise<ChatGPTTurnResult>;
}
