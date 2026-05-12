import { Worker } from "bullmq";

import { QUEUE_NAME, redisConnection } from "./queue";
import type { ScanJobData } from "./types";
import type { ScanReport } from "@website-audit/analyzers";

import {
  crawlPage,
  analyzeSeo,
  analyzeTechStack,
  analyzeServer,
  analyzeDomain,
} from "@website-audit/analyzers";

function isUrlLikelyValid(url: string): boolean {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

async function runScan(
  job: import("bullmq").Job<ScanJobData, ScanReport>
): Promise<ScanReport> {
  const { url } = job.data;

  // ── Step 1: Validate ──────────────────────────────────────────────────────
  await job.updateProgress(5);
  if (!isUrlLikelyValid(url)) {
    throw new Error("Invalid URL for scan job.");
  }
  job.log(`[${job.data.scanId}] URL validated: ${url}`);

  // ── Step 2: Crawl (Playwright) ────────────────────────────────────────────
  // This is the heaviest step — captures HTML, JS errors, perf metrics, headers
  await job.updateProgress(10);
  job.log(`[${job.data.scanId}] Starting crawl...`);
  const crawl = await crawlPage(url);
  await job.updateProgress(45);
  job.log(`[${job.data.scanId}] Crawl complete. Final URL: ${crawl.finalUrl}`);

  // ── Step 3: SEO Analysis (Cheerio) ────────────────────────────────────────
  await job.updateProgress(50);
  job.log(`[${job.data.scanId}] Analyzing SEO...`);
  const seo = analyzeSeo(crawl.html, crawl.finalUrl);
  await job.updateProgress(60);

  // ── Step 4: Tech Stack Detection ──────────────────────────────────────────
  await job.updateProgress(62);
  job.log(`[${job.data.scanId}] Detecting tech stack...`);
  const techStack = analyzeTechStack(crawl.html, crawl.headers);
  await job.updateProgress(70);

  // ── Step 5: Server + Domain (run in parallel) ─────────────────────────────
  await job.updateProgress(72);
  job.log(`[${job.data.scanId}] Analyzing server & domain in parallel...`);

  const [server, domain] = await Promise.all([
    analyzeServer(url, crawl.headers, crawl.responseTimeMs),
    analyzeDomain(url),
  ]);

  await job.updateProgress(95);
  job.log(`[${job.data.scanId}] Server & domain analysis complete.`);

  // ── Step 6: Assemble Final Report ─────────────────────────────────────────
  await job.updateProgress(100);
  job.log(`[${job.data.scanId}] Scan complete.`);

  return {
    url,
    finalUrl: crawl.finalUrl,
    scannedAt: new Date().toISOString(),
    seo,
    performance: crawl.performance,
    jsErrors: crawl.jsErrors,
    techStack,
    server,
    domain,
  };
}

async function main() {
  const worker = new Worker<ScanJobData, ScanReport>(
    QUEUE_NAME,
    async (job) => {
      job.log(`Starting scan ${job.data.scanId}`);
      return runScan(job);
    },
    {
      connection: redisConnection,
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => {
    job.log(`Completed scan ${job.data.scanId}`);
    console.log(`✅ Scan completed: ${job.data.scanId}`);
  });

  worker.on("failed", (job, err) => {
    job?.log(`Failed scan ${job?.data?.scanId}: ${err.message}`);
    console.error(`❌ Scan failed: ${job?.data?.scanId} — ${err.message}`);
  });

  worker.on("progress", (job, progress) => {
    console.log(`⏳ Scan ${job.data.scanId} progress: ${progress}%`);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down worker...");
    await worker.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down worker...");
    await worker.close();
    process.exit(0);
  });

  console.log("🚀 Worker started, waiting for jobs...");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});