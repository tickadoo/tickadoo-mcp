export const API_BASE = process.env.TICKADOO_API_BASE ?? "https://api.tickadoo.com";
export const SITE = process.env.TICKADOO_SITE_BASE ?? "https://www.tickadoo.com";
export const MCP_BASE_URL = process.env.TICKADOO_MCP_BASE ?? "https://mcp.tickadoo.com";
export const MCP_ENDPOINT_URL = `${MCP_BASE_URL}/mcp`;
export const MCP_API_TOKEN = process.env.TICKADOO_MCP_API_TOKEN ?? "";
export const MCP_PRODUCTS_ENDPOINT = "/integrations-api/v1.0/mcp/products";
export const PRODUCT_FEED_URL = "https://content.tickadoo.com/openai/ProductFeed.jsonl.gz";
export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGE_CODES = [
  "en",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "pl",
  "cs",
  "nl",
  "da",
  "sv",
  "no",
  "zh",
  "ja",
  "hi",
  "ar",
  "tr",
  "ko",
  "he",
  "fi",
  "ru",
  "el",
  "hu",
  "th",
  "vi",
  "uk",
  "es-mx",
  "pt-br",
  "ur",
  "bn",
  "fa",
  "tl",
  "ms",
  "ca",
  "is",
  "id",
  "ta",
  "pa-in",
  "gu",
  "zh-hant-hk",
  "yue",
  "bg",
  "ro",
  "hr",
] as const;
export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];
export const SUPPORTED_LANGUAGE_CODE_SET = new Set<string>(SUPPORTED_LANGUAGE_CODES);
export const DEFAULT_TICKADOO_UTM_PARAMS = "utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp";
export const TICKADOO_UTM_PARAMS = (process.env.TICKADOO_UTM_PARAMS ?? DEFAULT_TICKADOO_UTM_PARAMS)
  .trim()
  .replace(/^[?&]+/, "");
export type TickadooLogLevel = "none" | "info" | "debug";
const RAW_TICKADOO_LOG_LEVEL = (process.env.TICKADOO_LOG_LEVEL ?? "info").trim().toLowerCase();
export const TICKADOO_LOG_LEVEL: TickadooLogLevel = RAW_TICKADOO_LOG_LEVEL === "none"
  || RAW_TICKADOO_LOG_LEVEL === "debug"
  ? RAW_TICKADOO_LOG_LEVEL
  : "info";

export const SERVER_NAME = "tickadoo";
export const SERVER_VERSION = "1.2.0";
export const SERVER_DESCRIPTION = "tickadoo® — Discover and book theatre, events & experiences in 680+ cities worldwide.";

export const REQUEST_TIMEOUT_MS = 10_000;
export const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
export const MAX_API_ATTEMPTS = 2;
export const DETAIL_DATE_PREVIEW_LIMIT = 14;
export const SEARCH_PAGE_CACHE_TTL_MS = 5 * 60_000;
