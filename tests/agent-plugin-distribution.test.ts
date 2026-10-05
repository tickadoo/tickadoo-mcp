import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_AGENT_URL = "https://mcp.tickadoo.com/mcp/agents";
const OPENAI_LISTING_URL = "https://mcp.tickadoo.com/mcp/store-cards";
const MUSE_DEPLOYMENT_GATE =
  "Status: **prepared only**. The `/mcp/agents` endpoint is not usable until it is deployed and verified by the checks in `EVALS.md`. Do not install, connect, submit, or claim it is available before then.";
const EXPECTED_PUBLIC_AGENT_TOOLS = [
  "search_experiences",
  "search_local_experiences",
  "whats_on_tonight",
  "get_last_minute",
  "get_whats_on_this_week",
  "recommend_experiences",
  "get_city_guide",
  "get_travel_tips",
  "compare_experiences",
  "get_hidden_gems",
  "get_family_day",
  "get_date_night",
  "plan_itinerary",
  "list_cities",
  "get_experience_details",
  "get_related_experiences",
  "get_availability",
  "check_availability",
  "search_by_mood",
  "render_experience_cards",
] as const;

const PUBLIC_AGENT_INPUT_KEYS: Record<string, readonly string[]> = {
  search_experiences: [
    "category",
    "city",
    "indoor_outdoor",
    "language",
    "limit",
    "max_price",
    "min_rating",
    "min_review_count",
    "popular_only",
    "query",
    "restrict_to_top_rated",
    "tags",
  ],
  search_local_experiences: [
    "city",
    "date_from",
    "date_to",
    "language",
    "limit",
    "neighbourhood",
    "place_hint",
    "radius_hint",
    "tags",
  ],
  whats_on_tonight: ["category", "city", "language", "max_results"],
  get_last_minute: ["city", "hours", "language"],
  get_whats_on_this_week: ["city", "language"],
  recommend_experiences: ["city", "language", "limit", "query"],
  get_city_guide: ["city", "language"],
  get_travel_tips: ["city", "language"],
  compare_experiences: ["language", "slugs"],
  get_hidden_gems: ["city", "language", "max_results"],
  get_family_day: ["city", "date", "language"],
  get_date_night: ["city", "date", "language"],
  plan_itinerary: ["audience", "city", "days", "language"],
  list_cities: ["country", "language", "limit"],
  get_experience_details: ["language", "product_id", "slug"],
  get_related_experiences: ["context", "language", "max_results", "product_id"],
  get_availability: [
    "as_of",
    "city_slug",
    "date_from",
    "date_to",
    "fresh",
    "party_size",
    "preferred_time",
    "product_id",
    "slug",
  ],
  check_availability: ["date", "language", "party_size", "slug"],
  search_by_mood: ["city", "language", "limit", "mood"],
  render_experience_cards: ["experience_ids", "render_type"],
};

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(directory, entry.name), relative)));
    } else {
      files.push(relative);
    }
  }
  return files.sort();
}

