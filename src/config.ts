export const DEFAULT_TICKADOO_MCP_URL = "https://mcp.tickadoo.com/mcp";
export const TICKADOO_MCP_URL =
  process.env.TICKADOO_MCP_URL?.trim() || DEFAULT_TICKADOO_MCP_URL;

export type TickadooLogLevel = "none" | "info" | "debug";

const rawLogLevel = (process.env.TICKADOO_LOG_LEVEL ?? "info").trim().toLowerCase();

export const TICKADOO_LOG_LEVEL: TickadooLogLevel =
  rawLogLevel === "none" || rawLogLevel === "debug" ? rawLogLevel : "info";

const ELICITATION_ON = new Set(["1", "true", "yes", "on"]);

/** Default off. Accepts 1, true, yes, or on. No other value enables elicitation. */
export function readElicitationFlag(value: string | undefined): boolean {
  if (value === undefined) return false;
  return ELICITATION_ON.has(value.trim().toLowerCase());
}

export const TICKADOO_ELICITATION = readElicitationFlag(process.env.TICKADOO_ELICITATION);

export const BRIDGE_NAME = "tickadoo-stdio-bridge";
export const BRIDGE_VERSION = "2.2.0";
export const BRIDGE_WEBSITE_URL = "https://mcp.tickadoo.com";
