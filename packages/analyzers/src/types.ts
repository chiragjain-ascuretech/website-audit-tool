export type JsError = {
  message: string;
  stack?: string;
  source?: string;
};

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
  };
  canonical: {
    exists: boolean;
    value?: string;
  };
};

export type CrawlResult = {
  finalUrl: string;
  html: string;
  jsErrors: JsError[];
};

export type ScanReport = {
  url: string;
  finalUrl: string;
  seo: SeoReport;
  jsErrors: JsError[];
};

