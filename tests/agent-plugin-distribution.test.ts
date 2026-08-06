import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

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
      "evals/agent-plugin-scenarios.json",
      "schemas/agent-plugins/1.0.0/plugin.schema.json",
      "schemas/agent-plugins/1.0.0/mcp.schema.json",
    ]) {
      expect(packed.has(required), `${required} must be published`).toBe(true);
    }
    expect([...packed].filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file))).toHaveLength(7);
  });

  it("keeps provider-neutral scenarios closed over shipped skills and live tool metadata", async () => {
    const corpus = JSON.parse(await readFile(path.join(root, "evals/agent-plugin-scenarios.json"), "utf8")) as {
      version: unknown;
      description: unknown;
      scenarios: Array<{ id: string; prompt: string; expectedSkill: string; requiredTools: string[]; requirements: string[] }>;
    };
    const server = JSON.parse(await readFile(path.join(root, "server.json"), "utf8")) as {
      _meta: { "io.modelcontextprotocol.registry/publisher-provided": { tools: Array<{ name: string }> } };
    };
    const knownTools = new Set(server._meta["io.modelcontextprotocol.registry/publisher-provided"].tools.map((tool) => tool.name));
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
    expect(corpus.version).toBe("1.0.0");
    expect(typeof corpus.description).toBe("string");
    expect(Array.isArray(corpus.scenarios)).toBe(true);
    expect(corpus.scenarios).toHaveLength(12);
    expect(new Set(corpus.scenarios.map((scenario) => scenario.id)).size).toBe(corpus.scenarios.length);
    for (const scenario of corpus.scenarios) {
      expect(typeof scenario.id).toBe("string");
      expect(typeof scenario.prompt).toBe("string");
      expect(typeof scenario.expectedSkill).toBe("string");
      expect(Array.isArray(scenario.requiredTools)).toBe(true);
      expect(Array.isArray(scenario.requirements)).toBe(true);
      expect(scenario.prompt.length).toBeGreaterThan(10);
      expect(skillDirectories.has(scenario.expectedSkill)).toBe(true);
      expect(scenario.requirements.length).toBeGreaterThanOrEqual(2);
      expect(scenario.requirements.every((requirement) => typeof requirement === "string" && requirement.length > 5)).toBe(true);
      for (const tool of scenario.requiredTools) expect(knownTools.has(tool), `${scenario.id}: unknown tool ${tool}`).toBe(true);
    }
    for (const skill of skillDirectories) {
      expect(corpus.scenarios.some((scenario) => scenario.expectedSkill === skill), `${skill} needs an eval scenario`).toBe(true);
    }
  });
});
