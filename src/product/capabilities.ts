import type { CapabilityState, ProductCapability, ProductObservation } from "../core/types.js";

export interface CapabilityEvidence {
  capability: ProductCapability;
  state: CapabilityState;
  source: "observation" | "validation" | "configuration";
  detail?: string;
  observedAt: string;
}

export class CapabilityRegistry {
  private readonly states = new Map<ProductCapability, CapabilityEvidence>();

  constructor() {
    for (const capability of ["text", "web_search", "github", "apps", "files", "images"] as ProductCapability[]) {
      this.states.set(capability, {
        capability,
        state: capability === "text" ? "unimplemented" : "unknown",
        source: "configuration",
        observedAt: new Date(0).toISOString(),
      });
    }
  }

  record(evidence: CapabilityEvidence) {
    this.states.set(evidence.capability, { ...evidence });
  }

  observe(observation: ProductObservation) {
    const capability = capabilityFromObservation(observation);
    if (!capability) return;
    this.record({
      capability,
      state: observation.status === "unsupported" ? "unsupported" : "available",
      source: "observation",
      detail: observation.name ?? observation.type,
      observedAt: new Date().toISOString(),
    });
  }

  get(capability: ProductCapability) {
    return this.states.get(capability)!;
  }

  snapshot(): CapabilityEvidence[] {
    return [...this.states.values()].map((item) => ({ ...item }));
  }
}

export function capabilityFromObservation(observation: ProductObservation): ProductCapability | null {
  const value = `${observation.type} ${observation.name ?? ""}`.toLowerCase();
  if (value.includes("github")) return "github";
  if (value.includes("search") || value.includes("web")) return "web_search";
  if (value.includes("file") || value.includes("attachment")) return "files";
  if (value.includes("image")) return "images";
  if (value.includes("app") || value.includes("tool")) return "apps";
  if (value.includes("text") || value.includes("assistant")) return "text";
  return null;
}
