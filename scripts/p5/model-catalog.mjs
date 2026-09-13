export function modelKey(model) {
  const provider = String(model?.provider ?? model?.providerId ?? "");
  const id = String(model?.id ?? "");
  return provider && id ? `${provider}/${id}` : id;
}

export function catalogModels(registry) {
  return registry?.getAll?.() ?? [];
}

export function listModelKeys(registry) {
  return catalogModels(registry).map(modelKey).filter(Boolean).sort();
}

export function resolveAssistantModel(registry, configured) {
  const models = catalogModels(registry);
  if (!configured?.trim()) return null;
  if (configured !== "auto") {
    const exact = models.find((model) => modelKey(model) === configured || String(model?.id ?? "") === configured);
    return exact ? toResolved(exact) : null;
  }

  const ranked = models
    .map((raw) => ({ raw, key: modelKey(raw) }))
    .filter((item) => item.key)
    .sort((a, b) => scoreModel(b.key) - scoreModel(a.key));
  return ranked[0] ? toResolved(ranked[0].raw) : null;
}

export function resolveAssistantModelWithFallback(registry, configured, fallbackModel) {
  return resolveAssistantModel(registry, configured)
    ?? (fallbackModel ? resolveAssistantModel(registry, fallbackModel) : null);
}

function toResolved(model) {
  return {
    provider: String(model.provider ?? model.providerId ?? "") || undefined,
    model: String(model.id),
    key: modelKey(model),
    raw: model,
  };
}

function scoreModel(key) {
  const value = key.toLowerCase();
  if (/luna/.test(value)) return 110;
  if (/glm.*flash|flash.*glm/.test(value)) return 100;
  if (/flash/.test(value)) return 95;
  if (/deepseek/.test(value) && !/reason/.test(value)) return 80;
  if (/mini|small|fast/.test(value)) return 75;
  if (/sol|reason|xhigh|pro/.test(value)) return 20;
  return 50;
}

export function profileForContext(chars) {
  if (chars <= 20_000) return "fast";
  if (chars <= 60_000) return "normal";
  return "deep";
}
