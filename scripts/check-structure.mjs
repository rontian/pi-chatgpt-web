import { readFile, access } from "node:fs/promises";

const required = [
  "package.json",
  "README.md",
  "src/index.ts",
  "src/extension/command.ts",
  "src/extension/prompt-controller.ts",
  "src/runtime/chatgpt-runtime.ts",
  "src/transport/transport.ts",
  "src/transport/browser-owned.ts",
  "src/browser/runtime.ts",
  "src/browser/driver.ts",
  "src/browser/errors.ts",
  "scripts/p1/page-session.mjs",
  "scripts/p2/live-driver-probe.mjs",
  "scripts/p2/browser-runtime.mjs",
  "scripts/p2/native-chrome-driver.mjs",
  "src/context/collector.ts",
  "src/workflows/prompt/workflow.ts",
  "src/product/capabilities.ts",
  "src/reliability/diagnostics.ts",
  "src/reliability/drift.ts",
  "src/state/prompt-cache.ts",
  "scripts/p1/browser-probe.mjs",
  "scripts/p1/browser-probe-helpers.mjs",
  "scripts/p1/native-chrome-host.mjs",
  "scripts/p1/text-turn-probe.mjs",
  "scripts/p1/tab-recreate-probe.mjs",
  "scripts/p1/safety-probes.mjs",
  "scripts/p1/expiry-probe.mjs",
  "scripts/p1/ambiguous-write-probe.mjs",
  "docs/research/P1_TASK_SNAPSHOT.md",
  "docs/research/P1_READBACK_DECISION.md",
  "docs/research/P1_WEB_FEASIBILITY_REPORT.md",
  "docs/research/P2_TASK_SNAPSHOT.md",
  "docs/ARCHITECTURE.md",
  "docs/FEATURES.md",
  "docs/DEVELOPMENT_PLAN.md",
  "docs/TASKS.md",
  "docs/RELIABILITY.md",
  "docs/TROUBLESHOOTING.md",
  "docs/RELEASE.md",
  "docs/VALIDATION_CHECKLIST.md",
  "docs/research/P1_BROWSER_AUTOMATION_DECISION.md",
  "docs/research/P1_BROWSER_PROBE_RUNBOOK.md",
  "docs/research/P1_TEXT_TURN_PROBE_RUNBOOK.md",
  "docs/research/P10_CONNECTED_APPS_VALIDATION.md"
];

for (const path of required) await access(path);

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.name !== "pi-chatgpt-web") throw new Error("unexpected package name");
if (!/^0\.1\.0-alpha\./.test(pkg.version)) throw new Error("alpha version expected before workstation validation");
if (!pkg.keywords?.includes("pi-package")) throw new Error("missing pi-package keyword");
if (!pkg.pi?.extensions?.includes("./src/index.ts")) throw new Error("missing Pi extension entry");
if (pkg.peerDependencies?.["@earendil-works/pi-coding-agent"] !== "*") {
  throw new Error("Pi core package must be a peer dependency with '*' range");
}
if (pkg.dependencies?.["playwright-core"] !== "1.63.0") {
  throw new Error("P1 browser dependency must stay pinned to playwright-core 1.63.0");
}
for (const script of ["validate", "pack:check", "p1:turn", "p1:turn:continue", "p1:turn:five", "p1:tab", "p1:expiry", "p1:ambiguous", "p2:live"]) {
  if (!pkg.scripts?.[script]) throw new Error(`missing ${script} script`);
}
if (pkg.publishConfig?.access !== "public") throw new Error("public publishConfig expected");

console.log("structure check: ok");
