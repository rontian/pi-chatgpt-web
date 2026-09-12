import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const CHATGPT_URL = "https://chatgpt.com/";
export const DEFAULT_PROFILE_DIR = join(
  homedir(),
  ".pi",
  "agent",
  "pi-chatgpt-web",
  "browser-profile"
);
export const PROFILE_LOCK_NAME = ".p1-chrome.lock";
export const DEVTOOLS_ACTIVE_PORT_FILE = "DevToolsActivePort";

const FORBIDDEN_CHROME_ARGS = ["--no-sandbox", "--disable-web-security"];

const DARWIN_CHANNEL_PATHS = {
  chrome: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
  "chrome-beta": ["/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta"],
  "chrome-dev": ["/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev"],
  "chrome-canary": ["/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"],
};

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function parseDevToolsActivePort(contents) {
  const first = String(contents ?? "")
    .split(/\r?\n/, 1)[0]
    ?.trim();
  const port = Number.parseInt(first, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("DevToolsActivePort does not contain a valid TCP port.");
  }
  return port;
}

export function isFreshDevToolsActivePort({ mtimeMs, startedAtMs, graceMs = 2_000 } = {}) {
  if (!Number.isFinite(mtimeMs) || !Number.isFinite(startedAtMs)) return false;
  return mtimeMs + graceMs >= startedAtMs;
}

export function cdpHttpEndpoint(port) {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("CDP port must be a valid TCP port.");
  }
  return `http://127.0.0.1:${port}`;
}

export function assertLoopbackCdpUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("CDP endpoint is not a valid URL.");
  }
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsed.hostname)) {
    throw new Error("CDP endpoint must be loopback-only.");
  }
  return parsed;
}

export function buildNativeChromeArgs({
  profileDir,
  startUrl = CHATGPT_URL,
  proxy = null,
  headless = false,
  remoteDebuggingPort = 0,
  enableCdp = true,
} = {}) {
  if (!profileDir) throw new Error("Profile directory must not be empty.");
  if (enableCdp && (!Number.isInteger(remoteDebuggingPort) || remoteDebuggingPort < 0 || remoteDebuggingPort > 65535)) {
    throw new Error("remote debugging port must be 0 or a valid TCP port.");
  }

  const args = [
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
  ];
  if (enableCdp) {
    args.push("--remote-debugging-address=127.0.0.1");
    args.push(`--remote-debugging-port=${remoteDebuggingPort}`);
  }

  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
    args.push("--proxy-bypass-list=<-loopback>");
  }
  if (headless) args.push("--headless=new");
  if (startUrl) args.push(startUrl);

  for (const forbidden of FORBIDDEN_CHROME_ARGS) {
    if (args.includes(forbidden) || args.some((arg) => arg.startsWith(`${forbidden}=`))) {
      throw new Error(`Native Chrome host must not use ${forbidden}.`);
    }
  }

  return args;
}

function windowsChromeCandidates(channel) {
  const roots = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
    process.env.LOCALAPPDATA,
  ].filter(Boolean);
  const folders = {
    chrome: "Google\\Chrome\\Application\\chrome.exe",
    "chrome-beta": "Google\\Chrome Beta\\Application\\chrome.exe",
    "chrome-dev": "Google\\Chrome Dev\\Application\\chrome.exe",
    "chrome-canary": "Google\\Chrome SxS\\Application\\chrome.exe",
  };
  const relative = folders[channel] || folders.chrome;
  return roots.map((root) => join(root, relative));
}

function linuxChromeCandidates(channel) {
  if (channel === "chrome-beta") return ["google-chrome-beta", "chromium-browser", "chromium"];
  if (channel === "chrome-dev" || channel === "chrome-canary") {
    return ["google-chrome-unstable", "google-chrome-dev", "chromium-browser", "chromium"];
  }
  return ["google-chrome-stable", "google-chrome", "chromium-browser", "chromium"];
}

function findOnPath(binary) {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [binary], {
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/, 1)[0]?.trim() || null;
}

