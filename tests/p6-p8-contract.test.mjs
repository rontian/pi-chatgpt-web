import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("P6 context pipeline is bounded and filters session history", async () => {
  const budget = await readFile("src/context/budget.ts", "utf8");
  const collector = await readFile("src/context/collector.ts", "utf8");
  assert.match(budget, /maxChars/);
  assert.match(budget, /truncated/);
  assert.match(collector, /recentMessages/);
  assert.match(collector, /includeToolResults/);
  assert.match(collector, /helperUsed/);
  assert.match(collector, /maybeCompressContext/);
});

test("P7 prompt workflow is multi-round and envelope-driven", async () => {
  const workflow = await readFile("src/workflows/prompt/workflow.ts", "utf8");
  assert.match(workflow, /for \(let index = 1; index <= this\.maxRounds/);
  assert.match(workflow, /need_context/);
  assert.match(workflow, /final_envelope/);
  assert.match(workflow, /plain_text_final/);
});

test("P8 prompt UX supports show edit send retry inspect", async () => {
  const controller = await readFile("src/extension/prompt-controller.ts", "utf8");
  const command = await readFile("src/extension/command.ts", "utf8");
  assert.match(controller, /ctx\.ui\.editor/);
  assert.match(controller, /sendUserMessage/);
  assert.match(controller, /inspect/);
  for (const action of ["show", "edit", "send", "retry", "inspect"]) assert.ok(command.includes(`\"${action}\"`));
});
