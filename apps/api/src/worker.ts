import { Worker } from "bullmq";

import { QUEUE_NAME, redisConnection } from "./queue";
import type { ScanJobData } from "./types";
import type { ScanReport } from "@website-audit/analyzers";

import { analyzeSeo, crawlPage } from "@website-audit/analyzers";

function isUrlLikelyValid(url: string): boolean {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

async function runScan(job: import("bullmq").Job<ScanJobData, ScanReport>): Promise<ScanReport> {
  const { url } = job.data;

  job.updateProgress(5);
  if (!isUrlLikelyValid(url)) {
    throw new Error("Invalid URL for scan job.");
  }

  // Crawling (Playwright)
  const crawl = await crawlPage(url);
  job.updateProgress(70);

  // SEO analysis (Cheerio)
  const seo = analyzeSeo(crawl.html);
  job.updateProgress(95);

  // Note: jsErrors already captured during crawl.
  job.updateProgress(100);

  return {
    url,
    finalUrl: crawl.finalUrl,
    seo,
    jsErrors: crawl.jsErrors,
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
  });

  worker.on("failed", (job, err) => {
    job?.log(`Failed scan ${job?.data?.scanId}: ${err.message}`);
  });

  process.on("SIGINT", async () => {
    await worker.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await worker.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

