import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_CONFIG_PATH = join(homedir(), ".pi", "agent", "pi-chatgpt-web", "config.json");

export function createDefaultConfig() {
  return {
    chatgpt: {
      transport: "browser-owned",
      temporary: true,
      maxTurns: 8,
      timeoutMs: 180_000,
    },
    assistant: {
      enabled: true,
      model: "auto",
      fallbackModel: null,
      maxInputTokens: 32_000,
    },
    context: {
      recentMessages: 12,
      maxChars: 60_000,
      includeToolResults: false,
      includeSystemMessages: false,
    },
    prompt: {
      defaultAction: "editor",
      maxRounds: 8,
    },
  };
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function merge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isRecord(value) && isRecord(out[key])) out[key] = merge(out[key], value);
    else out[key] = value;
  }
  return out;
}

export function validateConfig(config) {
  const errors = [];
  if (config.chatgpt.maxTurns < 1 || config.chatgpt.maxTurns > 64) errors.push("chatgpt.maxTurns must be between 1 and 64");
  if (config.chatgpt.timeoutMs < 5_000) errors.push("chatgpt.timeoutMs must be >= 5000");
  if (config.context.recentMessages < 0 || config.context.recentMessages > 200) errors.push("context.recentMessages must be between 0 and 200");
  if (config.context.maxChars < 1_000) errors.push("context.maxChars must be >= 1000");
  if (config.prompt.maxRounds < 1 || config.prompt.maxRounds > 32) errors.push("prompt.maxRounds must be between 1 and 32");
  if (!config.assistant.model?.trim()) errors.push("assistant.model must not be empty");
  if (config.assistant.fallbackModel !== null && !String(config.assistant.fallbackModel).trim()) {
    errors.push("assistant.fallbackModel must be a model id or null");
  }
  return errors;
}

export async function loadConfig(path = DEFAULT_CONFIG_PATH) {
  const defaults = createDefaultConfig();
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return defaults;
    throw error;
  }
  const parsed = JSON.parse(raw);
  if (!isRecord(parsed)) throw new Error("pi-chatgpt-web config root must be an object");
  const config = merge(defaults, parsed);
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`Invalid pi-chatgpt-web config: ${errors.join("; ")}`);
  return config;
}

export async function saveConfig(config, path = DEFAULT_CONFIG_PATH) {
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`Invalid pi-chatgpt-web config: ${errors.join("; ")}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
