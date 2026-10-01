import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PUBLIC_DESCRIPTION =
  "Discover and book theatre, tours, attractions, and live experiences worldwide. Search, compare, check live availability, plan itineraries, and get direct tickadoo booking links. No API key required.";
const REGISTRY_DESCRIPTION =
  "Discover and book theatre, tours, attractions, and live experiences worldwide. No API key required.";
const GEMINI_DESCRIPTION =
  "Search and book theatre, attractions, tours, and live experiences worldwide with tickadoo.";
const MCP_HOMEPAGE = "https://mcp.tickadoo.com";
const MCP_ENDPOINT = `${MCP_HOMEPAGE}/mcp`;
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
const bridgeConfig = readFileSync(
  new URL("../src/config.ts", import.meta.url),
  "utf8",
);
const agentGuidance = ["../AGENTS.md", "../CLAUDE.md"].map((relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8"),
);
const [agentsGuidance, claudeGuidance] = agentGuidance;

describe("public registry metadata", () => {
  it("keeps live agent work on GitHub Issues and completed Slack mirrors", () => {
    const prohibitiveContext =
      /\b(?:do not|don't|never|must not|mustn't|should not|shouldn't|avoid|forbid|prohibit|no longer)\b/i;
    const historicalContext =
      /\b(?:read[- ]only|historical|archive(?:d)?|frozen|legacy|retired|pre-cutover)\b/i;
    const linearWorkflowPlaceholder = /[<{]linear[-_ ]?id[}>]/i;
    const activeLinearWorkflowActions = [
      /\b(?:assign|close|comment(?:\s+on)?|create|link|open|transition|update)\s+(?:an?\s+|the\s+)?linear(?:\s+(?:issue|ticket|project|workflow|workspace))?\b/i,
      /\b(?:use|adopt)\s+linear\b/i,
      /\b(?:file|log|record)\s+(?:an?\s+|the\s+)?(?:issue|ticket)\s+(?:in|on)\s+linear\b/i,
      /\b(?:manage|track|triage)\b[^.;!?]{0,60}\b(?:in|on|with)\s+linear\b/i,
      /\b(?:link|move|transition)\b[^.;!?]{0,60}\b(?:into|to)\s+linear\b/i,
    ];
    const deprecatedLifecycleInstructions = [
      /\b(?:deterministic\s+)?(?:human-visible\s+)?lifecycle (?:events|updates|mirrors)\b/i,
      /\buse distinct\b[^\n]{0,160}\b(?:started|review[- ]ready|paused)\b/i,
      /\bsession (?:active|started|paused)\b/i,
      /\broutine\b[^\n]{0,100}\b(?:starting|progress update)\b/i,
      /:\s*(?:started|review[- ]ready|paused)\s*(?:—|-)\s*/i,
      /(?:^|\n)\s*(?:[-*]\s*)?(?:post|send|write|announce)\s+(?:a\s+)?(?:start(?:ed)?|review[- ]ready|pause(?:d)?)(?:\s+(?:message|update|mirror|chatter))?\b/im,
    ];
    const staleLifecycleExamples = [
      "Post deterministic lifecycle mirrors to #activity",
      "Use distinct STARTED, REVIEW READY, and PAUSED states",
      "session active — working on the task",
      "Routine [weekly]: progress update",
      "[agent]: STARTED — scope",
      "Post START message",
      "Slack provides visibility after deterministic lifecycle events.",
    ];
    const allowedHistoricalOrProhibitiveExamples = [
      "Do not post deterministic lifecycle updates to #activity.",
      "Never announce STARTED, REVIEW READY, or PAUSED states.",
      "Avoid session active notices.",
      "Agents must not post routine progress updates.",
      "Legacy routine progress update formats are archived.",
      "Linear has been frozen; do not open Linear issues.",
      "Legacy GRO-196 is a read-only historical reference.",
      "Use GitHub rather than Linear for live tracking.",
      "Use GitHub instead of Linear for issue tracking.",
      "Move work from Linear to GitHub.",
    ];
    const activeLinearWorkflowExamples = [
      "Create a Linear issue for this work.",
      "Update the Linear ticket before review.",
      "Track live work in Linear.",
      "Use Linear for issue tracking.",
      "File a ticket in Linear.",
    ];
    const activeLinearMixedContextExamples = [
      "Never disclose secrets; create a Linear issue for live work.",
      "Legacy IDs are archived; file a ticket in Linear for this work.",
      "Do not omit validation, and use Linear for issue tracking.",
      "Legacy notes are retained, but create a Linear issue for new work.",
    ];
    const staleLifecycleMixedContextExamples = [
      "Never disclose secrets; post deterministic lifecycle events.",
      "Legacy formats are archived; announce session active for this run.",
      "Never omit validation, and post STARTED — scope.",
      "Historical formats are archived, but announce session active now.",
    ];

    const instructionClauses = (text: string) =>
      text
        .split(/\r?\n/)
        .flatMap((line) =>
          line.split(/;\s+|[.!?]\s+|,\s+(?:and|but)\s+|\s+but\s+/i),
        )
        .map((clause) => clause.trim())
        .filter(Boolean);
    const isHistoricalOrProhibitive = (clause: string) =>
      prohibitiveContext.test(clause) || historicalContext.test(clause);
    const hasDeprecatedLifecycleInstruction = (text: string) =>
      instructionClauses(text).some(
        (clause) =>
          !isHistoricalOrProhibitive(clause) &&
          deprecatedLifecycleInstructions.some((pattern) =>
            pattern.test(clause),
          ),
      );
    const hasActiveLinearWorkflowInstruction = (text: string) =>
      instructionClauses(text).some(
        (clause) =>
          !isHistoricalOrProhibitive(clause) &&
          activeLinearWorkflowActions.some((pattern) => pattern.test(clause)),
      );

    for (const example of staleLifecycleExamples) {
      expect(hasDeprecatedLifecycleInstruction(example), example).toBe(true);
    }
    for (const example of activeLinearWorkflowExamples) {
      expect(hasActiveLinearWorkflowInstruction(example), example).toBe(true);
    }
    for (const example of activeLinearMixedContextExamples) {
      expect(hasActiveLinearWorkflowInstruction(example), example).toBe(true);
    }
    for (const example of staleLifecycleMixedContextExamples) {
      expect(hasDeprecatedLifecycleInstruction(example), example).toBe(true);
    }
    for (const example of allowedHistoricalOrProhibitiveExamples) {
      expect(hasDeprecatedLifecycleInstruction(example), example).toBe(false);
      expect(hasActiveLinearWorkflowInstruction(example), example).toBe(false);
      expect(example, example).not.toMatch(linearWorkflowPlaceholder);
    }

    for (const guidance of agentGuidance) {
      expect(guidance).not.toMatch(linearWorkflowPlaceholder);
      expect(hasDeprecatedLifecycleInstruction(guidance)).toBe(false);
      expect(hasActiveLinearWorkflowInstruction(guidance)).toBe(false);
    }

    expect(agentsGuidance).toContain("GitHub issue number");
    expect(agentsGuidance).toContain("completed-action mirror");
    expect(claudeGuidance).toContain("#<github-issue-number>");
    expect(claudeGuidance).toContain("completed-action mirror");
  });

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
      /^\s{2}url:\s+https:\/\/mcp\.tickadoo\.com\/mcp\s*$/m,
    );
    expect(smitheryYaml).toMatch(
      /^\s{2}documentation:\s+https:\/\/mcp\.tickadoo\.com\/llms\.txt\s*$/m,
    );
  });
});
