import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertRetrySafe,
  classifyExpiredAuthProbe,
  classifyWriteTimeout,
  nextActionAfterTimeout,
} from "../scripts/p1/safety-probes.mjs";
import { runAmbiguousWriteExperiment } from "../scripts/p1/ambiguous-write-probe.mjs";

test("expired/unauthenticated auth is a controlled error class", () => {
  const expired = classifyExpiredAuthProbe({
    sessionAuthenticated: false,
    uiAuthenticated: false,
    sessionEndpointStatus: 401,
  });
  assert.equal(expired.authenticated, false);
  assert.equal(expired.expired, true);
  assert.equal(expired.errorClass, "auth_expired_or_unauthenticated");
  assert.equal(expired.sessionEndpointStatus, 401);
});

test("timeout after a possible accepted write is ambiguous and not retried", () => {
  const classification = classifyWriteTimeout({
    sendAttempted: true,
    assistantObserved: false,
    timedOut: true,
  });
  assert.equal(classification.status, "ambiguous");
  assert.equal(classification.mayAutomaticallyRetry, false);
  assert.throws(() => assertRetrySafe("ambiguous"), /reconciled before retry/);
  assert.deepEqual(nextActionAfterTimeout(classification), {
    sendAgain: false,
    inspectConversation: true,
    message: "Timed out waiting for a stable assistant response after a possible accepted write.",
  });
});

test("ambiguous-write experiment never sends a second turn", () => {
  const result = runAmbiguousWriteExperiment();
  assert.equal(result.sentSecondTurn, false);
  assert.equal(result.nextAction.sendAgain, false);
  assert.equal(result.status, "ambiguous");
});

test("expiry probe defaults to an empty temporary profile", () => {
  const source = readFileSync(new URL("../scripts/p1/expiry-probe.mjs", import.meta.url), "utf8");
  assert.match(source, /emptyProfile: true/);
  assert.match(source, /pi-chatgpt-web-expiry-/);
  assert.doesNotMatch(source, /unlinkSync|rmSync|clearCookies/);
});
