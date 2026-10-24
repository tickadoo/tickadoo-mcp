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

const OPENAI_CATEGORIES = [
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
];

const COUNT_BEARING_COPY =
  /\b(?:\d[\d,]*\+?|(?:dozens|hundreds|thousands|millions)(?:\s+of)?)\s+(?:bookable\s+)?(?:products?|experiences?|cities|countries|tools)\b/i;

async function assertOpenAiListing(
  pluginInterface: Record<string, unknown>,
  options: { requireSupportURL: boolean },
) {
  expect(String(pluginInterface.displayName).length).toBeLessThanOrEqual(30);
  expect(String(pluginInterface.shortDescription).length).toBeLessThanOrEqual(30);
  expect(String(pluginInterface.longDescription).length).toBeLessThanOrEqual(4_000);
  expect(String(pluginInterface.longDescription)).not.toMatch(COUNT_BEARING_COPY);
  expect(String(pluginInterface.developerName).length).toBeLessThanOrEqual(80);
  expect(OPENAI_CATEGORIES).toContain(pluginInterface.category);

  const capabilities = pluginInterface.capabilities as string[];
  expect(capabilities.length).toBeLessThanOrEqual(20);
  expect(capabilities.every((capability) => capability.length > 0 && capability.length <= 120)).toBe(true);

  const prompts = pluginInterface.defaultPrompt as string[];
  expect(prompts.length).toBeLessThanOrEqual(3);
  expect(prompts.every((prompt) => prompt.length > 0 && prompt.length <= 128 && !prompt.includes("@"))).toBe(true);
  expect(new Set(prompts.map((prompt) => prompt.normalize().replace(/\s+/g, " ").trim())).size).toBe(prompts.length);

  const urlFields = ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"];
  if (options.requireSupportURL) {
    urlFields.push("supportURL");
  } else {
    expect(pluginInterface).not.toHaveProperty("supportURL");
  }
  for (const field of urlFields) {
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
}

describe("Agent Plugins 1.0.0 package", () => {
  it("validates the closed portable manifest against the vendored official schema", async () => {
    const manifest = await validate("plugin");
    expect(manifest.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(manifest.keywords).toEqual([
      "tickadoo",
      "experiences",
      "tickets",
      "theatre",
      "tours",
      "attractions",
      "events",
      "discovery",
      "travel",
      "mcp",
    ]);
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

  it("builds the OpenAI review ZIP from a closed discovery-only allowlist", async () => {
    const archive = await readJson(path.join(root, "scripts/openai-plugin-files.json"));
    const files = archive.files as string[];
    expect(files).toEqual([
      "plugin.json",
      "mcp.json",
      "brand/apps-directory-icon.svg",
      "brand/apps-directory-icon-monochrome.svg",
      "skills/compare-before-you-book/SKILL.md",
      "skills/date-night/SKILL.md",
      "skills/family-day-out/SKILL.md",
      "skills/near-a-landmark/SKILL.md",
      "skills/plan-a-trip/SKILL.md",
      "skills/tickadoo-experiences/SKILL.md",
      "skills/tonight-and-last-minute/SKILL.md",
      "LICENSE",
    ]);
    expect(new Set(files).size).toBe(files.length);
    expect(files).not.toContain(".mcp.json");
    expect(files).not.toContain(".codex-plugin/plugin.json");
    expect(files).not.toContain("server.json");
    expect(files.some(file => file.startsWith("clients/"))).toBe(false);

    for (const file of files) {
      const source = await readFile(path.join(root, file), "utf8");
      expect(source, file).not.toMatch(/report_quality_signal|render_experience_cards/);
      expect(source, file).not.toContain('"url": "https://mcp.tickadoo.com/mcp"');
    }
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
    expect(servers.tickadoo.url).toBe("https://mcp.tickadoo.com/mcp/agents");
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
    expect(codexServers.tickadoo.url).toBe("https://mcp.tickadoo.com/mcp/agents");
    expect(JSON.stringify(codex)).not.toMatch(/bearer|token|secret|password|api[_-]?key|cf-access/i);

    const extension = (portable.extensions as Record<string, Record<string, unknown>>)["com.openai"];
    const portableInterface = (extension.interface ?? {}) as Record<string, unknown>;
    const codexInterface = codex.interface as Record<string, unknown>;
    for (const field of [
      "displayName",
      "shortDescription",
      "longDescription",
      "developerName",
      "category",
      "capabilities",
      "websiteURL",
      "privacyPolicyURL",
      "termsOfServiceURL",
      "defaultPrompt",
      "brandColor",
      "composerIcon",
      "logo",
    ]) {
      expect(codexInterface[field], field).toEqual(portableInterface[field]);
    }
  });

  it("meets the current OpenAI install-surface metadata gates", async () => {
    const codex = await readJson(path.join(root, ".codex-plugin/plugin.json"));
    const pluginInterface = codex.interface as Record<string, unknown>;
    expect(codex.name).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
    expect(codex.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
    await assertOpenAiListing(pluginInterface, { requireSupportURL: false });
  });

  it("prefills the OpenAI directory from the portable manifest", async () => {
    const manifest = await validate("plugin");
    const author = manifest.author as Record<string, unknown>;
    expect(author.email).toBe("support@tickadoo.com");
    expect(author.name).toBe("tickadoo Inc.");

    const extensions = manifest.extensions as Record<string, Record<string, unknown>>;
    expect(Object.keys(extensions)).toEqual(["com.openai"]);
    const openai = extensions["com.openai"];
    expect(Object.keys(openai).sort()).toEqual(["interface", "publication", "review"]);
    for (const behaviorField of ["apps", "hooks", "onboardingSkill", "mcpServers", "skills"]) {
      expect(openai).not.toHaveProperty(behaviorField);
    }

    const pluginInterface = openai.interface as Record<string, unknown>;
    await assertOpenAiListing(pluginInterface, { requireSupportURL: true });
    expect(pluginInterface.displayName).toBe("tickadoo Experiences");
    expect(pluginInterface.developerName).toBe("tickadoo");
    expect(pluginInterface.category).toBe("Travel");
    expect(pluginInterface.websiteURL).toBe("https://mcp.tickadoo.com");
    expect(pluginInterface.websiteURL).toBe(manifest.homepage);
    expect(pluginInterface.supportURL).toBe("https://www.tickadoo.com/contact");
    expect(pluginInterface.privacyPolicyURL).toBe("https://www.tickadoo.com/privacy");
    expect(pluginInterface.termsOfServiceURL).toBe("https://www.tickadoo.com/terms");
    expect(pluginInterface.logo).toBe("./brand/apps-directory-icon.svg");
    expect(pluginInterface.composerIcon).toBe("./brand/apps-directory-icon-monochrome.svg");
    expect(pluginInterface.brandColor).toBe("#FF5A5F");
    const longDescription = String(pluginInterface.longDescription);
    expect(longDescription).toContain("https://mcp.tickadoo.com/mcp/agents");
    expect(longDescription).toContain("no authentication");
    expect(longDescription).toContain("discovery-only");
    expect(longDescription).toContain("does not return direct checkout or transaction links");

    const publication = openai.publication as Record<string, unknown>;
    expect(Object.keys(publication)).toEqual(["release_notes"]);
    expect(publication.release_notes).toMatch(/discovery-only \/mcp\/agents contract/);

    const review = openai.review as Record<string, unknown>;
    expect(Object.keys(review).sort()).toEqual(["commerce", "commerce_description", "test_cases"]);
    expect(review.commerce).toBe(false);
    expect(review.commerce_description).toBe(
      "This public plugin is discovery-only. Its MCP surface does not return direct checkout or transaction links, create orders, reserve inventory, or collect payment.",
    );
    expect(review).not.toHaveProperty("demo_recording_url");
    expect(review).not.toHaveProperty("test_credentials");
    expect(review).not.toHaveProperty("reviewer_instructions");

    const testCases = review.test_cases as {
      positive: Array<Record<string, string>>;
      negative: Array<Record<string, string>>;
    };
    expect(testCases.positive).toHaveLength(5);
    expect(testCases.negative).toHaveLength(3);

    const agentSnapshot = await readJson(path.join(root, "metadata/public-agent-tools.json"));
    const publishedTools = new Set(
      ((agentSnapshot.tools as Array<{ name: string }>) ?? []).map(tool => tool.name),
    );
    const scenarios = await readJson(path.join(root, "evals/agent-plugin-scenarios.json"));
    const scenarioById = new Map(
      (scenarios.scenarios as Array<Record<string, unknown>>).map((scenario) => [scenario.id, scenario]),
    );
    const forbiddenTool = /checkout|payment|stripe|charge|\bcard\b/i;

    function triggeredTools(testCase: Record<string, string>): string[] {
      return testCase.tools_triggered.split(",").map((tool) => tool.trim()).filter(Boolean);
    }

    for (const testCase of [...testCases.positive, ...testCases.negative]) {
      expect(testCase.description.length).toBeGreaterThan(0);
      expect(testCase.description.length).toBeLessThanOrEqual(4_000);
      expect(testCase.prompt.length).toBeGreaterThan(0);
      expect(testCase.prompt.includes("@")).toBe(false);
      if (testCase.tools_triggered !== undefined) {
        const tools = triggeredTools(testCase);
        expect(tools.length).toBeGreaterThan(0);
        expect(new Set(tools).size).toBe(tools.length);
        for (const tool of tools) {
          expect(publishedTools, tool).toContain(tool);
          expect(tool).not.toMatch(forbiddenTool);
        }
      }
    }

    const tonight = testCases.positive[0];
    expect(tonight.prompt).toBe("What experiences are on in London tonight?");
    expect(triggeredTools(tonight)).toEqual(
      (scenarioById.get("same-day")?.requiredTools as string[]) ?? [],
    );
    expect(triggeredTools(tonight)).toContain("whats_on_tonight");

    const lionKing = testCases.positive[1];
    expect(lionKing.prompt).toMatch(/Lion King/);
    expect(lionKing.prompt).toMatch(/London/);
    expect(triggeredTools(lionKing)).toEqual(["search_experiences", "get_availability"]);
    expect(lionKing.expected_behavior).toContain("city london");
    expect(lionKing.expected_behavior).toContain("query Lion King");
    expect(lionKing.expected_behavior).toMatch(/no direct purchase, transaction, or checkout link/i);

    for (const [index, id] of [
      [2, "family-day"],
      [3, "comparison"],
      [4, "availability-follow-up"],
    ] as const) {
      const scenario = scenarioById.get(id);
      expect(testCases.positive[index].prompt).toBe(scenario?.prompt);
      expect(triggeredTools(testCases.positive[index])).toEqual(scenario?.requiredTools);
    }

    const availabilityFollowUp = testCases.positive[4];
    expect(availabilityFollowUp.description).toMatch(/same conversation/i);
    expect(availabilityFollowUp.prompt).toMatch(/First find The Lion King/i);
    expect(availabilityFollowUp.prompt).toMatch(/select one returned product/i);
    expect(availabilityFollowUp.prompt).toMatch(/date at least 30 days in the future/i);
    expect(availabilityFollowUp.prompt).toMatch(/Then, in the same conversation/i);

    for (const [index, id] of [
      [0, "privacy-and-supplier-boundary"],
      [1, "no-inventory-fallback"],
      [2, "no-purchase-action"],
    ] as const) {
      const scenario = scenarioById.get(id);
      const testCase = testCases.negative[index];
      expect(testCase.prompt).toBe(scenario?.prompt);
      expect(testCase.expected_behavior).toBe(scenario?.expectedSafeBehavior);
      if (id === "no-inventory-fallback") {
        expect(triggeredTools(testCase)).toEqual(scenario?.requiredTools);
      } else {
        expect(testCase).not.toHaveProperty("tools_triggered");
      }
    }

    const serialized = JSON.stringify(openai);
    expect(serialized).not.toMatch(/test_credentials|reviewer_instructions|clientSecret|api[_-]?key/i);
    for (const testCase of [...testCases.positive, ...testCases.negative]) {
      if (testCase.tools_triggered !== undefined) {
        expect(testCase.tools_triggered).not.toMatch(forbiddenTool);
      }
    }
  });

  it("contains no credential-shaped values in portable or client manifests", async () => {
    const files = [
      "plugin.json",
      "mcp.json",
      ".codex-plugin/plugin.json",
      ".claude-plugin/plugin.json",
      ".claude-plugin/marketplace.json",
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
