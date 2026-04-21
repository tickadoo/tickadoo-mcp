import { neon } from "@neondatabase/serverless";

// Per-request Neon client used by graph-query tools (get_related_experiences).
// Cloudflare Workers do not surface secrets via `process.env` — secrets pushed
// via `wrangler secret put` only appear on the handler's `env` argument. The
// Worker entrypoint constructs a client from `env.NEON_URL` and plumbs it
// through `createTickadooServer({ neonClient })` on every request, so there
// is no module-level mutable state and no risk of one request's connection
// string leaking into another's.
//
// The official `neon()` tagged-template client handles Postgres auth over
// HTTPS internally (SNI + bearer-style auth on the Neon compute endpoint).
// Do NOT reimplement the HTTP protocol — a prior custom wrapper leaked the
// connection string (password included) as a request header.

export type NeonClient = <Row = Record<string, unknown>>(
  query: string,
  params?: unknown[],
) => Promise<Row[]>;

export function createNeonClient(url: string | null | undefined): NeonClient | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    // Fail-fast URL sanity check before we hand the string to the driver.
    // Any parse error is surfaced as a generic message so tool responses
    // don't echo internal URL structure back to callers.
    new URL(trimmed);
  } catch {
    throw new Error("Database configuration error.");
  }

  const sql = neon(trimmed);
  return async <Row = Record<string, unknown>>(
    query: string,
    params: unknown[] = [],
  ): Promise<Row[]> => {
    const rows = await sql.query(query, params);
    return (Array.isArray(rows) ? rows : []) as Row[];
  };
}
