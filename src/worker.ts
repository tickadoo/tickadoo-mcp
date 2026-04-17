/**
 * Cloudflare Workers entrypoint for tickadoo MCP server (GRO-214).
 * Replaces the Vercel serverless functions in api/*.ts.
 *
 * Uses Hono for routing and the MCP SDK's WebStandardStreamableHTTPServerTransport
 * for native Workers compatibility (no Node.js shims needed).
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createTickadooServer } from "./shared/server.js";
import { SERVER_VERSION, SERVER_NAME } from "./shared/config.js";
import { buildServerManifest, buildAgentCard } from "./shared/discovery.js";
import { buildLlmsTxt, buildLlmsFullTxt } from "./shared/llms.js";

/* ---------- helpers ---------- */

const CACHE_1H = "public, max-age=3600";
const CACHE_5M = "public, max-age=300, stale-while-revalidate=300";
const CACHE_1M = "public, max-age=60, stale-while-revalidate=300";

function jsonResponse(data: unknown, opts?: { status?: number; cache?: string }) {
  return new Response(JSON.stringify(data), {
    status: opts?.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": opts?.cache ?? CACHE_1M,
      "X-MCP-Server-Version": SERVER_VERSION,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function textResponse(body: string, opts?: { contentType?: string; cache?: string }) {
  return new Response(body, {
    headers: {
      "Content-Type": opts?.contentType ?? "text/plain; charset=utf-8",
      "Cache-Control": opts?.cache ?? CACHE_5M,
      "X-MCP-Server-Version": SERVER_VERSION,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function buildHealthPayload() {
  const manifest = buildServerManifest() as Record<string, unknown>;
  const meta = manifest._meta as Record<string, unknown> | undefined;
  const pub = meta?.["io.modelcontextprotocol.registry/publisher-provided"] as Record<string, unknown> | undefined;
  const tools = (pub?.tools as unknown[]) ?? [];
  const remotes = (manifest.remotes as Array<{ type?: string; url?: string }>) ?? [];
  const primary = remotes.find((r) => r.type === "streamable-http") ?? remotes[0];
  return {
    status: "ok",
    version: (manifest.version as string) ?? SERVER_VERSION,
    uptime: "running",
    tools: tools.length,
    transport: primary?.type ?? "streamable-http",
    endpoint: primary?.url ?? "",
  };
}

/* ---------- Hono app ---------- */

const app = new Hono();

app.use("*", cors({ origin: "*" }));

// Health
app.get("/health", (c) => c.json(buildHealthPayload()));

// llms.txt
app.get("/llms.txt", () => textResponse(buildLlmsTxt(), { cache: CACHE_5M }));

// llms-full.txt
app.get("/llms-full.txt", () => textResponse(buildLlmsFullTxt(), { cache: CACHE_5M }));

// .well-known/mcp.json
app.get("/.well-known/mcp.json", () => jsonResponse(buildServerManifest(), { cache: CACHE_1H }));

// .well-known/agent-card.json
app.get("/.well-known/agent-card.json", () => jsonResponse(buildAgentCard(), { cache: CACHE_1H }));

// MCP endpoint
app.all("/mcp", async (c) => {
  const req = c.req.raw;

  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
        "Access-Control-Allow-Headers": "*",
        "X-MCP-Server-Version": SERVER_VERSION,
      },
    });
  }

  // GET without SSE accept -> health
  const accept = req.headers.get("accept") ?? "";
  if ((req.method === "GET" || req.method === "HEAD") && !accept.includes("text/event-stream")) {
    return jsonResponse(buildHealthPayload());
  }

  // MCP transport (stateless, JSON response mode)
  const server = createTickadooServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
});

// Landing page (root) - simplified JSON for now; full HTML ported in Phase 2
app.get("/", () =>
  jsonResponse({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: "tickadoo MCP Server — 14 AI-powered tools for experience discovery and booking",
    endpoint: "https://mcp.tickadoo.com/mcp",
    docs: {
      llms_txt: "https://mcp.tickadoo.com/llms.txt",
      llms_full_txt: "https://mcp.tickadoo.com/llms-full.txt",
      github: "https://github.com/tickadoo/tickadoo-mcp",
    },
  })
);

// 404
app.all("*", () => jsonResponse({ error: "not found" }, { status: 404 }));

export default app;
