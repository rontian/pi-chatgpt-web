import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChatGPTProductRuntime } from "../scripts/p3/conversation-runtime.mjs";

function mockTransport(replies) {
  const sent = [];
  return {
    name: "mock",
    sent: () => sent,
    health: async () => ({ ok: true, detail: "mock" }),
    sendTurn: async (request) => {
      sent.push(request);
      const reply = replies[sent.length - 1] ?? replies.at(-1);
      return {
        conversationId: request.conversationId ?? "created-1",
        assistantMessageId: `a${sent.length}`,
        status: reply.status ?? "completed",
        text: reply.text,
        observations: reply.observations ?? [{ type: "assistant", status: "ok", data: { token: "secret-should-redact" } }],
        provenance: {
          transport: "mock",
          browserOwnedWrite: false,
          reconciledReadback: false,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      };
    },
  };
}

test("P3 runtime creates, continues, and resumes without Pi UI", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-chatgpt-web-p3-"));
  const storePath = join(dir, "conversations.json");
  const transport = mockTransport([{ text: "one" }, { text: "two" }, { text: "resumed" }]);
  const runtime = new ChatGPTProductRuntime(transport, { storePath });

  const created = runtime.createConversation("ask");
  assert.equal(created.conversationId, null);
  const first = await runtime.sendTurn({ text: "hello" }, "ask");
  assert.equal(first.conversationId, "created-1");
  assert.equal(first.observations[0].data.token, "[redacted]");
  const second = await runtime.continueTurn("again", "ask");
  assert.equal(second.conversationId, "created-1");
  assert.equal(transport.sent()[1].conversationId, "created-1");
  assert.equal(runtime.getConversationState("ask").turns, 2);

  const other = new ChatGPTProductRuntime(transport, { storePath, persist: false });
  other.resumeConversation("created-1", "ask");
  const third = await other.continueTurn("from store", "ask");
  assert.equal(third.conversationId, "created-1");
  assert.equal(transport.sent()[2].conversationId, "created-1");

  const persisted = JSON.parse(await readFile(storePath, "utf8"));
  assert.equal(persisted.ask.conversationId, "created-1");
  assert.equal(persisted.ask.turns, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(persisted.ask, "text"), false);
});

test("P3 runtime transport is replaceable and hides browser-private fields", async () => {
  const transport = mockTransport([{ text: "OK" }]);
  const runtime = new ChatGPTProductRuntime(transport, { persist: false });
  const result = await runtime.sendTurn({ text: "只回复 OK" }, "cli");
  assert.equal(result.status, "completed");
  assert.equal(result.text, "OK");
  assert.equal(result.provenance.transport, "mock");
  assert.equal(result.observations.some((item) => item.type === "cdp" || item.name === "page"), false);
  assert.ok(!("page" in result));
  assert.ok(!("browser" in result));
});

test("unknown transport status normalizes to failed", async () => {
  const transport = mockTransport([{ text: "x", status: "weird" }]);
  const runtime = new ChatGPTProductRuntime(transport, { persist: false });
  const result = await runtime.sendTurn({ text: "x" }, "n");
  assert.equal(result.status, "failed");
});
