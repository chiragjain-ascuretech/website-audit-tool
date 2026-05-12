import * as cheerio from "cheerio";
import type { SeoReport } from "./types";

export function analyzeSeo(html: string, baseUrl?: string): SeoReport {
  const $ = cheerio.load(html);

  // ── Title ──────────────────────────────────────────────────────────────────
  const titleValue = $("head title").first().text().trim();
  const titleExists = titleValue.length > 0;

  // ── Meta Description ───────────────────────────────────────────────────────
  const metaDescValue = $('meta[name="description"]').attr("content")?.trim();
  const metaDescExists = Boolean(metaDescValue && metaDescValue.length > 0);

  // ── Canonical ──────────────────────────────────────────────────────────────
  const canonicalValue = $('link[rel="canonical"]').attr("href")?.trim();

  // ── Viewport ───────────────────────────────────────────────────────────────
  const viewportValue = $('meta[name="viewport"]').attr("content")?.trim();

  // ── Robots meta ────────────────────────────────────────────────────────────
  const robotsValue = $('meta[name="robots"]').attr("content")?.trim();

  // ── Headings ───────────────────────────────────────────────────────────────
  const h1Count = $("h1").length;
  const h2Count = $("h2").length;
  const h3Count = $("h3").length;

  // ── Open Graph ─────────────────────────────────────────────────────────────
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim();
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
  const ogUrl = $('meta[property="og:url"]').attr("content")?.trim();
  const ogType = $('meta[property="og:type"]').attr("content")?.trim();
  const ogExists = Boolean(ogTitle || ogDescription || ogImage);

  // ── Twitter Card ───────────────────────────────────────────────────────────
  const twCard = $('meta[name="twitter:card"]').attr("content")?.trim();
  const twTitle = $('meta[name="twitter:title"]').attr("content")?.trim();
  const twDescription = $('meta[name="twitter:description"]').attr("content")?.trim();
  const twImage = $('meta[name="twitter:image"]').attr("content")?.trim();
  const twExists = Boolean(twCard || twTitle);

  // ── Images ─────────────────────────────────────────────────────────────────
  const allImages = $("img");
  const missingAltUrls: string[] = [];

  allImages.each((_, el) => {
    const alt = $(el).attr("alt");
    const src = $(el).attr("src") ?? "";
    // missing alt = attribute is absent OR empty string
    if (alt === undefined || alt.trim() === "") {
      missingAltUrls.push(src.slice(0, 120)); // cap length for safety
    }
  });

  // ── Links ──────────────────────────────────────────────────────────────────
  const allLinks = $("a[href]");
  let internalCount = 0;
  let externalCount = 0;

  const parsedBase = baseUrl ? safeParseUrl(baseUrl) : null;

  allLinks.each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return; // skip anchors and non-http links
    }

    const resolved = safeResolveUrl(href, baseUrl);
    if (!resolved) return;

    const parsedHref = safeParseUrl(resolved);
    if (!parsedHref) return;

    if (parsedBase && parsedHref.hostname === parsedBase.hostname) {
      internalCount++;
    } else {
      externalCount++;
    }
  });

  // ── Structured Data ────────────────────────────────────────────────────────
  const structuredTypes: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() ?? "";
      const parsed = JSON.parse(raw);
      const schemas = Array.isArray(parsed) ? parsed : [parsed];
      for (const schema of schemas) {
        const type = schema["@type"];
        if (typeof type === "string") {
          structuredTypes.push(type);
        } else if (Array.isArray(type)) {
          structuredTypes.push(...type.filter((t) => typeof t === "string"));
        }
      }
    } catch {
      // malformed JSON-LD — skip silently
    }
  });

  return {
    title: {
      exists: titleExists,
      value: titleExists ? titleValue : undefined,
      length: titleExists ? titleValue.length : undefined,
    },
    metaDescription: {
      exists: metaDescExists,
      value: metaDescExists ? metaDescValue : undefined,
      length: metaDescExists ? metaDescValue!.length : undefined,
    },
    headings: {
      h1Count,
      hasH1: h1Count > 0,
      h2Count,
      h3Count,
    },
    canonical: {
      exists: Boolean(canonicalValue),
      value: canonicalValue || undefined,
    },
    viewport: {
      exists: Boolean(viewportValue),
      value: viewportValue || undefined,
    },
    robots: {
      exists: Boolean(robotsValue),
      value: robotsValue || undefined,
    },
    openGraph: {
      exists: ogExists,
      title: ogTitle,
      description: ogDescription,
      image: ogImage,
      url: ogUrl,
      type: ogType,
    },
    twitterCard: {
      exists: twExists,
      card: twCard,
      title: twTitle,
      description: twDescription,
      image: twImage,
    },
    images: {
      total: allImages.length,
      missingAlt: missingAltUrls.length,
      missingAltUrls: missingAltUrls.slice(0, 10), // show first 10 only
    },
    links: {
      total: internalCount + externalCount,
      internal: internalCount,
      external: externalCount,
      broken: 0, // deep link checking is a future phase
    },
    structuredData: {
      exists: structuredTypes.length > 0,
      count: structuredTypes.length,
      types: [...new Set(structuredTypes)], // deduplicate
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function safeResolveUrl(href: string, base?: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}