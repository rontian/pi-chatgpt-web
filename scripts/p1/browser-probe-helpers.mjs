export const AUTH_COMPOSER_SELECTORS = [
  "#prompt-textarea",
  '[contenteditable="true"][role="textbox"]',
  'textarea[placeholder*="Ask"]',
];

export const AUTH_ACCOUNT_SELECTORS = [
  '[data-testid="profile-button"]',
  '[data-testid="account-menu-button"]',
  'button[aria-label*="Profile"]',
  'button[aria-label*="Account"]',
];

export const AUTH_LOGIN_SELECTORS = [
  'a[href*="/auth/login"]',
  'button:has-text("Log in")',
  'button:has-text("Sign in")',
  'button:has-text("登录")',
];

function normalizeProxy(raw, { allowEmpty = false } = {}) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw new Error("Proxy must be a URL string.");

  const value = raw.trim();
  if (!value) {
    if (allowEmpty) return null;
    throw new Error("Proxy URL must not be empty.");
  }

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    throw new Error("Proxy must be a valid URL with an explicit scheme.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Proxy must be a valid URL.");
  }

  if (!["http:", "https:", "socks4:", "socks5:"].includes(parsed.protocol)) {
    throw new Error("Proxy URL must use http, https, socks4, or socks5.");
  }
  if (!parsed.hostname) throw new Error("Proxy URL must include a hostname.");

  return value;
}

export function extractProxyOption(argv, env = process.env) {
  const args = [];
  let cliProxy;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== "--proxy") {
      args.push(argv[i]);
      continue;
    }

    if (cliProxy !== undefined) throw new Error("--proxy may only be specified once.");
    if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) {
      throw new Error("--proxy requires a URL.");
    }
    cliProxy = argv[++i];
  }

  const proxy =
    cliProxy !== undefined
      ? normalizeProxy(cliProxy)
      : normalizeProxy(env.PI_CHATGPT_WEB_PROXY, { allowEmpty: true });

  return { args, proxy };
}

export function classifyAuthentication({
  sessionAuthenticated = false,
  uiAuthenticated = false,
  sessionEndpointStatus = null,
} = {}) {
  const session = Boolean(sessionAuthenticated);
  const ui = Boolean(uiAuthenticated);
  return {
    authenticated: session || ui,
    authSource: session && ui ? "session+ui" : session ? "session" : ui ? "ui" : null,
    sessionEndpointStatus: Number.isInteger(sessionEndpointStatus)
      ? sessionEndpointStatus
      : null,
  };
}

export function sanitizeAuthProbe(payload) {
  if (!payload || typeof payload !== "object") return classifyAuthentication();
  return classifyAuthentication({
    sessionAuthenticated: payload.sessionAuthenticated,
    uiAuthenticated: payload.uiAuthenticated,
    sessionEndpointStatus: payload.sessionEndpointStatus,
  });
}

export function sanitizeSessionProbe(payload) {
  if (!payload || typeof payload !== "object") return classifyAuthentication();
  return sanitizeAuthProbe({
    ...payload,
    sessionAuthenticated:
      payload.sessionAuthenticated ?? Boolean(payload.authenticated),
  });
}

async function anyVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      return true;
    }
  }
  return false;
}

export async function probeAuthentication(page) {
  const session = await page.evaluate(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
      });

      let sessionAuthenticated = false;
      if (response.ok) {
        const body = await response.json().catch(() => null);
        sessionAuthenticated = Boolean(
          body &&
            typeof body === "object" &&
            (body.user || body.accessToken || body.account || body.expires || body.authenticated === true)
        );
      }

      return {
        sessionAuthenticated,
        sessionEndpointStatus: response.status,
      };
    } catch {
      return {
        sessionAuthenticated: false,
        sessionEndpointStatus: null,
      };
    }
  });

  const [composerVisible, accountVisible, loginVisible] = await Promise.all([
    anyVisible(page, AUTH_COMPOSER_SELECTORS),
    anyVisible(page, AUTH_ACCOUNT_SELECTORS),
    anyVisible(page, AUTH_LOGIN_SELECTORS),
  ]);
  const uiAuthenticated = !loginVisible && (composerVisible || accountVisible);

  return sanitizeAuthProbe({
    ...session,
    uiAuthenticated,
  });
}
