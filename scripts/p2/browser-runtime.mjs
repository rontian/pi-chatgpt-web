import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);

export class BrowserRuntimeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BrowserRuntimeError";
    this.code = code;
  }
}

async function defaultHost() {
  return import("../p1/native-chrome-host.mjs");
}

async function defaultPlaywright() {
  const playwright = await import("playwright-core");
  return { chromium: playwright.chromium };
}

function envProxy() {
  const raw = process.env.PI_CHATGPT_WEB_PROXY?.trim();
  return raw ? raw : null;
}

function redactDiagnostics(value) {
  if (Array.isArray(value)) return value.map(redactDiagnostics);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = /token|cookie|authorization|secret|credential|session|access.?key|api.?key/i.test(key)
      ? "[redacted]"
      : redactDiagnostics(item);
  }
  return out;
}

export class BrowserRuntime {
  constructor(options = {}) {
    this.options = options;
    this.session = null;
    this.page = null;
    this.hostPromise = options.host ? Promise.resolve(options.host) : defaultHost();
  }

  async login() {
    await this.close();
    const host = await this.hostPromise;
    const profileDir = this.options.profileDir ?? host.DEFAULT_PROFILE_DIR;
    this.session = await host.launchNativeChromeSession({
      channel: this.options.channel ?? process.env.PI_CHATGPT_WEB_BROWSER_CHANNEL ?? "chrome",
      profileDir,
      proxy: this.options.proxy ?? envProxy(),
      headless: false,
      startUrl: host.CHATGPT_URL,
      enableCdp: false,
    });
    return {
      ok: true,
      detail: "Opened isolated Google Chrome without CDP. Finish login in that window, then run /chatgpt login confirm.",
      profileDir,
    };
  }

  async confirmLogin() {
    if (!this.session) {
      throw new BrowserRuntimeError("BROWSER_UNAVAILABLE", "No login Chrome session is waiting for confirmation.");
    }
    await this.close();
    return { ok: true, detail: "Login window closed. /chatgpt status or /chatgpt ask will attach over loopback CDP." };
  }

  async logout() {
    if (this.session && this.session.cdpEnabled === false) {
      await this.close();
    }
    const attached = await this.attach();
    try {
      const context = attached.browser.contexts()[0];
      await context?.clearCookies?.();
      return { ok: true, detail: "Cleared cookies in the isolated ChatGPT profile. Daily Chrome is unchanged." };
    } finally {
      await this.close();
    }
  }

  async health() {
    const host = await this.hostPromise;
    const profileDir = this.options.profileDir ?? host.DEFAULT_PROFILE_DIR;
    let chromeExecutableFound = false;
    try {
      host.findChromeExecutable(this.options.channel ?? process.env.PI_CHATGPT_WEB_BROWSER_CHANNEL ?? "chrome");
      chromeExecutableFound = true;
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
        chromeExecutableFound,
        profileDir,
      };
    }

    if (this.session && this.session.cdpEnabled === false) {
      return {
        ok: false,
        detail: "login Chrome is open without CDP; run /chatgpt login confirm after the composer is visible",
        chromeExecutableFound,
        profileDir,
      };
    }

    try {
      const attached = await this.attach();
      const helpers = await import("../p1/browser-probe-helpers.mjs");
      const auth = await helpers.probeAuthentication(attached.page);
      const diagnostics = redactDiagnostics({
        packageVersion: require("../../package.json").version,
        nodeVersion: process.version,
        platform: process.platform,
        playwrightVersion: require("playwright-core/package.json").version,
        browserChannel: this.options.channel ?? process.env.PI_CHATGPT_WEB_BROWSER_CHANNEL ?? "chrome",
        transport: "browser-owned",
        readbackMode: "dom-stable-research",
        profileDir,
        sessionEndpointStatus: auth.sessionEndpointStatus,
      });
      return {
        ok: auth.authenticated,
        detail: auth.authenticated ? "authenticated isolated Chrome session" : "isolated profile is not authenticated",
        authenticated: auth.authenticated,
        authSource: auth.authSource,
        sessionEndpointStatus: auth.sessionEndpointStatus,
        chromeExecutableFound,
        profileDir,
        diagnostics,
      };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
        chromeExecutableFound,
        profileDir,
      };
    }
  }

  async attach() {
    if (this.page && this.session?.browser) {
      return { page: this.page, browser: this.session.browser };
    }
    if (this.session && this.session.cdpEnabled === false) {
      throw new BrowserRuntimeError(
        "BROWSER_UNAVAILABLE",
        "Login Chrome is still open without CDP. Run /chatgpt login confirm first.",
      );
    }
    const host = await this.hostPromise;
    const playwrightLoader = this.options.playwrightLoader ?? defaultPlaywright;
    const { chromium } = await playwrightLoader();
    this.session = await host.launchNativeChromeSession({
      channel: this.options.channel ?? process.env.PI_CHATGPT_WEB_BROWSER_CHANNEL ?? "chrome",
      profileDir: this.options.profileDir ?? host.DEFAULT_PROFILE_DIR,
      proxy: this.options.proxy ?? envProxy(),
      headless: this.options.headless ?? false,
      startUrl: host.CHATGPT_URL,
      enableCdp: true,
    });
    if (!this.session.endpoint) {
      throw new BrowserRuntimeError("BROWSER_UNAVAILABLE", "Native Chrome launched without a loopback CDP endpoint.");
    }
    const browser = await host.connectPlaywrightOverCdp(chromium, this.session.endpoint);
    this.session.browser = browser;
    this.page = await host.getOrOpenChatgptPage(browser);
    return { page: this.page, browser };
  }

  async close() {
    const host = await this.hostPromise;
    const session = this.session;
    this.session = null;
    this.page = null;
    await host.closeNativeChromeSession(session);
  }
}
