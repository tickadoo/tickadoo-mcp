import type { IncomingMessage, ServerResponse } from "node:http";
import { SERVER_VERSION } from "../src/shared/config.js";
import { TELEMETRY_DASHBOARD_HTML } from "../src/shared/telemetry-dashboard.js";
import { writeMethodNotAllowed, writeReadonlyOptionsResponse } from "./_shared.js";

// TODO: Gate this route behind shared admin auth once the repo has one.
export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === "OPTIONS") {
    writeReadonlyOptionsResponse(res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    writeMethodNotAllowed(res);
    return;
  }

  res.statusCode = 200;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-MCP-Server-Version", SERVER_VERSION);

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  res.end(TELEMETRY_DASHBOARD_HTML);
}
