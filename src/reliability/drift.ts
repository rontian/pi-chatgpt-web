export interface CompatibilitySignature {
  packageVersion: string;
  piVersion?: string;
  playwrightVersion?: string;
  browserChannel?: string;
  browserVersion?: string;
  transport: string;
  readbackMode?: string;
}

export interface DriftCheck {
  ok: boolean;
  warnings: string[];
}

export function checkCompatibilityDrift(current: CompatibilitySignature, baseline?: Partial<CompatibilitySignature>): DriftCheck {
  if (!baseline) return { ok: true, warnings: [] };
  const warnings: string[] = [];
  for (const key of ["playwrightVersion", "browserChannel", "transport", "readbackMode"] as const) {
    const expected = baseline[key];
    const actual = current[key];
    if (expected && actual && expected !== actual) warnings.push(`${key} changed: ${expected} -> ${actual}`);
  }
  return { ok: warnings.length === 0, warnings };
}

export function mayAutomaticallyRetry(status: string): boolean {
  return status === "failed";
}

export function assertRetrySafe(status: string) {
  if (status === "ambiguous") throw new Error("Ambiguous ChatGPT writes must be reconciled before retry.");
}
