import type { ProductCapability } from "../core/types.js";
import type { ChatGPTProductRuntime } from "../runtime/chatgpt-runtime.js";
import type { CapabilityEvidence } from "./capabilities.js";

export interface CapabilityValidationCase {
  capability: ProductCapability;
  prompt: string;
  expectedSubstring?: string;
  description?: string;
}

export async function validateCapability(
  runtime: ChatGPTProductRuntime,
  testCase: CapabilityValidationCase,
): Promise<CapabilityEvidence> {
  const result = await runtime.sendTurn(
    { text: testCase.prompt, temporary: true },
    `capability:${testCase.capability}`,
  );

  let state: CapabilityEvidence["state"] = "unknown";
  if (result.status === "completed" && result.text) {
    if (testCase.expectedSubstring) {
      state = result.text.toLowerCase().includes(testCase.expectedSubstring.toLowerCase()) ? "available" : "unknown";
    } else if (result.observations.some((item) => `${item.type} ${item.name ?? ""}`.toLowerCase().includes(testCase.capability.replace("_", " ")))) {
      state = "available";
    }
  }

  const evidence: CapabilityEvidence = {
    capability: testCase.capability,
    state,
    source: "validation",
    detail: testCase.description ?? `validation status=${result.status}`,
    observedAt: new Date().toISOString(),
  };
  runtime.capabilities.record(evidence);
  return evidence;
}
