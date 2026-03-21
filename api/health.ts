import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buildHealthPayload,
  writeJson,
  writeMethodNotAllowed,
  writeReadonlyOptionsResponse,
} from "./_shared.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    writeReadonlyOptionsResponse(res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    writeMethodNotAllowed(res);
    return;
  }

  writeJson(req, res, buildHealthPayload());
}
