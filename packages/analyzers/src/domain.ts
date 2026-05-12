import { promises as dns } from "dns";
import { connect as tlsConnect } from "tls";
import type { DomainReport, SslReport } from "./types";

// ── SSL Certificate ───────────────────────────────────────────────────────────

function fetchSslInfo(hostname: string, port = 443): Promise<SslReport> {
  return new Promise((resolve) => {
    const socket = tlsConnect(
      {
        host: hostname,
        port,
        servername: hostname,         // SNI support
        rejectUnauthorized: false,    // still connect even if cert is invalid
        timeout: 10_000,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const protocol = socket.getProtocol() ?? undefined;

          if (!cert || Object.keys(cert).length === 0) {
            socket.destroy();
            resolve({ valid: false });
            return;
          }

          const validFrom = cert.valid_from
            ? new Date(cert.valid_from).toISOString()
            : undefined;

          const validTo = cert.valid_to
            ? new Date(cert.valid_to).toISOString()
            : undefined;

          let daysRemaining: number | undefined;
          if (cert.valid_to) {
            const expiry = new Date(cert.valid_to).getTime();
            const now = Date.now();
            daysRemaining = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
          }

          // issuer and subject can be objects or strings depending on Node version
          const issuer = formatCertField(cert.issuer);
          const subject = formatCertField(cert.subject);

          const isValid =
            socket.authorized === true ||
            (daysRemaining !== undefined && daysRemaining > 0);

          socket.destroy();
          resolve({
            valid: isValid,
            issuer,
            subject,
            validFrom,
            validTo,
            daysRemaining,
            protocol,
          });
        } catch {
          socket.destroy();
          resolve({ valid: false });
        }
      }
    );

    socket.on("error", () => {
      resolve({ valid: false });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ valid: false });
    });
  });
}

// cert.issuer / cert.subject can be an object like { CN: "...", O: "..." }
function formatCertField(
  field: string | Record<string, string> | undefined
): string | undefined {
  if (!field) return undefined;
  if (typeof field === "string") return field;
  // Convert { CN: "Let's Encrypt", O: "..." } → "CN=Let's Encrypt, O=..."
  return Object.entries(field)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

// ── DNS Records ───────────────────────────────────────────────────────────────

async function resolveA(hostname: string): Promise<string[]> {
  try {
    return await dns.resolve4(hostname);
  } catch {
    return [];
  }
}

async function resolveMx(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveMx(hostname);
    // Sort by priority, return exchange hostnames
    return records
      .sort((a, b) => a.priority - b.priority)
      .map((r) => `${r.exchange} (priority ${r.priority})`);
  } catch {
    return [];
  }
}

async function resolveNs(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveNs(hostname);
    return records.sort();
  } catch {
    return [];
  }
}

// ── Main Analyzer ─────────────────────────────────────────────────────────────

export async function analyzeDomain(url: string): Promise<DomainReport> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const isHttps = parsed.protocol === "https:";
  const port = parsed.port ? parseInt(parsed.port, 10) : isHttps ? 443 : 80;

  // Run DNS lookups + SSL in parallel for speed
  const [aRecords, mxRecords, nsRecords, ssl] = await Promise.all([
    resolveA(hostname),
    resolveMx(hostname),
    resolveNs(hostname),
    isHttps
      ? fetchSslInfo(hostname, port)
      : Promise.resolve<SslReport>({ valid: false }),
  ]);

  return {
    hostname,
    aRecords,
    mxRecords,
    nsRecords,
    ssl,
  };
}