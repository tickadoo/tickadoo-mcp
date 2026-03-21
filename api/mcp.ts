import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { MCP_ENDPOINT_URL, SERVER_NAME, SERVER_VERSION } from "../src/shared/config.js";
import { createTickadooServer } from "../src/shared/server.js";

type BodyCapableRequest = IncomingMessage & { body?: unknown };
const CONTENT_SECURITY_POLICY = "default-src 'none'; connect-src https://api.tickadoo.com https://content.tickadoo.com https://www.tickadoo.com";
const RESPONSE_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

function writeHealthResponse(req: IncomingMessage, res: ServerResponse): void {
  const body = JSON.stringify({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    status: "ok",
    endpoint: MCP_ENDPOINT_URL,
    transport: "streamable-http",
  });

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", RESPONSE_CACHE_CONTROL);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(body);
}

function parseBody(req: BodyCapableRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) {
      resolve(req.body);
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("Cache-Control", RESPONSE_CACHE_CONTROL);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const accept = req.headers.accept ?? "";
  if ((req.method === "GET" || req.method === "HEAD") && !accept.includes("text/event-stream")) {
    writeHealthResponse(req, res);
    return;
  }

  const server = createTickadooServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close().catch(() => undefined);
  });

  await server.connect(transport);
  const body = await parseBody(req as BodyCapableRequest);
  await transport.handleRequest(req, res, body);
}
