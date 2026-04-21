import type { IncomingMessage, ServerResponse } from "node:http";
import { SERVER_VERSION } from "../src/shared/config.js";
import { TELEMETRY_DASHBOARD_HTML } from "../src/shared/telemetry-dashboard.js";
import {
  writeJson,
  writeMethodNotAllowed,
  writeReadonlyOptionsResponse,
  CONTENT_SECURITY_POLICY,
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

export default function handler(req: IncomingMessage, res: ServerResponse): void {
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

  res.statusCode = 200;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("X-MCP-Server-Version", SERVER_VERSION);

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  res.end(TELEMETRY_DASHBOARD_HTML);
}
