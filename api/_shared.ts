import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let serverManifest: Record<string, any>;
try {
  const manifestPath = resolve(__dirname, "..", "server.json");
  serverManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
} catch {
  serverManifest = { version: "1.2.0", remotes: [{ type: "streamable-http", url: "https://mcp.tickadoo.com/mcp" }], _meta: { "io.modelcontextprotocol.registry/publisher-provided": { license: "MIT", tools: [{ name: "search_experiences", description: "Search for bookable experiences in any city with optional date filtering" }, { name: "find_nearby_experiences", description: "Find experiences near coordinates with optional date filtering" }, { name: "list_cities", description: "List all 700+ supported cities" }, { name: "get_experience_details", description: "Get detailed info for a specific experience" }] } } };
}

export const CONTENT_SECURITY_POLICY = "default-src 'none'; connect-src https://api.tickadoo.com https://content.tickadoo.com https://www.tickadoo.com";
export const RESPONSE_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
export const DISCOVERY_CACHE_CONTROL = "public, max-age=3600";

const discoveryTools = serverManifest._meta?.["io.modelcontextprotocol.registry/publisher-provided"]?.tools ?? [];
const primaryRemote = serverManifest.remotes?.find((remote: any) => remote.type === "streamable-http") ?? serverManifest.remotes?.[0];

export function buildHealthPayload() {
  return {
    status: "ok",
    version: serverManifest.version,
    uptime: "running",
    tools: discoveryTools.length,
    transport: primaryRemote?.type ?? "streamable-http",
    endpoint: primaryRemote?.url ?? "",
  };
}

export function writeJson(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  options?: { cacheControl?: string; statusCode?: number },
): void {
  res.statusCode = options?.statusCode ?? 200;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", options?.cacheControl ?? RESPONSE_CACHE_CONTROL);

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  res.end(JSON.stringify(body));
}

export function writeReadonlyOptionsResponse(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.writeHead(204);
  res.end();
}

export function writeMethodNotAllowed(res: ServerResponse): void {
  res.statusCode = 405;
  res.setHeader("Allow", "GET, HEAD, OPTIONS");
  res.end("Method Not Allowed");
}

export function getServerManifest() {
  return serverManifest;
}
