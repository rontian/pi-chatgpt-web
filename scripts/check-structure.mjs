import { readFile, access } from "node:fs/promises";

const required = [
  "package.json",
  "README.md",
  "src/index.ts",
  "src/extension/command.ts",
  "src/runtime/chatgpt-runtime.ts",
  "src/transport/transport.ts",
  "src/transport/browser-owned.ts",
  "scripts/p1/browser-probe.mjs",
  "scripts/p1/text-turn-probe.mjs",
  "tests/text-turn-probe.test.mjs",
  "docs/ARCHITECTURE.md",
  "docs/FEATURES.md",
  "docs/DEVELOPMENT_PLAN.md",
  "docs/TASKS.md",
  "docs/research/P1_BROWSER_AUTOMATION_DECISION.md",
  "docs/research/P1_BROWSER_PROBE_RUNBOOK.md",
  "docs/research/P1_TEXT_TURN_PROBE_RUNBOOK.md"
];

for (const path of required) await access(path);

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.name !== "pi-chatgpt-web") throw new Error("unexpected package name");
if (!pkg.keywords?.includes("pi-package")) throw new Error("missing pi-package keyword");
if (!pkg.pi?.extensions?.includes("./src/index.ts")) throw new Error("missing Pi extension entry");
if (pkg.peerDependencies?.["@earendil-works/pi-coding-agent"] !== "*") {
  throw new Error("Pi core package must be a peer dependency with '*' range");
}
if (pkg.dependencies?.["playwright-core"] !== "1.63.0") {
  throw new Error("P1 browser dependency must stay pinned to playwright-core 1.63.0");
}
for (const script of ["p1:turn", "p1:turn:continue", "p1:turn:five"]) {
  if (!pkg.scripts?.[script]) throw new Error(`missing ${script} script`);
}

console.log("structure check: ok");
