import type { IncomingMessage, ServerResponse } from "node:http";
import { SERVER_VERSION } from "../src/shared/config.js";
import { createTelemetrySql } from "../src/shared/telemetry.js";
import { fetchTelemetryDashboard } from "../src/shared/telemetry-dashboard.js";
import {
  writeJson,
  writeMethodNotAllowed,
  writeReadonlyOptionsResponse,
} from "./_shared.js";

// TODO: Gate this route behind shared admin auth once the repo has one.
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    writeReadonlyOptionsResponse(res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    writeMethodNotAllowed(res);
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
