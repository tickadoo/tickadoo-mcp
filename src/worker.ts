/**
 * Cloudflare Workers entrypoint for tickadoo MCP server (GRO-214).
 * Replaces the Vercel serverless functions in api/*.ts.
 *
 * Uses Hono for routing and the MCP SDK's WebStandardStreamableHTTPServerTransport
 * for native Workers compatibility (no Node.js shims needed).
 */
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createTickadooServer } from "./shared/server.js";
import { SERVER_VERSION, SERVER_NAME } from "./shared/config.js";
import { buildServerManifest, buildAgentCard } from "./shared/discovery.js";
import { buildLlmsTxt, buildLlmsFullTxt } from "./shared/llms.js";
import { createTelemetrySql } from "./shared/telemetry.js";
import { configureNeonConnectionString } from "./shared/neon.js";
import { AGENTX_HTML } from "./shared/agentx.js";
import { fetchTelemetryDashboard, TELEMETRY_DASHBOARD_HTML } from "./shared/telemetry-dashboard.js";

/* ---------- helpers ---------- */

const CACHE_1H = "public, max-age=3600";
const CACHE_5M = "public, max-age=300, stale-while-revalidate=300";
const CACHE_1M = "public, max-age=60, stale-while-revalidate=300";
const CACHE_NO_STORE = "no-store";

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

const app = new Hono<{ Bindings: { NEON_URL?: string } }>();

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

// TODO: Gate these admin telemetry routes behind the shared admin auth middleware once one exists in this repo.
app.get("/admin/telemetry", () =>
  textResponse(TELEMETRY_DASHBOARD_HTML, {
    contentType: "text/html; charset=utf-8",
    cache: CACHE_NO_STORE,
  })
);

app.get("/admin/telemetry.json", async (c) => {
  const sql = createTelemetrySql(c.env.NEON_URL ?? process.env.NEON_URL);
  if (!sql) {
    return jsonResponse({ error: "NEON_URL is not configured" }, { status: 500, cache: CACHE_NO_STORE });
  }

  try {
    return jsonResponse(await fetchTelemetryDashboard(sql), { cache: CACHE_NO_STORE });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500, cache: CACHE_NO_STORE },
    );
  }
});

