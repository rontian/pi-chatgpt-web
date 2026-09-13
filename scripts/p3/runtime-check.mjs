#!/usr/bin/env node
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ChatGPTProductRuntime } from "./conversation-runtime.mjs";

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "pi-chatgpt-web-p3-check-"));
  let turn = 0;
  const transport = {
    name: "mock",
    health: async () => ({ ok: true }),
    sendTurn: async (request) => {
      turn += 1;
      return {
        conversationId: request.conversationId ?? "p3-mock",
        status: "completed",
        text: turn === 1 ? "one" : "two",
        observations: [],
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
  const runtime = new ChatGPTProductRuntime(transport, { storePath: join(dir, "conversations.json") });
  runtime.createConversation("cli");
  const first = await runtime.sendTurn({ text: "first" }, "cli");
  const second = await runtime.continueTurn("second", "cli");
  const result = {
    phase: "P3",
    probe: "runtime-check",
    transportName: transport.name,
    sameConversation: first.conversationId === second.conversationId,
    turns: runtime.getConversationState("cli")?.turns ?? 0,
    usedPiUi: false,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.sameConversation || result.turns !== 2) process.exitCode = 2;
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
