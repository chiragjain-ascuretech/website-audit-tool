// ─── Primitives ───────────────────────────────────────────────────────────────

export type JsError = {
  message: string;
  stack?: string;
  source?: string; // "pageerror" | "console"
};

// ─── Crawl ────────────────────────────────────────────────────────────────────

export type CrawlResult = {
  finalUrl: string;
  html: string;
  jsErrors: JsError[];
  performance: PerformanceReport;
  headers: Record<string, string>; // raw HTTP response headers
  responseTimeMs: number;
};

// ─── SEO ──────────────────────────────────────────────────────────────────────

export type SeoReport = {
  title: {
    exists: boolean;
    value?: string;
    length?: number;
  };
  metaDescription: {
    exists: boolean;
    value?: string;
    length?: number;
  };
  headings: {
    h1Count: number;
    hasH1: boolean;
    h2Count: number;
    h3Count: number;
  };
  canonical: {
    exists: boolean;
    value?: string;
  };
  viewport: {
    exists: boolean;
    value?: string;
  };
  robots: {
    exists: boolean;
    value?: string;
  };
  openGraph: {
    exists: boolean;
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
  };
  twitterCard: {
    exists: boolean;
    card?: string;
    title?: string;
    description?: string;
    image?: string;
  };
  images: {
    total: number;
    missingAlt: number;
    missingAltUrls: string[];
  };
  links: {
    total: number;
    internal: number;
    external: number;
    broken: number; // placeholder for future deep check
  };
  structuredData: {
    exists: boolean;
    count: number;
    types: string[]; // e.g. ["Product", "BreadcrumbList"]
  };
};

// ─── Performance ──────────────────────────────────────────────────────────────

export type PerformanceReport = {
  // Navigation timing (milliseconds)
  ttfb: number | null;          // Time To First Byte
  domContentLoaded: number | null;
  loadEventEnd: number | null;
  // Paint timing
  firstPaint: number | null;
  firstContentfulPaint: number | null;
  // Resource summary
  resourceCount: number;
  transferSizeKB: number;
  // Page weight
  htmlSizeKB: number;
};

// ─── Tech Stack ───────────────────────────────────────────────────────────────

export type TechCategory =
  | "CMS"
  | "Framework"
  | "Analytics"
  | "CDN"
  | "Hosting"
  | "Marketing"
  | "Security"
  | "UI Library"
  | "Tag Manager"
  | "eCommerce"
  | "Other";

export type TechItem = {
  name: string;
  category: TechCategory;
  confidence: "high" | "medium" | "low";
  evidence?: string; // what triggered the detection
};

export type TechStackReport = {
  detected: TechItem[];
};

// ─── Server ───────────────────────────────────────────────────────────────────

export type SecurityHeader = {
  name: string;
  present: boolean;
  value?: string;
};

export type ServerReport = {
  ip?: string;
  server?: string;          // Server header value
  poweredBy?: string;       // X-Powered-By header
  responseTimeMs: number;
  redirectChain: string[];  // list of URLs in redirect chain
  statusCode: number;
  securityHeaders: SecurityHeader[];
  contentType?: string;
  httpsEnabled: boolean;
  http2Enabled: boolean;
};

// ─── Domain ───────────────────────────────────────────────────────────────────

export type SslReport = {
  valid: boolean;
  issuer?: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  protocol?: string;
};

export type DomainReport = {
  hostname: string;
  aRecords: string[];
  mxRecords: string[];
  nsRecords: string[];
  ssl: SslReport;
};

// ─── Full Report ──────────────────────────────────────────────────────────────

export type ScanReport = {
  url: string;
  finalUrl: string;
  scannedAt: string;          // ISO timestamp
  seo: SeoReport;
  performance: PerformanceReport;
  jsErrors: JsError[];
  techStack: TechStackReport;
  server: ServerReport;
  domain: DomainReport;
};