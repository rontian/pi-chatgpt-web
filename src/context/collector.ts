import type { AssistantAdapter } from "../assistant/types.js";
import type { PiChatGPTWebConfig } from "../config/types.js";
import { applyCharBudget } from "./budget.js";
import type { SessionSnapshot } from "./snapshot.js";

export interface CollectedMessage {
  role: "user" | "assistant" | "system" | "tool" | "other";
  text: string;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String((part as any).text ?? "");
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function collectBranchMessages(entries: readonly any[], config: PiChatGPTWebConfig): CollectedMessage[] {
  const out: CollectedMessage[] = [];
  for (const entry of entries) {
    if (entry?.type !== "message" || !entry.message) continue;
    const message = entry.message;
    const rawRole = String(message.role ?? (message.toolName ? "tool" : "other"));
    const role: CollectedMessage["role"] =
      rawRole === "user" || rawRole === "assistant" || rawRole === "system" || rawRole === "tool"
        ? rawRole
        : message.toolName
          ? "tool"
          : "other";
    if (role === "tool" && !config.context.includeToolResults) continue;
    if (role === "system" && !config.context.includeSystemMessages) continue;
    const text = textFromContent(message.content ?? message.text);
    if (text.trim()) out.push({ role, text: text.trim() });
  }
  return out.slice(-config.context.recentMessages);
}

export async function buildSessionSnapshot(args: {
  goal: string;
  cwd?: string;
  project?: string;
  entries: readonly any[];
  config: PiChatGPTWebConfig;
  assistant?: AssistantAdapter | null;
}): Promise<SessionSnapshot & { meta: Record<string, unknown> }> {
  const messages = collectBranchMessages(args.entries, args.config);
  const newestFirst = [...messages].reverse();
  const budgeted = applyCharBudget(newestFirst, args.config.context.maxChars, (item) => `${item.role}: ${item.text}\n`);
  const selected = [...budgeted.items].reverse();

  let relevantContext = selected.map((item) => `${item.role}: ${item.text}`);
  let helperUsed = false;
  if (args.assistant && args.config.assistant.enabled && budgeted.truncated) {
    const extracted = await args.assistant.run({
      profile: "normal",
      instruction: "Compress the supplied Pi session context for another model. Preserve explicit user constraints, current task state, decisions, errors, branch/commit identifiers, and unresolved questions. Return concise plain text only.",
      input: relevantContext.join("\n\n"),
    });
    if (extracted.trim()) {
      relevantContext = [extracted.trim()];
      helperUsed = true;
    }
  }

  return {
    goal: args.goal,
    cwd: args.cwd,
    project: args.project,
    relevantContext,
    constraints: [],
    unknowns: [],
    meta: {
      sourceMessages: messages.length,
      includedMessages: selected.length,
      usedChars: budgeted.usedChars,
      truncated: budgeted.truncated,
      excludedMessages: budgeted.excluded,
      helperUsed,
    },
  };
}
