import type { PiChatGPTWebConfig } from "./types.js";

export function createDefaultConfig(): PiChatGPTWebConfig {
  return {
    chatgpt: {
      transport: "browser-owned",
      temporary: true,
      maxTurns: 8,
      timeoutMs: 180_000
    },
    assistant: {
      enabled: true,
      model: "auto",
      fallbackModel: null,
      maxInputTokens: 32_000
    },
    context: {
      recentMessages: 12,
      maxChars: 60_000,
      includeToolResults: false,
      includeSystemMessages: false
    },
    prompt: {
      defaultAction: "editor",
      maxRounds: 8
    }
  };
}
