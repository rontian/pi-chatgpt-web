import type { AssistantAdapter, AssistantTask } from "./types.js";
import { resolveAssistantModel, type ModelCatalogLike } from "./model-catalog.js";

export type AssistantRunner = (args: {
  model: any;
  system: string;
  input: string;
  profile: AssistantTask["profile"];
}) => Promise<string>;

export class PiAssistantAdapter implements AssistantAdapter {
  constructor(
    private readonly registry: ModelCatalogLike,
    private readonly configuredModel: string,
    private readonly runner: AssistantRunner,
  ) {}

  async run(task: AssistantTask): Promise<string> {
    const resolved = resolveAssistantModel(this.registry, this.configuredModel);
    if (!resolved) {
      throw new Error(`Helper model not found in Pi/OpenCodex registry: ${this.configuredModel}`);
    }
    return this.runner({
      model: resolved.raw,
      system: task.instruction,
      input: task.input,
      profile: task.profile,
    });
  }
}

export class DisabledAssistantAdapter implements AssistantAdapter {
  async run(_task: AssistantTask): Promise<string> {
    throw new Error("Helper model is disabled.");
  }
}
