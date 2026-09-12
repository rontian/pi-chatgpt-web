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
  const loader = await readFile("src/config/loader.ts", "utf8");
  const catalog = await readFile("src/assistant/model-catalog.ts", "utf8");
  assert.match(loader, /DEFAULT_CONFIG_PATH/);
  assert.match(loader, /mode: 0o600/);
  assert.match(catalog, /resolveAssistantModel/);
  assert.match(catalog, /luna\|flash/);
  assert.match(catalog, /deepseek/);
});
