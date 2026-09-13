#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import process from "node:process";
import {
  AMBIGUOUS_TIMEOUT_MESSAGE,
  assertRetrySafe,
  classifyWriteTimeout,
  nextActionAfterTimeout,
} from "./safety-probes.mjs";

export function parseArgs(argv) {
  const result = { json: false };
  for (const arg of argv) {
    if (arg === "--json") result.json = true;
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function printHelp() {
  console.log(`P1 ambiguous-write policy probe

Usage:
  npm run p1:ambiguous

This does not send a ChatGPT turn. It records the fail-closed policy for
a timeout after a possible accepted write: inspect/reconcile, never
blind-retry.
`);
}

export function runAmbiguousWriteExperiment() {
  const classification = classifyWriteTimeout({
    sendAttempted: true,
    assistantObserved: false,
    timedOut: true,
  });
  let retryError = null;
  try {
    assertRetrySafe(classification.status);
  } catch (error) {
    retryError = error instanceof Error ? error.message : String(error);
  }
  const next = nextActionAfterTimeout(classification);
  return {
    phase: "P1",
    probe: "ambiguous-write",
    ...classification,
    nextAction: next,
    retryError,
    policy: AMBIGUOUS_TIMEOUT_MESSAGE,
    sentSecondTurn: false,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  const result = runAmbiguousWriteExperiment();
  console.log(JSON.stringify(result, null, 2));
  if (result.sentSecondTurn || result.nextAction.sendAgain) process.exitCode = 2;
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
