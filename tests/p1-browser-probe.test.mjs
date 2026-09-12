import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { browserProbeAttachPolicy, parseArgs, sanitizeAuthProbe } from "../scripts/p1/browser-probe.mjs";
import {
  classifyAuthentication,
  extractProxyOption,
} from "../scripts/p1/browser-probe-helpers.mjs";
import { buildNativeChromeArgs } from "../scripts/p1/native-chrome-host.mjs";

test("P1 browser probe uses an isolated persistent profile and no proxy by default", () => {
  const parsed = parseArgs([], {});
  assert.match(
    parsed.profileDir,
    /\.pi[\\/]agent[\\/]pi-chatgpt-web[\\/]browser-profile$/
  );
  assert.equal(parsed.channel, "chrome");
  assert.equal(parsed.proxy, null);
  assert.equal(parsed.checkOnly, false);
});

test("P1 browser probe reads proxy from the environment", () => {
  const parsed = parseArgs([], { PI_CHATGPT_WEB_PROXY: "http://127.0.0.1:7890" });
  assert.equal(parsed.proxy, "http://127.0.0.1:7890");
  assert.ok(
    buildNativeChromeArgs({
      profileDir: parsed.profileDir,
      proxy: parsed.proxy,
    }).includes("--proxy-server=http://127.0.0.1:7890")
  );
});

test("--proxy overrides PI_CHATGPT_WEB_PROXY", () => {
  const parsed = parseArgs(
    ["--proxy", "socks5://127.0.0.1:1080"],
    { PI_CHATGPT_WEB_PROXY: "http://127.0.0.1:7890" }
  );
  assert.equal(parsed.proxy, "socks5://127.0.0.1:1080");
  assert.ok(
    buildNativeChromeArgs({
      profileDir: parsed.profileDir,
      proxy: parsed.proxy,
    }).includes("--proxy-server=socks5://127.0.0.1:1080")
  );
});

test("proxy parsing handles empty environment and rejects invalid explicit values", () => {
  assert.equal(extractProxyOption([], { PI_CHATGPT_WEB_PROXY: "   " }).proxy, null);
  assert.throws(() => parseArgs(["--proxy", ""], {}), /must not be empty/);
  assert.throws(() => parseArgs(["--proxy", "localhost:7890"], {}), /valid URL/);
  assert.throws(() => parseArgs(["--proxy", "ftp://localhost:21"], {}), /http, https, socks4, or socks5/);
  assert.throws(() => parseArgs(["--proxy"], {}), /requires a URL/);
});

test("P1 browser probe accepts explicit non-secret runtime overrides", () => {
  const parsed = parseArgs([
    "--channel",
    "chrome-beta",
    "--profile-dir",
    "./.tmp/p1-profile",
    "--check-only",
    "--json",
  ], {});

  assert.equal(parsed.channel, "chrome-beta");
  assert.equal(parsed.checkOnly, true);
  assert.equal(parsed.json, true);
  assert.ok(parsed.profileDir.endsWith(".tmp/p1-profile"));
});

test("interactive login waits for the user before CDP attach; check-only never prompts", () => {
  assert.equal(browserProbeAttachPolicy({ checkOnly: false, headless: false }), "login-without-cdp-then-reattach");
  assert.equal(browserProbeAttachPolicy({ checkOnly: true, headless: false }), "attach-immediately");
  assert.equal(browserProbeAttachPolicy({ checkOnly: false, headless: true }), "attach-immediately");

  const source = readFileSync(new URL("../scripts/p1/browser-probe.mjs", import.meta.url), "utf8");
  assert.match(source, /waitForInteractiveLoginConfirmation/);
  assert.match(source, /enableCdp: !interactiveLogin/);
  assert.match(source, /enableCdp: true/);
  assert.doesNotMatch(source, /fill\(|type\(|press\(/);
});

test("auth sanitizer never preserves session material", () => {
  const sanitized = sanitizeAuthProbe({
    sessionAuthenticated: true,
    uiAuthenticated: true,
    sessionEndpointStatus: 200,
    accessToken: "must-not-leak",
    cookies: ["must-not-leak"],
    user: { email: "must-not-leak@example.com" },
    account: { id: "must-not-leak" },
  });

  assert.deepEqual(sanitized, {
    authenticated: true,
    authSource: "session+ui",
    sessionEndpointStatus: 200,
  });
  assert.doesNotMatch(JSON.stringify(sanitized), /must-not-leak/);
});

test("authSource identifies session, UI, combined, and unauthenticated evidence", () => {
  assert.equal(classifyAuthentication({ sessionAuthenticated: true }).authSource, "session");
  assert.deepEqual(
    classifyAuthentication({ uiAuthenticated: true, sessionEndpointStatus: 200 }),
    { authenticated: true, authSource: "ui", sessionEndpointStatus: 200 }
  );
  assert.equal(
    classifyAuthentication({ sessionAuthenticated: true, uiAuthenticated: true }).authSource,
    "session+ui"
  );
  assert.deepEqual(classifyAuthentication({ sessionEndpointStatus: 200 }), {
    authenticated: false,
    authSource: null,
    sessionEndpointStatus: 200,
  });
});
