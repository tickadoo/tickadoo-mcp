import { describe, expect, it } from "vitest";
import app from "../src/worker.js";
import {
  MCP_CAPABILITY_CATEGORIES,
  MCP_PUBLIC_TOOL_COUNT,
} from "../src/shared/discovery.js";
import { SERVER_VERSION } from "../src/shared/config.js";

describe("discovery routes (Worker)", () => {
  it("serves the registry manifest at /.well-known/mcp.json with the current public tools", async () => {
    const res = await app.request("/.well-known/mcp.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("x-mcp-server-version")).toBe(SERVER_VERSION);
    expect(res.headers.get("content-type") ?? "").toContain("application/json");

    const payload = (await res.json()) as {
      version: string;
      _meta: {
        "io.modelcontextprotocol.registry/publisher-provided": {
          tools: Array<{ name: string }>;
        };
      };
    };
    expect(payload.version).toBe(SERVER_VERSION);
    const tools = payload._meta["io.modelcontextprotocol.registry/publisher-provided"].tools;
    expect(tools).toHaveLength(MCP_PUBLIC_TOOL_COUNT);
    expect(tools.map((tool) => tool.name)).toEqual(
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

  it("serves the agent card at /.well-known/agent-card.json with the full capabilities list", async () => {
    const res = await app.request("/.well-known/agent-card.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("x-mcp-server-version")).toBe(SERVER_VERSION);

    const payload = (await res.json()) as {
      version: string;
      capabilities: { supported: string[] };
      skills: Array<{ id: string }>;
    };
    expect(payload.version).toBe(SERVER_VERSION);
    expect(payload.capabilities.supported).toEqual([...MCP_CAPABILITY_CATEGORIES]);
    expect(payload.skills.map((skill) => skill.id)).toEqual([...MCP_CAPABILITY_CATEGORIES]);
  });

  it("stamps the MCP server version header on /llms-full.txt and includes the tool count", async () => {
    const res = await app.request("/llms-full.txt");

    expect(res.status).toBe(200);
    expect(res.headers.get("x-mcp-server-version")).toBe(SERVER_VERSION);
    const body = await res.text();
    expect(body).toContain(`Tool count: ${MCP_PUBLIC_TOOL_COUNT}`);
  });

  it("/llms.txt also advertises the correct tool count", async () => {
    const res = await app.request("/llms.txt");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(`Tool count: ${MCP_PUBLIC_TOOL_COUNT}`);
  });
});
