import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";
import type { ServerReport, SecurityHeader } from "./types";

// ── Security headers we check for ────────────────────────────────────────────

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "x-xss-protection",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
];

// ── Redirect chain follower ───────────────────────────────────────────────────

type HopResult = {
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  responseTimeMs: number;
};

function fetchHop(url: string, timeoutMs = 10_000): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const requester = isHttps ? httpsRequest : httpRequest;

    const req = requester(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "HEAD",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; WebAuditBot/1.0)",
          Accept: "*/*",
        },
        rejectUnauthorized: false, // allow self-signed certs for analysis
      },
      (res) => {
        const responseTimeMs = Date.now() - start;
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (v) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
        }
        resolve({
          url,
          statusCode: res.statusCode ?? 0,
          headers,
          responseTimeMs,
        });
        res.resume(); // consume response body
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });

    req.end();
  });
}

async function followRedirects(
  startUrl: string,
  maxHops = 8
): Promise<HopResult[]> {
  const chain: HopResult[] = [];
  let current = startUrl;

  for (let i = 0; i < maxHops; i++) {
    let hop: HopResult;
    try {
      hop = await fetchHop(current);
    } catch {
      break;
    }

    chain.push(hop);

    const { statusCode, headers } = hop;
    const isRedirect = [301, 302, 303, 307, 308].includes(statusCode);

    if (!isRedirect || !headers["location"]) break;

    // Resolve relative redirects
    try {
      current = new URL(headers["location"], current).toString();
    } catch {
      break;
    }
  }

  return chain;
}

// ── HTTP/2 detection ──────────────────────────────────────────────────────────
// Playwright already negotiates h2; we detect via headers Playwright captured.

function detectHttp2(headers: Record<string, string>): boolean {
  // Some servers expose this via a custom header or via the alt-svc header
  const altSvc = headers["alt-svc"] ?? "";
  return altSvc.includes("h2") || Boolean(headers["x-firefox-spdy"]);
}

// ── Main Analyzer ─────────────────────────────────────────────────────────────

export async function analyzeServer(
  url: string,
  crawlHeaders: Record<string, string>, // headers already captured by Playwright
  crawlResponseTimeMs: number
): Promise<ServerReport> {
  // Follow redirect chain via HEAD requests
  const chain = await followRedirects(url).catch(() => []);

  const redirectChain = chain.map((h) => h.url);
  const finalHop = chain[chain.length - 1];

  // Merge headers: crawl headers take priority (they're from the final page load)
  const mergedHeaders: Record<string, string> = {
    ...(finalHop?.headers ?? {}),
    ...crawlHeaders,
  };

  const statusCode = finalHop?.statusCode ?? 200;
  const responseTimeMs =
    chain.length > 0
      ? chain.reduce((sum, h) => sum + h.responseTimeMs, 0)
      : crawlResponseTimeMs;

  // Security headers audit
  const securityHeaders: SecurityHeader[] = SECURITY_HEADERS.map((name) => {
    const value = mergedHeaders[name];
    return {
      name,
      present: value !== undefined,
      value: value ?? undefined,
    };
  });

  // Parse IP from DNS — best effort
  let ip: string | undefined;
  try {
    const { promises: dns } = await import("dns");
    const parsed = new URL(url);
    const records = await dns.resolve4(parsed.hostname).catch(() => []);
    ip = records[0];
  } catch {
    ip = undefined;
  }

  const httpsEnabled = url.startsWith("https://");
  const http2Enabled = detectHttp2(mergedHeaders);

  return {
    ip,
    server: mergedHeaders["server"],
    poweredBy: mergedHeaders["x-powered-by"],
    responseTimeMs,
    redirectChain,
    statusCode,
    securityHeaders,
    contentType: mergedHeaders["content-type"],
    httpsEnabled,
    http2Enabled,
  };
}