export function findChromeExecutable(
  channel = "chrome",
  { env = process.env, exists = existsSync, platform = process.platform } = {}
) {
  const fromEnv = env.PI_CHATGPT_WEB_CHROME_EXECUTABLE || env.CHROME_PATH || env.GOOGLE_CHROME_PATH;
  if (fromEnv) {
    if (!exists(fromEnv)) throw new Error(`Chrome executable not found: ${fromEnv}`);
    return fromEnv;
  }

  const resolvedChannel = channel || "chrome";
  const candidates =
    platform === "darwin"
      ? DARWIN_CHANNEL_PATHS[resolvedChannel] || DARWIN_CHANNEL_PATHS.chrome
      : platform === "win32"
        ? windowsChromeCandidates(resolvedChannel)
        : linuxChromeCandidates(resolvedChannel);

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (exists(candidate)) return candidate;
      continue;
    }
    const located = findOnPath(candidate);
    if (located && exists(located)) return located;
  }

  throw new Error(
    `Could not find Google Chrome for channel "${resolvedChannel}". Set PI_CHATGPT_WEB_CHROME_EXECUTABLE.`
  );
}

export function profileLockPath(profileDir) {
  return join(profileDir, PROFILE_LOCK_NAME);
}

export function profileLockOwnerPath(profileDir) {
  return join(profileLockPath(profileDir), "owner.json");
}

function profileInUseError(pid, kind = "process") {
  const err = new Error(
    kind === "chrome"
      ? `P1 Chrome profile is already in use by Chrome process ${pid}. Close that Chrome window first.`
      : `P1 Chrome profile is already in use by process ${pid}. Stop that probe before starting another.`
  );
  err.code = "P1_PROFILE_IN_USE";
  return err;
}

export function lockRecordMatches(observed, current) {
  if (!observed || !current) return false;
  return (
    observed.pid === current.pid &&
    observed.token === current.token &&
    observed.dev === current.dev &&
    observed.ino === current.ino
  );
}

function readLockRecord(path) {
  const st = lstatSync(path);
  const payload = JSON.parse(readFileSync(path, "utf8"));
  return {
    pid: payload.pid,
    token: payload.token ?? null,
    isDirectory: st.isDirectory(),
    isFile: st.isFile(),
    dev: st.dev,
    ino: st.ino,
  };
}

function readOwnerRecord(ownerPath) {
  const st = lstatSync(ownerPath);
  const payload = JSON.parse(readFileSync(ownerPath, "utf8"));
  return {
    pid: payload.pid,
    token: payload.token ?? null,
    dev: st.dev,
    ino: st.ino,
  };
}

