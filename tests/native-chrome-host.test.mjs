import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import {
  acquireProfileLock,
  assertLoopbackCdpUrl,
  assertProfileNotUsedByForeignChrome,
  buildNativeChromeArgs,
  cdpHttpEndpoint,
  isFreshDevToolsActivePort,
  parseDevToolsActivePort,
  reclaimStaleProfileLock,
  spawnOwnedChrome,
  terminateOwnedProcess,
  waitForDevToolsEndpoint,
} from "../scripts/p1/native-chrome-host.mjs";

function sourceOf(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("native Chrome argv uses isolated profile, loopback CDP, and no proxy by default", () => {
  const args = buildNativeChromeArgs({
    profileDir: "/tmp/p1-profile",
    startUrl: "https://chatgpt.com/",
  });

  assert.equal(args.includes("--proxy-server"), false);
  assert.equal(args.some((arg) => arg.startsWith("--proxy-server=")), false);
  assert.ok(args.includes("--user-data-dir=/tmp/p1-profile"));
  assert.ok(args.includes("--remote-debugging-address=127.0.0.1"));
  assert.ok(args.includes("--remote-debugging-port=0"));
  assert.equal(args.includes("--remote-debugging-port=9222"), false);
  assert.equal(args.includes("--no-sandbox"), false);
  assert.equal(args.includes("--disable-web-security"), false);
  assert.ok(args.includes("https://chatgpt.com/"));
  assert.ok(args.includes("--new-window"));
});

test("interactive login argv omits CDP flags", () => {
  const args = buildNativeChromeArgs({
    profileDir: "/tmp/p1-profile",
    enableCdp: false,
  });
  assert.equal(args.some((arg) => arg.startsWith("--remote-debugging-")), false);
  assert.ok(args.includes("--user-data-dir=/tmp/p1-profile"));
});

test("optional proxy override is added as --proxy-server and never as Playwright launch proxy", () => {
  const envArgs = buildNativeChromeArgs({
    profileDir: "/tmp/p1-profile",
    proxy: "http://127.0.0.1:7890",
  });
  assert.ok(envArgs.includes("--proxy-server=http://127.0.0.1:7890"));
  assert.ok(envArgs.includes("--proxy-bypass-list=<-loopback>"));
});

test("DevToolsActivePort parser reads the first-line port", () => {
  assert.equal(parseDevToolsActivePort("54321\n/devtools/browser/abc"), 54321);
  assert.throws(() => parseDevToolsActivePort("not-a-port\n"), /valid TCP port/);
});

test("stale DevToolsActivePort is rejected before connect", async () => {
  assert.equal(
    isFreshDevToolsActivePort({ mtimeMs: 1_000, startedAtMs: 10_000, graceMs: 2_000 }),
    false
  );
  assert.equal(
    isFreshDevToolsActivePort({ mtimeMs: 10_500, startedAtMs: 10_000, graceMs: 2_000 }),
    true
  );

  let nowMs = 0;
  await assert.rejects(
    waitForDevToolsEndpoint({
      profileDir: "/tmp/p1-profile",
      startedAtMs: 10_000,
      timeoutMs: 300,
      now: () => nowMs,
      sleep: async (ms) => {
        nowMs += ms;
      },
      statImpl: async () => ({ mtimeMs: 1_000 }),
      readFileImpl: async () => "9222\n",
      fetchImpl: async () => {
        throw new Error("must not fetch a stale DevToolsActivePort");
      },
    }),
    /stale DevToolsActivePort/
  );
});

test("fresh DevToolsActivePort is used after Chrome writes a new endpoint", async () => {
  const result = await waitForDevToolsEndpoint({
    profileDir: "/tmp/p1-profile",
    startedAtMs: 10_000,
    timeoutMs: 1_000,
    now: () => 10_100,
    sleep: async () => {},
    statImpl: async () => ({ mtimeMs: 10_050 }),
    readFileImpl: async () => "45555\n/devtools/browser/x",
    fetchImpl: async (url) => {
      assert.equal(url, "http://127.0.0.1:45555/json/version");
      return {
        ok: true,
        json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1:45555/devtools/browser/x" }),
      };
    },
  });
  assert.equal(result.port, 45555);
  assert.equal(result.endpoint, cdpHttpEndpoint(45555));
});

test("native launcher uses spawn with an argv array and no shell string", () => {
  const calls = [];
  const child = spawnOwnedChrome("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--user-data-dir=/tmp/p1-profile",
    "--remote-debugging-port=0",
  ], {
    spawnImpl(executable, args, options) {
      calls.push({ executable, args, options });
      return { pid: 1 };
    },
  });

  assert.equal(child.pid, 1);
  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0].executable, "string");
  assert.equal(Array.isArray(calls[0].args), true);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.detached, true);
  assert.throws(
    () => spawnOwnedChrome("/chrome", " --remote-debugging-port=0"),
    /argv must be an array/
  );
});

