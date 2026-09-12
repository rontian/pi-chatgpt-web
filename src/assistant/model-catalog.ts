import type { AssistantModelRef, AssistantProfile } from "./types.js";

export interface ModelCatalogLike {
  getAll(): readonly any[];
}

export interface ResolvedAssistantModel extends AssistantModelRef {
  key: string;
  raw: any;
}

export function modelKey(model: any): string {
  const provider = String(model?.provider ?? model?.providerId ?? "");
  const id = String(model?.id ?? "");
  return provider && id ? `${provider}/${id}` : id;
}

export function listModelKeys(registry: ModelCatalogLike): string[] {
  return registry.getAll().map(modelKey).filter(Boolean).sort();
}

export function resolveAssistantModel(registry: ModelCatalogLike, configured: string): ResolvedAssistantModel | null {
  const models = registry.getAll();
  if (configured !== "auto") {
    const exact = models.find((model) => modelKey(model) === configured || String(model?.id ?? "") === configured);
    if (!exact) return null;
    return {
      provider: String(exact.provider ?? exact.providerId ?? "") || undefined,
      model: String(exact.id),
      key: modelKey(exact),
      raw: exact,
    };
  }

  const ranked = models
    .map((raw) => ({ raw, key: modelKey(raw) }))
    .filter((item) => item.key)
    .sort((a, b) => scoreModel(b.key) - scoreModel(a.key));
  const selected = ranked[0];
  if (!selected) return null;
  return {
    provider: String(selected.raw.provider ?? selected.raw.providerId ?? "") || undefined,
    model: String(selected.raw.id),
    key: selected.key,
    raw: selected.raw,
  };
}

function scoreModel(key: string): number {
  const value = key.toLowerCase();
  if (/luna|flash/.test(value)) return 100;
  if (/glm.*flash|flash.*glm/.test(value)) return 95;
  if (/deepseek/.test(value) && !/reason/.test(value)) return 80;
  if (/mini|small|fast/.test(value)) return 75;
  if (/sol|reason|xhigh|pro/.test(value)) return 20;
  return 50;
}

export function profileForContext(chars: number): AssistantProfile {
  if (chars <= 20_000) return "fast";
  if (chars <= 60_000) return "normal";
  return "deep";
}
