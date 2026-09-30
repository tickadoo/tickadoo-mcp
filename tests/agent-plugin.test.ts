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
    expect(manifest.keywords).toEqual([
      "tickadoo",
      "experiences",
      "tickets",
      "theatre",
      "tours",
      "attractions",
      "events",
      "booking",
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
      expect(source, `${skill}: endpoint-neutral connection wording`).toContain(
        "the MCP connection configured by this package",
      );
      expect(source, `${skill}: no hardcoded MCP endpoint`).not.toMatch(
        /(?:https?:\/\/)?mcp\.tickadoo\.com\/mcp(?:\/(?:agents|store-cards))?|(?:^|[\s("'`])\/mcp(?:\/(?:agents|store-cards))?(?=$|[\s)"'`,.;:])/im,
      );
    }
  });

  it("keeps portable skill calls inside the minimized public-agent input contract", async () => {
    const skillNames = [
      "compare-before-you-book",
      "date-night",
      "family-day-out",
      "near-a-landmark",
      "plan-a-trip",
      "tickadoo-experiences",
      "tonight-and-last-minute",
    ];
    const sources = new Map(
      await Promise.all(
        skillNames.map(async (skill) => [
          skill,
          await readFile(path.join(root, "skills", skill, "SKILL.md"), "utf8"),
        ] as const),
      ),
    );
    const allSkills = [...sources.values()].join("\n");

    // These fields exist on richer integrator surfaces but are intentionally
    // absent from the portable /mcp/agents contract shared by every client.
    for (const removedArgument of [
      "pax",
      "kids_ages",
      "render_context",
      "idempotency_key",
      "format",
    ]) {
      expect(allSkills, `removed public-agent argument: ${removedArgument}`).not.toMatch(
        new RegExp(`\\b${removedArgument}\\b`),
      );
    }
    expect(allSkills).not.toMatch(/topic\s*:/i);

    const general = sources.get("tickadoo-experiences") ?? "";
    expect(general).toContain(
      "| Natural-language ask | `recommend_experiences` | query, city?, limit?, language? |",
    );
    expect(general).toContain(
      "| Multi-day plan | `plan_itinerary` | city, days, audience?, language? |",
    );
    expect(general).toContain("| Family day | `get_family_day` | city, date?, language? |");
    expect(general).toContain("| Evening for two | `get_date_night` | city, date?, language? |");
    expect(general).toContain(
      "| Travel-related catalogue candidates | `get_travel_tips` | city, language? |",
    );
    expect(general).toContain(
      "| Show visual cards | `render_experience_cards` | experience_ids (the product_id values from the discovery result, verbatim), required render_type |",
    );
    expect(general).toContain(
      "| Date-specific link (legacy interface) | `check_availability` | slug as `city_slug/product_slug`, date, party_size |",
    );
    expect(general).toContain(
      "| Compare 2-5 specific products | `compare_experiences` | city-scoped `city_slug/product_slug` values with distinct product slugs |",
    );
    expect(sources.get("compare-before-you-book")).toMatch(
      /compare_experiences\(slugs\)[\s\S]*city_slug\/product_slug/i,
    );
    expect(sources.get("compare-before-you-book")).toMatch(
      /every `product_slug` component must be distinct/i,
    );
    for (const [skill, source] of sources) {
      if (!source.includes("check_availability")) continue;
      expect(source, `${skill}: city-scoped availability slug`).toContain(
        "city_slug/product_slug",
      );
    }
    const documentedTools = general
      .match(/## Tool selection map\n\n([\s\S]*?)(?=\n\nThe public connection)/)?.[1]
      ?.split("\n")
      .flatMap((line) => [...(line.split("|")[2] ?? "").matchAll(/`([a-z_]+)`/g)])
      .map((match) => match[1]);
    expect(documentedTools).toEqual([
      "search_experiences",
      "recommend_experiences",
      "search_by_mood",
      "search_local_experiences",
      "get_experience_details",
      "get_related_experiences",
      "get_availability",
      "check_availability",
      "compare_experiences",
      "get_city_guide",
      "whats_on_tonight",
      "get_last_minute",
      "get_whats_on_this_week",
      "plan_itinerary",
      "get_family_day",
      "get_date_night",
      "get_hidden_gems",
      "get_travel_tips",
      "list_cities",
      "render_experience_cards",
    ]);

    expect(sources.get("plan-a-trip")).toMatch(
      /call `plan_itinerary` with `city`, `days` and `audience` when known[\s\S]*interests, budget and desired pace as selection and scheduling constraints[\s\S]*do not send them as tool arguments/i,
    );
    expect(sources.get("family-day-out")).toMatch(
      /call `get_family_day` with `city` and `date` when known[\s\S]*children's ages and budget as selection constraints[\s\S]*do not send them as tool arguments/i,
    );
    expect(sources.get("date-night")).toMatch(
      /call `get_date_night` with `city` and `date` when known[\s\S]*budget as a selection constraint[\s\S]*do not send it as a tool argument/i,
    );

    const requiredWorkflowOrder: Record<string, string[]> = {
      "compare-before-you-book": [
        "search_experiences",
        "compare_experiences",
        "get_experience_details",
        "get_availability",
        "check_availability",
      ],
      "date-night": [
        "get_date_night",
        "get_experience_details",
        "get_availability",
        "check_availability",
      ],
      "family-day-out": [
        "get_family_day",
        "get_experience_details",
        "get_availability",
        "check_availability",
      ],
      "near-a-landmark": [
        "search_local_experiences",
        "get_experience_details",
        "get_availability",
        "check_availability",
      ],
      "plan-a-trip": ["get_city_guide", "plan_itinerary", "get_experience_details"],
      "tonight-and-last-minute": [
        "whats_on_tonight",
        "get_experience_details",
        "get_availability",
        "check_availability",
      ],
    };
    for (const [skill, expectedTools] of Object.entries(requiredWorkflowOrder)) {
      const workflow = sources
        .get(skill)
        ?.match(/## The workflow \(tool chain\)\n\n([\s\S]*?)(?=\n## )/)?.[1];
      expect(workflow, `${skill}: workflow section`).toBeTruthy();
      let cursor = -1;
      for (const tool of expectedTools) {
        const next = workflow?.indexOf(tool, cursor + 1) ?? -1;
        expect(next, `${skill}: ${tool} remains in workflow order`).toBeGreaterThan(cursor);
        cursor = next;
      }
    }
  });

  it("keeps discovered package files contained within the plugin root", async () => {
    const resolvedRoot = await realpath(root);
    for (const relative of [
      "plugin.json",
      "mcp.json",
      "skills",
      "server.json",
      "metadata/public-agent-tools.json",
    ]) {
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
    expect(codex.keywords).toEqual(portable.keywords);
    expect(codex.skills).toBe("./skills/");
    expect(codex.mcpServers).toBe("./.mcp.json");
    const codexServers = await readJson(path.join(root, String(codex.mcpServers)));
    const configuredServers = codexServers.mcpServers as Record<string, Record<string, unknown>>;
    expect(configuredServers.tickadoo.type).toBe("http");
    expect(configuredServers.tickadoo.url).toBe("https://mcp.tickadoo.com/mcp/agents");
    const extensions = portable.extensions as Record<string, Record<string, unknown>>;
    const portableInterface = extensions["com.openai"].interface as Record<string, unknown>;
    const { supportURL, ...portableCodexInterface } = portableInterface;
    expect(supportURL).toBe("https://www.tickadoo.com/contact");
    expect(codex.interface).toEqual(portableCodexInterface);
    expect(codex.interface).not.toHaveProperty("supportURL");
    expect(JSON.stringify(codex)).not.toMatch(/bearer|token|secret|password|api[_-]?key|cf-access/i);
  });

  it("meets the current OpenAI install-surface metadata gates", async () => {
    const portable = await readJson(path.join(root, "plugin.json"));
    const codex = await readJson(path.join(root, ".codex-plugin/plugin.json"));
    const extensions = portable.extensions as Record<string, Record<string, unknown>>;
    const openai = extensions["com.openai"];
    const pluginInterface = openai.interface as Record<string, unknown>;
    expect(Object.keys(openai).sort()).toEqual([
      "interface",
      "onboardingSkill",
      "publication",
      "review",
    ]);
    const { supportURL, ...portableCodexInterface } = pluginInterface;
    expect(supportURL).toBe("https://www.tickadoo.com/contact");
    expect(codex.interface).toEqual(portableCodexInterface);
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

    for (const field of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
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

  it("packages a complete OpenAI MCP review case set without credentials", async () => {
    const portable = await readJson(path.join(root, "plugin.json"));
    const extensions = portable.extensions as Record<string, Record<string, unknown>>;
    const openai = extensions["com.openai"] as {
      onboardingSkill: string;
      review: {
        test_cases: {
          positive: Array<{
            description: string;
            prompt: string;
            tools_triggered: string;
            expected_behavior: string;
          }>;
          negative: Array<{ description: string; prompt: string }>;
        };
        commerce: boolean;
        commerce_description: string;
      };
      publication: { release_notes: string };
    };
    const corpus = JSON.parse(
      await readFile(path.join(root, "evals/agent-plugin-scenarios.json"), "utf8"),
    ) as { scenarios: Array<{ prompt: string }> };
    const snapshot = JSON.parse(
      await readFile(path.join(root, "metadata/public-agent-tools.json"), "utf8"),
    ) as {
      tools: Array<{ name: string }>;
    };
    const knownPrompts = new Set(corpus.scenarios.map((scenario) => scenario.prompt));
    const knownTools = new Set(
      snapshot.tools.map((tool) => tool.name),
    );
    const openaiDeniedTools = new Set([
      "find_nearby_experiences",
      "get_related_experiences",
      "report_quality_signal",
    ]);
    const positive = openai.review.test_cases.positive;
    const negative = openai.review.test_cases.negative;

    expect(openai.onboardingSkill).toBe("./skills/tickadoo-experiences/SKILL.md");
    expect(await realpath(path.resolve(root, openai.onboardingSkill))).toBe(
      path.join(root, "skills/tickadoo-experiences/SKILL.md"),
    );
    expect(positive).toHaveLength(5);
    expect(negative).toHaveLength(3);
    expect(new Set([...positive, ...negative].map((testCase) => testCase.prompt)).size).toBe(8);

    for (const testCase of positive) {
      expect(testCase.description.trim()).not.toBe("");
      expect(testCase.expected_behavior.trim()).not.toBe("");
      expect(knownPrompts, testCase.prompt).toContain(testCase.prompt);
      const tools = testCase.tools_triggered.split(",").map((tool) => tool.trim());
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every((tool) => knownTools.has(tool)), testCase.tools_triggered).toBe(true);
      expect(tools.every((tool) => !openaiDeniedTools.has(tool)), testCase.tools_triggered).toBe(true);
    }
    for (const testCase of negative) {
      expect(Object.keys(testCase).sort()).toEqual(["description", "prompt"]);
      expect(testCase.description.trim()).not.toBe("");
      expect(knownPrompts, testCase.prompt).toContain(testCase.prompt);
    }
    const feedbackCase = negative.find((testCase) =>
      testCase.prompt.includes("What would happen if I reported it"),
    );
    expect(feedbackCase?.description).toMatch(/connection cannot file feedback/i);
    expect(feedbackCase?.description).toMatch(/do not .*imply.*submitted/i);

    expect(openai.review.commerce).toBe(true);
    expect(openai.review.commerce_description).toContain("not through the MCP tools");
    expect(openai.publication.release_notes.trim()).not.toBe("");
    expect(openai.publication.release_notes).not.toMatch(/^initial\b/i);
    expect(JSON.stringify(openai.review)).not.toMatch(
      /test_credentials|reviewer_instructions|authorization|bearer|password|api[_-]?key|cf-access/i,
    );
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
      "server.json",
      "metadata/public-agent-tools.json",
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
