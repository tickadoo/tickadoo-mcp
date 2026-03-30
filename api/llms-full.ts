import type { IncomingMessage, ServerResponse } from "node:http";
import { SERVER_VERSION } from "../src/shared/config.js";
import { buildLlmsFullTxt } from "../src/shared/llms.js";

function writePlainText(req: IncomingMessage, res: ServerResponse, body: string): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-MCP-Server-Version", SERVER_VERSION);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(body);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }

  writePlainText(req, res, buildLlmsFullTxt());
}
