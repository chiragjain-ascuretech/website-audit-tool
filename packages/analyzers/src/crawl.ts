import { chromium } from "playwright";
import type { CrawlResult, JsError, PerformanceReport } from "./types";

const DEFAULT_NAV_TIMEOUT_MS = 45_000;
const IDLE_TIMEOUT_MS = 12_000;
const EXTRA_WAIT_MS = 1_500;

export async function crawlPage(url: string): Promise<CrawlResult> {
  const jsErrors: JsError[] = [];
  const startTime = Date.now();

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; WebAuditBot/1.0; +https://github.com/your-org/website-audit-tool)",
    });

    const page = await context.newPage();

    // ── JS error capture ────────────────────────────────────────────────────
    page.on("pageerror", (err) => {
      jsErrors.push({
        message: err.message,
        stack: err.stack,
        source: "pageerror",
      });
    });

    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      const looksLikeUncaught =
        text.startsWith("Uncaught") || text.includes("Uncaught ");
      if (type === "error" || looksLikeUncaught) {
        jsErrors.push({ message: text, source: "console" });
      }
    });

    // ── Navigation ──────────────────────────────────────────────────────────
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_NAV_TIMEOUT_MS,
    });

    await page
      .waitForLoadState("networkidle", { timeout: IDLE_TIMEOUT_MS })
      .catch(() => undefined);

    await page.waitForTimeout(EXTRA_WAIT_MS);

    const responseTimeMs = Date.now() - startTime;
    const finalUrl = page.url();
    const html = await page.content();

    // ── Raw response headers ─────────────────────────────────────────────────
    const rawHeaders: Record<string, string> = {};
    if (response) {
      const hdrs = response.headers();
      for (const [k, v] of Object.entries(hdrs)) {
        rawHeaders[k.toLowerCase()] = v;
      }
    }

    // ── Performance via Web Performance API ─────────────────────────────────
    const performance = await page
      .evaluate((): PerformanceReport => {
        const nav = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming | undefined;

        const paintEntries = performance.getEntriesByType("paint");
        const fp = paintEntries.find((e) => e.name === "first-paint");
        const fcp = paintEntries.find(
          (e) => e.name === "first-contentful-paint"
        );

        const resources = performance.getEntriesByType(
          "resource"
        ) as PerformanceResourceTiming[];
        const transferSize = resources.reduce(
          (sum, r) => sum + (r.transferSize ?? 0),
          0
        );

        const htmlSize =
          document.documentElement.outerHTML?.length ?? 0;

        return {
          ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
          domContentLoaded: nav
            ? Math.round(
                nav.domContentLoadedEventEnd - nav.startTime
              )
            : null,
          loadEventEnd: nav
            ? Math.round(nav.loadEventEnd - nav.startTime)
            : null,
          firstPaint: fp ? Math.round(fp.startTime) : null,
          firstContentfulPaint: fcp ? Math.round(fcp.startTime) : null,
          resourceCount: resources.length,
          transferSizeKB: Math.round(transferSize / 1024),
          htmlSizeKB: Math.round(htmlSize / 1024),
        };
      })
      .catch(
        (): PerformanceReport => ({
          ttfb: null,
          domContentLoaded: null,
          loadEventEnd: null,
          firstPaint: null,
          firstContentfulPaint: null,
          resourceCount: 0,
          transferSizeKB: 0,
          htmlSizeKB: 0,
        })
      );

    return {
      finalUrl,
      html,
      jsErrors,
      performance,
      headers: rawHeaders,
      responseTimeMs,
    };
  } finally {
    await browser.close();
  }
}