export function reclaimStaleProfileLock(profileDir, { isAliveImpl = isAlive } = {}) {
  const lockDir = profileLockPath(profileDir);
  let st;
  try {
    st = lstatSync(lockDir);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }

  if (st.isFile()) {
    let observed;
    try {
      observed = readLockRecord(lockDir);
    } catch {
      try {
        unlinkSync(lockDir);
        return true;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    }
    if (Number.isInteger(observed.pid) && isAliveImpl(observed.pid)) {
      throw profileInUseError(observed.pid);
    }
    let current;
    try {
      current = readLockRecord(lockDir);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") return false;
      throw error;
    }
    if (!lockRecordMatches(observed, current)) return false;
    try {
      unlinkSync(lockDir);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") return false;
      throw error;
    }
    return true;
  }

  if (!st.isDirectory()) {
    throw new Error("P1 Chrome profile lock has an unexpected file type.");
  }

  const ownerPath = profileLockOwnerPath(profileDir);
  let observed = null;
  try {
    observed = readOwnerRecord(ownerPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (observed && Number.isInteger(observed.pid) && isAliveImpl(observed.pid)) {
    throw profileInUseError(observed.pid);
  }
  if (observed) {
    let current;
    try {
      current = readOwnerRecord(ownerPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (!current || !lockRecordMatches(observed, current)) return false;
    if (Number.isInteger(current.pid) && isAliveImpl(current.pid)) {
      throw profileInUseError(current.pid);
    }
    try {
      unlinkSync(ownerPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  try {
    rmdirSync(lockDir);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    if (error.code === "ENOTEMPTY" || error.code === "EEXIST") {
      throw profileInUseError("another probe");
    }
    throw error;
  }
}

export async function acquireProfileLock(
  profileDir,
  { pid = process.pid, isAliveImpl = isAlive } = {}
) {
  if (!profileDir) throw new Error("Profile directory must not be empty.");
  await mkdir(profileDir, { recursive: true });
  const lockDir = profileLockPath(profileDir);
  const ownerPath = profileLockOwnerPath(profileDir);
  const token = randomUUID();
  const payload = `${JSON.stringify({ pid, token, createdAt: new Date().toISOString() })}\n`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      mkdirSync(lockDir, { recursive: false, mode: 0o700 });
      writeFileSync(ownerPath, payload, { mode: 0o600 });
      return {
        path: lockDir,
        ownerPath,
        pid,
        token,
        async release() {
          await releaseProfileLock(lockDir, pid, token);
        },
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      reclaimStaleProfileLock(profileDir, { isAliveImpl });
    }
  }

  throw new Error("Failed to acquire the P1 Chrome profile lock.");
}

export async function releaseProfileLock(lockDir, pid, token) {
  const ownerPath = join(lockDir, "owner.json");
  try {
    const existing = JSON.parse(await readFile(ownerPath, "utf8"));
    if (existing.pid !== pid) return;
    if (token && existing.token && existing.token !== token) return;
  } catch {
    return;
  }
  try {
    await unlink(ownerPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    rmdirSync(lockDir);
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") throw error;
  }
}

export function readChromeSingletonPid(
  profileDir,
  { readlinkImpl = readlinkSync, lstatImpl = lstatSync } = {}
) {
  const singleton = join(profileDir, "SingletonLock");
  try {
    lstatImpl(singleton);
  } catch {
    return null;
  }
  try {
    const target = readlinkImpl(singleton);
    const match = String(target).match(/-(\d+)$/);
    if (!match) return null;
    const pid = Number.parseInt(match[1], 10);
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function assertProfileNotUsedByForeignChrome(
  profileDir,
  ownedPid = null,
  { isAliveImpl = isAlive } = {}
) {
  const singletonPid = readChromeSingletonPid(profileDir);
  if (singletonPid && singletonPid !== ownedPid && isAliveImpl(singletonPid)) {
    throw profileInUseError(singletonPid, "chrome");
  }
}

export function spawnOwnedChrome(executable, args, { spawnImpl = spawn } = {}) {
  if (typeof executable !== "string" || !executable) {
    throw new Error("Chrome executable must be a path string.");
  }
  if (!Array.isArray(args)) {
    throw new Error("Chrome argv must be an array, not a shell string.");
  }
  return spawnImpl(executable, args, {
    stdio: ["ignore", "ignore", "ignore"],
    shell: false,
    detached: true,
  });
}

function processStillRunning(child) {
  return Boolean(child) && child.exitCode == null && child.signalCode == null;
}

export async function terminateOwnedProcess(
  child,
  { timeoutMs = 3_000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}
) {
  if (!child || child.pid == null) return { exited: true, signal: null };
  if (!processStillRunning(child)) {
    return { exited: true, signal: child.signalCode ?? null };
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      return { exited: !processStillRunning(child), signal: child.signalCode ?? null };
    }
  }

  const deadline = Date.now() + timeoutMs;
  while (processStillRunning(child) && Date.now() < deadline) {
    await sleep(50);
  }
  if (processStillRunning(child)) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        // owned process already gone
      }
    }
    const killDeadline = Date.now() + 1_000;
    while (processStillRunning(child) && Date.now() < killDeadline) {
      await sleep(50);
    }
  }
  return {
    exited: !processStillRunning(child),
    signal: child.signalCode ?? null,
  };
}

export async function waitForDevToolsEndpoint({
  profileDir,
  startedAtMs,
  timeoutMs = 30_000,
  child,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  fetchImpl = fetch,
  readFileImpl = readFile,
  statImpl = stat,
} = {}) {
  if (!profileDir) throw new Error("Profile directory must not be empty.");
  if (!Number.isFinite(startedAtMs)) throw new Error("startedAtMs is required.");

  const filePath = join(profileDir, DEVTOOLS_ACTIVE_PORT_FILE);
  const deadline = startedAtMs + timeoutMs;
  let lastError;

  while (now() < deadline) {
    if (child && child.exitCode != null) {
      throw new Error("Native Chrome exited before the CDP endpoint became ready.");
    }
    try {
      const info = await statImpl(filePath);
      if (!isFreshDevToolsActivePort({ mtimeMs: info.mtimeMs, startedAtMs })) {
        lastError = new Error("stale DevToolsActivePort");
      } else {
        const port = parseDevToolsActivePort(await readFileImpl(filePath, "utf8"));
        const endpoint = cdpHttpEndpoint(port);
        const response = await fetchImpl(`${endpoint}/json/version`);
        if (response.ok) {
          const version = await response.json().catch(() => ({}));
          if (version?.webSocketDebuggerUrl) {
            assertLoopbackCdpUrl(version.webSocketDebuggerUrl);
          }
          return { port, endpoint, version };
        }
        lastError = new Error(`CDP responded with ${response.status}`);
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }

  throw new Error(
    `Native Chrome CDP endpoint did not become ready: ${lastError instanceof Error ? lastError.message : lastError}`
  );
}

export async function connectPlaywrightOverCdp(chromium, endpoint) {
  if (!chromium?.connectOverCDP) {
    throw new Error("Playwright Chromium connectOverCDP is unavailable.");
  }
  assertLoopbackCdpUrl(endpoint);
  return chromium.connectOverCDP(endpoint);
}

export function isChatgptPageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "chatgpt.com" || parsed.hostname.endsWith(".chatgpt.com");
  } catch {
    return false;
  }
}

export async function waitForProfileIdle(
  profileDir,
  { timeoutMs = 10_000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pid = readChromeSingletonPid(profileDir);
    if (!pid || !isAlive(pid)) return;
    await sleep(100);
  }
  assertProfileNotUsedByForeignChrome(profileDir);
}

function isUsableChatgptPage(page) {
  const url = page.url();
  return isChatgptPageUrl(url) && !url.startsWith("chrome-error://");
}

function sanitizePageLocation(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "<unparseable>";
  }
}

export async function getOrOpenChatgptPage(browser) {
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const existing = context.pages().find((page) => isUsableChatgptPage(page));
    if (existing) {
      await existing.waitForLoadState("domcontentloaded").catch(() => {});
      const title = await existing.title().catch(() => "");
      if (/ERR_|无法访问|This site can.?t be reached/i.test(title)) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        continue;
      }
      return existing;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const seen = context.pages().map((page) => sanitizePageLocation(page.url()));
  throw new Error(
    `Native Chrome did not open chatgpt.com by itself. Playwright will not drive that navigation. pages=${seen.join(",") || "<none>"}`
  );
}

export async function launchNativeChromeSession({
  channel = "chrome",
  profileDir = DEFAULT_PROFILE_DIR,
  proxy = null,
  headless = false,
  startUrl = CHATGPT_URL,
  timeoutMs = 30_000,
  spawnImpl = spawn,
  executable,
  enableCdp = true,
} = {}) {
  await mkdir(profileDir, { recursive: true });
  const lock = await acquireProfileLock(profileDir);
  try {
    assertProfileNotUsedByForeignChrome(profileDir);
    try {
      await unlink(join(profileDir, DEVTOOLS_ACTIVE_PORT_FILE));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    const chromePath = executable || findChromeExecutable(channel);
    const args = buildNativeChromeArgs({
      profileDir,
      startUrl,
      proxy,
      headless,
      remoteDebuggingPort: 0,
      enableCdp,
    });
    const startedAtMs = Date.now();
    const child = spawnOwnedChrome(chromePath, args, { spawnImpl });
    if (!child || child.pid == null) {
      throw new Error("Failed to spawn Google Chrome.");
    }

    try {
      if (!enableCdp) {
        return {
          child,
          executable: chromePath,
          args,
          profileDir,
          proxyOverrideConfigured: Boolean(proxy),
          lock,
          cdpEnabled: false,
          port: null,
          endpoint: null,
        };
      }
      const cdp = await waitForDevToolsEndpoint({
        profileDir,
        startedAtMs,
        timeoutMs,
        child,
      });
      return {
        child,
        executable: chromePath,
        args,
        profileDir,
        proxyOverrideConfigured: Boolean(proxy),
        lock,
        cdpEnabled: true,
        ...cdp,
      };
    } catch (error) {
      await terminateOwnedProcess(child);
      throw error;
    }
  } catch (error) {
    await lock.release();
    throw error;
  }
}

export async function closeNativeChromeSession(session, { keepOpen = false } = {}) {
  if (!session) return;
  if (session.browser) {
    try {
      await session.browser.close();
    } catch {
      // CDP connection may already be gone
    }
    session.browser = null;
  }
  if (!keepOpen) {
    const termination = await terminateOwnedProcess(session.child);
    if (!termination.exited) {
      throw new Error(
        `Owned Chrome process ${session.child?.pid} did not exit; keeping the P1 profile lock.`
      );
    }
    if (session.profileDir) await waitForProfileIdle(session.profileDir);
  }
  if (session.lock) {
    await session.lock.release();
    session.lock = null;
  }
}
