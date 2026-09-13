#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import process from "node:process";
import { NativeChromeTurnDriver } from "./native-chrome-driver.mjs";

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
  console.log(`P2 opt-in live NativeChromeTurnDriver probe

Usage:
  npm run p2:live

Requires an already authenticated isolated P1/P2 Chrome profile.
Does not open an interactive login window.
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  const driver = new NativeChromeTurnDriver();
  try {
    const health = await driver.health();
    if (!health.ok) {
      console.log(JSON.stringify({ phase: "P2", probe: "live-driver", ...health }, null, 2));
      process.exitCode = 2;
      return;
    }
    const result = await driver.send({ text: options.text });
    const output = {
      phase: "P2",
      probe: "live-driver",
      status: result.status,
      conversationIdObserved: Boolean(result.conversationId && result.conversationId !== "unknown"),
      responseLength: result.text?.length ?? 0,
      browserOwnedWrite: result.provenance.browserOwnedWrite,
      reconciledReadback: result.provenance.reconciledReadback,
    };
    console.log(JSON.stringify(output, null, 2));
    if (result.status !== "completed") process.exitCode = 2;
  } finally {
    await driver.close();
  }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
