const SENSITIVE = /token|cookie|authorization|secret|credential|session|access.?key|api.?key/i;

export function redactDiagnostics(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDiagnostics);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE.test(key) ? "[redacted]" : redactDiagnostics(item);
  }
  return out;
}

export interface DiagnosticBundleInput {
  packageVersion: string;
  nodeVersion: string;
  platform: string;
  transportHealth: unknown;
  capabilities: unknown;
  configSummary: unknown;
  lastWorkflow?: unknown;
}

export function createDiagnosticBundle(input: DiagnosticBundleInput) {
  return redactDiagnostics({
    generatedAt: new Date().toISOString(),
    ...input,
  });
}
