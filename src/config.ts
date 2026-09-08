export const DEFAULT_TICKADOO_MCP_URL = "https://mcp.tickadoo.com/mcp";
export const TICKADOO_MCP_URL =
  process.env.TICKADOO_MCP_URL?.trim() || DEFAULT_TICKADOO_MCP_URL;

export type TickadooLogLevel = "none" | "info" | "debug";

const rawLogLevel = (process.env.TICKADOO_LOG_LEVEL ?? "info").trim().toLowerCase();

export const TICKADOO_LOG_LEVEL: TickadooLogLevel =
  rawLogLevel === "none" || rawLogLevel === "debug" ? rawLogLevel : "info";

export const BRIDGE_NAME = "tickadoo-stdio-bridge";
export const BRIDGE_VERSION = "2.1.0";
export const BRIDGE_WEBSITE_URL = "https://mcp.tickadoo.com";
