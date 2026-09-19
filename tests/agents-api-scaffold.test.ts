import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MISSING_CREDENTIAL_GUIDANCE,
  MissingAgentsCredentialError,
  SMOKE_INPUT,
  SMOKE_INSTRUCTIONS,
  TICKADOO_BOOKING_HOST,
  TICKADOO_MCP_TOOL,
  TICKADOO_MCP_URL,
  collectEventText,
  extractBookingUrl,
  isTickadooBookingUrl,
  requireOpenAIApiKey,
} from "../examples/agents-api-tickadoo-smoke.js";

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
    expect(extractBookingUrl("Book at https://www.tickadoo.com/london/lion-king.")).toBe(
      "https://www.tickadoo.com/london/lion-king",
    );
    expect(extractBookingUrl("https://evil.example/?q=www.tickadoo.com/london")).toBeUndefined();
    expect(extractBookingUrl("https://www.tickadoo.com.evil.example/x")).toBeUndefined();
    expect(extractBookingUrl("http://www.tickadoo.com/london/lion-king")).toBeUndefined();
    expect(extractBookingUrl("no link here")).toBeUndefined();
    expect(isTickadooBookingUrl("https://www.tickadoo.com/x")).toBe(true);
    expect(isTickadooBookingUrl("https://not-tickadoo.example/www.tickadoo.com")).toBe(false);
  });

  it("only accepts booking URLs from assistant final-answer text", () => {
    const toolOnlyEvent = {
      type: "agent.session.turn.item.done",
      item: {
        type: "mcp_call",
        server_label: "tickadoo",
        status: "completed",
        output: "https://www.tickadoo.com/tool-only",
      },
    };
    expect(collectEventText(toolOnlyEvent)).toBe("");

    const assistantFinalEvent = {
      type: "agent.session.turn.item.done",
      item: {
        type: "message",
        role: "assistant",
        phase: "final_answer",
        content: [
          {
            type: "output_text",
            text: "Book at https://www.tickadoo.com/london/lion-king",
          },
        ],
      },
    };
    expect(extractBookingUrl(collectEventText(assistantFinalEvent))).toBe(
      "https://www.tickadoo.com/london/lion-king",
    );
  });

  it("fails clearly when the Agents API credential is missing", () => {
    expect(() => requireOpenAIApiKey({})).toThrow(MissingAgentsCredentialError);
    expect(() => requireOpenAIApiKey({})).toThrow(MISSING_CREDENTIAL_GUIDANCE);
    expect(MISSING_CREDENTIAL_GUIDANCE).toContain(
      "Francis/Mark must add OPENAI_API_KEY to tickadoo-mcp repo secrets",
    );
    expect(MISSING_CREDENTIAL_GUIDANCE).toContain("Do not reuse Cloudflare ads keys");
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
    expect(doc).toContain("CI/dev-only");
    expect(doc).toContain("npm install --omit=dev");
    expect(doc).toContain("push");
    expect(doc).toContain("workflow_dispatch");
    expect(doc).toContain("does **not** run automatically on pull requests");
    expect(doc).toContain("Do not use `pull_request_target`");
    expect(doc).not.toMatch(/server_url": "https:\/\/mcp\.tickadoo\.com"/);

    expect(workflow).toContain("secrets.OPENAI_API_KEY");
    expect(workflow).toContain("Francis/Mark must add OPENAI_API_KEY");
    expect(workflow).toContain("Do not invent keys");
    expect(workflow).toContain("npm run smoke:agents-api");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).not.toMatch(/^on:\s*\n(?:.*\n)*?  pull_request:/m);
    expect(workflow).not.toContain("pull_request_target");

    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.devDependencies?.openai).toBeTruthy();
    expect(pkg.dependencies?.openai).toBeUndefined();

    const smoke = await readFile(
      path.join(root, "examples/agents-api-tickadoo-smoke.ts"),
      "utf8",
    );
    expect(smoke).toContain("iterPages()");
    expect(smoke).toContain("hasNextPage()");
    expect(smoke).toContain("pagination incomplete");

    expect(readme).toContain("docs/openai-agents-api.md");
  });
});
