import { readFile, access } from "node:fs/promises";

const required = [
  "package.json",
  "README.md",
  "src/index.ts",
  "src/extension/command.ts",
  "src/runtime/chatgpt-runtime.ts",
  "src/transport/transport.ts",
  "src/transport/browser-owned.ts",
  "docs/ARCHITECTURE.md",
  "docs/FEATURES.md",
  "docs/DEVELOPMENT_PLAN.md",
  "docs/TASKS.md"
];

for (const path of required) await access(path);

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.name !== "pi-chatgpt-web") throw new Error("unexpected package name");
if (!pkg.keywords?.includes("pi-package")) throw new Error("missing pi-package keyword");
if (!pkg.pi?.extensions?.includes("./src/index.ts")) throw new Error("missing Pi extension entry");
if (pkg.peerDependencies?.["@earendil-works/pi-coding-agent"] !== "*") {
  throw new Error("Pi core package must be a peer dependency with '*' range");
}

console.log("structure check: ok");
