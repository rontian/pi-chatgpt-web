import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultConfig, loadConfig, saveConfig, validateConfig } from "../scripts/p5/config.mjs";
import {
  profileForContext,
  resolveAssistantModel,
  resolveAssistantModelWithFallback,
} from "../scripts/p5/model-catalog.mjs";
import {
  createAssistantAdapter,
  describeAssistantHelper,
  DisabledAssistantAdapter,
  extractAssistantText,
  maybeCompressContext,
  PiAssistantAdapter,
} from "../scripts/p5/pi-adapter.mjs";
import { AskCommandServices } from "../scripts/p4/ask-services.mjs";

function model(provider, id) {
  return { provider, id };
}

function registry(models, options = {}) {
  const authed = new Set(options.authed ?? models.map((item) => `${item.provider}/${item.id}`));
  const complete = options.complete ?? (async (raw) => ({
    content: [{ type: "text", text: `ok:${raw.provider}/${raw.id}` }],
    stopReason: "stop",
  }));
  return {
    getAll: () => models,
    hasConfiguredAuth: (raw) => authed.has(`${raw.provider}/${raw.id}`),
    complete,
  };
}

const catalog = [
  model("amazon-bedrock", "global.openai.gpt-5.6-sol"),
  model("deepseek", "deepseek-chat"),
  model("opencodex", "glm-5.3-flash"),
  model("amazon-bedrock", "global.openai.gpt-5.6-luna"),
];

test("auto prefers Luna/Flash over Sol/reasoner", () => {
  const resolved = resolveAssistantModel(registry(catalog), "auto");
  assert.equal(resolved.key, "amazon-bedrock/global.openai.gpt-5.6-luna");
});

test("explicit registered model resolves and missing model is clear", () => {
  const resolved = resolveAssistantModel(registry(catalog), "deepseek/deepseek-chat");
  assert.equal(resolved.model, "deepseek-chat");
  assert.equal(resolveAssistantModel(registry(catalog), "missing/model"), null);
});

test("fallback model is used when primary is missing or unauthenticated", async () => {
  const fallback = resolveAssistantModelWithFallback(
    registry(catalog),
    "missing/model",
    "opencodex/glm-5.3-flash",
  );
  assert.equal(fallback.key, "opencodex/glm-5.3-flash");

  const used = [];
  const adapter = new PiAssistantAdapter(
    registry(catalog, { authed: ["opencodex/glm-5.3-flash"] }),
    "amazon-bedrock/global.openai.gpt-5.6-luna",
    async ({ model }) => {
      used.push(`${model.provider}/${model.id}`);
      return "compressed";
    },
    "opencodex/glm-5.3-flash",
  );
  assert.equal(await adapter.run({ profile: "fast", instruction: "x", input: "y" }), "compressed");
  assert.deepEqual(used, ["opencodex/glm-5.3-flash"]);
});

test("runner failure falls back to fallbackModel", async () => {
  const used = [];
  const adapter = new PiAssistantAdapter(
    registry(catalog),
    "amazon-bedrock/global.openai.gpt-5.6-luna",
    async ({ model }) => {
      const key = `${model.provider}/${model.id}`;
      used.push(key);
      if (key.includes("luna")) throw new Error("primary unavailable");
      return "from-fallback";
    },
    "opencodex/glm-5.3-flash",
  );
  assert.equal(await adapter.run({ profile: "normal", instruction: "x", input: "y" }), "from-fallback");
  assert.deepEqual(used, [
    "amazon-bedrock/global.openai.gpt-5.6-luna",
    "opencodex/glm-5.3-flash",
  ]);
});

