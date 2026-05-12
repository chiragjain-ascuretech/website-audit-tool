import type { TechCategory, TechItem, TechStackReport } from "./types";
import * as cheerio from "cheerio";

type DetectionRule = {
  name: string;
  category: TechCategory;
  confidence: "high" | "medium" | "low";
  headerKey?: string;
  headerPattern?: RegExp;
  scriptSrc?: RegExp;        // match <script src="...">
  scriptContent?: RegExp;    // match inside <script>...</script>
  metaName?: string;
  metaContent?: RegExp;
  metaProperty?: string;     // og:* tags
  cookiePattern?: RegExp;
  htmlSelector?: string;     // specific element detection
  htmlAttribute?: { selector: string; attr: string; pattern: RegExp };
};

const RULES: DetectionRule[] = [
  // ── Frameworks (more intelligent detection) ──────────────────────────────
  {
    name: "Next.js",
    category: "Framework",
    confidence: "high",
    scriptSrc: /_next\/static/,
  },
  {
    name: "Nuxt.js",
    category: "Framework",
    confidence: "high",
    scriptSrc: /_nuxt\//,
  },
  {
    name: "Gatsby",
    category: "Framework",
    confidence: "high",
    scriptSrc: /gatsby-chunk/,
  },
  {
    name: "React",
    category: "Framework",
    confidence: "high",
    scriptSrc: /react\..*\.js/i,
  },
  {
    name: "Vue.js",
    category: "Framework",
    confidence: "high",
    htmlAttribute: {
      selector: "[data-v-app], [data-v-scope], [data-v-cloak]",
      attr: "data-v-",
      pattern: /data-v-[a-f0-9]/,
    },
  },
  {
    name: "Angular",
    category: "Framework",
    confidence: "high",
    scriptSrc: /angular\..*\.js/i,
  },
  {
    name: "Angular",
    category: "Framework",
    confidence: "medium",
    htmlAttribute: {
      selector: "[ng-version]",
      attr: "ng-version",
      pattern: /\d+/,
    },
  },
  {
    name: "Svelte",
    category: "Framework",
    confidence: "high",
    scriptSrc: /svelte.*\.js/i,
  },
  {
    name: "Remix",
    category: "Framework",
    confidence: "high",
    scriptSrc: /@remix-run/,
  },
  {
    name: "Astro",
    category: "Framework",
    confidence: "high",
    scriptSrc: /astro-island/,
  },

  // ── CMS ───────────────────────────────────────────────────────────────────
  {
    name: "WordPress",
    category: "CMS",
    confidence: "high",
    htmlAttribute: {
      selector: 'link[href*="/wp-content/"]',
      attr: "href",
      pattern: /\/wp-content\//,
    },
  },
  {
    name: "WordPress",
    category: "CMS",
    confidence: "high",
    metaName: "generator",
    metaContent: /wordpress/i,
  },
  {
    name: "Drupal",
    category: "CMS",
    confidence: "high",
    htmlAttribute: {
      selector: 'link[href*="/sites/"]',
      attr: "href",
      pattern: /\/sites\/default\/files\//,
    },
  },
  {
    name: "Shopify",
    category: "eCommerce",
    confidence: "high",
    scriptSrc: /cdn\.shopify\.com/,
  },
  {
    name: "WooCommerce",
    category: "eCommerce",
    confidence: "high",
    htmlAttribute: {
      selector: '[class*="woocommerce"]',
      attr: "class",
      pattern: /woocommerce/,
    },
  },
  {
    name: "Magento",
    category: "eCommerce",
    confidence: "high",
    scriptSrc: /magento.*\.js/i,
  },
  {
    name: "Squarespace",
    category: "CMS",
    confidence: "high",
    scriptSrc: /static\.squarespace\.com/,
  },
  {
    name: "Wix",
    category: "CMS",
    confidence: "high",
    scriptSrc: /static\.wixstatic\.com/,
  },
  {
    name: "Webflow",
    category: "CMS",
    confidence: "high",
    scriptSrc: /webflow\.com\/css/,
  },
  {
    name: "Ghost",
    category: "CMS",
    confidence: "high",
    metaName: "generator",
    metaContent: /ghost/i,
  },

  // ── UI Libraries ──────────────────────────────────────────────────────────
  {
    name: "Bootstrap",
    category: "UI Library",
    confidence: "high",
    scriptSrc: /bootstrap.*\.js/i,
  },
  {
    name: "Tailwind CSS",
    category: "UI Library",
    confidence: "high",
    scriptSrc: /tailwindcss/,
  },
  {
    name: "Material UI",
    category: "UI Library",
    confidence: "high",
    scriptSrc: /@mui|material-ui/,
  },
  {
    name: "Ant Design",
    category: "UI Library",
    confidence: "high",
    scriptSrc: /antd|ant-design/,
  },
  {
    name: "jQuery",
    category: "UI Library",
    confidence: "high",
    scriptSrc: /jquery.*\.js/i,
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    name: "Google Analytics (GA4)",
    category: "Analytics",
    confidence: "high",
    scriptSrc: /googletagmanager\.com\/gtag\/js/,
  },
  {
    name: "Google Analytics (UA)",
    category: "Analytics",
    confidence: "high",
    scriptSrc: /google-analytics\.com\/analytics\.js/,
  },
  {
    name: "Google Tag Manager",
    category: "Tag Manager",
    confidence: "high",
    scriptSrc: /googletagmanager\.com\/gtm\.js/,
  },
  {
    name: "Facebook Pixel",
    category: "Marketing",
    confidence: "high",
    scriptSrc: /connect\.facebook\.net.*fbevents\.js/,
  },
  {
    name: "HubSpot",
    category: "Marketing",
    confidence: "high",
    scriptSrc: /js\.hs-scripts\.com/,
  },
  {
    name: "Hotjar",
    category: "Analytics",
    confidence: "high",
    scriptSrc: /static\.hotjar\.com/,
  },
  {
    name: "Mixpanel",
    category: "Analytics",
    confidence: "high",
    scriptSrc: /cdn\.mxpnl\.com/,
  },
  {
    name: "Segment",
    category: "Analytics",
    confidence: "high",
    scriptSrc: /cdn\.segment\.com/,
  },
  {
    name: "Intercom",
    category: "Marketing",
    confidence: "high",
    scriptSrc: /widget\.intercom\.io/,
  },
  {
    name: "Crisp Chat",
    category: "Marketing",
    confidence: "high",
    scriptSrc: /client\.crisp\.chat/,
  },

  // ── CDN ───────────────────────────────────────────────────────────────────
  {
    name: "Cloudflare",
    category: "CDN",
    confidence: "high",
    headerKey: "cf-ray",
  },
  {
    name: "Fastly",
    category: "CDN",
    confidence: "high",
    headerKey: "x-served-by",
    headerPattern: /cache-/i,
  },
  {
    name: "AWS CloudFront",
    category: "CDN",
    confidence: "high",
    headerKey: "x-amz-cf-id",
  },
  {
    name: "Vercel",
    category: "Hosting",
    confidence: "high",
    headerKey: "x-vercel-id",
  },
  {
    name: "Netlify",
    category: "Hosting",
    confidence: "high",
    headerKey: "x-nf-request-id",
  },
  {
    name: "GitHub Pages",
    category: "Hosting",
    confidence: "high",
    headerKey: "server",
    headerPattern: /github\.com pages/i,
  },

  // ── Server ────────────────────────────────────────────────────────────────
  {
    name: "Node.js",
    category: "Framework",
    confidence: "high",
    headerKey: "x-powered-by",
    headerPattern: /express/i,
  },
  {
    name: "PHP",
    category: "Framework",
    confidence: "high",
    headerKey: "x-powered-by",
    headerPattern: /php/i,
  },
  {
    name: "Nginx",
    category: "Other",
    confidence: "high",
    headerKey: "server",
    headerPattern: /nginx/i,
  },
  {
    name: "Apache",
    category: "Other",
    confidence: "high",
    headerKey: "server",
    headerPattern: /apache/i,
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    name: "reCAPTCHA",
    category: "Security",
    confidence: "high",
    scriptSrc: /google\.com\/recaptcha/,
  },
  {
    name: "Cloudflare Turnstile",
    category: "Security",
    confidence: "high",
    scriptSrc: /challenges\.cloudflare\.com\/turnstile/,
  },
  {
    name: "hCaptcha",
    category: "Security",
    confidence: "high",
    scriptSrc: /hcaptcha\.com/,
  },
];

