export type AssistantProfile = "fast" | "normal" | "deep";

export interface AssistantModelRef {
  provider?: string;
  model: string;
}

export interface AssistantTask {
  profile: AssistantProfile;
  instruction: string;
  input: string;
}

export interface AssistantAdapter {
  run(task: AssistantTask): Promise<string>;
}