test("CDP endpoint is loopback-only", () => {
  assert.equal(assertLoopbackCdpUrl("http://127.0.0.1:45555").hostname, "127.0.0.1");
  assert.throws(() => assertLoopbackCdpUrl("http://0.0.0.0:45555"), /loopback-only/);
});

test("profile lock rejects a second concurrent owner", async () => {
  const profileDir = await mkdtemp(join(tmpdir(), "p1-profile-"));
  try {
    await mkdir(profileDir, { recursive: true });
    const first = await acquireProfileLock(profileDir, { pid: process.pid });
    await assert.rejects(acquireProfileLock(profileDir, { pid: process.pid + 1 }), /already in use/);
    await first.release();
    const second = await acquireProfileLock(profileDir, { pid: process.pid });
    await second.release();
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }
});

test("stale lock reclaim refuses to unlink a replacement lock", () => {
  const profileDir = join(tmpdir(), `p1-profile-${Date.now()}-${process.pid}`);
  mkdirSync(profileDir, { recursive: true });
  const lockPath = join(profileDir, ".p1-chrome.lock");
  writeFileSync(lockPath, `${JSON.stringify({ pid: 1, token: "stale" })}\n`);
  let reads = 0;
  try {
    reclaimStaleProfileLock(profileDir, {
      isAliveImpl() {
        reads += 1;
        if (reads === 1) {
          writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, token: "replacement" })}\n`);
          return false;
        }
        return true;
      },
    });
  } catch (error) {
    assert.match(String(error.message), /already in use/);
  }
  const remaining = readFileSync(lockPath, "utf8");
  assert.match(remaining, /replacement/);
  rmSync(profileDir, { recursive: true, force: true });
});

test("foreign Chrome SingletonLock is rejected", () => {
  const profileDir = join(tmpdir(), `p1-profile-singleton-${Date.now()}`);
  mkdirSync(profileDir, { recursive: true });
  symlinkSync(`localhost-${process.pid}`, join(profileDir, "SingletonLock"));
  assert.throws(
    () => assertProfileNotUsedByForeignChrome(profileDir, null, { isAliveImpl: () => true }),
    /Chrome process/
  );
  rmSync(profileDir, { recursive: true, force: true });
});

test("SIGTERM without exit escalates to SIGKILL", async () => {
  const signals = [];
  const child = {
    pid: 99,
    exitCode: null,
    signalCode: null,
    kill(signal) {
      signals.push(signal);
      if (signal === "SIGKILL") {
        this.exitCode = null;
        this.signalCode = "SIGKILL";
      }
      return true;
    },
  };
  let now = 0;
  const result = await terminateOwnedProcess(child, {
    timeoutMs: 80,
    sleep: async (ms) => {
      now += ms;
    },
  });
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(result.exited, true);
  assert.equal(now > 0, true);
});

test("P1 probes share the native Chrome host and no longer launch Playwright-owned Chrome", () => {
  const browser = sourceOf("scripts/p1/browser-probe.mjs");
  const turn = sourceOf("scripts/p1/text-turn-probe.mjs");
  const host = sourceOf("scripts/p1/native-chrome-host.mjs");

  assert.match(browser, /from "\.\/native-chrome-host\.mjs"/);
  assert.match(turn, /from "\.\/native-chrome-host\.mjs"/);
  assert.doesNotMatch(browser, /launchPersistentContext/);
  assert.doesNotMatch(turn, /launchPersistentContext/);
  assert.match(sourceOf("scripts/p1/native-chrome-host.mjs"), /Playwright will not drive that navigation/);

  assert.match(browser, /connectPlaywrightOverCdp/);
  assert.match(turn, /connectPlaywrightOverCdp/);
  assert.match(host, /spawnOwnedChrome/);
  assert.doesNotMatch(host, /\bexec\(/);
  assert.match(host, /FORBIDDEN_CHROME_ARGS/);
  const args = buildNativeChromeArgs({ profileDir: "/tmp/p1-profile" });
  assert.equal(args.some((arg) => arg.includes("no-sandbox") || arg.includes("disable-web-security")), false);
});
