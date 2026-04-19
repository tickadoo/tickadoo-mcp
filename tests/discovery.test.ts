import { describe, expect, it } from "vitest";

import llmsFullHandler from "../api/llms-full.js";
import wellKnownAgentCardHandler from "../api/well-known-agent-card.js";
import wellKnownMcpHandler from "../api/well-known-mcp.js";
import {
  MCP_CAPABILITY_CATEGORIES,
  MCP_PUBLIC_TOOL_COUNT,
} from "../src/shared/discovery.js";
import { SERVER_VERSION } from "../src/shared/config.js";

class MockResponse {
  statusCode = 200;
  headers = new Map<string, string>();
  body = "";
  headersSent = false;

  setHeader(name: string, value: string | number): void {
    this.headers.set(name.toLowerCase(), String(value));
  }

  writeHead(statusCode: number, headers?: Record<string, string>): this {
    this.statusCode = statusCode;
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        this.setHeader(name, value);
      }
    }
    return this;
  }

  end(chunk?: string): void {
    if (typeof chunk === "string") {
      this.body += chunk;
    }
    this.headersSent = true;
  }
}

function createRequest(method: "GET" | "HEAD" | "OPTIONS" = "GET") {
  return {
    method,
    headers: {},
  } as any;
}

describe("discovery routes", () => {
  it("serves the v1.4 registry manifest with the current public tools", async () => {
    const res = new MockResponse();

    await wellKnownMcpHandler(createRequest("GET"), res as any);

    expect(res.statusCode).toBe(200);
    expect(res.headers.get("x-mcp-server-version")).toBe(SERVER_VERSION);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");

    const payload = JSON.parse(res.body);
    expect(payload.version).toBe(SERVER_VERSION);
    expect(payload._meta["io.modelcontextprotocol.registry/publisher-provided"].tools).toHaveLength(MCP_PUBLIC_TOOL_COUNT);
    expect(payload._meta["io.modelcontextprotocol.registry/publisher-provided"].tools.map((tool: { name: string }) => tool.name)).toEqual(
      expect.arrayContaining([
        "search_experiences",
        "search_by_mood",
        "get_last_minute",
        "find_nearby_experiences",
        "check_availability",
        "get_related_experiences",
        "get_travel_tips",
        "get_transfer_info",
        "whats_on_tonight",
      ]),
    );
  });

  it("serves the agent card with the full capabilities list", async () => {
    const res = new MockResponse();

    await wellKnownAgentCardHandler(createRequest("GET"), res as any);

    expect(res.statusCode).toBe(200);
    expect(res.headers.get("x-mcp-server-version")).toBe(SERVER_VERSION);

    const payload = JSON.parse(res.body);
    expect(payload.version).toBe(SERVER_VERSION);
    expect(payload.capabilities.supported).toEqual([...MCP_CAPABILITY_CATEGORIES]);
    expect(payload.skills.map((skill: { id: string }) => skill.id)).toEqual([...MCP_CAPABILITY_CATEGORIES]);
  });

  it("adds the MCP server version header to llms-full responses", async () => {
    const res = new MockResponse();

    await llmsFullHandler(createRequest("GET"), res as any);

    expect(res.statusCode).toBe(200);
    expect(res.headers.get("x-mcp-server-version")).toBe(SERVER_VERSION);
    expect(res.body).toContain(`Tool count: ${MCP_PUBLIC_TOOL_COUNT}`);
  });
});
