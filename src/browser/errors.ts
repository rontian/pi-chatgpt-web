export { BrowserRuntimeError } from "../../scripts/p2/browser-runtime.mjs";

export type BrowserErrorCode =
  | "AUTH_EXPIRED"
  | "BROWSER_UNAVAILABLE"
  | "PROFILE_IN_USE"
  | "TURN_TIMEOUT"
  | "TURN_CANCELLED"
  | "PRODUCT_DRIFT"
  | "AMBIGUOUS_WRITE";
