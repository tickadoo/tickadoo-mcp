type NeonSqlResponse<Row> = {
  rows?: Row[];
  message?: string;
};

// Cloudflare Workers do not surface secrets via `process.env`. Secrets pushed
// via `wrangler secret put` or the CF API only show up on the `env` parameter
// of handlers. The worker entrypoint calls configureNeonConnectionString()
// with the per-request env.NEON_URL so graph queries can find it.
let cachedConnectionString: string | undefined;

export function configureNeonConnectionString(url: string | undefined): void {
  if (url && url.trim()) cachedConnectionString = url.trim();
}

function resolveConnectionString(): string | undefined {
  return cachedConnectionString ?? process.env.NEON_URL?.trim();
}

function getNeonEndpoint(): string {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error("NEON_URL is required for graph queries.");
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch (error) {
    throw new Error(`Invalid NEON_URL: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed.host) {
    throw new Error("NEON_URL is missing a host.");
  }

  return `https://${parsed.host}/sql`;
}

export async function neonQuery<Row>(query: string, params: unknown[] = []): Promise<Row[]> {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error("NEON_URL is required for graph queries.");
  }

  const response = await fetch(getNeonEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Neon-Connection-String": connectionString,
    },
    body: JSON.stringify({ query, params }),
  });

  const payload = await response.json() as NeonSqlResponse<Row>;
  if (!response.ok) {
    throw new Error(payload.message || `Neon query failed with status ${response.status}`);
  }

  return Array.isArray(payload.rows) ? payload.rows : [];
}
