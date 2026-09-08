import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
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

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
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

  it("meets the current OpenAI install-surface metadata gates", async () => {
    const codex = await readJson(path.join(root, ".codex-plugin/plugin.json"));
    const pluginInterface = codex.interface as Record<string, unknown>;
    expect(codex.name).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
    expect(codex.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
    expect(String(pluginInterface.displayName).length).toBeLessThanOrEqual(30);
    expect(String(pluginInterface.shortDescription).length).toBeLessThanOrEqual(30);
    expect(String(pluginInterface.longDescription).length).toBeLessThanOrEqual(4_000);
    expect(String(pluginInterface.developerName).length).toBeLessThanOrEqual(80);
    expect([
      "Productivity",
      "Creativity",
      "Developer Tools",
      "Business & Operations",
      "Data & Analytics",
      "Communication",
      "Education & Research",
      "Security",
      "Finance",
      "Healthcare",
      "Travel",
      "Entertainment",
      "Other",
    ]).toContain(pluginInterface.category);

    const capabilities = pluginInterface.capabilities as string[];
    expect(capabilities.length).toBeLessThanOrEqual(20);
    expect(capabilities.every((capability) => capability.length > 0 && capability.length <= 120)).toBe(true);

    const prompts = pluginInterface.defaultPrompt as string[];
    expect(prompts.length).toBeLessThanOrEqual(3);
    expect(prompts.every((prompt) => prompt.length > 0 && prompt.length <= 128 && !prompt.includes("@"))).toBe(true);
    expect(new Set(prompts.map((prompt) => prompt.normalize().replace(/\s+/g, " ").trim())).size).toBe(prompts.length);

    for (const field of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) {
      const value = String(pluginInterface[field]);
      const url = new URL(value);
      expect(value.length, field).toBeLessThanOrEqual(1_024);
      expect(url.protocol, field).toBe("https:");
      expect(url.username, field).toBe("");
      expect(url.password, field).toBe("");
    }

    const brandColor = String(pluginInterface.brandColor);
    expect(brandColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(1.05 / (relativeLuminance(brandColor) + 0.05)).toBeGreaterThanOrEqual(2);

    const resolvedRoot = await realpath(root);
    for (const field of ["composerIcon", "logo"]) {
      const relative = String(pluginInterface[field]);
      expect(relative).toMatch(/^\.\/brand\/.+\.svg$/);
      const asset = path.resolve(root, relative);
      const assetStat = await lstat(asset);
      expect(assetStat.isSymbolicLink(), `${field} must not be a symlink`).toBe(false);
      expect(assetStat.size, `${field} must not exceed 5 MiB`).toBeLessThanOrEqual(5 * 1024 * 1024);
      expect(await realpath(asset)).toSatisfy((resolved) => resolved.startsWith(`${resolvedRoot}${path.sep}`));
      const svg = await readFile(asset, "utf8");
      expect(svg, `${field} must have an SVG root`).toMatch(/^\s*<svg\b/);
      const dimensions = svg.match(/<svg\b[^>]*\bviewBox="0 0 (\d+) \1"/);
      expect(dimensions, `${field} must have a square numeric viewBox`).not.toBeNull();
      expect(Number(dimensions?.[1]), `${field} must be at least 48 by 48`).toBeGreaterThanOrEqual(48);
    }
  });

  it("contains no credential-shaped values in portable or client manifests", async () => {
    const files = [
      "plugin.json",
      "mcp.json",
      ".codex-plugin/plugin.json",
      ".claude-plugin/plugin.json",
      ".mcp.json",
      "clients/github-copilot/mcp.json",
    ];
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
