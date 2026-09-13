import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("P2 browser transport is driver-injected and preserves ambiguous-write rule", async () => {
  const source = await readFile("src/transport/browser-owned.ts", "utf8");
  assert.match(source, /interface BrowserTurnDriver/);
  assert.match(source, /status === "ambiguous"/);
  assert.match(source, /reconciledReadback/);
});

test("P3 product runtime keeps per-workflow conversation state", async () => {
  const source = await readFile("scripts/p3/conversation-runtime.mjs", "utf8");
  assert.match(source, /this\.conversations = new Map/);
  assert.match(source, /workflowKey/);
  assert.match(source, /conversationId: request\.conversationId \?\?/);
});
