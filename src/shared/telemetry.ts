import { neon } from "@neondatabase/serverless";

// Agent call telemetry and attribution helpers.

type HeaderValue = string | string[] | undefined;

export type SqlClient = <TRow = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<TRow[]>;

export interface TelemetryRequestInfo {
  headers: Record<string, HeaderValue>;
  url?: URL;
}

export interface TelemetryContext {
  sql: SqlClient;
  requestInfo: TelemetryRequestInfo;
  startedAt: number;
  sessionId?: string;
}

export interface TelemetryRecord {
  toolName: string;
  inputArgs: unknown;
  resultCount?: number;
  topProductIds?: string[];
  isError?: boolean;
  errorMessage?: string;
}

// Whitelist of tool input keys that are safe to persist for analytics.
// Anything outside this set is dropped before it reaches agent_calls.input_args
// so freetext fields (search `query` strings, open-ended prompts, etc.) never
// land in a Neon row that could later leak via the admin dashboard.
const ALLOWED_TELEMETRY_KEYS = new Set([
  // city / location
  "city", "country", "citySlug", "city_slug",
  "latitude", "longitude", "radius_km",
  // pagination + sort
  "max_results", "offset", "limit", "sort",
  // dates
  "dateFrom", "dateTo", "date_from", "date_to",
  // product references (slug-like identifiers, not PII)
  "slug", "product_id", "productId", "booking_path", "bookingPath",
  // filters
  "category", "tags", "audience", "setting",
  "physical_level", "physicalLevel",
  "duration_min", "duration_max", "durationMin", "durationMax",
  "min_price", "max_price", "minPrice", "maxPrice", "price_min", "price_max",
  "min_rating", "minRating",
  "languages", "language",
  "free_cancellation", "freeCancellation",
  "wheelchair", "wheelchair_accessible",
  // tool-specific knobs
  "mood", "context", "party_size", "partySize", "date",
  "ids", "slugs",
  // booking/transfer
  "from", "to",
  // formatting
  "format",
]);

const MAX_TELEMETRY_STRING_LENGTH = 120;
const MAX_TELEMETRY_ARRAY_LENGTH = 10;

function scrubTelemetryValue(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "string") {
    return value.length > MAX_TELEMETRY_STRING_LENGTH
      ? value.slice(0, MAX_TELEMETRY_STRING_LENGTH)
      : value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_TELEMETRY_ARRAY_LENGTH)
      .map(scrubTelemetryValue)
      .filter((v) => v !== undefined);
  }
  // Drop nested objects, functions, symbols, bigints, etc.
  return undefined;
}

export function scrubInputArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (!ALLOWED_TELEMETRY_KEYS.has(key)) continue;
    const scrubbed = scrubTelemetryValue(value);
    if (scrubbed !== undefined) out[key] = scrubbed;
  }
  return out;
}

const HOST_HINT_PATTERNS: Array<[RegExp, string]> = [
  [/claude/i, "claude"],
  [/anthropic/i, "claude"],
  [/chatgpt|openai/i, "chatgpt"],
  [/goose/i, "goose"],
  [/vscode|visualstudio/i, "vscode"],
  [/postman/i, "postman"],
  [/curl/i, "curl"],
];

export function createTelemetrySql(connectionString?: string | null): SqlClient | null {
  const trimmed = connectionString?.trim();
  if (!trimmed) {
    return null;
  }

  return neon(trimmed) as unknown as SqlClient;
}

function getHeaderValue(headers: Record<string, HeaderValue>, headerName: string): string | undefined {
  const wanted = headerName.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) {
      continue;
    }

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  return undefined;
}

export function inferHostHint(userAgent: string, origin: string): string {
  const combined = `${userAgent} ${origin}`;
  for (const [pattern, hint] of HOST_HINT_PATTERNS) {
    if (pattern.test(combined)) {
      return hint;
    }
  }

  return "unknown";
}

/**
 * Writes a single agent_calls row and returns the id.
 * Wrapped in try/catch so telemetry failures never degrade a user-facing response.
 */
