export { BrowserRuntime, BrowserRuntimeError } from "../../scripts/p2/browser-runtime.mjs";

export interface BrowserRuntimeOptions {
  channel?: string;
  profileDir?: string;
  proxy?: string | null;
  headless?: boolean;
  timeoutMs?: number;
  host?: unknown;
  playwrightLoader?: () => Promise<{ chromium: { connectOverCDP(endpoint: string): Promise<unknown> } }>;
}

export interface BrowserHealth {
  ok: boolean;
  detail?: string;
  authenticated?: boolean;
  authSource?: string | null;
  sessionEndpointStatus?: number | null;
  chromeExecutableFound?: boolean;
  profileDir?: string;
  diagnostics?: unknown;
}
