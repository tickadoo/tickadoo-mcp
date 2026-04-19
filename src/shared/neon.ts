type NeonSqlResponse<Row> = {
  rows?: Row[];
  message?: string;
};

function getNeonEndpoint(): string {
  const connectionString = process.env.NEON_URL?.trim();
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
  const connectionString = process.env.NEON_URL?.trim();
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
