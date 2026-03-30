import type { IncomingMessage, ServerResponse } from "node:http";
import { SERVER_VERSION } from "../src/shared/config.js";
import { buildServerManifest } from "../src/shared/discovery.js";

const serverManifest = buildServerManifest() as any;

export const CONTENT_SECURITY_POLICY = "default-src 'none'; connect-src https://api.tickadoo.com https://content.tickadoo.com https://www.tickadoo.com";
export const RESPONSE_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
export const DISCOVERY_CACHE_CONTROL = "public, max-age=3600";

const discoveryTools = serverManifest._meta?.["io.modelcontextprotocol.registry/publisher-provided"]?.tools ?? [];
const primaryRemote = serverManifest.remotes?.find((remote: { type?: string }) => remote.type === "streamable-http") ?? serverManifest.remotes?.[0];

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
  res.setHeader("X-MCP-Server-Version", SERVER_VERSION);

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
  res.setHeader("X-MCP-Server-Version", SERVER_VERSION);
  res.writeHead(204);
  res.end();
}

export function writeMethodNotAllowed(res: ServerResponse): void {
  res.statusCode = 405;
  res.setHeader("Allow", "GET, HEAD, OPTIONS");
  res.setHeader("X-MCP-Server-Version", SERVER_VERSION);
  res.end("Method Not Allowed");
}

export function getServerManifest() {
  return serverManifest;
}
