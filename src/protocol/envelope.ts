export const ENVELOPE_OPEN = "<pi-chatgpt>";
export const ENVELOPE_CLOSE = "</pi-chatgpt>";

export type WorkflowEnvelope =
  | { status: "need_context"; requests: unknown[] }
  | { status: "final" }
  | { status: "error"; message: string };

export function extractEnvelope(text: string): WorkflowEnvelope | null {
  const start = text.indexOf(ENVELOPE_OPEN);
  const end = text.indexOf(ENVELOPE_CLOSE);
  if (start < 0 || end <= start) return null;

  const raw = text.slice(start + ENVELOPE_OPEN.length, end).trim();
  try {
    const value = JSON.parse(raw) as WorkflowEnvelope;
    if (!value || typeof value !== "object" || !("status" in value)) return null;
    return value;
  } catch {
    return null;
  }
}
