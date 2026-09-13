import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createAssistantAdapter } from "../assistant/pi-adapter.js";
import { loadConfig } from "../config/loader.js";
import { buildSessionSnapshot } from "../context/collector.js";
import { PromptWorkflow } from "../workflows/prompt/workflow.js";
import type { WorkflowResult } from "../workflows/types.js";
import { loadPromptCache, savePromptCache } from "../state/prompt-cache.js";
import type { ChatGPTCommandServices } from "./services.js";

interface PromptState {
  request: string;
  snapshot: unknown;
  result: WorkflowResult;
}

export class PromptController {
  private last: PromptState | null = null;
  private restored = false;

  private readonly pi: ExtensionAPI;
  private readonly services: ChatGPTCommandServices;

  constructor(pi: ExtensionAPI, services: ChatGPTCommandServices) {
    this.pi = pi;
    this.services = services;
  }

  async run(request: string, ctx: ExtensionContext) {
    if (!request.trim()) throw new Error("Usage: /chatgpt prompt <request>");
    const config = await loadConfig();
    const entries = ctx.sessionManager.getBranch();
    const snapshot = await buildSessionSnapshot({
      goal: request,
      cwd: ctx.cwd,
      project: basename(ctx.cwd),
      entries,
      config,
      assistant: createAssistantAdapter(config, ctx.modelRegistry),
    });
    const workflow = new PromptWorkflow(this.services.runtime, { maxRounds: config.prompt.maxRounds });
    const result = await workflow.run({ request, cwd: ctx.cwd, snapshot });
    this.last = { request, snapshot, result };
    if (result.status === "completed" && result.text) {
      await savePromptCache({
        request,
        prompt: result.text,
        conversationId: result.conversationId,
        rounds: result.rounds,
        inspection: result.inspection,
      });
    }
    return result;
  }

  async show(ctx: ExtensionContext) {
    await this.ensureRestored();
    ctx.ui.notify(this.requireCompleted(), "info");
  }

  async edit(ctx: ExtensionContext) {
    await this.ensureRestored();
    const text = this.requireCompleted();
    const edited = await ctx.ui.editor("Edit ChatGPT-generated Pi prompt", text);
    if (!edited?.trim() || !this.last) return;
    this.last.result.text = edited;
    this.last.result.status = "completed";
    await savePromptCache({
      request: this.last.request,
      prompt: edited,
      conversationId: this.last.result.conversationId,
      rounds: this.last.result.rounds,
      inspection: this.last.result.inspection,
    });
    ctx.ui.setEditorText(edited);
  }

  async send(ctx: ExtensionContext) {
    await this.ensureRestored();
    const text = this.requireCompleted();
    if (!ctx.isIdle()) throw new Error("Pi agent is busy. Wait until it is idle before /chatgpt prompt send.");
    this.pi.sendUserMessage(text);
  }

  async inspect(ctx: ExtensionContext) {
    await this.ensureRestored();
    if (!this.last) throw new Error("No /chatgpt prompt result is available.");
    ctx.ui.notify(JSON.stringify({
      request: this.last.request,
      snapshot: this.last.snapshot,
      status: this.last.result.status,
      conversationId: this.last.result.conversationId,
      rounds: this.last.result.rounds,
      inspection: this.last.result.inspection,
      resultChars: this.last.result.text?.length ?? 0,
    }, null, 2), "info");
  }

  async retry(ctx: ExtensionContext) {
    await this.ensureRestored();
    if (!this.last) throw new Error("No /chatgpt prompt request is available to retry.");
    return this.run(this.last.request, ctx);
  }

  private async ensureRestored() {
    if (this.last || this.restored) return;
    this.restored = true;
    const cached = await loadPromptCache();
    if (!cached) return;
    this.last = {
      request: cached.request,
      snapshot: { restoredFromCache: true, savedAt: cached.savedAt },
      result: {
        status: "completed",
        text: cached.prompt,
        conversationId: cached.conversationId,
        rounds: cached.rounds as any,
        inspection: { ...cached.inspection, restoredFromCache: true },
      },
    };
  }

  private requireCompleted(): string {
    if (!this.last || this.last.result.status !== "completed" || !this.last.result.text) {
      throw new Error("No completed /chatgpt prompt result is available.");
    }
    return this.last.result.text;
  }
}
