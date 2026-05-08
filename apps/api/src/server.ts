import fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "crypto";

import { scanQueue } from "./queue";
import { env } from "./env";
import type { ScanJobData } from "./types";

type ApiScanRequest = {
  url?: string;
};

function isAllowedProtocol(protocol: string): boolean {
  const p = protocol.toLowerCase();
  return env.ALLOWED_PROTOCOLS.includes(p.replace(":", ""));
}

function urlToStringSafe(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.length > env.MAX_URL_LENGTH) return null;
  try {
    const u = new URL(trimmed);
    return u.toString();
  } catch {
    return null;
  }
}

const app = fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
  },
});

async function main() {
  await app.register(cors, { origin: true });

  app.get("/healthz", async () => {
    return { ok: true };
  });

  app.post<{ Body: ApiScanRequest }>("/api/scan", async (request, reply) => {
    const body = request.body ?? {};
    const urlStr = urlToStringSafe(body.url);
    if (!urlStr) {
      reply.code(400);
      return { error: "Invalid request. Provide a valid `url`." };
    }

    const parsed = new URL(urlStr);
    if (!isAllowedProtocol(parsed.protocol)) {
      reply.code(400);
      return { error: `Protocol not allowed: ${parsed.protocol}` };
    }

    if (env.REQUIRE_HTTP_HTTPS === "true") {
      if (!["http:", "https:"].includes(parsed.protocol)) {
        reply.code(400);
        return { error: "Only http/https URLs are allowed." };
      }
    }

    if (env.ALLOW_HOSTS.length > 0 && !env.ALLOW_HOSTS.includes(parsed.hostname)) {
      reply.code(400);
      return { error: "Hostname not allowed." };
    }

    const scanId = randomUUID();
    const jobData: ScanJobData = {
      scanId,
      url: parsed.toString(),
    };

    await scanQueue.add(
      "scan",
      jobData,
      {
        jobId: scanId,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    return { id: scanId };
  });

  app.get("/api/scan/:id", async (request, reply) => {
    const id = request.params.id;
    const job = await scanQueue.getJob(id);
    if (!job) {
      reply.code(404);
      return { error: "Scan not found." };
    }

    const state = await job.getState();
    const progress = typeof job.progress === "number" ? job.progress : 0;
    const result = (job as any).returnvalue ?? null;

    return {
      id,
      state,
      progress,
      result,
    };
  });

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  app.log.info(`API listening on port ${env.API_PORT}`);
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});

