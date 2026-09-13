import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseArgs,
  normalizeText,
  buildProbeToken,
  buildPrompt,
  expectedReply,
  summarizeTurn,
  extractConversationId,
  assertAuthenticatedForTextTurn,
  TEXT_TURN_UNAUTHENTICATED_MESSAGE,
} from "../scripts/p1/text-turn-probe.mjs";

test("text-turn probe bounds turns and parses options", () => {
  const parsed = parseArgs(["--turns", "5", "--timeout-ms", "90000", "--json"], {});
  assert.equal(parsed.turns, 5);
  assert.equal(parsed.timeoutMs, 90000);
  assert.equal(parsed.json, true);
  assert.throws(() => parseArgs(["--turns", "6"], {}), /between 1 and 5/);
});

test("text-turn probe uses the same proxy precedence and validation", () => {
  assert.equal(parseArgs([], {}).proxy, null);
  assert.equal(
    parseArgs([], { PI_CHATGPT_WEB_PROXY: "http://127.0.0.1:7890" }).proxy,
    "http://127.0.0.1:7890"
  );
  assert.equal(
    parseArgs(["--proxy", "https://proxy.example:8443"], {
      PI_CHATGPT_WEB_PROXY: "http://127.0.0.1:7890",
    }).proxy,
    "https://proxy.example:8443"
  );
  assert.throws(() => parseArgs(["--proxy", ""], {}), /must not be empty/);
});

test("second turn proves prior-conversation recall", () => {
  const first = buildProbeToken("a1b2c3d4", 1);
  const second = buildProbeToken("a1b2c3d4", 2);
  assert.match(buildPrompt({ turn: 2, firstToken: first, token: second }), /previous assistant reply/);
  assert.equal(expectedReply({ turn: 2, firstToken: first, token: second }), first);
});

test("summary does not expose response text", () => {
  const result = summarizeTurn({
    turn: 1,
    expected: "  OK  ",
    actual: "OK\n",
    conversationId: "abc",
    elapsedMs: 123,
  });
  assert.equal(result.exactMatch, true);
  assert.equal(result.responseLength, 2);
  assert.ok(result.responseSha256.length === 64);
  assert.equal("actual" in result, false);
  assert.equal("expected" in result, false);
});

test("normalization and conversation id extraction are deterministic", () => {
  assert.equal(normalizeText("A\n  B"), "A B");
  assert.equal(extractConversationId("https://chatgpt.com/c/1234?x=1"), "1234");
  assert.equal(extractConversationId("https://chatgpt.com/"), null);
});

test("assistant wait accepts either a new bubble or changed latest text", () => {
  const source = readFileSync(new URL("../scripts/p1/page-session.mjs", import.meta.url), "utf8");
  assert.match(source, /hasNewAssistantTurn/);
  assert.match(source, /countAdvanced/);
  assert.match(source, /textAdvanced/);
  const probe = readFileSync(new URL("../scripts/p1/text-turn-probe.mjs", import.meta.url), "utf8");
  assert.match(probe, /waitForAssistant\(page, before\.count, options\.timeoutMs, beforeText\)/);
});

test("text-turn probe fails closed when the isolated profile is not authenticated", () => {
  assert.throws(
    () => assertAuthenticatedForTextTurn({ authenticated: false, authSource: null, sessionEndpointStatus: 200 }),
    new RegExp(TEXT_TURN_UNAUTHENTICATED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
  assert.doesNotThrow(() => assertAuthenticatedForTextTurn({ authenticated: true, authSource: "ui" }));
});
