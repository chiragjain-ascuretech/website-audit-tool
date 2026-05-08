"use client";

import { useMemo, useState } from "react";

type ApiScanJobResponse = {
  id: string;
  state: string;
  progress: number;
  result: any | null;
};

function isValidHttpUrl(value: string): string | null {
  try {
    const u = new URL(value);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export default function Page() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

  const [inputUrl, setInputUrl] = useState("");
  const [scanId, setScanId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const canScan = useMemo(() => status !== "running", [status]);

  async function startScan() {
    if (!apiBase) {
      setError("Server URL is not configured. Set NEXT_PUBLIC_API_BASE_URL in your .env.");
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

    // Poll scan status until completion.
    const maxAttempts = 120; // ~2 minutes with 1s delay.
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const jobRes = await fetch(`${apiBase}/api/scan/${payload.id}`);
      if (!jobRes.ok) {
        setStatus("failed");
        setError("Scan started but polling failed.");
        return;
      }

      const job = (await jobRes.json()) as ApiScanJobResponse;
      setProgress(job.progress ?? 0);

      if (job.state === "completed") {
        setStatus("completed");
        setResult(job.result);
        return;
      }
      if (job.state === "failed") {
        setStatus("failed");
        setResult(job.result);
        setError("Scan failed. See details if available.");
        return;
      }

      await new Promise((r) => setTimeout(r, 1_000));
    }

    setStatus("failed");
    setError("Timed out waiting for the scan to complete.");
  }

  const seo = result?.seo;
  const jsErrors = result?.jsErrors as Array<{ message: string; stack?: string; source?: string }> | undefined;

  return (
    <main className="app-shell bg-grid">
      <div className="container">
        <header className="hero">
          <div className="badge">
            <span className="badge-dot" />
            Premium audit reports in minutes
          </div>
          <h1 className="hero-title">Website Audit Tool</h1>
          <p className="hero-subtitle">
            Get SEO checks + runtime JavaScript errors from a single URL scan.
          </p>
        </header>

        <section className="card">
          <div className="scan-row">
            <div className="scan-input-wrap">
              <label className="field-label">Website URL</label>
              <input
                className="scan-input"
                placeholder="https://example.com"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                disabled={!canScan}
              />
            </div>
            <div className="scan-button-wrap">
              <button
                onClick={startScan}
                disabled={!canScan}
                className="scan-button"
              >
                {status === "running" ? "Scanning..." : "Start Scan"}
              </button>
            </div>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          {status === "running" || status === "completed" || status === "failed" ? (
            <div className="progress-wrap">
              <div className="progress-head">
                <span>
                  Job: <span className="mono">{scanId ?? "-"}</span>
                </span>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-bar"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="result-grid">
          <div className="card">
            <h2 className="card-title">SEO Overview</h2>
            {status === "idle" ? (
              <p className="muted">Submit a URL to generate SEO checks.</p>
            ) : !seo ? (
              <p className="muted">No SEO data yet.</p>
            ) : (
              <div className="metric-list">
                <MetricRow
                  label="Title tag"
                  ok={seo.title?.exists}
                  value={seo.title?.value}
                />
                <MetricRow
                  label="Meta description"
                  ok={seo.metaDescription?.exists}
                  value={seo.metaDescription?.value}
                />
                <MetricRow
                  label="H1 presence"
                  ok={seo.headings?.hasH1}
                  value={`H1 count: ${seo.headings?.h1Count ?? 0}`}
                />
                <MetricRow
                  label="Canonical link"
                  ok={seo.canonical?.exists}
                  value={seo.canonical?.value}
                />
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="card-title">JavaScript Errors</h2>
            {status === "idle" ? (
              <p className="muted">Console/page errors will appear here.</p>
            ) : !jsErrors ? (
              <p className="muted">No JS error data yet.</p>
            ) : jsErrors.length === 0 ? (
              <p className="success-text">No console/page errors detected.</p>
            ) : (
              <div className="error-list">
                {jsErrors.slice(0, 12).map((e, idx) => (
                  <div
                    key={`${idx}-${e.message}`}
                    className="error-item"
                  >
                    <div className="error-head">
                      <p className="error-message">{e.message}</p>
                      <span className="error-source">
                        {e.source ?? "unknown"}
                      </span>
                    </div>
                    {e.stack ? (
                      <pre className="error-stack">
                        {e.stack}
                      </pre>
                    ) : null}
                  </div>
                ))}
                {jsErrors.length > 12 ? (
                  <p className="muted">Showing first 12 errors.</p>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricRow({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value?: string;
}) {
  return (
    <div className="metric-row">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        <div className={`metric-status ${ok ? "ok" : "warn"}`}>
          {ok ? "OK" : "Missing/Check"}
        </div>
        {value ? (
          <div className="metric-detail">{value}</div>
        ) : (
          <div className="metric-detail empty">-</div>
        )}
      </div>
    </div>
  );
}

