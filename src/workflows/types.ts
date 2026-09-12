export interface WorkflowContext {
  request: string;
  piSessionId?: string;
  cwd?: string;
  snapshot?: unknown;
}

export interface WorkflowRound {
  index: number;
  inputKind: "initial" | "context" | "retry";
  outputStatus: string;
  conversationId?: string;
  responseChars?: number;
}

export interface WorkflowResult {
  status: "completed" | "failed";
  text?: string;
  error?: string;
  conversationId?: string;
  rounds?: WorkflowRound[];
  inspection?: Record<string, unknown>;
}

export interface ChatGPTWorkflow {
  readonly name: string;
  run(context: WorkflowContext): Promise<WorkflowResult>;
}

export interface ContextRequestResolver {
  resolve(requests: unknown[], context: WorkflowContext): Promise<string>;
}
