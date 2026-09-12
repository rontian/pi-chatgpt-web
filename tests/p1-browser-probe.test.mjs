import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, sanitizeSessionProbe } from "../scripts/p1/browser-probe.mjs";

test("P1 browser probe uses an isolated persistent profile by default", () => {
  const parsed = parseArgs([]);
  assert.match(
    parsed.profileDir,
    /\.pi[\\/]agent[\\/]pi-chatgpt-web[\\/]browser-profile$/
  );
  assert.equal(
    parsed.channel,
    process.env.PI_CHATGPT_WEB_BROWSER_CHANNEL || "chrome"
  );
  assert.equal(parsed.checkOnly, false);
});

test("P1 browser probe accepts explicit non-secret runtime overrides", () => {
  const parsed = parseArgs([
    "--channel",
    "chrome-beta",
    "--profile-dir",
    "./.tmp/p1-profile",
    "--check-only",
    "--json",
  ]);

  assert.equal(parsed.channel, "chrome-beta");
  assert.equal(parsed.checkOnly, true);
  assert.equal(parsed.json, true);
  assert.ok(parsed.profileDir.endsWith(".tmp/p1-profile"));
});

test("session probe sanitizer never preserves session material", () => {
  const sanitized = sanitizeSessionProbe({
    authenticated: true,
    sessionEndpointStatus: 200,
    accessToken: "must-not-leak",
    cookies: ["must-not-leak"],
    user: { email: "must-not-leak@example.com" },
  });

  assert.deepEqual(sanitized, {
    authenticated: true,
    sessionEndpointStatus: 200,
  });
});
