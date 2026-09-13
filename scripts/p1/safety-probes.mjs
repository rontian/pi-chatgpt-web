import { classifyAuthentication } from "./browser-probe-helpers.mjs";

export const AMBIGUOUS_TIMEOUT_MESSAGE =
  "Timed out waiting for a stable assistant response after a possible accepted write.";

export function classifyExpiredAuthProbe(auth) {
  const sanitized = classifyAuthentication({
    sessionAuthenticated: Boolean(auth?.sessionAuthenticated),
    uiAuthenticated: Boolean(auth?.uiAuthenticated),
    sessionEndpointStatus: auth?.sessionEndpointStatus ?? null,
  });
  return {
    ...sanitized,
    expired: !sanitized.authenticated,
    errorClass: sanitized.authenticated ? null : "auth_expired_or_unauthenticated",
  };
}

export function classifyWriteTimeout({
  sendAttempted,
  assistantObserved,
  timedOut,
} = {}) {
  if (!sendAttempted) {
    return { status: "failed", mayAutomaticallyRetry: true, retryBlockedReason: null };
  }
  if (timedOut && !assistantObserved) {
    return {
      status: "ambiguous",
      mayAutomaticallyRetry: false,
      retryBlockedReason: "ambiguous_write_must_be_reconciled",
    };
  }
  if (timedOut && assistantObserved) {
    return {
      status: "ambiguous",
      mayAutomaticallyRetry: false,
      retryBlockedReason: "ambiguous_write_must_be_reconciled",
    };
  }
  return { status: "completed", mayAutomaticallyRetry: false, retryBlockedReason: null };
}

export function assertRetrySafe(status) {
  if (status === "ambiguous") {
    throw new Error("Ambiguous ChatGPT writes must be reconciled before retry.");
  }
}

export function mayAutomaticallyRetry(status) {
  return status === "failed";
}

export function nextActionAfterTimeout(classification) {
  if (classification.status === "ambiguous") {
    return {
      sendAgain: false,
      inspectConversation: true,
      message: AMBIGUOUS_TIMEOUT_MESSAGE,
    };
  }
  return {
    sendAgain: mayAutomaticallyRetry(classification.status),
    inspectConversation: false,
    message: null,
  };
}
