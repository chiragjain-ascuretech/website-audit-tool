import IORedis from "ioredis";
import { Queue } from "bullmq";

import type { ScanReport } from "@website-audit/analyzers";
import type { ScanJobData } from "./types";
import { env } from "./env";

const QUEUE_NAME = "scanQueue";

const connection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
});

export const scanQueue = new Queue<ScanJobData, ScanReport>(QUEUE_NAME, {
  connection,
});

export const redisConnection = connection;
export { QUEUE_NAME };

