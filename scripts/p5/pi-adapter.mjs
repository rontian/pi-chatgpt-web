import { profileForContext, resolveAssistantModel, resolveAssistantModelWithFallback } from "./model-catalog.mjs";

export function extractAssistantText(response) {
  const parts = Array.isArray(response?.content) ? response.content : [];
  return parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function profileRequestOptions(profile) {
  if (profile === "deep") return { reasoningEffort: "medium" };
  if (profile === "fast") return { reasoningEffort: "minimal" };
  return {};
}

export function createRegistryAssistantRunner(registry) {
  return async ({ model, system, input, profile }) => {
    if (typeof registry.complete !== "function") {
      throw new Error("Pi model registry cannot complete helper-model requests.");
    }
    const response = await registry.complete(
      model,
      {
        systemPrompt: system,
        messages: [
          {
            role: "user",
            content: input,
            timestamp: Date.now(),
          },
        ],
      },
      profileRequestOptions(profile),
    );
    if (response?.stopReason === "error" || response?.errorMessage) {
      throw new Error(response.errorMessage ?? "Helper model request failed.");
    }
    const text = extractAssistantText(response);
    if (!text) throw new Error("Helper model returned no text.");
    return text;
  };
}

export class PiAssistantAdapter {
  constructor(registry, configuredModel, runner = createRegistryAssistantRunner(registry), fallbackModel = null) {
    this.registry = registry;
    this.configuredModel = configuredModel;
    this.runner = runner;
    this.fallbackModel = fallbackModel;
  }

  async run(task) {
    const resolved = this.resolveRunnableModel();
    try {
      return await this.runner({
        model: resolved.raw,
        system: task.instruction,
        input: task.input,
        profile: task.profile,
      });
    } catch (error) {
      const fallback = this.resolveFallback(resolved);
      if (!fallback) throw error;
      return this.runner({
        model: fallback.raw,
        system: task.instruction,
        input: task.input,
        profile: task.profile,
      });
    }
  }

  resolveRunnableModel() {
    const primary = resolveAssistantModel(this.registry, this.configuredModel);
    if (primary && this.canUse(primary.raw)) return primary;
    const fallback = this.resolveFallback(primary);
    if (fallback) return fallback;
    if (!primary) {
      throw new Error(`Helper model not found in Pi/OpenCodex registry: ${this.configuredModel}`);
    }
    throw new Error(`Helper model has no configured authentication: ${primary.key}`);
  }

  resolveFallback(primary) {
    if (!this.fallbackModel) return null;
    const fallback = resolveAssistantModel(this.registry, this.fallbackModel);
    if (!fallback || fallback.key === primary?.key || !this.canUse(fallback.raw)) return null;
    return fallback;
  }

  canUse(model) {
    if (typeof this.registry.hasConfiguredAuth !== "function") return true;
    return this.registry.hasConfiguredAuth(model);
  }
}

export class DisabledAssistantAdapter {
  async run() {
    throw new Error("Helper model is disabled.");
  }
}

export function createAssistantAdapter(config, registry) {
  if (!config.assistant.enabled) return new DisabledAssistantAdapter();
  return new PiAssistantAdapter(
    registry,
    config.assistant.model,
    createRegistryAssistantRunner(registry),
    config.assistant.fallbackModel,
  );
}

export function describeAssistantHelper(config, registry) {
  if (!config.assistant.enabled) return "disabled";
  const resolved = resolveAssistantModelWithFallback(registry, config.assistant.model, config.assistant.fallbackModel);
  return resolved?.key ?? `${config.assistant.model} (unresolved)`;
}

export const HELPER_COMPRESSION_INSTRUCTION = "Compress the supplied Pi session context for another model. Preserve explicit user constraints, current task state, decisions, errors, branch/commit identifiers, and unresolved questions. Return concise plain text only.";

export async function maybeCompressContext({ assistant, enabled, truncated, usedChars, relevantContext }) {
  if (!assistant || !enabled || !truncated) {
    return { relevantContext, helperUsed: false };
  }
  const extracted = await assistant.run({
    profile: profileForContext(usedChars),
    instruction: HELPER_COMPRESSION_INSTRUCTION,
    input: relevantContext.join("\n\n"),
  });
  if (!extracted?.trim()) return { relevantContext, helperUsed: false };
  return { relevantContext: [extracted.trim()], helperUsed: true };
}
