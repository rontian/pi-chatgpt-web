import type { ChatGPTProductRuntime } from "../../runtime/chatgpt-runtime.js";
import { ENVELOPE_CLOSE, extractEnvelope } from "../../protocol/envelope.js";
import type { ChatGPTWorkflow, ContextRequestResolver, WorkflowContext, WorkflowResult, WorkflowRound } from "../types.js";

export interface PromptWorkflowOptions {
  maxRounds?: number;
  resolver?: ContextRequestResolver | null;
}

export class PromptWorkflow implements ChatGPTWorkflow {
  readonly name = "prompt";
  private readonly maxRounds: number;
  private readonly resolver: ContextRequestResolver | null;

  constructor(private readonly runtime: ChatGPTProductRuntime, options: PromptWorkflowOptions = {}) {
    this.maxRounds = options.maxRounds ?? 8;
    this.resolver = options.resolver ?? null;
  }

  async run(context: WorkflowContext): Promise<WorkflowResult> {
    const rounds: WorkflowRound[] = [];
    let nextInput = buildInitialTurn(context);
    let inputKind: WorkflowRound["inputKind"] = "initial";
    let conversationId: string | undefined;

    for (let index = 1; index <= this.maxRounds; index += 1) {
      const result = await this.runtime.sendTurn({ conversationId, text: nextInput, temporary: true }, `prompt:${context.piSessionId ?? "default"}`);
      conversationId = result.conversationId === "unknown" ? conversationId : result.conversationId;
      rounds.push({
        index,
        inputKind,
        outputStatus: result.status,
        conversationId,
        responseChars: result.text?.length ?? 0,
      });

      if (result.status !== "completed" || !result.text) {
        return {
          status: "failed",
          error: `ChatGPT turn did not complete: ${result.status}`,
          conversationId,
          rounds,
          inspection: { reason: "turn_not_completed" },
        };
      }

      const envelope = extractEnvelope(result.text);
      if (!envelope) {
        return {
          status: "completed",
          text: result.text.trim(),
          conversationId,
          rounds,
          inspection: { protocolFallback: "plain_text_final" },
        };
      }

      if (envelope.status === "final") {
        const close = result.text.indexOf(ENVELOPE_CLOSE);
        const finalText = close >= 0 ? result.text.slice(close + ENVELOPE_CLOSE.length).trim() : result.text.trim();
        return {
          status: "completed",
          text: finalText || result.text.trim(),
          conversationId,
          rounds,
          inspection: { protocol: "final_envelope" },
        };
      }

      if (envelope.status === "error") {
        return { status: "failed", error: envelope.message, conversationId, rounds };
      }

      if (envelope.status === "need_context") {
        const contextText = this.resolver
          ? await this.resolver.resolve(envelope.requests, context)
          : "No additional external context resolver is configured. Use the supplied Pi session snapshot and produce the best possible final result without inventing facts.";
        nextInput = buildContextTurn(contextText);
        inputKind = "context";
        continue;
      }
    }

    return {
      status: "failed",
      error: `Prompt workflow exceeded maxRounds=${this.maxRounds}`,
      conversationId,
      rounds,
      inspection: { reason: "max_rounds" },
    };
  }
}

export function buildInitialTurn(context: WorkflowContext): string {
  return [
    "You are preparing a final execution prompt for a Pi coding agent.",
    "Analyze the request and supplied session snapshot. You may take multiple turns if information is insufficient.",
    "For intermediate context requests, emit exactly one JSON envelope:",
    '<pi-chatgpt>{"status":"need_context","requests":[]}</pi-chatgpt>',
    "When ready, emit:",
    '<pi-chatgpt>{"status":"final"}</pi-chatgpt>',
    "followed by the complete final execution prompt.",
    "Do not claim to have read repositories, files, tools, or external services unless that information is present in the supplied context.",
    "",
    `USER REQUEST:\n${context.request}`,
    "",
    `PI SESSION SNAPSHOT:\n${JSON.stringify(context.snapshot ?? {}, null, 2)}`,
  ].join("\n");
}

export function buildContextTurn(contextText: string): string {
  return [
    "Additional context for the same task follows.",
    contextText,
    "Continue the analysis. Request more context only if essential; otherwise return the final envelope and complete execution prompt.",
  ].join("\n\n");
}
