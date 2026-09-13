import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("P4 command surface routes operational subcommands", async () => {
  const parser = await readFile("src/extension/parse-command.ts", "utf8");
  const command = await readFile("src/extension/command.ts", "utf8");
  for (const token of ["login", "logout", "doctor", "ask", "prompt", "config"]) {
    assert.ok(parser.includes(`\"${token}\"`), `missing parser token ${token}`);
  }
  assert.match(command, /ctx\.modelRegistry/);
  assert.match(command, /services\.ask/);
});

test("P5 config and helper model boundaries are implemented", async () => {
  const loader = await readFile("scripts/p5/config.mjs", "utf8");
  const catalog = await readFile("scripts/p5/model-catalog.mjs", "utf8");
  const adapter = await readFile("scripts/p5/pi-adapter.mjs", "utf8");
  const command = await readFile("src/extension/command.ts", "utf8");
  const controller = await readFile("src/extension/prompt-controller.ts", "utf8");
  const collector = await readFile("src/context/collector.ts", "utf8");
  assert.match(loader, /DEFAULT_CONFIG_PATH/);
  assert.match(loader, /mode: 0o600/);
  assert.match(catalog, /resolveAssistantModel/);
  assert.match(catalog, /resolveAssistantModelWithFallback/);
  assert.match(catalog, /luna/);
  assert.match(catalog, /flash/);
  assert.match(catalog, /deepseek/);
  assert.match(adapter, /createRegistryAssistantRunner/);
  assert.match(adapter, /fallbackModel/);
  assert.match(command, /fallback-model/);
  assert.match(controller, /createAssistantAdapter/);
  assert.match(collector, /maybeCompressContext/);
});
