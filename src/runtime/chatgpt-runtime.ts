export {
  ChatGPTProductRuntime,
  conversationMetadata,
  DEFAULT_CONVERSATION_STORE,
} from "../../scripts/p3/conversation-runtime.mjs";

export interface ConversationState {
  conversationId: string | null;
  turns: number;
  lastStatus: string | null;
  lastAssistantMessageId?: string;
  updatedAt?: string;
}
