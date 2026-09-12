import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, sanitizeAuthProbe } from "../scripts/p1/browser-probe.mjs";
import {
  buildPersistentContextOptions,
  classifyAuthentication,
  extractProxyOption,
} from "../scripts/p1/browser-probe-helpers.mjs";

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
});

test("--proxy overrides PI_CHATGPT_WEB_PROXY", () => {
  const parsed = parseArgs(
    ["--proxy", "socks5://127.0.0.1:1080"],
    { PI_CHATGPT_WEB_PROXY: "http://127.0.0.1:7890" }
  );
  assert.equal(parsed.proxy, "socks5://127.0.0.1:1080");
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

test("persistent context options keep Chromium sandbox and add proxy only when configured", () => {
  assert.deepEqual(
    buildPersistentContextOptions({ channel: "chrome", headless: false, proxy: null }),
    { channel: "chrome", headless: false, viewport: null, chromiumSandbox: true }
  );
  assert.deepEqual(
    buildPersistentContextOptions({
      channel: "chrome",
      headless: true,
      proxy: "http://127.0.0.1:7890",
    }),
    {
      channel: "chrome",
      headless: true,
      viewport: null,
      chromiumSandbox: true,
      proxy: { server: "http://127.0.0.1:7890" },
    }
  );
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