// MCP request handler (shared by /mcp and POST /)
async function handleMcpRequest(c: any): Promise<Response> {
  const req = c.req.raw;

  // Surface the Workers env secret to the shared neon helper so graph-query
  // tools (get_related_experiences, etc.) can reach Postgres. In CF Workers,
  // process.env does NOT receive `wrangler secret put` values — only the
  // per-request env object does, hence the explicit plumbing here.
  configureNeonConnectionString(c.env?.NEON_URL);

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
  const server = createTickadooServer({
    telemetrySql: createTelemetrySql(c.env.NEON_URL ?? process.env.NEON_URL),
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

// MCP endpoint (canonical path)
app.all("/mcp", handleMcpRequest);

// Bot/crawler convenience handlers (cuts dashboard 4xx noise from indexers)
//
// robots.txt strategy: the MCP JSON-RPC endpoint at /mcp is not indexable
// (POST only, no HTML) so crawlers wouldn't get anything useful there anyway.
// But the HTML routes we DO want indexed are /agentx, /llms.txt, /llms-full.txt,
// /.well-known/mcp.json, /.well-known/agent-card.json. Previously this file
// returned a blanket Disallow: /, which silently removed tickadoo from every
// AI crawler's index — that was AgentX self-sabotage. The new policy:
// explicitly allow major AI bots, list the sitemap, and disallow only /mcp
// (which isn't meant to be crawled).
const ROBOTS_TXT = [
  "# Default — allow discovery, disallow the JSON-RPC endpoint",
  "User-agent: *",
  "Allow: /",
  "Disallow: /mcp",
  "",
  "# Sitemap",
  "Sitemap: https://mcp.tickadoo.com/sitemap.xml",
  "",
  "# AI agents — explicit welcome",
  "User-agent: GPTBot",
  "Allow: /",
  "",
  "User-agent: OAI-SearchBot",
  "Allow: /",
  "",
  "User-agent: ChatGPT-User",
  "Allow: /",
  "",
  "User-agent: ClaudeBot",
  "Allow: /",
  "",
  "User-agent: Claude-Web",
  "Allow: /",
  "",
  "User-agent: anthropic-ai",
  "Allow: /",
  "",
  "User-agent: PerplexityBot",
  "Allow: /",
  "",
  "User-agent: Perplexity-User",
  "Allow: /",
  "",
  "User-agent: Applebot-Extended",
  "Allow: /",
  "",
  "User-agent: Google-Extended",
  "Allow: /",
  "",
  "User-agent: Googlebot",
  "Allow: /",
  "",
  "User-agent: Bingbot",
  "Allow: /",
  "",
  "User-agent: Meta-ExternalAgent",
  "Allow: /",
  "",
  "User-agent: Meta-ExternalFetcher",
  "Allow: /",
  "",
  "User-agent: Amazonbot",
  "Allow: /",
  "",
  "User-agent: CCBot",
  "Allow: /",
  "",
  "User-agent: DuckAssistBot",
  "Allow: /",
  "",
  "User-agent: YouBot",
  "Allow: /",
  "",
  "User-agent: MistralAI-User",
  "Allow: /",
  "",
].join("\n") + "\n";

// OpenAI domain verification for ChatGPT Apps Directory submission.
// When Francis submits tickadoo as a ChatGPT App, OpenAI issues a verification
// token that must be served at a specific path as plain text (not JSON/HTML).
// Set OPENAI_DOMAIN_VERIFY_TOKEN as a worker secret and this route answers.
// Until the token is issued, the route 404s (identical to the default).
app.get("/.well-known/openai-domain-verify", (c: Context<{ Bindings: Env }>) => {
  const token = (c.env as Env & { OPENAI_DOMAIN_VERIFY_TOKEN?: string }).OPENAI_DOMAIN_VERIFY_TOKEN;
  if (!token) return c.text("", 404);
  return c.text(token, 200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" });
});

// Legacy path variant some OpenAI documentation references.
app.get("/openai-domain-verification.txt", (c: Context<{ Bindings: Env }>) => {
  const token = (c.env as Env & { OPENAI_DOMAIN_VERIFY_TOKEN?: string }).OPENAI_DOMAIN_VERIFY_TOKEN;
  if (!token) return c.text("", 404);
  return c.text(token, 200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" });
});

app.get("/robots.txt", () =>
  textResponse(ROBOTS_TXT, { contentType: "text/plain; charset=utf-8", cache: CACHE_1H })
);
app.get("/favicon.ico", () => new Response(null, { status: 204, headers: { "Cache-Control": CACHE_1H } }));
// Real sitemap with the indexable HTML pages on this domain.
const SITEMAP_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '  <url><loc>https://mcp.tickadoo.com/agentx</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>',
  '  <url><loc>https://mcp.tickadoo.com/llms.txt</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>',
  '  <url><loc>https://mcp.tickadoo.com/llms-full.txt</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>',
  '</urlset>',
  "",
].join("\n");
app.get("/sitemap.xml", () =>
  textResponse(SITEMAP_XML, { contentType: "application/xml; charset=utf-8", cache: CACHE_1H })
);

// AgentX playbook — thought leadership + AEO anchor for AI agents that crawl us.
app.get("/agentx", () => new Response(AGENTX_HTML, {
  status: 200,
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
    "Access-Control-Allow-Origin": "*",
    "Link": "<https://mcp.tickadoo.com/agentx>; rel=\"canonical\"",
  },
}));

// Landing page: GET serves the JSON descriptor; POST is forwarded to the MCP handler so
// legacy clients that POST JSON-RPC at the root still work without a 404.
app.get("/", () =>
  jsonResponse({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: "tickadoo MCP Server — AI-powered tools for experience discovery and booking",
    endpoint: "https://mcp.tickadoo.com/mcp",
    docs: {
      llms_txt: "https://mcp.tickadoo.com/llms.txt",
      llms_full_txt: "https://mcp.tickadoo.com/llms-full.txt",
      agentx: "https://mcp.tickadoo.com/agentx",
      github: "https://github.com/tickadoo/tickadoo-mcp",
    },
  })
);
app.post("/", handleMcpRequest);

// 404
app.all("*", () => jsonResponse({ error: "not found" }, { status: 404 }));

export default app;
