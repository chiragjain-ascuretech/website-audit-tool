import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const env = {
  REDIS_HOST: process.env.REDIS_HOST ?? "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT ?? "6379"),
  API_PORT: Number(process.env.API_PORT ?? "3001"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  // In local dev, Playwright often needs these flags; keep analyzer side as well.
  PLAYWRIGHT_NO_SANDBOX: process.env.PLAYWRIGHT_NO_SANDBOX ?? "1",
  // Used only by the frontend (NEXT_PUBLIC). Included here for completeness.
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  // Optional: enforce allowed protocols.
  ALLOWED_PROTOCOLS: (process.env.ALLOWED_PROTOCOLS ?? "http,https").split(",").map((s) => s.trim()),
  // Optional: if set, only allow scanning these hosts (CSV). Empty means allow all.
  ALLOW_HOSTS: (process.env.ALLOW_HOSTS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  // Optional: for more strictness; default false.
  REQUIRE_HTTP_HTTPS: process.env.REQUIRE_HTTP_HTTPS ?? "true",
  // Optional sanity limit.
  MAX_URL_LENGTH: Number(process.env.MAX_URL_LENGTH ?? "2048"),
};

// Prevent TS unused linting issues in editors.
void requireEnv;

