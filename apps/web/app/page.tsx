"use client";

import { useMemo, useState } from "react";
import type {
  ScanReport,
  SeoReport,
  PerformanceReport,
  TechStackReport,
  ServerReport,
  DomainReport,
  JsError,
} from "@website-audit/analyzers";

// ── Types ─────────────────────────────────────────────────────────────────────

type ApiScanJobResponse = {
  id: string;
  state: string;
  progress: number;
  result: ScanReport | null;
};

type Tab = "seo" | "performance" | "techstack" | "server" | "domain" | "jserrors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidHttpUrl(value: string): string | null {
  try {
    const u = new URL(value);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtKB(kb: number | null | undefined): string {
  if (kb == null) return "—";
  if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB`;
  return `${kb} KB`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function scoreColor(ok: boolean): string {
  return ok ? "chip-ok" : "chip-warn";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={`chip ${ok ? "chip-ok" : "chip-warn"}`}>
      {label ?? (ok ? "OK" : "Missing")}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="section-title">{children}</h3>;
}

function DataRow({
  label,
  value,
  chip,
  chipOk,
  chipLabel,
  mono,
}: {
  label: string;
  value?: React.ReactNode;
  chip?: boolean;
  chipOk?: boolean;
  chipLabel?: string;
  mono?: boolean;
}) {
  const hasValue =
    value !== undefined &&
    value !== null &&
    value !== "";

  const hasChip =
    chip &&
    chipOk !== undefined;

  return (
    <div className="data-row">
      <span className="data-label">{label}</span>

      <span className={`data-value ${mono ? "mono" : ""}`}>
        {hasChip ? (
          <Chip ok={chipOk} label={chipLabel} />
        ) : null}

        {hasValue ? value : null}

        {!hasChip && !hasValue ? "—" : null}
      </span>
    </div>
  );
}

// ── Tab: SEO ─────────────────────────────────────────────────────────────────

function SeoTab({ seo }: { seo: SeoReport }) {
  return (
    <div className="tab-content">
      <div className="audit-grid">

        {/* Core Meta */}
        <div className="audit-card">
          <SectionTitle>Core Meta Tags</SectionTitle>
          <DataRow
            label="Title Tag"
            chip chipOk={seo.title.exists}
            value={seo.title.value
              ? <span className="detail-text">{seo.title.value} <em className="length-hint">({seo.title.length} chars)</em></span>
              : null}
          />
          <DataRow
            label="Meta Description"
            chip chipOk={seo.metaDescription.exists}
            value={seo.metaDescription.value
              ? <span className="detail-text">{seo.metaDescription.value} <em className="length-hint">({seo.metaDescription.length} chars)</em></span>
              : null}
          />
          <DataRow
            label="Canonical URL"
            chip chipOk={seo.canonical.exists}
            value={seo.canonical.value}
            mono
          />
          <DataRow
            label="Viewport"
            chip chipOk={seo.viewport.exists}
            value={seo.viewport.value}
          />
          <DataRow
            label="Robots Meta"
            chip chipOk={seo.robots.exists}
            value={seo.robots.value ?? (seo.robots.exists ? undefined : "Not set (defaults to index, follow)")}
          />
        </div>

        {/* Headings */}
        <div className="audit-card">
          <SectionTitle>Heading Structure</SectionTitle>
          <DataRow
            label="H1 Present"
            chip chipOk={seo.headings.hasH1}
            chipLabel={seo.headings.hasH1 ? `${seo.headings.h1Count} found` : "Missing"}
          />
          <DataRow label="H2 Count" value={String(seo.headings.h2Count)} />
          <DataRow label="H3 Count" value={String(seo.headings.h3Count)} />

          <SectionTitle>Links</SectionTitle>
          <DataRow label="Total Links" value={String(seo.links.total)} />
          <DataRow label="Internal" value={String(seo.links.internal)} />
          <DataRow label="External" value={String(seo.links.external)} />

          <SectionTitle>Images</SectionTitle>
          <DataRow label="Total Images" value={String(seo.images.total)} />
          <DataRow
            label="Missing Alt Text"
            chip chipOk={seo.images.missingAlt === 0}
            chipLabel={seo.images.missingAlt === 0 ? "All OK" : `${seo.images.missingAlt} missing`}
          />
        </div>

        {/* Open Graph */}
        <div className="audit-card">
          <SectionTitle>Open Graph</SectionTitle>
          <DataRow label="OG Tags Present" chip chipOk={seo.openGraph.exists} />
          {seo.openGraph.exists && (
            <>
              <DataRow label="og:title" value={seo.openGraph.title} />
              <DataRow label="og:description" value={seo.openGraph.description} />
              <DataRow label="og:type" value={seo.openGraph.type} />
              <DataRow label="og:image" value={seo.openGraph.image} mono />
              <DataRow label="og:url" value={seo.openGraph.url} mono />
            </>
          )}

          <SectionTitle>Twitter Card</SectionTitle>
          <DataRow label="Twitter Tags Present" chip chipOk={seo.twitterCard.exists} />
          {seo.twitterCard.exists && (
            <>
              <DataRow label="twitter:card" value={seo.twitterCard.card} />
              <DataRow label="twitter:title" value={seo.twitterCard.title} />
              <DataRow label="twitter:description" value={seo.twitterCard.description} />
            </>
          )}
        </div>

        {/* Structured Data */}
        <div className="audit-card">
          <SectionTitle>Structured Data (JSON-LD)</SectionTitle>
          <DataRow
            label="JSON-LD Present"
            chip chipOk={seo.structuredData.exists}
            chipLabel={seo.structuredData.exists ? `${seo.structuredData.count} schema(s)` : "None found"}
          />
          {seo.structuredData.types.length > 0 && (
            <div className="tag-list">
              {seo.structuredData.types.map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          )}

          {seo.images.missingAltUrls.length > 0 && (
            <>
              <SectionTitle>Images Missing Alt Text</SectionTitle>
              <div className="url-list">
                {seo.images.missingAltUrls.map((u, i) => (
                  <div key={i} className="url-item mono">{u || "(no src)"}</div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Tab: Performance ──────────────────────────────────────────────────────────

function PerfTab({ perf }: { perf: PerformanceReport }) {
  const metrics = [
    { label: "Time to First Byte (TTFB)", value: fmtMs(perf.ttfb), ok: (perf.ttfb ?? 999) < 600 },
    { label: "First Paint", value: fmtMs(perf.firstPaint), ok: (perf.firstPaint ?? 9999) < 1800 },
    { label: "First Contentful Paint", value: fmtMs(perf.firstContentfulPaint), ok: (perf.firstContentfulPaint ?? 9999) < 1800 },
    { label: "DOM Content Loaded", value: fmtMs(perf.domContentLoaded), ok: (perf.domContentLoaded ?? 9999) < 3000 },
    { label: "Page Load Complete", value: fmtMs(perf.loadEventEnd), ok: (perf.loadEventEnd ?? 9999) < 5000 },
  ];

  return (
    <div className="tab-content">
      <div className="audit-grid">

        {/* Timing */}
        <div className="audit-card span-2">
          <SectionTitle>Page Timing</SectionTitle>
          <div className="perf-metric-grid">
            {metrics.map((m) => (
              <div key={m.label} className={`perf-metric-card ${m.ok ? "perf-ok" : "perf-warn"}`}>
                <div className="perf-value">{m.value}</div>
                <div className="perf-label">{m.label}</div>
                <div className={`perf-badge ${m.ok ? "badge-ok" : "badge-warn"}`}>
                  {m.ok ? "Good" : "Needs Work"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="audit-card">
          <SectionTitle>Resource Summary</SectionTitle>
          <DataRow label="Total Resources" value={String(perf.resourceCount)} />
          <DataRow label="Total Transfer Size" value={fmtKB(perf.transferSizeKB)} />
          <DataRow label="HTML Document Size" value={fmtKB(perf.htmlSizeKB)} />
        </div>

        {/* Thresholds */}
        <div className="audit-card">
          <SectionTitle>Performance Thresholds</SectionTitle>
          <DataRow label="TTFB < 600ms" chip chipOk={(perf.ttfb ?? 999) < 600} chipLabel={(perf.ttfb ?? 999) < 600 ? "Pass" : "Fail"} />
          <DataRow label="FCP < 1.8s" chip chipOk={(perf.firstContentfulPaint ?? 9999) < 1800} chipLabel={(perf.firstContentfulPaint ?? 9999) < 1800 ? "Pass" : "Fail"} />
          <DataRow label="DCL < 3s" chip chipOk={(perf.domContentLoaded ?? 9999) < 3000} chipLabel={(perf.domContentLoaded ?? 9999) < 3000 ? "Pass" : "Fail"} />
          <DataRow label="Load < 5s" chip chipOk={(perf.loadEventEnd ?? 9999) < 5000} chipLabel={(perf.loadEventEnd ?? 9999) < 5000 ? "Pass" : "Fail"} />
        </div>

      </div>
    </div>
  );
}

// ── Tab: Tech Stack ───────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  CMS: "🗂",
  Framework: "⚙️",
  Analytics: "📊",
  CDN: "🌐",
  Hosting: "🖥",
  Marketing: "📣",
  Security: "🔒",
  "UI Library": "🎨",
  "Tag Manager": "🏷",
  eCommerce: "🛒",
  Other: "🔧",
};

function TechStackTab({ techStack }: { techStack: TechStackReport }) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof techStack.detected>();
    for (const item of techStack.detected) {
      const existing = map.get(item.category) ?? [];
      existing.push(item);
      map.set(item.category, existing);
    }
    return map;
  }, [techStack]);

  if (techStack.detected.length === 0) {
    return (
      <div className="tab-content">
        <div className="audit-card">
          <p className="muted">No technologies detected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="audit-grid">
        {[...grouped.entries()].map(([category, items]) => (
          <div key={category} className="audit-card">
            <SectionTitle>
              {CATEGORY_ICONS[category] ?? "🔧"} {category}
            </SectionTitle>
            {items.map((item) => (
              <div key={item.name} className="tech-item">
                <div className="tech-name">{item.name}</div>
                <div className="tech-meta">
                  <span className={`confidence confidence-${item.confidence}`}>
                    {item.confidence}
                  </span>
                  {item.evidence && (
                    <span className="tech-evidence">{item.evidence}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Server ───────────────────────────────────────────────────────────────

function ServerTab({ server }: { server: ServerReport }) {
  return (
    <div className="tab-content">
      <div className="audit-grid">

        {/* Overview */}
        <div className="audit-card">
          <SectionTitle>Server Overview</SectionTitle>
          <DataRow label="IP Address" value={server.ip} mono />
          <DataRow label="Server" value={server.server} />
          <DataRow label="X-Powered-By" value={server.poweredBy} />
          <DataRow label="HTTP Status" value={String(server.statusCode)} />
          <DataRow label="Response Time" value={fmtMs(server.responseTimeMs)} />
          <DataRow label="Content Type" value={server.contentType} />
          <DataRow label="HTTPS Enabled" chip chipOk={server.httpsEnabled} />
          <DataRow label="HTTP/2 Enabled" chip chipOk={server.http2Enabled} />
        </div>

        {/* Redirect Chain */}
        <div className="audit-card">
          <SectionTitle>Redirect Chain</SectionTitle>
          {server.redirectChain.length <= 1 ? (
            <p className="success-text">✓ No redirects detected</p>
          ) : (
            <div className="redirect-chain">
              {server.redirectChain.map((u, i) => (
                <div key={i} className="redirect-hop">
                  {i > 0 && <div className="redirect-arrow">↓</div>}
                  <div className="url-item mono">{u}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Headers */}
        <div className="audit-card span-2">
          <SectionTitle>Security Headers</SectionTitle>
          <div className="security-grid">
            {server.securityHeaders.map((h) => (
              <div key={h.name} className={`security-header-card ${h.present ? "sec-ok" : "sec-warn"}`}>
                <div className="sec-status">{h.present ? "✓" : "✗"}</div>
                <div className="sec-name mono">{h.name}</div>
                {h.value && <div className="sec-value">{h.value}</div>}
                {!h.present && <div className="sec-missing">Not set</div>}
              </div>
            ))}
          </div>
          <div className="sec-summary">
            <span className={scoreColor(server.securityHeaders.filter(h => h.present).length >= 7)}>
              {server.securityHeaders.filter(h => h.present).length} / {server.securityHeaders.length} headers present
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Tab: Domain ───────────────────────────────────────────────────────────────

function DomainTab({ domain }: { domain: DomainReport }) {
  const ssl = domain.ssl;
  const daysOk = (ssl.daysRemaining ?? 0) > 30;

  return (
    <div className="tab-content">
      <div className="audit-grid">

        {/* SSL Certificate */}
        <div className="audit-card">
          <SectionTitle>SSL Certificate</SectionTitle>
          <DataRow label="Valid" chip chipOk={ssl.valid} />
          <DataRow label="Issuer" value={ssl.issuer} />
          <DataRow label="Subject" value={ssl.subject} />
          <DataRow label="Protocol" value={ssl.protocol} />
          <DataRow label="Valid From" value={fmtDate(ssl.validFrom)} />
          <DataRow label="Valid To" value={fmtDate(ssl.validTo)} />
          <DataRow
            label="Days Remaining"
            chip chipOk={daysOk}
            chipLabel={ssl.daysRemaining != null ? `${ssl.daysRemaining} days` : "Unknown"}
          />
        </div>

        {/* DNS Records */}
        <div className="audit-card">
          <SectionTitle>DNS Records</SectionTitle>
          <DataRow label="Hostname" value={domain.hostname} mono />

          <div className="dns-section">
            <div className="dns-label">A Records (IPv4)</div>
            {domain.aRecords.length === 0
              ? <p className="muted">None found</p>
              : domain.aRecords.map((r) => (
                  <div key={r} className="url-item mono">{r}</div>
                ))}
          </div>

          <div className="dns-section">
            <div className="dns-label">MX Records (Mail)</div>
            {domain.mxRecords.length === 0
              ? <p className="muted">None found</p>
              : domain.mxRecords.map((r) => (
                  <div key={r} className="url-item mono">{r}</div>
                ))}
          </div>

          <div className="dns-section">
            <div className="dns-label">NS Records (Nameservers)</div>
            {domain.nsRecords.length === 0
              ? <p className="muted">None found</p>
              : domain.nsRecords.map((r) => (
                  <div key={r} className="url-item mono">{r}</div>
                ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Tab: JS Errors ────────────────────────────────────────────────────────────

function JsErrorsTab({ jsErrors }: { jsErrors: JsError[] }) {
  return (
    <div className="tab-content">
      {jsErrors.length === 0 ? (
        <div className="audit-card">
          <p className="success-text">✓ No console or page errors detected.</p>
        </div>
      ) : (
        <div className="error-list">
          {jsErrors.map((e, idx) => (
            <div key={idx} className="error-item">
              <div className="error-head">
                <p className="error-message">{e.message}</p>
                <span className={`error-source-badge source-${e.source}`}>
                  {e.source ?? "unknown"}
                </span>
              </div>
              {e.stack && (
                <pre className="error-stack">{e.stack}</pre>
              )}
            </div>
          ))}
          {jsErrors.length > 20 && (
            <p className="muted">Showing first 20 of {jsErrors.length} errors.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

  const [inputUrl, setInputUrl] = useState("");
  const [scanId, setScanId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanReport | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("seo");

  const canScan = status !== "running";

  async function startScan() {
    if (!apiBase) {
      setError("Server URL not configured.");
      setStatus("failed");
      return;
    }

    const normalized = isValidHttpUrl(inputUrl);
    if (!normalized) {
      setError("Please enter a valid http/https URL.");
      setStatus("failed");
      return;
    }

    setError(null);
    setStatus("running");
    setProgress(0);
    setResult(null);
    setScanId(null);

    const startRes = await fetch(`${apiBase}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalized }),
    });

    if (!startRes.ok) {
      const payload = await startRes.json().catch(() => ({}));
      setStatus("failed");
      setError(payload?.error || "Failed to start scan.");
      return;
    }

    const payload = (await startRes.json()) as { id: string };
    setScanId(payload.id);

    const maxAttempts = 120;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const jobRes = await fetch(`${apiBase}/api/scan/${payload.id}`);
      if (!jobRes.ok) {
        setStatus("failed");
        setError("Polling failed.");
        return;
      }

      const job = (await jobRes.json()) as ApiScanJobResponse;
      setProgress(job.progress ?? 0);

      if (job.state === "completed") {
        setStatus("completed");
        setResult(job.result);
        setActiveTab("seo");
        return;
      }

      if (job.state === "failed") {
        setStatus("failed");
        setError("Scan failed.");
        return;
      }

      await new Promise((r) => setTimeout(r, 1_000));
    }

    setStatus("failed");
    setError("Timed out waiting for scan.");
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "seo", label: "SEO" },
    { id: "performance", label: "Performance" },
    { id: "techstack", label: "Tech Stack", count: result?.techStack?.detected?.length },
    { id: "server", label: "Server" },
    { id: "domain", label: "Domain" },
    { id: "jserrors", label: "JS Errors", count: result?.jsErrors?.length },
  ];

  return (
    <main className="app-shell bg-grid">
      <div className="container">

        {/* Hero */}
        <header className="hero">
          <div className="badge">
            <span className="badge-dot" />
            Premium audit reports in minutes
          </div>
          <h1 className="hero-title">Website Audit Tool</h1>
          <p className="hero-subtitle">
            SEO · Performance · Tech Stack · Server · Domain · JS Errors — all from one scan.
          </p>
        </header>

        {/* Scan Input */}
        <section className="card scan-card">
          <div className="scan-row">
            <div className="scan-input-wrap">
              <label className="field-label">Website URL</label>
              <input
                className="scan-input"
                placeholder="https://example.com"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canScan && startScan()}
                disabled={!canScan}
              />
            </div>
            <div className="scan-button-wrap">
              <button onClick={startScan} disabled={!canScan} className="scan-button">
                {status === "running" ? (
                  <><span className="spinner" /> Scanning…</>
                ) : "Start Scan"}
              </button>
            </div>
          </div>

          {error && <p className="error-text">⚠ {error}</p>}

          {(status === "running" || status === "completed" || status === "failed") && (
            <div className="progress-wrap">
              <div className="progress-head">
                <span>Job: <span className="mono">{scanId ?? "—"}</span></span>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-bar"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              {status === "running" && (
                <p className="progress-hint">
                  {progress < 45 ? "🔍 Crawling page with headless browser…"
                    : progress < 62 ? "📋 Analyzing SEO tags…"
                    : progress < 72 ? "🔬 Detecting tech stack…"
                    : progress < 95 ? "🌐 Checking server & domain…"
                    : "✅ Assembling report…"}
                </p>
              )}
            </div>
          )}

          {status === "completed" && result && (
            <div className="scan-meta">
              <span>Scanned: <span className="mono">{result.finalUrl}</span></span>
              <span className="scan-time">
                {new Date(result.scannedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </section>

        {/* Results */}
        {status === "idle" && (
          <div className="idle-state">
            <div className="idle-grid">
              {["SEO", "Performance", "Tech Stack", "Server", "Domain", "JS Errors"].map((label) => (
                <div key={label} className="idle-card">
                  <div className="idle-label">{label}</div>
                  <div className="idle-hint">Submit a URL to scan</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === "running" && (
          <div className="loading-state">
            <div className="loading-pulse" />
            <p className="muted">Running full audit, this may take 30–60 seconds…</p>
          </div>
        )}

        {status === "completed" && result && (
          <section className="results-section">
            {/* Tabs */}
            <div className="tab-bar">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? "tab-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className={`tab-count ${tab.id === "jserrors" && tab.count > 0 ? "tab-count-warn" : ""}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Panels */}
            {activeTab === "seo" && <SeoTab seo={result.seo} />}
            {activeTab === "performance" && <PerfTab perf={result.performance} />}
            {activeTab === "techstack" && <TechStackTab techStack={result.techStack} />}
            {activeTab === "server" && <ServerTab server={result.server} />}
            {activeTab === "domain" && <DomainTab domain={result.domain} />}
            {activeTab === "jserrors" && <JsErrorsTab jsErrors={result.jsErrors} />}
          </section>
        )}

      </div>
    </main>
  );
}