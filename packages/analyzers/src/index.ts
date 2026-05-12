// ── Re-exports from individual analyzer modules ───────────────────────────────

export { crawlPage } from "./crawl";
export { analyzeSeo } from "./seo";
export { analyzeTechStack } from "./techStack";
export { analyzeServer } from "./server";
export { analyzeDomain } from "./domain";

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  // Primitives
  JsError,

  // Crawl
  CrawlResult,

  // Reports
  SeoReport,
  PerformanceReport,
  TechStackReport,
  TechItem,
  TechCategory,
  ServerReport,
  SecurityHeader,
  DomainReport,
  SslReport,

  // Full report
  ScanReport,
} from "./types";