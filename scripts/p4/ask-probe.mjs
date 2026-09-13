#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import process from "node:process";
import { AskCommandServices } from "./ask-services.mjs";

function parseArgs(argv) {
  const result = { text: "只回复 OK", json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") result.json = true;
    else if (arg === "--text") result.text = argv[++i];
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function printHelp() {
  console.log(`P4 opt-in /chatgpt ask path probe

Usage:
  npm run p4:ask

Runs AskCommandServices through NativeChromeTurnDriver.
Does not start the Pi TUI.
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  const services = new AskCommandServices();
  try {
    const result = await services.ask(options.text);
    const output = {
      phase: "P4",
      probe: "ask",
      status: result.status,
      conversationIdObserved: Boolean(result.conversationId && result.conversationId !== "unknown"),
      responseLength: result.text?.length ?? 0,
      renderedText: Boolean(result.status === "completed" && result.text),
      usedPiUi: false,
    };
    console.log(JSON.stringify(output, null, 2));
    if (result.status !== "completed" || !result.text) process.exitCode = 2;
  } finally {
    await services.close();
  }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
