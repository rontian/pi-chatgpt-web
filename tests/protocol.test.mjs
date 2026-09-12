import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("protocol source declares both envelope markers", async () => {
  const source = await readFile("src/protocol/envelope.ts", "utf8");
  assert.ok(source.includes("<pi-chatgpt>"));
  assert.ok(source.includes("</pi-chatgpt>"));
});

test("bootstrap transport refuses to fake an implementation", async () => {
  const source = await readFile("src/transport/browser-owned.ts", "utf8");
  assert.match(source, /intentionally unimplemented/i);
});