test("disabled helper does not affect ChatGPT transport construction", async () => {
  const config = createDefaultConfig();
  config.assistant.enabled = false;
  const adapter = createAssistantAdapter(config, registry(catalog));
  assert.equal(adapter instanceof DisabledAssistantAdapter, true);
  await assert.rejects(() => adapter.run({ profile: "fast", instruction: "x", input: "y" }), /disabled/);
  assert.equal(describeAssistantHelper(config, registry(catalog)), "disabled");

  const services = new AskCommandServices({
    health: async () => ({ ok: false, detail: "browser driver is unconfigured" }),
    send: async () => {
      throw new Error("transport should stay independent of helper disable");
    },
  });
  const health = await services.transport.health();
  assert.equal(health.ok, false);
  assert.match(health.detail ?? "", /unconfigured/);
  assert.equal(typeof services.ask, "function");
});

test("registry complete extracts text and reports missing auth clearly", async () => {
  const adapter = createAssistantAdapter(
    { assistant: { enabled: true, model: "opencodex/glm-5.3-flash", fallbackModel: null, maxInputTokens: 1000 } },
    registry(catalog),
  );
  assert.equal(await adapter.run({ profile: "fast", instruction: "sys", input: "hello" }), "ok:opencodex/glm-5.3-flash");

  const unauthed = new PiAssistantAdapter(
    registry(catalog, { authed: [] }),
    "opencodex/glm-5.3-flash",
  );
  await assert.rejects(
    () => unauthed.run({ profile: "fast", instruction: "sys", input: "hello" }),
    /no configured authentication/,
  );
});

test("Chinese + code-heavy extraction preserves constraints", async () => {
  const constraint = "不要修改生产数据库，只改 docs/TASKS.md";
  const code = "export function applyCharBudget() { return { truncated: true }; }";
  const relevantContext = [
    `user: ${constraint}\n\n\`\`\`ts\n${code}\n\`\`\``,
    `assistant: ${"filler ".repeat(80)}`,
    "user: 继续压缩这段中文约束和代码。",
  ];
  const result = await maybeCompressContext({
    assistant: {
      async run(task) {
        assert.match(task.instruction, /Preserve explicit user constraints/);
        assert.match(task.input, /不要修改生产数据库/);
        assert.match(task.input, /applyCharBudget/);
        return `约束: ${constraint}\n代码: applyCharBudget`;
      },
    },
    enabled: true,
    truncated: true,
    usedChars: 80_000,
    relevantContext,
  });
  assert.equal(result.helperUsed, true);
  assert.match(result.relevantContext[0], /不要修改生产数据库/);
  assert.match(result.relevantContext[0], /applyCharBudget/);
});

test("disabled helper skips compression even when context is truncated", async () => {
  const result = await maybeCompressContext({
    assistant: new DisabledAssistantAdapter(),
    enabled: false,
    truncated: true,
    usedChars: 40_000,
    relevantContext: ["user: first", "user: second"],
  });
  assert.equal(result.helperUsed, false);
  assert.deepEqual(result.relevantContext, ["user: first", "user: second"]);
});

test("config validation and persistence keep fallbackModel", async () => {
  const config = createDefaultConfig();
  config.assistant.fallbackModel = "opencodex/glm-5.3-flash";
  assert.deepEqual(validateConfig(config), []);
  const dir = await mkdtemp(join(tmpdir(), "p5-config-"));
  const path = join(dir, "config.json");
  await saveConfig(config, path);
  const loaded = await loadConfig(path);
  assert.equal(loaded.assistant.fallbackModel, "opencodex/glm-5.3-flash");
  const raw = JSON.parse(await readFile(path, "utf8"));
  assert.equal(raw.assistant.fallbackModel, "opencodex/glm-5.3-flash");
});

test("profile mapping and text extraction stay vendor-neutral", () => {
  assert.equal(profileForContext(1_000), "fast");
  assert.equal(profileForContext(40_000), "normal");
  assert.equal(profileForContext(80_000), "deep");
  assert.equal(extractAssistantText({
    content: [
      { type: "thinking", thinking: "secret" },
      { type: "text", text: "keep" },
      { type: "text", text: "this" },
    ],
  }), "keep\nthis");
});
