import type { ChatGPTTurnRequest, ChatGPTTurnResult } from "../core/types.js";
import type { ProductTransport } from "../transport/transport.js";
import { CapabilityRegistry } from "../product/capabilities.js";
import { normalizeProductObservations } from "../product/observations.js";

export interface ConversationState {
  conversationId: string | null;
  turns: number;
  lastStatus: ChatGPTTurnResult["status"] | null;
  lastAssistantMessageId?: string;
}

export class ChatGPTProductRuntime {
  private readonly conversations = new Map<string, ConversationState>();
  readonly capabilities = new CapabilityRegistry();

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

    const raw = await this.transport.sendTurn(effective);
    const result: ChatGPTTurnResult = {
      ...raw,
      observations: normalizeProductObservations(raw.observations ?? []),
    };
    for (const observation of result.observations) this.capabilities.observe(observation);
    if (result.status === "completed" && result.text) {
      this.capabilities.record({
        capability: "text",
        state: "available",
        source: "observation",
        detail: "completed assistant text",
        observedAt: new Date().toISOString(),
      });
    }

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
