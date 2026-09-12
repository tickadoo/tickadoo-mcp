import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BOOKING_URL_PATTERN,
  MISSING_OPENAI_API_KEY_MESSAGE,
  SMOKE_INPUT,
  SMOKE_INSTRUCTIONS,
  TICKADOO_BOOKING_HOST,
  TICKADOO_MCP_TOOL,
  TICKADOO_MCP_URL,
  extractBookingUrl,
  requireOpenAIApiKey,
} from "../examples/agents-api-tickadoo-smoke.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("OpenAI Agents API → tickadoo MCP scaffold", () => {
  it("pins the /mcp Streamable HTTP URL and service-origin tool", () => {
    expect(TICKADOO_MCP_URL).toBe("https://mcp.tickadoo.com/mcp");
    expect(TICKADOO_MCP_TOOL).toEqual({
      type: "mcp",
      server_label: "tickadoo",
      transport: {
        type: "http",
        server_url: "https://mcp.tickadoo.com/mcp",
      },
      connection_origin: "service",
      required: true,
    });
    expect(JSON.stringify(TICKADOO_MCP_TOOL)).not.toContain('"https://mcp.tickadoo.com"');
    expect(JSON.stringify(TICKADOO_MCP_TOOL)).not.toMatch(/payment|checkout|card/i);
  });

  it("steers the smoke toward a Lion King London booking_url and no payment tool", () => {
    expect(SMOKE_INSTRUCTIONS).toMatch(/Lion King/);
    expect(SMOKE_INSTRUCTIONS).toMatch(/London/);
    expect(SMOKE_INSTRUCTIONS).toMatch(TICKADOO_BOOKING_HOST);
    expect(SMOKE_INSTRUCTIONS).toMatch(/Do not collect payment/);
    expect(SMOKE_INPUT).toMatch(/Lion King/);
    expect(SMOKE_INPUT).toMatch(/London/);
    expect(SMOKE_INPUT).toMatch(/booking_url/);
    expect(extractBookingUrl("See https://www.tickadoo.com/london/lion-king")).toBe(
      "https://www.tickadoo.com/london/lion-king",
    );
    expect(extractBookingUrl("no link here")).toBeUndefined();
    expect(BOOKING_URL_PATTERN.test("https://www.tickadoo.com/x")).toBe(true);
  });

  it("fails clearly when OPENAI_API_KEY is missing", () => {
    expect(() => requireOpenAIApiKey({})).toThrow(MISSING_OPENAI_API_KEY_MESSAGE);
    expect(MISSING_OPENAI_API_KEY_MESSAGE).toContain(
      "Francis/Mark must add OPENAI_API_KEY to tickadoo-mcp repo secrets",
    );
    expect(MISSING_OPENAI_API_KEY_MESSAGE).toContain("Do not reuse Cloudflare ads keys");
    expect(requireOpenAIApiKey({ OPENAI_API_KEY: " test-key " })).toBe("test-key");
  });

  it("documents the /mcp correction, beta header, and CI secret requirement", async () => {
    const doc = await readFile(path.join(root, "docs/openai-agents-api.md"), "utf8");
    const workflow = await readFile(
      path.join(root, ".github/workflows/agents-api-smoke.yml"),
      "utf8",
    );
    const readme = await readFile(path.join(root, "README.md"), "utf8");

    expect(doc).toContain('"server_url": "https://mcp.tickadoo.com/mcp"');
    expect(doc).toContain('"connection_origin": "service"');
    expect(doc).toContain('"required": true');
    expect(doc).toContain("OpenAI-Beta: agents=v1");
    expect(doc).toMatch(/openai.*≥ 7\.15\.0|openai-node.*v7\.15\.0/i);
    expect(doc).toContain("404");
    expect(doc).toContain("https://mcp.tickadoo.com/mcp");
    expect(doc).toContain("npm run smoke:agents-api");
    expect(doc).not.toMatch(/server_url": "https:\/\/mcp\.tickadoo\.com"/);

    expect(workflow).toContain("secrets.OPENAI_API_KEY");
    expect(workflow).toContain("Francis/Mark must add OPENAI_API_KEY");
    expect(workflow).toContain("Do not invent keys");
    expect(workflow).toContain("npm run smoke:agents-api");

    expect(readme).toContain("docs/openai-agents-api.md");
  });
});
