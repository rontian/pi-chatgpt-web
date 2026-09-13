import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_CONVERSATION_STORE = join(
  homedir(),
  ".pi",
  "agent",
  "pi-chatgpt-web",
  "conversations.json",
);

const SECRET_KEYS = /token|cookie|authorization|secret|session|credential/i;

export function sanitizeObservationData(value) {
  if (Array.isArray(value)) return value.map(sanitizeObservationData);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SECRET_KEYS.test(key) ? "[redacted]" : sanitizeObservationData(item);
  }
  return out;
}

export function normalizeProductObservation(input) {
  if (!input || typeof input !== "object") return { type: "unknown", data: input };
  return {
    type: typeof input.type === "string" ? input.type : "unknown",
    name: typeof input.name === "string" ? input.name : undefined,
    status: typeof input.status === "string" ? input.status : undefined,
    data: sanitizeObservationData(input.data ?? input),
  };
}

export function normalizeTurnStatus(status) {
  if (status === "completed" || status === "in_progress" || status === "requires_action" || status === "ambiguous" || status === "failed") {
    return status;
  }
  return "failed";
}

function emptyCapabilities() {
  const now = new Date(0).toISOString();
  return {
    text: { capability: "text", state: "unimplemented", source: "configuration", observedAt: now },
    web_search: { capability: "web_search", state: "unknown", source: "configuration", observedAt: now },
    github: { capability: "github", state: "unknown", source: "configuration", observedAt: now },
    apps: { capability: "apps", state: "unknown", source: "configuration", observedAt: now },
    files: { capability: "files", state: "unknown", source: "configuration", observedAt: now },
    images: { capability: "images", state: "unknown", source: "configuration", observedAt: now },
  };
}

export class CapabilityRegistry {
  constructor() {
    this.states = new Map(Object.entries(emptyCapabilities()));
  }

  record(evidence) {
    this.states.set(evidence.capability, { ...evidence });
  }

  observe(observation) {
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

  get(capability) {
    return this.states.get(capability);
  }

  snapshot() {
    return [...this.states.values()].map((item) => ({ ...item }));
  }
}

export function capabilityFromObservation(observation) {
  const value = `${observation?.type ?? ""} ${observation?.name ?? ""}`.toLowerCase();
  if (value.includes("github")) return "github";
  if (value.includes("search") || value.includes("web")) return "web_search";
  if (value.includes("file") || value.includes("attachment")) return "files";
  if (value.includes("image")) return "images";
  if (value.includes("app") || value.includes("tool")) return "apps";
  if (value.includes("text") || value.includes("assistant")) return "text";
  return null;
}

export async function loadConversationStore(path = DEFAULT_CONVERSATION_STORE) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

export async function saveConversationStore(store, path = DEFAULT_CONVERSATION_STORE) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

export function conversationMetadata(state) {
  if (!state) return null;
  return {
    conversationId: state.conversationId,
    turns: state.turns,
    lastStatus: state.lastStatus,
    lastAssistantMessageId: state.lastAssistantMessageId ?? null,
    updatedAt: state.updatedAt ?? null,
  };
}

export class ChatGPTProductRuntime {
  constructor(transport, options = {}) {
    this.transport = transport;
    this.storePath = options.storePath ?? DEFAULT_CONVERSATION_STORE;
    this.persist = options.persist !== false;
    this.conversations = new Map();
    this.capabilities = new CapabilityRegistry();
  }

  health() {
    return this.transport.health();
  }

  createConversation(workflowKey = "default") {
    const next = {
      conversationId: null,
      turns: 0,
      lastStatus: null,
      lastAssistantMessageId: undefined,
      updatedAt: new Date().toISOString(),
    };
    this.conversations.set(workflowKey, next);
    return conversationMetadata(next);
  }

  resumeConversation(conversationId, workflowKey = "default") {
    if (!conversationId || typeof conversationId !== "string") {
      throw new Error("resumeConversation requires a conversation id.");
    }
    if (/[/?#]/.test(conversationId)) {
      throw new Error("conversation id is unsafe.");
    }
    const previous = this.conversations.get(workflowKey);
    const next = {
      conversationId,
      turns: previous?.turns ?? 0,
      lastStatus: previous?.lastStatus ?? null,
      lastAssistantMessageId: previous?.lastAssistantMessageId,
      updatedAt: new Date().toISOString(),
    };
    this.conversations.set(workflowKey, next);
    return conversationMetadata(next);
  }

  getConversationState(key) {
    return this.conversations.get(key) ?? null;
  }

  async sendTurn(request, workflowKey = "default") {
    const previous = this.conversations.get(workflowKey);
    const effective = {
      ...request,
      conversationId: request.conversationId ?? previous?.conversationId ?? undefined,
    };
    const raw = await this.transport.sendTurn(effective);
    const result = {
      ...raw,
      status: normalizeTurnStatus(raw.status),
      observations: (raw.observations ?? []).map(normalizeProductObservation),
    };
    for (const observation of result.observations) this.capabilities.observe(observation);
    if (result.status === "completed" && result.text) {
      this.capabilities.record({
        capability: "text",
        state: "available",
        source: "observation",
        detail: "completed assistant text",
        observedAt: new Date().toISOString(),
      });
    }
    const next = {
      conversationId: result.conversationId === "unknown" ? previous?.conversationId ?? null : result.conversationId,
      turns: (previous?.turns ?? 0) + 1,
      lastStatus: result.status,
      lastAssistantMessageId: result.assistantMessageId,
      updatedAt: new Date().toISOString(),
    };
    this.conversations.set(workflowKey, next);
    if (this.persist) {
      const store = await loadConversationStore(this.storePath);
      store[workflowKey] = conversationMetadata(next);
      await saveConversationStore(store, this.storePath);
    }
    return result;
  }

  continueTurn(text, workflowKey = "default") {
    const previous = this.conversations.get(workflowKey);
    return this.sendTurn({ text, conversationId: previous?.conversationId ?? undefined }, workflowKey);
  }

  clearConversation(workflowKey = "default") {
    this.conversations.delete(workflowKey);
  }
}
