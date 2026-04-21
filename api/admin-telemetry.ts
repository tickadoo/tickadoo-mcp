import type { IncomingMessage, ServerResponse } from "node:http";
import { SERVER_VERSION } from "../src/shared/config.js";
import { createTelemetrySql } from "../src/shared/telemetry.js";
import { fetchTelemetryDashboard } from "../src/shared/telemetry-dashboard.js";
import {
  writeJson,
  writeMethodNotAllowed,
  writeReadonlyOptionsResponse,
} from "./_shared.js";

function isAuthorized(req: IncomingMessage): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const raw = req.headers.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = match[1];
  if (provided.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < provided.length; i++) {
    result |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    writeReadonlyOptionsResponse(res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    writeMethodNotAllowed(res);
    return;
  }

  if (!process.env.ADMIN_TOKEN) {
    writeJson(req, res, { error: "admin auth is not configured" }, { cacheControl: "no-store", statusCode: 503 });
    return;
  }

  if (!isAuthorized(req)) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="tickadoo-admin"');
    writeJson(req, res, { error: "unauthorized" }, { cacheControl: "no-store", statusCode: 401 });
    return;
  }

  const sql = createTelemetrySql(process.env.NEON_URL);
  if (!sql) {
    writeJson(req, res, { error: "NEON_URL is not configured" }, { cacheControl: "no-store", statusCode: 500 });
    return;
  }

  try {
    writeJson(req, res, await fetchTelemetryDashboard(sql), { cacheControl: "no-store" });
  } catch (error) {
    res.setHeader("X-MCP-Server-Version", SERVER_VERSION);
    writeJson(
      req,
      res,
      { error: error instanceof Error ? error.message : String(error) },
      { cacheControl: "no-store", statusCode: 500 },
    );
  }
}
