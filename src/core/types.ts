export type TurnStatus = "completed" | "in_progress" | "requires_action" | "ambiguous" | "failed";

export type ProductCapability = "text" | "web_search" | "github" | "apps" | "files" | "images";
export type CapabilityState = "available" | "unsupported" | "unknown" | "unimplemented";

export interface ProductObservation {
  type: string;
  name?: string;
  status?: string;
  data?: unknown;
}

export interface ExecutionProvenance {
  transport: string;
  browserOwnedWrite: boolean;
  reconciledReadback: boolean;
  startedAt: string;
  completedAt?: string;
}

export interface ChatGPTTurnRequest {
  conversationId?: string;
  text: string;
  temporary?: boolean;
}

export interface ChatGPTTurnResult {
  conversationId: string;
  userMessageId?: string;
  assistantMessageId?: string;
  status: TurnStatus;
  text?: string;
  observations: ProductObservation[];
  provenance: ExecutionProvenance;
}
