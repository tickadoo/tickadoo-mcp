export const API_BASE = process.env.TICKADOO_API_BASE ?? "https://api.tickadoo.com";
export const SITE = process.env.TICKADOO_SITE_BASE ?? "https://www.tickadoo.com";
export const MCP_BASE_URL = process.env.TICKADOO_MCP_BASE ?? "https://mcp.tickadoo.com";
export const MCP_ENDPOINT_URL = `${MCP_BASE_URL}/mcp`;
export const PRODUCT_FEED_URL = "https://content.tickadoo.com/openai/ProductFeed.jsonl.gz";

export const SERVER_NAME = "tickadoo";
export const SERVER_VERSION = "1.1.0";
export const SERVER_DESCRIPTION = "tickadoo® — Discover and book theatre, events & experiences in 700+ cities worldwide.";

export const REQUEST_TIMEOUT_MS = 10_000;
export const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
export const MAX_API_ATTEMPTS = 2;
export const DETAIL_DATE_PREVIEW_LIMIT = 14;
export const SEARCH_PAGE_CACHE_TTL_MS = 5 * 60_000;
