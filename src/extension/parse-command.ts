export type ParsedChatGPTCommand =
  | { kind: "help"; tokens: string[] }
  | { kind: "status"; tokens: string[] }
  | { kind: "planned"; tokens: string[] };

export function tokenizeCommand(input: string): string[] {
  return input.trim().split(/\s+/u).filter(Boolean);
}

export function parseChatGPTCommand(input: string): ParsedChatGPTCommand {
  const tokens = tokenizeCommand(input);
  if (tokens.length === 0 || tokens[0] === "help") return { kind: "help", tokens };
  if (tokens[0] === "status") return { kind: "status", tokens };
  return { kind: "planned", tokens };
}