describe("Agent Plugin distribution", () => {
  it("keeps every public client on the read-only agent surface", async () => {
    const portable = JSON.parse(await readFile(path.join(root, "mcp.json"), "utf8"));
    const repository = JSON.parse(await readFile(path.join(root, ".mcp.json"), "utf8"));
    const codex = JSON.parse(
      await readFile(path.join(root, ".codex-plugin/plugin.json"), "utf8"),
    );
    expect(codex.mcpServers).toBe("./.mcp.json");
    const codexConfig = JSON.parse(
      await readFile(path.resolve(root, codex.mcpServers), "utf8"),
    );
    const claudeCode = JSON.parse(
      await readFile(path.join(root, ".claude/settings.json"), "utf8"),
    );
    const claudeDirectory = JSON.parse(
      await readFile(path.join(root, "distribution/claude/.mcp.json"), "utf8"),
    );
    const copilot = JSON.parse(
      await readFile(path.join(root, "clients/github-copilot/mcp.json"), "utf8"),
    );
    const managedClaude = JSON.parse(
      await readFile(path.join(root, "clients/anthropic-managed-agents/agent.json"), "utf8"),
    );
    const gemini = JSON.parse(
      await readFile(path.join(root, "gemini-extension.json"), "utf8"),
    );
    const registry = JSON.parse(await readFile(path.join(root, "server.json"), "utf8"));
    const smithery = await readFile(path.join(root, "smithery.yaml"), "utf8");
    const bridgeConfig = await readFile(path.join(root, "src/config.ts"), "utf8");
    const syncScript = await readFile(
      path.join(root, "scripts/sync-server-json.mjs"),
      "utf8",
    );

    expect([
      portable.mcpServers.tickadoo.url,
      repository.mcpServers.tickadoo.url,
      codexConfig.mcpServers.tickadoo.url,
      claudeCode.mcpServers.tickadoo.url,
      claudeDirectory.mcpServers.tickadoo.url,
      copilot.mcpServers.tickadoo.url,
      managedClaude.mcp_servers[0]?.url,
      gemini.mcpServers.tickadoo.httpUrl,
      registry.remotes[0]?.url,
    ]).toEqual(Array(9).fill(PUBLIC_AGENT_URL));
    expect(smithery).toMatch(/^\s{2}url:\s+https:\/\/mcp\.tickadoo\.com\/mcp\/agents\s*$/m);
    expect(bridgeConfig).toContain(`DEFAULT_TICKADOO_MCP_URL = "${PUBLIC_AGENT_URL}"`);
    expect(syncScript).toContain(`canonicalRemoteUrl = "${PUBLIC_AGENT_URL}"`);

    const claudeSubmission = await readFile(
      path.join(root, "docs/claude-directory-submission.md"),
      "utf8",
    );
    const encodedPublicAgentUrl = encodeURIComponent(PUBLIC_AGENT_URL);
    expect(claudeSubmission).toContain(`connectorUrl=${encodedPublicAgentUrl}`);
    expect(claudeSubmission).not.toContain(
      "connectorUrl=https%3A%2F%2Fmcp.tickadoo.com%2Fmcp\n",
    );
    const normalizedClaudeSubmission = claudeSubmission.replace(/\s+/g, " ");
    expect(normalizedClaudeSubmission).toContain("three to five PNG screenshots");
    expect(normalizedClaudeSubmission).toContain("at least 1,000");
    expect(normalizedClaudeSubmission).toContain(
      "not bought, sponsored or changed by compensation",
    );
    expect(normalizedClaudeSubmission).toContain(
      "has documented rights to proxy every underlying inventory API",
    );

    const openAiSubmission = await readFile(
      path.join(root, "docs/openai-plugin-submission.md"),
      "utf8",
    );
    const normalizedOpenAiSubmission = openAiSubmission.replace(/\s+/g, " ");
    expect(normalizedOpenAiSubmission).toContain("exactly 706 pixels wide");
    expect(normalizedOpenAiSubmission).toContain("400-860 pixels tall");
    expect(normalizedOpenAiSubmission).toContain(
      "annotation justifications are no longer required",
    );
    expect(normalizedOpenAiSubmission).toContain("openWorldHint");
    expect(normalizedOpenAiSubmission).toContain(
      "Treat an annotation mismatch as a server release blocker",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "select a version that differs from every uploaded version",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "eligible commerce as physical goods and excludes digital products and services",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "Do not set `commerce: false`",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "current 20-tool scan exposes raw location fields",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "do not remove one tool and assume the remaining surface is compliant",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "Projects configured for EU data residency cannot currently submit",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "permits a path change on the same scheme, hostname and port",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "request IDs, verification timestamps, provenance levels and per-slot idempotency keys",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "holds documented rights to use and proxy every underlying inventory API",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "Screenshots are no longer shown in the Directory",
    );
    expect(normalizedOpenAiSubmission).toContain(
      "intentionally omits `review.demo_recording_url`",
    );

    const museEndpointFiles = [
      "README.md",
      "INSTALL.md",
      "FORM-OVERVIEW.md",
      "FORM-STEP2.md",
      "SKILL.md",
      "EVALS.md",
      "SUBMISSION.md",
      "muse.md",
    ];
    for (const file of museEndpointFiles) {
      const contents = await readFile(path.join(root, "connectors/muse", file), "utf8");
      expect(contents, file).toContain(PUBLIC_AGENT_URL);
      expect(contents, file).not.toMatch(
        /https:\/\/mcp\.tickadoo\.com\/mcp(?=$|["'`\s,)])/m,
      );
    }

    const museStandaloneFiles = (
      await listFiles(path.join(root, "connectors/muse"))
    ).filter(file => file.endsWith(".md"));
    expect(museStandaloneFiles).toHaveLength(9);
    for (const file of museStandaloneFiles) {
      const contents = await readFile(path.join(root, "connectors/muse", file), "utf8");
      const normalized = contents.replace(/\s+/g, " ").trim();
      expect(normalized, `${file}: deployment gate`).toContain(MUSE_DEPLOYMENT_GATE);
      expect(contents, `${file}: stale deployment claim`).not.toMatch(
        /works today|works before directory approval|submit today|both are reachable|answers initialize in\s*~|works from the public internet|live-tested the same morning|anyone can still connect|last live pass|remains? live/i,
      );
      expect(contents, `${file}: personal submitter details`).not.toMatch(
        /francis(?:hellyer|@tickadoo\.com)/i,
      );
      expect(contents, `${file}: unverified inventory claim`).not.toMatch(
        /official[- ]primary|primary stock|purchase is first-party|official (?:theatre|attraction|experience) tickets|tickets? (?:are|is) fulfilled by tickadoo|mobile tickets? (?:are|is) fulfilled by tickadoo|ticket fulfilment (?:happens|stays) on tickadoo|(?:mobile\s+)?tickets?\s+(?:are|is)\s+delivered\b|tickadoo\s+delivers?\b/i,
      );
      expect(contents, `${file}: stale public tool count`).not.toMatch(
        /\b22(?:[- ]tool|\s+read-only)/i,
      );
    }
  });

  it("keeps every Muse JSON request inside the frozen public-agent input contract", async () => {
    expect(Object.keys(PUBLIC_AGENT_INPUT_KEYS)).toEqual(
      Array.from(EXPECTED_PUBLIC_AGENT_TOOLS),
    );

    const museFiles = (await listFiles(path.join(root, "connectors/muse"))).filter(
      file => file.endsWith(".md"),
    );
    let parsedPayloads = 0;
    for (const file of museFiles) {
      const contents = await readFile(path.join(root, "connectors/muse", file), "utf8");
      for (const match of contents.matchAll(/(?:^|\s)-d\s+'(\{[^\r\n]*\})'/gm)) {
        parsedPayloads += 1;
        const request = JSON.parse(match[1]) as {
          method?: string;
          params?: { name?: string; arguments?: Record<string, unknown> };
        };
        if (request.method !== "tools/call") continue;

        const toolName = request.params?.name;
        expect(toolName, `${file}: missing tool name`).toBeTypeOf("string");
        expect(EXPECTED_PUBLIC_AGENT_TOOLS, `${file}: non-public tool`).toContain(
          toolName,
        );
        const allowedInputs = PUBLIC_AGENT_INPUT_KEYS[toolName ?? ""];
        expect(allowedInputs, `${file}: missing frozen input contract`).toBeDefined();
        for (const input of Object.keys(request.params?.arguments ?? {})) {
          expect(allowedInputs, `${file}: ${toolName}.${input} is not public`).toContain(
            input,
          );
        }
      }
    }
    expect(parsedPayloads).toBe(5);
  });

  it("keeps the prepared release checklist gated on the public-agent endpoint", async () => {
    const checklist = await readFile(path.join(root, "docs/release-2.1.0.md"), "utf8");
    expect(checklist).toContain("Status: **prepared only**");
    expect(checklist).toContain(
      "after Howard deploys the public-agent endpoint",
    );
    expect(checklist).toContain(PUBLIC_AGENT_URL);
    expect(checklist).not.toMatch(
      /https:\/\/mcp\.tickadoo\.com\/mcp(?=$|["'`\s,);])/m,
    );
  });

  it("provides a repo marketplace for ChatGPT and Codex discovery", async () => {
    const portable = JSON.parse(await readFile(path.join(root, "plugin.json"), "utf8")) as {
      name: string;
    };
    const codex = JSON.parse(
      await readFile(path.join(root, ".codex-plugin/plugin.json"), "utf8"),
    ) as {
      interface: { category: string };
    };
    const marketplace = JSON.parse(
      await readFile(path.join(root, ".agents/plugins/marketplace.json"), "utf8"),
    ) as {
      name: string;
      interface: { displayName: string };
      plugins: Array<{
        name: string;
        source: { source: string; path: string };
        policy: { installation: string; authentication: string };
        category: string;
      }>;
    };

    expect(marketplace.name).toBe("tickadoo-agent-plugins");
    expect(marketplace.interface.displayName).toBe("tickadoo Agent Plugins");
    expect(marketplace.plugins).toEqual([
      {
        name: portable.name,
        source: { source: "local", path: "./" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: codex.interface.category,
      },
    ]);
    expect(JSON.stringify(marketplace)).not.toMatch(
      /authorization|bearer|token|secret|password|api[_-]?key|cf-access/i,
    );
  });

  it("provides a strict GitHub Copilot marketplace entry for the portable root", async () => {
    const manifest = JSON.parse(await readFile(path.join(root, "plugin.json"), "utf8")) as {
      name: string;
      version: string;
      description: string;
    };
    const marketplace = JSON.parse(
      await readFile(path.join(root, ".github/plugin/marketplace.json"), "utf8"),
    ) as {
      name: string;
      owner: { name: string };
      metadata: { version: string };
      plugins: Array<{
        name: string;
        version: string;
        description: string;
        source: string;
        strict: boolean;
      }>;
    };

    expect(marketplace.name).toBe("tickadoo-agent-plugins");
    expect(marketplace.owner.name).toBe("tickadoo Inc.");
    expect(marketplace.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(marketplace.plugins).toHaveLength(1);
    expect(marketplace.plugins[0]).toMatchObject({
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      source: ".",
      strict: true,
    });
  });

  it("provides a strict Claude Code marketplace for the native plugin", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, ".claude-plugin/plugin.json"), "utf8"),
    ) as {
      name: string;
      description: string;
      author: { name: string; url: string };
      homepage: string;
      repository: string;
      license: string;
      keywords: string[];
    };
    const marketplace = JSON.parse(
      await readFile(path.join(root, ".claude-plugin/marketplace.json"), "utf8"),
    ) as {
      name: string;
      owner: { name: string; url: string };
      description: string;
      metadata: { description: string };
      plugins: Array<Record<string, unknown>>;
    };

    expect(marketplace.name).toBe("tickadoo-agent-plugins");
    expect(marketplace.owner).toEqual({
      name: "tickadoo Inc.",
      url: "https://www.tickadoo.com",
    });
    expect(marketplace.metadata.description).toBe(marketplace.description);
    expect(marketplace.plugins).toHaveLength(1);
    expect(marketplace.plugins[0]).toMatchObject({
      name: manifest.name,
      source: "./",
      description: manifest.description,
      author: manifest.author,
      homepage: manifest.homepage,
      repository: manifest.repository,
      license: manifest.license,
      keywords: manifest.keywords,
      strict: true,
    });
    expect(marketplace.plugins[0]).not.toHaveProperty("version");
    expect(JSON.stringify(marketplace)).not.toMatch(
      /authorization|bearer|token|secret|password|api[_-]?key|cf-access/i,
    );
  });

  it("provides a minimal Claude public-directory plugin folder", async () => {
    const directory = path.join(root, "distribution/claude");
    const files = await listFiles(directory);
    const expectedFiles = [
      ".claude-plugin/plugin.json",
      ".mcp.json",
      "LICENSE",
      "README.md",
      "skills/tickadoo-experiences/SKILL.md",
    ].sort();
    const manifest = JSON.parse(
      await readFile(path.join(directory, ".claude-plugin/plugin.json"), "utf8"),
    ) as {
      name: string;
      version: string;
      description: string;
      author: { name: string; url: string };
      license: string;
    };
    const rootManifest = JSON.parse(
      await readFile(path.join(root, ".claude-plugin/plugin.json"), "utf8"),
    ) as { name: string; version: string };
    const mcp = JSON.parse(await readFile(path.join(directory, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { type: string; url: string }>;
    };
    const readme = await readFile(path.join(directory, "README.md"), "utf8");
    const rootReadme = await readFile(path.join(root, "README.md"), "utf8");
    const skill = await readFile(
      path.join(directory, "skills/tickadoo-experiences/SKILL.md"),
      "utf8",
    );

    expect(files).toEqual(expectedFiles);
    expect(manifest).toMatchObject({
      name: rootManifest.name,
      version: rootManifest.version,
      author: { name: "tickadoo Inc.", url: "https://www.tickadoo.com" },
      license: "MIT",
    });
    expect(manifest.description.length).toBeGreaterThan(0);
    expect(manifest.description.length).toBeLessThanOrEqual(2_000);
    expect(mcp.mcpServers).toEqual({
      tickadoo: { type: "http", url: "https://mcp.tickadoo.com/mcp/agents" },
    });
    expect(readme.match(/\b[\p{L}\p{N}][\p{L}\p{N}'-]*\b/gu)?.length ?? 0).toBeGreaterThanOrEqual(40);
    expect(readme).toContain("https://www.tickadoo.com/privacy");
    expect(readme).toContain("https://www.tickadoo.com/contact");
    expect(readme).toContain("Checkout and payment happen");
    expect(readme).toContain("structured tool-call metadata");
    expect(readme).toMatch(/must not claim a\s+blanket 30- or 90-day deletion period/);
    expect(readme).not.toMatch(/does not collect, store, or require personal data/i);
    expect(rootReadme).toContain("structured tool-call metadata");
    expect(rootReadme).not.toMatch(/does not collect, store, or require personal data/i);
    expect(skill).toMatch(/^---\nname: tickadoo-experiences\n/);
    expect(skill).toMatch(/\ndescription: .+\n---\n/);
    expect(skill).not.toMatch(/\b(?:ChatGPT|Codex|OpenAI)\b/);
    expect(skill).not.toMatch(/immediately\s+after\s+any|always\s+call|exactly\s+once|ignore\s+previous/i);
    expect(skill).toMatch(/does not expose\s+`report_quality_signal`/);
    expect(skill).not.toMatch(/call `report_quality_signal`/i);

    const resolvedDirectory = await realpath(directory);
    for (const file of files) {
      const candidate = path.join(directory, file);
      const stat = await lstat(candidate);
      expect(stat.isFile(), file).toBe(true);
      expect(stat.isSymbolicLink(), file).toBe(false);
      expect(stat.size, file).toBeLessThanOrEqual(256 * 1024);
      expect(await realpath(candidate)).toSatisfy((resolved) =>
        resolved.startsWith(`${resolvedDirectory}${path.sep}`),
      );
      const source = await readFile(candidate, "utf8");
      expect(source, file).not.toMatch(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/i);
      expect(source, file).not.toMatch(/"Authorization"\s*:/i);
      expect(source, file).not.toMatch(
        /\$\{[^}]*(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY)[^}]*\}/i,
      );
      expect(source, file).not.toMatch(/(?:sk|ghp|github_pat|AKIA)[-_A-Za-z0-9]{12,}/);
      expect(source, file).not.toMatch(/https?:\/\/[^/\s]+:[^@/\s]+@/);
    }
    expect(await readFile(path.join(directory, "LICENSE"), "utf8")).toBe(
      await readFile(path.join(root, "LICENSE"), "utf8"),
    );
    expect(
      await readFile(
        path.join(root, ".claude/skills/tickadoo-experiences/SKILL.md"),
        "utf8",
      ),
    ).toBe(await readFile(path.join(root, "skills/tickadoo-experiences/SKILL.md"), "utf8"));
  });

  it("matches GitHub Copilot native plugin discovery conventions", async () => {
    const manifest = JSON.parse(await readFile(path.join(root, "plugin.json"), "utf8")) as {
      name: string;
    };
    const copilotMcp = JSON.parse(await readFile(path.join(root, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { type: string; url: string }>;
    };
    const skills = [
      "compare-before-you-book",
      "date-night",
      "family-day-out",
      "near-a-landmark",
      "plan-a-trip",
      "tickadoo-experiences",
      "tonight-and-last-minute",
    ];

    expect(manifest.name).toBe("tickadoo-experiences");
    expect(Object.keys(copilotMcp.mcpServers)).toEqual(["tickadoo"]);
    expect(copilotMcp.mcpServers.tickadoo.type).toBe("http");
    expect(copilotMcp.mcpServers.tickadoo.url).toBe("https://mcp.tickadoo.com/mcp/agents");
    for (const skill of skills) {
      expect(await readFile(path.join(root, "skills", skill, "SKILL.md"), "utf8")).toContain(
        `name: ${skill}`,
      );
    }
  });

  it("ships the portable package and client adapters in the npm tarball", () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      main: string;
      bin: Record<string, string>;
      publishConfig: { access: string; provenance: boolean };
    };
    const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: root,
      encoding: "utf8",
    });
    const report = JSON.parse(output) as Array<{ files: Array<{ path: string; mode: number }> }>;
    const packed = new Map(report[0].files.map((file) => [file.path, file]));
    const expectedFiles = [
      ".claude-plugin/marketplace.json",
      ".claude-plugin/plugin.json",
      ".mcp.json",
      ".codex-plugin/plugin.json",
      "CHANGELOG.md",
      "LICENSE",
      "README.md",
      "brand/apps-directory-icon-monochrome.svg",
      "brand/apps-directory-icon.svg",
      "clients/anthropic-managed-agents/agent.json",
      "clients/github-copilot/mcp.json",
      "dist/index.js",
      "docs/agent-plugins.md",
      "evals/agent-plugin-scenarios.json",
      "mcp.json",
      "metadata/public-agent-tools.json",
      "package.json",
      "plugin.json",
      "schemas/agent-plugins/1.0.0/mcp.schema.json",
      "schemas/agent-plugins/1.0.0/plugin.schema.json",
      "schemas/agent-plugins/1.0.0/SHA256SUMS",
      "server.json",
      "skills/compare-before-you-book/SKILL.md",
      "skills/date-night/SKILL.md",
      "skills/family-day-out/SKILL.md",
      "skills/near-a-landmark/SKILL.md",
      "skills/plan-a-trip/SKILL.md",
      "skills/tickadoo-experiences/SKILL.md",
      "skills/tonight-and-last-minute/SKILL.md",
    ].sort();
    expect([...packed.keys()].sort()).toEqual(expectedFiles);
    expect(packageJson.main).toBe("dist/index.js");
    expect(packageJson.bin).toEqual({ "mcp-server": "dist/index.js" });
    expect(packageJson.publishConfig).toEqual({ access: "public", provenance: true });
    expect(readFileSync(path.join(root, "dist/index.js"), "utf8")).toMatch(
      /^#!\/usr\/bin\/env node\n/,
    );
    expect((packed.get("dist/index.js")?.mode ?? 0) & 0o111).not.toBe(0);
    expect([...packed.keys()].filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file))).toHaveLength(7);
  });

  it("defines a minimal, contained OpenAI submission ZIP", async () => {
    const allowlist = JSON.parse(
      await readFile(path.join(root, "scripts/openai-plugin-files.json"), "utf8"),
    ) as { files: string[]; sourceOverrides: Record<string, string> };
    const expectedFiles = [
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
    ];
    const manifest = JSON.parse(await readFile(path.join(root, "plugin.json"), "utf8")) as {
      extensions: {
        "com.openai": {
          interface: { composerIcon: string; logo: string };
          onboardingSkill: string;
        };
      };
    };

    expect(allowlist.files).toEqual(expectedFiles);
    expect(new Set(allowlist.files).size).toBe(allowlist.files.length);
    expect(allowlist.files.length).toBeLessThanOrEqual(5_000);
    expect(allowlist.files.filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file))).toHaveLength(7);
    expect(allowlist.files).not.toContain(".codex-plugin/plugin.json");
    expect(allowlist.files).not.toContain(".app.json");
    expect(allowlist.files).not.toContain("package.json");
    expect(allowlist.sourceOverrides).toEqual({
      "mcp.json": "distribution/openai/mcp.json",
    });

    const portableManifestText = await readFile(path.join(root, "plugin.json"), "utf8");
    expect(portableManifestText).not.toMatch(/openai\/ui|events\/(?:list|subscribe|unsubscribe)/i);
    expect(portableManifestText).not.toMatch(/sidebar|thread panel|file viewer|automation/i);

    const portableMcp = JSON.parse(await readFile(path.join(root, "mcp.json"), "utf8")) as {
      mcpServers: Record<string, { url: string }>;
    };
    const openaiMcp = JSON.parse(
      await readFile(path.join(root, allowlist.sourceOverrides["mcp.json"]), "utf8"),
    ) as { mcpServers: Record<string, { type: string; url: string }> };
    expect(portableMcp.mcpServers.tickadoo.url).toBe(PUBLIC_AGENT_URL);
    expect(openaiMcp.mcpServers.tickadoo).toEqual({
      type: "streamable-http",
      url: OPENAI_LISTING_URL,
    });

    const openai = manifest.extensions["com.openai"];
    for (const reference of [
      openai.interface.composerIcon,
      openai.interface.logo,
      openai.onboardingSkill,
    ]) {
      expect(allowlist.files).toContain(reference.replace(/^\.\//, ""));
    }

    const unavailableOpenaiTools = [
      "find_nearby_experiences",
      "get_related_experiences",
      "report_quality_signal",
    ];

    const resolvedRoot = await realpath(root);
    let uncompressedBytes = 0;
    for (const file of allowlist.files) {
      expect(path.isAbsolute(file), file).toBe(false);
      expect(file.split(path.posix.sep)).not.toContain("..");
      const source = allowlist.sourceOverrides[file] ?? file;
      expect(path.isAbsolute(source), source).toBe(false);
      expect(source.split(path.posix.sep)).not.toContain("..");
      const candidate = path.join(root, source);
      const stat = await lstat(candidate);
      expect(stat.isFile(), file).toBe(true);
      expect(stat.isSymbolicLink(), file).toBe(false);
      expect(await realpath(candidate)).toSatisfy((resolved) =>
        resolved.startsWith(`${resolvedRoot}${path.sep}`),
      );
      const contents = await readFile(candidate, "utf8");
      const memberBytes = Buffer.byteLength(contents);
      expect(memberBytes, `${file}: OpenAI member size`).toBeLessThanOrEqual(
        100 * 1024 * 1024,
      );
      uncompressedBytes += memberBytes;
      expect(contents, file).not.toMatch(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/i);
      expect(contents, file).not.toMatch(/"Authorization"\s*:/i);
      expect(contents, file).not.toMatch(
        /\$\{[^}]*(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY)[^}]*\}/i,
      );
      expect(contents, file).not.toMatch(/(?:sk|ghp|github_pat|AKIA)[-_A-Za-z0-9]{12,}/);
      expect(contents, file).not.toMatch(/https?:\/\/[^/\s]+:[^@/\s]+@/);
      if (/^skills\/[^/]+\/SKILL\.md$/.test(file)) {
        for (const tool of unavailableOpenaiTools) {
          if (!contents.includes(`\`${tool}\``)) continue;
          if (tool === "report_quality_signal") {
            expect(contents, file).toMatch(
              /(?:do not expose `report_quality_signal`|not exposed on every client surface|if `report_quality_signal` is available in the connected tool set)/i,
            );
          } else {
            const lines = contents.split("\n");
            const guardedIndex = lines.findIndex((line) => line.includes(`\`${tool}\``));
            const guardedContext = lines
              .slice(Math.max(0, guardedIndex - 1), guardedIndex + 2)
              .join(" ");
            expect(guardedContext, `${file}: ${tool}`).toMatch(
              /(?:do not (?:use|call).*from ChatGPT|Non-ChatGPT only|does not expose|when exposed)/i,
            );
          }
        }
      }
    }
    expect(uncompressedBytes, "OpenAI extracted archive size").toBeLessThanOrEqual(
      512 * 1024 * 1024,
    );

    const builder = await readFile(path.join(root, "scripts/build-openai-plugin-zip.mjs"), "utf8");
    expect(builder).toContain("MAX_COMPRESSED_ZIP_BYTES = 100_000_000");
    expect(builder).toContain("MAX_ARCHIVE_ENTRIES = 5_000");
    expect(builder).toContain("MAX_ARCHIVE_MEMBER_BYTES = 100 * 1024 * 1024");
    expect(builder).toContain("MAX_UNCOMPRESSED_ZIP_BYTES = 512 * 1024 * 1024");
    expect(builder).toContain("MAX_ARCHIVE_PATH_SEGMENTS = 20");
    expect(builder).toContain("renameSync(temporaryOutputPath, outputPath)");
    expect(builder).not.toContain("rmSync(outputPath");
  });

  it("keeps new OpenAI extensions and MCP Events behind runtime gates", async () => {
    const architecture = await readFile(path.join(root, "docs/agent-plugins.md"), "utf8");
    const submission = await readFile(path.join(root, "docs/openai-plugin-submission.md"), "utf8");

    for (const document of [architecture, submission]) {
      expect(document).toContain("https://developers.openai.com/plugins/build/extensions");
      expect(document).toContain("MCP Events");
      expect(document).toContain(
        "https://help.openai.com/en/articles/6825453-chatgpt-release-notes",
      );
      expect(document).toContain("events/list");
      expect(document).toContain("events/subscribe");
      expect(document).toContain("events/unsubscribe");
      expect(document).toMatch(/separately authenticated/i);
      expect(document).toMatch(/must never reserve,\s*buy/i);
      expect(document).toMatch(/Live Voice/i);
    }

    expect(architecture).toContain('invoked with `{}`');
    expect(architecture).toContain("must never be invented");
    expect(submission).toContain('_meta["openai/ui"].entrypoints');
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
    const snapshot = JSON.parse(
      await readFile(path.join(root, "metadata/public-agent-tools.json"), "utf8"),
    ) as {
      tools: Array<{
        name: string;
        annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
      }>;
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
      snapshot.tools.map((tool) => [tool.name, tool]),
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

  it("ships a default-deny Claude Managed Agents adapter", async () => {
    const adapter = JSON.parse(
      await readFile(path.join(root, "clients/anthropic-managed-agents/agent.json"), "utf8"),
    ) as {
      model: { id: string };
      system: string;
      mcp_servers: Array<{ type: string; name: string; url: string }>;
      tools: Array<{
        type: string;
        mcp_server_name: string;
        default_config: { enabled: boolean; permission_policy: { type: string } };
        configs: Array<{
          name: string;
          enabled: boolean;
          permission_policy: { type: string };
        }>;
      }>;
    };
    const portable = JSON.parse(await readFile(path.join(root, "mcp.json"), "utf8")) as {
      mcpServers: Record<string, { url: string }>;
    };
    const copilot = JSON.parse(
      await readFile(path.join(root, "clients/github-copilot/mcp.json"), "utf8"),
    ) as { mcpServers: Record<string, { tools: string[] }> };
    const snapshot = JSON.parse(
      await readFile(path.join(root, "metadata/public-agent-tools.json"), "utf8"),
    ) as {
      tools: Array<{
        name: string;
        annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
      }>;
    };

    expect(adapter.model.id).toBe("claude-sonnet-5");
    expect(adapter.system).toContain("Ground recommendations in tool results");
    expect(adapter.mcp_servers).toEqual([
      {
        type: "url",
        name: "tickadoo",
        url: portable.mcpServers.tickadoo.url,
      },
    ]);
    expect(adapter.tools).toHaveLength(1);
    const toolset = adapter.tools[0];
    expect(toolset.type).toBe("mcp_toolset");
    expect(toolset.mcp_server_name).toBe("tickadoo");
    expect(toolset.default_config).toEqual({
      enabled: false,
      permission_policy: { type: "always_ask" },
    });
    expect(toolset.configs.map((config) => config.name)).toEqual(
      copilot.mcpServers.tickadoo.tools,
    );
    expect(toolset.configs.every((config) => config.enabled)).toBe(true);
    expect(
      toolset.configs.every((config) => config.permission_policy.type === "always_allow"),
    ).toBe(true);

    const metadata = new Map(
      snapshot.tools.map((tool) => [
        tool.name,
        tool,
      ]),
    );
    for (const config of toolset.configs) {
      const tool = metadata.get(config.name);
      expect(tool, `unknown Claude tool ${config.name}`).toBeDefined();
      expect(tool?.annotations?.readOnlyHint, `${config.name}: readOnlyHint`).toBe(true);
      expect(tool?.annotations?.destructiveHint, `${config.name}: destructiveHint`).toBe(false);
    }
    expect(toolset.configs.map((config) => config.name)).not.toContain("report_quality_signal");
    expect(toolset.configs.map((config) => config.name)).not.toContain("render_experience_cards");
    expect(JSON.stringify(adapter)).not.toMatch(
      /authorization|bearer|token|secret|password|api[_-]?key|cf-access/i,
    );
  });

  it("keeps provider-neutral scenarios closed over shipped skills and frozen tool metadata", async () => {
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
    };
    const snapshot = JSON.parse(
      await readFile(path.join(root, "metadata/public-agent-tools.json"), "utf8"),
    ) as {
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
    expect(server.description.length).toBeLessThanOrEqual(100);
    const publicAgentTools = snapshot.tools;
    const knownTools = new Set(publicAgentTools.map((tool) => tool.name));
    for (const tool of publicAgentTools) {
      expect(tool.title?.length, `${tool.name}: snapshot title`).toBeGreaterThan(0);
      expect(tool.annotations?.title, `${tool.name}: annotation title`).toBe(tool.title);
      expect(typeof tool.annotations?.readOnlyHint, `${tool.name}: readOnlyHint`).toBe("boolean");
      expect(typeof tool.annotations?.destructiveHint, `${tool.name}: destructiveHint`).toBe("boolean");
      expect(typeof tool.annotations?.idempotentHint, `${tool.name}: idempotentHint`).toBe("boolean");
      expect(typeof tool.annotations?.openWorldHint, `${tool.name}: openWorldHint`).toBe("boolean");
    }
    expect(publicAgentTools.map((tool) => tool.name)).toEqual(EXPECTED_PUBLIC_AGENT_TOOLS);
    expect(publicAgentTools).toHaveLength(20);
    expect(publicAgentTools.some((tool) => tool.name === "report_quality_signal")).toBe(false);
    expect(publicAgentTools.some((tool) => tool.name === "find_nearby_experiences")).toBe(false);
    expect(publicAgentTools.some((tool) => tool.name === "get_transfer_info")).toBe(false);
    expect(
      publicAgentTools.every(
        (tool) =>
          tool.annotations?.readOnlyHint === true &&
          tool.annotations?.destructiveHint === false,
      ),
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
    for (const scenarioId of ["family-day", "date-night", "near-place"]) {
      expect(
        corpus.scenarios.find((scenario) => scenario.id === scenarioId)?.requiredTools,
        `${scenarioId}: shown results must use the shipped card-rendering workflow`,
      ).toContain("render_experience_cards");
    }
    expect(corpus.scenarios.find((scenario) => scenario.id === "privacy-and-supplier-boundary")?.requiredTools).toEqual([]);
    expect(corpus.scenarios.find((scenario) => scenario.id === "feedback-consent")?.requiredTools).toEqual([]);
  });
});
