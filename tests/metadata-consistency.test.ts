import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PUBLIC_DESCRIPTION =
  "Discover and book theatre, tours, attractions, and live experiences worldwide. Search, compare, check live availability, plan itineraries, and get direct tickadoo booking links. No API key required.";
const MCP_HOMEPAGE = "https://mcp.tickadoo.com";
const MCP_ENDPOINT = `${MCP_HOMEPAGE}/mcp`;

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  ) as T;
}

const packageJson = readJson<{
  version: string;
  repository: { url: string };
}>("../package.json");
const pluginJson = readJson<{
  version: string;
  description: string;
  homepage: string;
  repository: string;
}>("../.claude-plugin/plugin.json");
const serverJson = readJson<{
  version: string;
  description: string;
  websiteUrl: string;
  remotes: Array<{ type: string; url: string }>;
}>("../server.json");
const smitheryYaml = readFileSync(
  new URL("../smithery.yaml", import.meta.url),
  "utf8",
);
const syncScript = readFileSync(
  new URL("../scripts/sync-server-json.mjs", import.meta.url),
  "utf8",
);

describe("public registry metadata", () => {
  it("keeps published versions aligned with package.json", () => {
    expect(pluginJson.version).toBe(packageJson.version);
    expect(serverJson.version).toBe(packageJson.version);
  });

  it("uses one evergreen, count-free public description", () => {
    const smitheryDescription = smitheryYaml.match(
      /^\s{2}description:\s+"([^"]+)"\s*$/m,
    )?.[1];

    expect(pluginJson.description).toBe(PUBLIC_DESCRIPTION);
    expect(serverJson.description).toBe(PUBLIC_DESCRIPTION);
    expect(smitheryDescription).toBe(PUBLIC_DESCRIPTION);
    expect(syncScript).toContain(JSON.stringify(PUBLIC_DESCRIPTION));

    for (const description of [
      pluginJson.description,
      serverJson.description,
      smitheryDescription ?? "",
    ]) {
      expect(description).not.toMatch(
        /\b\d[\d,]*\+?\s+(?:bookable\s+)?(?:products?|experiences?|cities|tools)\b/i,
      );
    }
  });

  it("keeps registry links on the canonical MCP service", () => {
    expect(pluginJson.homepage).toBe(MCP_HOMEPAGE);
    expect(pluginJson.repository).toBe(
      packageJson.repository.url.replace(/\.git$/, ""),
    );
    expect(serverJson.websiteUrl).toBe(MCP_HOMEPAGE);
    expect(serverJson.remotes).toEqual([
      { type: "streamable-http", url: MCP_ENDPOINT },
    ]);
    expect(smitheryYaml).toMatch(
      /^\s{2}url:\s+https:\/\/mcp\.tickadoo\.com\/mcp\s*$/m,
    );
    expect(smitheryYaml).toMatch(
      /^\s{2}documentation:\s+https:\/\/mcp\.tickadoo\.com\/llms\.txt\s*$/m,
    );
  });
});
