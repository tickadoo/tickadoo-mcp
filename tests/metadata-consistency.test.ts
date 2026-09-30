import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PUBLIC_DESCRIPTION =
  "Discover and book theatre, tours, attractions, and live experiences worldwide. Search, compare, check live availability, plan itineraries, and get direct tickadoo booking links. No API key required.";
const REGISTRY_DESCRIPTION =
  "Discover and book theatre, tours, attractions, and live experiences worldwide. No API key required.";
const GEMINI_DESCRIPTION =
  "Search and book theatre, attractions, tours, and live experiences worldwide with tickadoo.";
const MCP_HOMEPAGE = "https://mcp.tickadoo.com";
const MCP_ENDPOINT = `${MCP_HOMEPAGE}/mcp/agents`;
const COUNT_BEARING_COPY =
  /\b\d[\d,]*\+?\s+(?:bookable\s+)?(?:products?|experiences?|cities|tools)\b/i;

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  ) as T;
}

const packageJson = readJson<{
  version: string;
  description: string;
  repository: { url: string };
}>("../package.json");
const packageLock = readJson<{
  version: string;
  packages: Record<string, { version?: string }>;
}>("../package-lock.json");
const portablePlugin = readJson<{
  version: string;
  description: string;
  homepage: string;
  repository: string;
  keywords: string[];
}>("../plugin.json");
const claudePlugin = readJson<{
  version: string;
  description: string;
  homepage: string;
  repository: string;
  keywords: string[];
}>("../.claude-plugin/plugin.json");
const codexPlugin = readJson<{
  version: string;
  description: string;
}>("../.codex-plugin/plugin.json");
const geminiExtension = readJson<{
  version: string;
  description: string;
}>("../gemini-extension.json");
const copilotMarketplace = readJson<{
  metadata: { version: string; description: string };
  plugins: Array<{ version: string; description: string }>;
}>("../.github/plugin/marketplace.json");
type PublicAgentTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    additionalProperties: boolean;
  };
  outputSchema: {
    type: string;
    properties: Record<string, unknown>;
    additionalProperties: boolean;
  };
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
};
const serverJson = readJson<{
  version: string;
  description: string;
  websiteUrl: string;
  remotes: Array<{ type: string; url: string }>;
  _meta: {
    "io.modelcontextprotocol.registry/publisher-provided": Record<string, unknown>;
  };
}>("../server.json");
const publicAgentSnapshot = readJson<{
  source: string;
  tools: PublicAgentTool[];
}>("../metadata/public-agent-tools.json");
const smitheryYaml = readFileSync(
  new URL("../smithery.yaml", import.meta.url),
  "utf8",
);
const syncScript = readFileSync(
  new URL("../scripts/sync-server-json.mjs", import.meta.url),
  "utf8",
);
const bridgeConfig = readFileSync(
  new URL("../src/config.ts", import.meta.url),
  "utf8",
);
const agentGuidance = ["../AGENTS.md", "../CLAUDE.md"].map((relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8"),
);

describe("public registry metadata", () => {
  it("keeps every release-bearing artifact aligned with package.json", () => {
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    const bridgeVersion = bridgeConfig.match(
      /^export const BRIDGE_VERSION = "([^"]+)";$/m,
    )?.[1];
    const releaseVersions = new Map<string, string | undefined>([
      ["package-lock.json", packageLock.version],
      ["package-lock.json root package", packageLock.packages[""].version],
      ["src/config.ts", bridgeVersion],
      ["plugin.json", portablePlugin.version],
      [".claude-plugin/plugin.json", claudePlugin.version],
      [".codex-plugin/plugin.json", codexPlugin.version],
      ["gemini-extension.json", geminiExtension.version],
      ["server.json", serverJson.version],
      ["Copilot marketplace plugin", copilotMarketplace.plugins[0]?.version],
    ]);

    for (const [artifact, version] of releaseVersions) {
      expect(version, artifact).toBe(packageJson.version);
    }
    expect(copilotMarketplace.metadata.version).toBe("1.0.0");
  });

  it("uses evergreen, count-free descriptions within each registry's limits", () => {
    const smitheryDescription = smitheryYaml.match(
      /^\s{2}description:\s+"([^"]+)"\s*$/m,
    )?.[1];

    expect(portablePlugin.description).toBe(PUBLIC_DESCRIPTION);
    expect(claudePlugin.description).toBe(PUBLIC_DESCRIPTION);
    expect(codexPlugin.description).toBe(PUBLIC_DESCRIPTION);
    expect(copilotMarketplace.plugins[0]?.description).toBe(PUBLIC_DESCRIPTION);
    expect(geminiExtension.description).toBe(GEMINI_DESCRIPTION);
    expect(claudePlugin.keywords).toEqual(portablePlugin.keywords);
    expect(serverJson.description).toBe(REGISTRY_DESCRIPTION);
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
    expect(smitheryDescription).toBe(PUBLIC_DESCRIPTION);
    expect(syncScript).toContain(JSON.stringify(REGISTRY_DESCRIPTION));

    for (const description of [
      packageJson.description,
      portablePlugin.description,
      claudePlugin.description,
      codexPlugin.description,
      copilotMarketplace.metadata.description,
      copilotMarketplace.plugins[0]?.description ?? "",
      geminiExtension.description,
      serverJson.description,
      smitheryDescription ?? "",
      ...agentGuidance,
    ]) {
      expect(description).not.toMatch(COUNT_BEARING_COPY);
    }
  });

  it("keeps registry links on the canonical MCP service", () => {
    expect(portablePlugin.homepage).toBe(MCP_HOMEPAGE);
    expect(portablePlugin.repository).toBe(
      packageJson.repository.url.replace(/^git\+/, "").replace(/\.git$/, ""),
    );
    expect(claudePlugin.homepage).toBe(MCP_HOMEPAGE);
    expect(claudePlugin.repository).toBe(portablePlugin.repository);
    expect(serverJson.websiteUrl).toBe(MCP_HOMEPAGE);
    expect(serverJson.remotes).toEqual([
      { type: "streamable-http", url: MCP_ENDPOINT },
    ]);
    expect(syncScript).toContain("url: canonicalRemoteUrl");
    expect(syncScript).not.toContain("url: sourceRemoteUrl.href");
    expect(smitheryYaml).toMatch(
      /^\s{2}url:\s+https:\/\/mcp\.tickadoo\.com\/mcp\/agents\s*$/m,
    );
    expect(smitheryYaml).toMatch(
      /^\s{2}documentation:\s+https:\/\/mcp\.tickadoo\.com\/llms\.txt\s*$/m,
    );
  });

  it("keeps publisher-provided registry metadata below the official 4 KiB limit", () => {
    const publisherMetadata =
      serverJson._meta["io.modelcontextprotocol.registry/publisher-provided"];
    expect(Buffer.byteLength(JSON.stringify(publisherMetadata), "utf8")).toBeLessThanOrEqual(
      4_096,
    );
    expect(publisherMetadata).not.toHaveProperty("tools");
    expect(publisherMetadata).toEqual({ license: "MIT" });
  });

  it("ships complete, closed, read-only metadata in the public-agent snapshot", () => {
    const tools = publicAgentSnapshot.tools;
    expect(publicAgentSnapshot.source).toBe(
      "tickadoo/howard@4bbc8b213c4230e31cb65e10634b99a146d4f530",
    );
    expect(tools).toHaveLength(20);
    expect(new Set(tools.map(tool => tool.name)).size).toBe(20);
    for (const denied of [
      "report_quality_signal",
      "find_nearby_experiences",
      "get_transfer_info",
    ]) {
      expect(tools.map(tool => tool.name)).not.toContain(denied);
    }
    for (const tool of tools) {
      expect(tool.title.trim(), `${tool.name}: title`).not.toBe("");
      expect(tool.description.trim(), `${tool.name}: description`).not.toBe("");
      expect(tool.annotations.title, `${tool.name}: annotation title`).toBe(tool.title);
      expect(tool.annotations.readOnlyHint, `${tool.name}: read-only`).toBe(true);
      expect(tool.annotations.destructiveHint, `${tool.name}: non-destructive`).toBe(false);
      expect(tool.annotations.openWorldHint, `${tool.name}: closed-world`).toBe(false);
      expect(typeof tool.annotations.idempotentHint, `${tool.name}: idempotence`).toBe(
        "boolean",
      );
      expect(tool.inputSchema.type, `${tool.name}: input object`).toBe("object");
      expect(tool.inputSchema.additionalProperties, `${tool.name}: input closure`).toBe(false);
      expect(tool.inputSchema.properties, `${tool.name}: input properties`).toBeTypeOf(
        "object",
      );
      expect(tool.outputSchema.type, `${tool.name}: output object`).toBe("object");
      expect(tool.outputSchema.additionalProperties, `${tool.name}: output closure`).toBe(false);
      expect(tool.outputSchema.properties, `${tool.name}: output properties`).toBeTypeOf(
        "object",
      );
    }
    expect(syncScript).toContain("publicAgentToolMetadata");
    expect(syncScript).toContain("metadata/public-agent-tools.json");
    expect(syncScript).toContain("approvedSourceRemoteUrl");
    expect(syncScript).toContain("createNoRedirectFetch");
    expect(syncScript).toContain('redirect: "error"');
    expect(syncScript).not.toContain("normaliseDescription");
    expect(syncScript).not.toContain("from ${sourceRemoteUrl.href}");
  });
});
