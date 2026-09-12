import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface CachedPromptState {
  version: 1;
  savedAt: string;
  request: string;
  prompt: string;
  conversationId?: string;
  rounds?: unknown[];
  inspection?: Record<string, unknown>;
}

export const DEFAULT_PROMPT_CACHE = join(homedir(), ".pi", "agent", "pi-chatgpt-web", "cache", "last-prompt.json");

export async function savePromptCache(state: Omit<CachedPromptState, "version" | "savedAt">, path = DEFAULT_PROMPT_CACHE) {
  const value: CachedPromptState = { version: 1, savedAt: new Date().toISOString(), ...state };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export async function loadPromptCache(path = DEFAULT_PROMPT_CACHE): Promise<CachedPromptState | null> {
  try {
    const raw = await readFile(path, "utf8");
    const value = JSON.parse(raw) as CachedPromptState;
    if (value?.version !== 1 || typeof value.request !== "string" || typeof value.prompt !== "string") return null;
    return value;
  } catch (error: any) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function clearPromptCache(path = DEFAULT_PROMPT_CACHE) {
  await rm(path, { force: true });
}
