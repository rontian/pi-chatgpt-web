export interface PiChatGPTWebConfig {
  chatgpt: {
    transport: "browser-owned";
    temporary: boolean;
    maxTurns: number;
    timeoutMs: number;
  };
  assistant: {
    enabled: boolean;
    model: "auto" | string;
    fallbackModel: string | null;
    maxInputTokens: number;
  };
  context: {
    recentMessages: number;
    maxChars: number;
    includeToolResults: boolean;
    includeSystemMessages: boolean;
  };
  prompt: {
    defaultAction: "editor" | "show";
    maxRounds: number;
  };
}
