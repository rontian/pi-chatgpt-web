import type { ChatGPTTurnRequest, ChatGPTTurnResult } from "../core/types.js";
import type { ProductTransport } from "../transport/transport.js";

export interface ConversationState {
  conversationId: string | null;
  turns: number;
  lastStatus: ChatGPTTurnResult["status"] | null;
  lastAssistantMessageId?: string;
}

export class ChatGPTProductRuntime {
  private readonly conversations = new Map<string, ConversationState>();

  constructor(private readonly transport: ProductTransport) {}

  health() {
    return this.transport.health();
  }

  getConversationState(key: string): ConversationState | null {
    return this.conversations.get(key) ?? null;
  }

  async sendTurn(request: ChatGPTTurnRequest, workflowKey = "default"): Promise<ChatGPTTurnResult> {
    const previous = this.conversations.get(workflowKey);
    const effective: ChatGPTTurnRequest = {
      ...request,
      conversationId: request.conversationId ?? previous?.conversationId ?? undefined,
    };

    const result = await this.transport.sendTurn(effective);
    const next: ConversationState = {
      conversationId: result.conversationId === "unknown" ? previous?.conversationId ?? null : result.conversationId,
      turns: (previous?.turns ?? 0) + 1,
      lastStatus: result.status,
      lastAssistantMessageId: result.assistantMessageId,
    };
    this.conversations.set(workflowKey, next);
    return result;
  }

  clearConversation(workflowKey = "default") {
    this.conversations.delete(workflowKey);
  }
}
