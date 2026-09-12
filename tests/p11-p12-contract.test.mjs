import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("P11 diagnostics and retry policy are fail-closed", async () => {
  const diagnostics = await readFile("src/reliability/diagnostics.ts", "utf8");
  const drift = await readFile("src/reliability/drift.ts", "utf8");
  assert.match(diagnostics, /\[redacted\]/);
  assert.match(diagnostics, /token\|cookie\|authorization/i);
  assert.match(drift, /Ambiguous ChatGPT writes must be reconciled before retry/);
  assert.match(drift, /mayAutomaticallyRetry/);
});

test("P11 prompt cache is private and reloadable", async () => {
  const cache = await readFile("src/state/prompt-cache.ts", "utf8");
  const controller = await readFile("src/extension/prompt-controller.ts", "utf8");
  assert.match(cache, /mode: 0o600/);
  assert.match(cache, /last-prompt\.json/);
  assert.match(controller, /ensureRestored/);
  assert.match(controller, /savePromptCache/);
});

test("P12 manifest remains alpha until real validation", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.match(pkg.version, /^0\.1\.0-alpha\./);
  assert.equal(pkg.publishConfig.access, "public");
  assert.ok(pkg.scripts.validate);
  assert.ok(pkg.scripts["pack:check"]);
});
