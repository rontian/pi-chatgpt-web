export {
  catalogModels,
  listModelKeys,
  modelKey,
  profileForContext,
  resolveAssistantModel,
  resolveAssistantModelWithFallback,
} from "../../scripts/p5/model-catalog.mjs";

export type { AssistantModelRef, AssistantProfile } from "./types.js";

export interface ModelCatalogLike {
  getAll(): readonly any[];
}

export interface ResolvedAssistantModel {
  provider?: string;
  model: string;
  key: string;
  raw: any;
}
