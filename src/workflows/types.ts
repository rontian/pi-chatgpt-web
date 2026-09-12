export interface WorkflowContext {
  request: string;
  piSessionId?: string;
  cwd?: string;
}

export interface WorkflowResult {
  status: "completed" | "failed";
  text?: string;
  error?: string;
}

export interface ChatGPTWorkflow {
  readonly name: string;
  run(context: WorkflowContext): Promise<WorkflowResult>;
}
