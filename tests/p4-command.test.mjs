import test from "node:test";
import assert from "node:assert/strict";
import { parseChatGPTCommand } from "../src/extension/parse-command.ts";
import { handleOperationalCommand } from "../scripts/p4/command-handler.mjs";
import { AskCommandServices } from "../scripts/p4/ask-services.mjs";

function fakeDriver(sendImpl) {
  return {
    health: async () => ({ ok: true, detail: "mock ready" }),
    send: sendImpl,
    login: async () => ({ ok: true, detail: "login opened" }),
    confirmLogin: async () => ({ ok: true, detail: "login confirmed" }),
    logout: async () => ({ ok: true, detail: "logged out" }),
    close: async () => {},
  };
}

test("P4 parser exposes login confirm and ask text", () => {
  assert.equal(parseChatGPTCommand("login confirm").action, "confirm");
  assert.equal(parseChatGPTCommand("ask 只回复 OK").text, "只回复 OK");
  assert.equal(parseChatGPTCommand("doctor").kind, "doctor");
});

test("P4 ask renders completed text and actionable failures", async () => {
  const notes = [];
  const notify = (message, level) => notes.push({ message, level });
  const completed = new AskCommandServices(fakeDriver(async () => ({
    conversationId: "c1",
    status: "completed",
    text: "OK",
    observations: [],
    provenance: {
      transport: "mock",
      browserOwnedWrite: false,
      reconciledReadback: false,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
  })));
  await handleOperationalCommand(parseChatGPTCommand("ask 只回复 OK"), completed, notify);
  assert.equal(notes.at(-1).message, "OK");
  assert.equal(notes.at(-1).level, "info");

  const failed = new AskCommandServices(fakeDriver(async () => ({
    conversationId: "unknown",
    status: "failed",
    text: "ChatGPT profile is not authenticated. Run /chatgpt login first.",
    observations: [],
    provenance: {
      transport: "mock",
      browserOwnedWrite: false,
      reconciledReadback: false,
      startedAt: new Date().toISOString(),
    },
  })));
  await handleOperationalCommand(parseChatGPTCommand("ask hello"), failed, notify);
  assert.match(notes.at(-1).message, /did not complete: failed/);
  assert.match(notes.at(-1).message, /not authenticated/);
  assert.equal(notes.at(-1).level, "warning");
});

test("P4 login/status/doctor route through services", async () => {
  const notes = [];
  const notify = (message, level) => notes.push({ message, level });
  const services = new AskCommandServices(fakeDriver(async () => {
    throw new Error("send should not run");
  }));
  await handleOperationalCommand(parseChatGPTCommand("login"), services, notify);
  await handleOperationalCommand(parseChatGPTCommand("login confirm"), services, notify);
  await handleOperationalCommand(parseChatGPTCommand("logout"), services, notify);
  await handleOperationalCommand(parseChatGPTCommand("status"), services, notify);
  await handleOperationalCommand(parseChatGPTCommand("doctor"), services, notify);
  assert.match(notes[0].message, /login opened/);
  assert.match(notes[1].message, /login confirmed/);
  assert.match(notes[2].message, /logged out/);
  assert.match(notes[3].message, /transport: ready/);
  assert.match(notes[4].message, /"ok": true/);
});