// ── Main Analyzer ─────────────────────────────────────────────────────────────

export function analyzeTechStack(
  html: string,
  headers: Record<string, string>
): TechStackReport {
  const $ = cheerio.load(html);
  const detected = new Map<string, TechItem>();

  for (const rule of RULES) {
    const existing = detected.get(rule.name);
    if (existing && existing.confidence === "high") continue;

    let matched = false;
    let evidence = "";

    // 1. Header detection
    if (rule.headerKey) {
      const headerValue = headers[rule.headerKey];
      if (headerValue !== undefined) {
        if (rule.headerPattern) {
          if (rule.headerPattern.test(headerValue)) {
            matched = true;
            evidence = `Header: ${rule.headerKey}: "${headerValue.slice(0, 60)}"`;
          }
        } else {
          matched = true;
          evidence = `Header present: ${rule.headerKey}`;
        }
      }
    }

    // 2. Script src detection (only in <script> tags)
    if (!matched && rule.scriptSrc) {
      const scripts = $("script[src]");
      let found = false;
      scripts.each((_, el) => {
        const src = $(el).attr("src") ?? "";
        if (rule.scriptSrc!.test(src)) {
          found = true;
          evidence = `Script: ${src.slice(0, 60)}`;
          return false;
        }
      });
      matched = found;
    }

    // 3. Script content detection (only inside <script> tags)
    if (!matched && rule.scriptContent) {
      const scripts = $("script:not([src])");
      let found = false;
      scripts.each((_, el) => {
        const content = $(el).html() ?? "";
        if (rule.scriptContent!.test(content)) {
          found = true;
          evidence = `Script content detected`;
          return false;
        }
      });
      matched = found;
    }

    // 4. Meta tag detection
    if (!matched && rule.metaName) {
      const metaEl = $(`meta[name="${rule.metaName}"]`);
      if (metaEl.length > 0) {
        const content = metaEl.attr("content") ?? "";
        if (!rule.metaContent || rule.metaContent.test(content)) {
          matched = true;
          evidence = `Meta: ${rule.metaName}="${content.slice(0, 60)}"`;
        }
      }
    }

    // 5. Meta property detection (Open Graph, etc.)
    if (!matched && rule.metaProperty) {
      const metaEl = $(`meta[property="${rule.metaProperty}"]`);
      if (metaEl.length > 0) {
        matched = true;
        evidence = `Property: ${rule.metaProperty}`;
      }
    }

    // 6. HTML attribute/selector detection (safe DOM parsing)
    if (!matched && rule.htmlAttribute) {
      const elements = $(rule.htmlAttribute.selector);
      if (elements.length > 0) {
        let found = false;
        elements.each((_, el) => {
          const attrValue = $(el).attr(rule.htmlAttribute!.attr) ?? "";
          if (rule.htmlAttribute!.pattern.test(attrValue)) {
            found = true;
            evidence = `HTML: ${rule.htmlAttribute!.selector}`;
            return false;
          }
        });
        matched = found;
      }
    }

    if (matched) {
      detected.set(rule.name, {
        name: rule.name,
        category: rule.category,
        confidence: rule.confidence,
        evidence,
      });
    }
  }

  const sorted = [...detected.values()].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    const diff = order[a.confidence] - order[b.confidence];
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  return { detected: sorted };
}