import type { ProductObservation } from "../core/types.js";

const SECRET_KEYS = /token|cookie|authorization|secret|session|credential/i;

export function sanitizeObservationData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeObservationData);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEYS.test(key) ? "[redacted]" : sanitizeObservationData(item);
  }
  return out;
}

export function normalizeProductObservation(input: unknown): ProductObservation {
  if (!input || typeof input !== "object") {
    return { type: "unknown", data: input };
  }
  const record = input as Record<string, unknown>;
  return {
    type: typeof record.type === "string" ? record.type : "unknown",
    name: typeof record.name === "string" ? record.name : undefined,
    status: typeof record.status === "string" ? record.status : undefined,
    data: sanitizeObservationData(record.data ?? record),
  };
}

export function normalizeProductObservations(inputs: unknown[]): ProductObservation[] {
  return inputs.map(normalizeProductObservation);
}
