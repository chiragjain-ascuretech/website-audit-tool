import { chromium } from "playwright";
import * as cheerio from "cheerio";

import type { CrawlResult, JsError, ScanReport, SeoReport } from "./types";

const DEFAULT_NAV_TIMEOUT_MS = 45_000;

export async function crawlPage(url: string): Promise<CrawlResult> {
  const jsErrors: JsError[] = [];

  const browser = await chromium.launch({
    headless: true,
    // Helpful for some Linux/container environments where sandboxing is unavailable.
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

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
      const looksLikeUncaught = text.startsWith("Uncaught") || text.includes("Uncaught ");

      if (type === "error" || looksLikeUncaught) {
        jsErrors.push({
          message: text,
          source: "console",
        });
      }
    });

    // Let page scripts load enough to trigger errors/console logs.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_NAV_TIMEOUT_MS });
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);

    const finalUrl = page.url();
    const html = await page.content();
    return { finalUrl, html, jsErrors };
  } finally {
    await browser.close();
  }
}

export function analyzeSeo(html: string): SeoReport {
  const $ = cheerio.load(html);

  const titleValue = $("head title").first().text().trim();
  const metaDescriptionValue = $('meta[name="description"]').attr("content")?.trim();
  const canonicalValue = $('link[rel="canonical"]').attr("href")?.trim();

  const titleExists = titleValue.length > 0;
  const metaDescriptionExists = Boolean(metaDescriptionValue && metaDescriptionValue.length > 0);

  const h1Count = $("h1").length;

  return {
    title: {
      exists: titleExists,
      value: titleExists ? titleValue : undefined,
      length: titleExists ? titleValue.length : undefined,
    },
    metaDescription: {
      exists: metaDescriptionExists,
      value: metaDescriptionExists ? metaDescriptionValue : undefined,
      length: metaDescriptionExists ? metaDescriptionValue!.length : undefined,
    },
    headings: {
      h1Count,
      hasH1: h1Count > 0,
    },
    canonical: {
      exists: Boolean(canonicalValue),
      value: canonicalValue || undefined,
    },
  };
}

export async function scanUrl(url: string): Promise<ScanReport> {
  const crawl = await crawlPage(url);
  const seo = analyzeSeo(crawl.html);

  return {
    url,
    finalUrl: crawl.finalUrl,
    seo,
    jsErrors: crawl.jsErrors,
  };
}

