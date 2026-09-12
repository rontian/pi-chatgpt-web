export type ParsedChatGPTCommand =
  | { kind: "help"; tokens: string[] }
  | { kind: "status"; tokens: string[] }
  | { kind: "login"; tokens: string[] }
  | { kind: "logout"; tokens: string[] }
  | { kind: "doctor"; tokens: string[] }
  | { kind: "ask"; tokens: string[]; text: string }
  | { kind: "prompt"; tokens: string[]; action: string; text: string }
  | { kind: "config"; tokens: string[]; action: string; value?: string }
  | { kind: "unknown"; tokens: string[] };

export function tokenizeCommand(input: string): string[] {
  return input.trim().split(/\s+/u).filter(Boolean);
}

export function parseChatGPTCommand(input: string): ParsedChatGPTCommand {
  const trimmed = input.trim();
  const tokens = tokenizeCommand(trimmed);
  if (tokens.length === 0 || tokens[0] === "help") return { kind: "help", tokens };
  const head = tokens[0];
  if (head === "status" || head === "login" || head === "logout" || head === "doctor") {
    return { kind: head, tokens };
  }
  if (head === "ask") {
    return { kind: "ask", tokens, text: trimmed.slice(3).trim() };
  }
  if (head === "prompt") {
    const rest = trimmed.slice(6).trim();
    const action = tokens[1] && ["show", "edit", "send", "retry", "inspect"].includes(tokens[1]) ? tokens[1] : "run";
    const text = action === "run" ? rest : tokens.slice(2).join(" ");
    return { kind: "prompt", tokens, action, text };
  }
  if (head === "config") {
    return { kind: "config", tokens, action: tokens[1] ?? "show", value: tokens.slice(2).join(" ") || undefined };
  }
  return { kind: "unknown", tokens };
}
