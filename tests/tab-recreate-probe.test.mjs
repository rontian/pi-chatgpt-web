import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conversationUrl, parseArgs } from "../scripts/p1/tab-recreate-probe.mjs";

test("tab recreate probe parses the same proxy precedence", () => {
  assert.equal(parseArgs([], {}).proxy, null);
  assert.equal(
    parseArgs([], { PI_CHATGPT_WEB_PROXY: "http://127.0.0.1:7890" }).proxy,
    "http://127.0.0.1:7890"
  );
});

test("conversation URL is rebuilt from the observed id without query material", () => {
  assert.equal(conversationUrl("abc-123"), "https://chatgpt.com/c/abc-123");
  assert.throws(() => conversationUrl(""), /conversationId is required/);
});

test("tab recreate waits for restored assistant text instead of reading immediately", () => {
  const source = readFileSync(new URL("../scripts/p1/tab-recreate-probe.mjs", import.meta.url), "utf8");
  assert.match(source, /waitForRestoredAssistant/);
});
