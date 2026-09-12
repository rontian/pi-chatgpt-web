import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("P9 observation layer redacts secrets and preserves unknown events", async () => {
  const source = await readFile("src/product/observations.ts", "utf8");
  assert.match(source, /token\|cookie\|authorization\|secret\|session\|credential/i);
  assert.match(source, /type: "unknown"/);
});

test("P9 capability registry does not assume connected apps", async () => {
  const source = await readFile("src/product/capabilities.ts", "utf8");
  assert.match(source, /state: capability === "text" \? "unimplemented" : "unknown"/);
  assert.match(source, /github/);
  assert.match(source, /web_search/);
});

test("P10 validation requires observable response evidence", async () => {
  const source = await readFile("src/product/validation.ts", "utf8");
  assert.match(source, /expectedSubstring/);
  assert.match(source, /state.*"unknown"/s);
  assert.match(source, /runtime\.capabilities\.record/);
});
