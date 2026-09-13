import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("protocol source declares both envelope markers", async () => {
  const source = await readFile("src/protocol/envelope.ts", "utf8");
  assert.ok(source.includes("<pi-chatgpt>"));
  assert.ok(source.includes("</pi-chatgpt>"));
});

test("browser transport requires an explicit validated driver instead of faking Web success", async () => {
  const source = await readFile("src/transport/browser-owned.ts", "utf8");
  assert.match(source, /BrowserTurnDriver/);
  assert.match(source, /UnconfiguredBrowserTurnDriver/);
  assert.match(source, /browser driver is unconfigured/i);
});