export async function recordAgentCall(
  ctx: TelemetryContext,
  record: TelemetryRecord,
): Promise<string | null> {
  try {
    const headers = ctx.requestInfo.headers;
    const userAgent = getHeaderValue(headers, "user-agent") ?? "";
    const origin = getHeaderValue(headers, "origin") ?? "";
    const refererOrigin = (() => {
      try {
        const referer = getHeaderValue(headers, "referer");
        return referer ? new URL(referer).origin : "";
      } catch {
        return "";
      }
    })();
    const hostHint = inferHostHint(userAgent, origin || refererOrigin);
    const latencyMs = Math.max(0, Date.now() - ctx.startedAt);

    const rows = await ctx.sql<{ id: string }>`
      INSERT INTO agent_calls (
        tool_name, input_args, result_count, top_product_ids,
        request_id, session_id, host_hint, origin_host,
        latency_ms, is_error, error_message
      ) VALUES (
        ${record.toolName},
        ${JSON.stringify(scrubInputArgs(record.inputArgs))}::jsonb,
        ${record.resultCount ?? null},
        ${record.topProductIds ?? []},
        ${getHeaderValue(headers, "x-request-id") ?? null},
        ${ctx.sessionId ?? getHeaderValue(headers, "mcp-session-id") ?? null},
        ${hostHint},
        ${origin || refererOrigin || ctx.requestInfo.url?.origin || null},
        ${latencyMs},
        ${record.isError ?? false},
        ${record.errorMessage ?? null}
      )
      RETURNING id
    `;

    return rows[0]?.id ?? null;
  } catch (error) {
    console.warn("telemetry write failed", error);
    return null;
  }
}

/**
 * Extracts top product ids from a tool response's structuredContent.
 * Handles nearby payloads (results[] or experiences[]), single experience
 * payloads, and details payloads where slug sits at the top level.
 */
export function extractTopProductIds(structuredContent: unknown, n = 3): string[] {
  if (!structuredContent || typeof structuredContent !== "object") {
    return [];
  }

  const sc = structuredContent as Record<string, unknown>;
  const topLevelId = [sc.slug, sc.id, sc.product_id]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  const candidates = [
    Array.isArray(sc.results) ? sc.results : null,
    Array.isArray(sc.experiences) ? sc.experiences : null,
    sc.experience ? [sc.experience] : null,
    sc.product ? [sc.product] : null,
  ];
  const list = (candidates.find(candidate => candidate !== null) ?? []) as Array<Record<string, unknown>>;
  const ids = [
    ...(topLevelId ? [topLevelId] : []),
    ...list.map(item =>
      (typeof item.slug === "string" && item.slug)
      || (typeof item.id === "string" && item.id)
      || (typeof item.product_id === "string" && item.product_id)
      || "",
    ),
  ].filter(Boolean);

  return [...new Set(ids)].slice(0, n);
}

/**
 * Stamps agent_call_id onto a tool response's structuredContent so the widget
 * can emit utm_content back to the booking webhook for attribution.
 * Mutates both top-level _meta and per-item _meta so card and map widgets
 * both see it.
 */
export function stampAgentCallId(structuredContent: Record<string, unknown>, agentCallId: string): void {
  const currentMeta = (structuredContent._meta as Record<string, unknown>) || {};
  structuredContent._meta = { ...currentMeta, agent_call_id: agentCallId };

  const lists = [
    Array.isArray(structuredContent.results) ? structuredContent.results : null,
    Array.isArray(structuredContent.experiences) ? structuredContent.experiences : null,
  ];

  for (const list of lists) {
    if (!list) {
      continue;
    }

    for (const item of list as Array<Record<string, unknown>>) {
      const meta = (item._meta as Record<string, unknown>) || {};
      item._meta = { ...meta, agent_call_id: agentCallId };
    }
  }

  for (const key of ["experience", "product"]) {
    const value = structuredContent[key];
    if (!value || typeof value !== "object") {
      continue;
    }

    const item = value as Record<string, unknown>;
    const meta = (item._meta as Record<string, unknown>) || {};
    item._meta = { ...meta, agent_call_id: agentCallId };
  }
}
