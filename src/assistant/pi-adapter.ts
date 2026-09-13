export {
  createAssistantAdapter,
  createRegistryAssistantRunner,
  describeAssistantHelper,
  DisabledAssistantAdapter,
  extractAssistantText,
  HELPER_COMPRESSION_INSTRUCTION,
  maybeCompressContext,
  PiAssistantAdapter,
  profileRequestOptions,
} from "../../scripts/p5/pi-adapter.mjs";

export type { AssistantAdapter, AssistantProfile, AssistantTask } from "./types.js";
export type { ModelCatalogLike } from "./model-catalog.js";

export interface AssistantRegistryLike {
  getAll(): readonly any[];
  complete?(model: any, context: { systemPrompt?: string; messages: any[] }, options?: Record<string, unknown>): Promise<any>;
  hasConfiguredAuth?(model: any): boolean;
}

export type AssistantRunner = (args: {
  model: any;
  system: string;
  input: string;
  profile: import("./types.js").AssistantProfile;
}) => Promise<string>;
