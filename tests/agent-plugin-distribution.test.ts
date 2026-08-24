import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("Agent Plugin distribution", () => {
  it("ships the portable package and client adapters in the npm tarball", () => {
    const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: root,
      encoding: "utf8",
    });
    const report = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>;
    const packed = new Set(report[0].files.map((file) => file.path));
    for (const required of [
      "plugin.json",
      "mcp.json",
      ".codex-plugin/plugin.json",
      ".claude-plugin/plugin.json",
      ".mcp.json",
      "clients/github-copilot/mcp.json",
      "evals/agent-plugin-scenarios.json",
      "schemas/agent-plugins/1.0.0/plugin.schema.json",
      "schemas/agent-plugins/1.0.0/mcp.schema.json",
    ]) {
      expect(packed.has(required), `${required} must be published`).toBe(true);
    }
    expect([...packed].filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file))).toHaveLength(7);
  });

  it("ships a least-privilege GitHub Copilot cloud adapter", async () => {
    const adapter = JSON.parse(
      await readFile(path.join(root, "clients/github-copilot/mcp.json"), "utf8"),
    ) as {
      mcpServers: Record<
        string,
        { type: string; url: string; tools: string[]; headers?: unknown; env?: unknown }
      >;
    };
    const portable = JSON.parse(await readFile(path.join(root, "mcp.json"), "utf8")) as {
      mcpServers: Record<string, { url: string }>;
    };
    const registry = JSON.parse(await readFile(path.join(root, "server.json"), "utf8")) as {
      _meta: {
        "io.modelcontextprotocol.registry/publisher-provided": {
          tools: Array<{
            name: string;
            annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
          }>;
        };
      };
    };

    expect(Object.keys(adapter.mcpServers)).toEqual(["tickadoo"]);
    const server = adapter.mcpServers.tickadoo;
    expect(server.type).toBe("http");
    expect(server.url).toBe(portable.mcpServers.tickadoo.url);
    expect(server.tools.length).toBeGreaterThan(0);
    expect(new Set(server.tools).size).toBe(server.tools.length);
    expect(server.tools).not.toContain("*");
    expect(server).not.toHaveProperty("headers");
    expect(server).not.toHaveProperty("env");
    expect(JSON.stringify(adapter)).not.toMatch(/authorization|bearer|token|secret|password|api[_-]?key|cf-access/i);

    const metadata = new Map(
      registry._meta["io.modelcontextprotocol.registry/publisher-provided"].tools.map((tool) => [tool.name, tool]),
    );
    for (const toolName of server.tools) {
      const tool = metadata.get(toolName);
      expect(tool, `unknown Copilot tool ${toolName}`).toBeDefined();
      expect(tool?.annotations?.readOnlyHint, `${toolName}: readOnlyHint`).toBe(true);
      expect(tool?.annotations?.destructiveHint, `${toolName}: destructiveHint`).toBe(false);
    }
    expect(server.tools).not.toContain("report_quality_signal");
    expect(server.tools).not.toContain("render_experience_cards");
  });

  it("keeps provider-neutral scenarios closed over shipped skills and live tool metadata", async () => {
    const corpus = JSON.parse(await readFile(path.join(root, "evals/agent-plugin-scenarios.json"), "utf8")) as {
      version: unknown;
      description: unknown;
      scenarios: Array<{
        id: string;
        kind: "positive" | "negative";
        prompt: string;
        expectedSkill: string;
        requiredTools: string[];
        requirements: string[];
        fixture?: string;
        expectedResultShape?: string;
        expectedSafeBehavior?: string;
        rationale?: string;
      }>;
    };
    const server = JSON.parse(await readFile(path.join(root, "server.json"), "utf8")) as {
      description: string;
      _meta: {
        "io.modelcontextprotocol.registry/publisher-provided": {
          tools: Array<{
            name: string;
            title?: string;
            annotations?: {
              title?: string;
              readOnlyHint?: boolean;
              destructiveHint?: boolean;
              idempotentHint?: boolean;
              openWorldHint?: boolean;
            };
          }>;
        };
      };
    };
    expect(server.description.length).toBeLessThanOrEqual(100);
    const registryTools = server._meta["io.modelcontextprotocol.registry/publisher-provided"].tools;
    const knownTools = new Set(registryTools.map((tool) => tool.name));
    for (const tool of registryTools) {
      expect(tool.title?.length, `${tool.name}: registry title`).toBeGreaterThan(0);
      expect(tool.annotations?.title, `${tool.name}: annotation title`).toBe(tool.title);
      expect(typeof tool.annotations?.readOnlyHint, `${tool.name}: readOnlyHint`).toBe("boolean");
      expect(typeof tool.annotations?.destructiveHint, `${tool.name}: destructiveHint`).toBe("boolean");
      expect(typeof tool.annotations?.idempotentHint, `${tool.name}: idempotentHint`).toBe("boolean");
      expect(typeof tool.annotations?.openWorldHint, `${tool.name}: openWorldHint`).toBe("boolean");
    }
    expect(registryTools.find((tool) => tool.name === "report_quality_signal")?.annotations?.readOnlyHint).toBe(false);
    expect(
      registryTools
        .filter((tool) => tool.name !== "report_quality_signal")
        .every((tool) => tool.annotations?.readOnlyHint === true),
    ).toBe(true);
    const skillDirectories = new Set(
      [
        "compare-before-you-book",
        "date-night",
        "family-day-out",
        "near-a-landmark",
        "plan-a-trip",
        "tickadoo-experiences",
        "tonight-and-last-minute",
      ],
    );
    expect(corpus.version).toBe("1.1.0");
    expect(typeof corpus.description).toBe("string");
    expect(Array.isArray(corpus.scenarios)).toBe(true);
    expect(corpus.scenarios).toHaveLength(12);
    expect(corpus.scenarios.filter((scenario) => scenario.kind === "positive")).toHaveLength(9);
    expect(corpus.scenarios.filter((scenario) => scenario.kind === "negative")).toHaveLength(3);
    expect(new Set(corpus.scenarios.map((scenario) => scenario.id)).size).toBe(corpus.scenarios.length);
    for (const scenario of corpus.scenarios) {
      expect(typeof scenario.id).toBe("string");
      expect(["positive", "negative"]).toContain(scenario.kind);
      expect(typeof scenario.prompt).toBe("string");
      expect(typeof scenario.expectedSkill).toBe("string");
      expect(Array.isArray(scenario.requiredTools)).toBe(true);
      expect(Array.isArray(scenario.requirements)).toBe(true);
      expect(scenario.prompt.length).toBeGreaterThan(10);
      expect(skillDirectories.has(scenario.expectedSkill)).toBe(true);
      expect(scenario.requirements.length).toBeGreaterThanOrEqual(2);
      expect(scenario.requirements.every((requirement) => typeof requirement === "string" && requirement.length > 5)).toBe(true);
      if (scenario.kind === "positive") {
        expect(scenario.fixture?.length, `${scenario.id}: fixture`).toBeGreaterThan(20);
        expect(scenario.expectedResultShape?.length, `${scenario.id}: result shape`).toBeGreaterThan(20);
        expect(scenario.expectedSafeBehavior, `${scenario.id}: positive-only fields`).toBeUndefined();
        expect(scenario.rationale, `${scenario.id}: positive-only fields`).toBeUndefined();
      } else {
        expect(scenario.expectedSafeBehavior?.length, `${scenario.id}: safe behavior`).toBeGreaterThan(20);
        expect(scenario.rationale?.length, `${scenario.id}: rationale`).toBeGreaterThan(20);
        expect(scenario.fixture, `${scenario.id}: negative-only fields`).toBeUndefined();
        expect(scenario.expectedResultShape, `${scenario.id}: negative-only fields`).toBeUndefined();
      }
      for (const tool of scenario.requiredTools) expect(knownTools.has(tool), `${scenario.id}: unknown tool ${tool}`).toBe(true);
    }
    for (const skill of skillDirectories) {
      expect(corpus.scenarios.some((scenario) => scenario.expectedSkill === skill), `${skill} needs an eval scenario`).toBe(true);
    }
    expect(corpus.scenarios.find((scenario) => scenario.id === "privacy-and-supplier-boundary")?.requiredTools).toEqual([]);
    expect(corpus.scenarios.find((scenario) => scenario.id === "feedback-consent")?.requiredTools).toEqual([
      "report_quality_signal",
    ]);
  });
});
