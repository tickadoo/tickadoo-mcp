import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = path.join(root, "schemas/agent-plugins/1.0.0");

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
}

async function validate(documentName: "plugin" | "mcp") {
  const schema = await readJson(path.join(schemaRoot, `${documentName}.schema.json`));
  const document = await readJson(path.join(root, `${documentName}.json`));
  const ajv = new Ajv2020({ strict: true });
  const valid = ajv.validate(schema, document);
  expect(ajv.errors).toBeNull();
  expect(valid).toBe(true);
  return document;
}

async function walkContained(directory: string, resolvedRoot: string): Promise<string[]> {
  const discovered: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    const stat = await lstat(candidate);
    expect(stat.isSymbolicLink(), `${path.relative(root, candidate)} must not be a symlink`).toBe(false);
    const resolved = await realpath(candidate);
    expect(
      resolved.startsWith(`${resolvedRoot}${path.sep}`),
      `${path.relative(root, candidate)} must resolve inside the plugin root`,
    ).toBe(true);
    discovered.push(candidate);
    if (entry.isDirectory()) discovered.push(...(await walkContained(candidate, resolvedRoot)));
  }
  return discovered;
}

describe("Agent Plugins 1.0.0 package", () => {
  it("validates the closed portable manifest against the vendored official schema", async () => {
    const manifest = await validate("plugin");
    expect(manifest.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(manifest).not.toHaveProperty("mcpServers");
    expect(manifest).not.toHaveProperty("skills");
  });

  it("discovers every immediate skill and matches directory names to frontmatter", async () => {
    const entries = await readdir(path.join(root, "skills"), { withFileTypes: true });
    const skills = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    expect(skills).toEqual([
      "compare-before-you-book",
      "date-night",
      "family-day-out",
      "near-a-landmark",
      "plan-a-trip",
      "tickadoo-experiences",
      "tonight-and-last-minute",
    ]);
    for (const skill of skills) {
      const source = await readFile(path.join(root, "skills", skill, "SKILL.md"), "utf8");
      expect(source.match(/^---\n([\s\S]*?)\n---/)?.[1]).toMatch(new RegExp(`(^|\\n)name: ${skill}($|\\n)`));
    }
  });

  it("keeps discovered package files contained within the plugin root", async () => {
    const resolvedRoot = await realpath(root);
    for (const relative of ["plugin.json", "mcp.json", "skills"]) {
      const candidate = path.join(root, relative);
      const stat = await lstat(candidate);
      expect(stat.isSymbolicLink()).toBe(false);
      expect(await realpath(candidate)).toSatisfy((resolved) => resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`));
    }
    const portableFiles = await walkContained(path.join(root, "skills"), resolvedRoot);
    await walkContained(path.join(root, ".codex-plugin"), resolvedRoot);
    const skillFiles = portableFiles.filter((candidate) => path.basename(candidate) === "SKILL.md");
    expect(skillFiles.every((candidate) => path.dirname(path.dirname(candidate)) === path.join(root, "skills"))).toBe(true);
  });

  it("rejects fields outside the closed portable manifest schema", async () => {
    const schema = await readJson(path.join(schemaRoot, "plugin.schema.json"));
    const manifest = await readJson(path.join(root, "plugin.json"));
    const ajv = new Ajv2020({ strict: true });
    expect(ajv.validate(schema, { ...manifest, __unknownPortableField: true })).toBe(false);
    expect(ajv.errors?.some((error) => error.keyword === "additionalProperties")).toBe(true);
  });

  it("uses a supported secure transport without package-visible authentication", async () => {
    const config = await validate("mcp");
    const serialized = JSON.stringify(config);
    expect(serialized).not.toMatch(/authorization|bearer|token|secret|password|api[_-]?key|cf-access/i);
    const servers = config.mcpServers as Record<string, Record<string, unknown>>;
    expect(Object.values(servers)).toHaveLength(1);
    expect(servers.tickadoo.type).toBe("streamable-http");
    expect(servers.tickadoo.url).toBe("https://mcp.tickadoo.com/mcp");
    expect(new URL(String(servers.tickadoo.url)).protocol).toBe("https:");
    expect(new URL(String(servers.tickadoo.url)).username).toBe("");
    expect(new URL(String(servers.tickadoo.url)).password).toBe("");
    expect(servers.tickadoo).not.toHaveProperty("headers");
  });

  it("pins matching schema versions for manifest and MCP discovery", async () => {
    const manifest = await readJson(path.join(root, "plugin.json"));
    const mcp = await readJson(path.join(root, "mcp.json"));
    expect(manifest.$schema).toContain("/1.0.0/");
    expect(mcp.$schema).toContain("/1.0.0/");

    const expected = new Map(
      (await readFile(path.join(schemaRoot, "SHA256SUMS"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => line.trim().split(/\s+/, 2).reverse() as [string, string]),
    );
    for (const [file, digest] of expected) {
      const actual = createHash("sha256")
        .update(await readFile(path.join(schemaRoot, file)))
        .digest("hex");
      expect(actual).toBe(digest);
    }
  });

  it("keeps the Codex client extension parallel to the portable manifest", async () => {
    const portable = await readJson(path.join(root, "plugin.json"));
    const codex = await readJson(path.join(root, ".codex-plugin/plugin.json"));
    expect(codex.name).toBe(portable.name);
    expect(codex.version).toBe(portable.version);
    expect(codex.skills).toBe("./skills/");
    const codexServers = codex.mcpServers as Record<string, Record<string, unknown>>;
    expect(codexServers.tickadoo.type).toBe("http");
    expect(codexServers.tickadoo.url).toBe("https://mcp.tickadoo.com/mcp");
    expect(JSON.stringify(codex)).not.toMatch(/bearer|token|secret|password|api[_-]?key|cf-access/i);
  });

  it("contains no credential-shaped values in portable or client manifests", async () => {
    const files = ["plugin.json", "mcp.json", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json", ".mcp.json"];
    for (const file of files) {
      const source = await readFile(path.join(root, file), "utf8");
      expect(source).not.toMatch(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/i);
      expect(source).not.toMatch(/"Authorization"\s*:/i);
      expect(source).not.toMatch(/\$\{[^}]*(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY)[^}]*\}/i);
      expect(source).not.toMatch(/(?:sk|ghp|github_pat|AKIA)[-_A-Za-z0-9]{12,}/);
      expect(source).not.toMatch(/https?:\/\/[^/\s]+:[^@/\s]+@/);
    }
  });
});
