import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createDefaultConfig } from "./defaults.js";
import type { PiChatGPTWebConfig } from "./types.js";

export const DEFAULT_CONFIG_PATH = join(homedir(), ".pi", "agent", "pi-chatgpt-web", "config.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function merge<T extends Record<string, any>>(base: T, override: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isRecord(value) && isRecord(out[key])) out[key] = merge(out[key] as Record<string, any>, value);
    else out[key] = value;
  }
  return out as T;
}

export function validateConfig(config: PiChatGPTWebConfig): string[] {
  const errors: string[] = [];
  if (config.chatgpt.maxTurns < 1 || config.chatgpt.maxTurns > 64) errors.push("chatgpt.maxTurns must be between 1 and 64");
  if (config.chatgpt.timeoutMs < 5_000) errors.push("chatgpt.timeoutMs must be >= 5000");
  if (config.context.recentMessages < 0 || config.context.recentMessages > 200) errors.push("context.recentMessages must be between 0 and 200");
  if (config.context.maxChars < 1_000) errors.push("context.maxChars must be >= 1000");
  if (config.prompt.maxRounds < 1 || config.prompt.maxRounds > 32) errors.push("prompt.maxRounds must be between 1 and 32");
  if (!config.assistant.model?.trim()) errors.push("assistant.model must not be empty");
  return errors;
}

export async function loadConfig(path = DEFAULT_CONFIG_PATH): Promise<PiChatGPTWebConfig> {
  const defaults = createDefaultConfig();
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error: any) {
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

export async function saveConfig(config: PiChatGPTWebConfig, path = DEFAULT_CONFIG_PATH) {
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`Invalid pi-chatgpt-web config: ${errors.join("; ")}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
