import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type ContractTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  annotations: Record<string, unknown>;
  [key: string]: unknown;
};

type Snapshot = {
  schema_version: number;
  source: string;
  endpoint: string;
  protocol_version: string;
  server_info: Record<string, unknown>;
  capabilities: Record<string, unknown>;
  instructions: string;
  tools: ContractTool[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = (await import(
  pathToFileURL(path.join(root, "scripts/public-agent-contract.mjs")).href
)) as {
  PUBLIC_AGENT_ENDPOINT: string;
  EXPECTED_PUBLIC_AGENT_TOOLS: readonly string[];
  extractCompletePublicAgentToolsPage: (
    result: Record<string, unknown>,
  ) => Record<string, unknown>[];
  stableClone: <T>(value: T) => T;
  assertPublicAgentSnapshot: (snapshot: Snapshot) => void;
  assertLivePublicAgentMatchesSnapshot: (
    live: Omit<Snapshot, "schema_version" | "source" | "endpoint">,
    snapshot: Snapshot,
  ) => void;
  publicAgentContractDigest: (snapshot: Snapshot) => string;
};

async function readSnapshot(): Promise<{ raw: string; snapshot: Snapshot }> {
  const raw = await readFile(path.join(root, "metadata/public-agent-tools.json"), "utf8");
  return { raw, snapshot: JSON.parse(raw) as Snapshot };
}

function liveFromSnapshot(snapshot: Snapshot) {
  return {
    protocol_version: snapshot.protocol_version,
    server_info: structuredClone(snapshot.server_info),
    capabilities: structuredClone(snapshot.capabilities),
    instructions: snapshot.instructions,
    tools: structuredClone(snapshot.tools),
  };
}

describe("public-agent contract", () => {
  it("pins the exact deployed 23-tool discovery-only Howard surface", async () => {
    const { raw, snapshot } = await readSnapshot();
    expect(snapshot.source).toMatch(/^tickadoo\/howard@[0-9a-f]{40}$/);
    expect(snapshot.endpoint).toBe(contract.PUBLIC_AGENT_ENDPOINT);
    expect(snapshot.tools.map(tool => tool.name)).toEqual(
      contract.EXPECTED_PUBLIC_AGENT_TOOLS,
    );
    expect(snapshot.tools).toHaveLength(23);
    expect(() => contract.assertPublicAgentSnapshot(snapshot)).not.toThrow();
    expect(contract.publicAgentContractDigest(snapshot)).toMatch(/^[0-9a-f]{64}$/);
    expect(raw).toBe(`${JSON.stringify(snapshot, null, 2)}\n`);
  });

  it("accepts an exact live representation and rejects any descriptor drift", async () => {
    const { snapshot } = await readSnapshot();
    const live = liveFromSnapshot(snapshot);
    expect(() =>
      contract.assertLivePublicAgentMatchesSnapshot(live, snapshot),
    ).not.toThrow();

    live.tools[0].description += " Unreviewed claim.";
    expect(() =>
      contract.assertLivePublicAgentMatchesSnapshot(live, snapshot),
    ).toThrow(/Live public-agent contract differs/);
  });

  it("rejects missing, extra, renamed, duplicated, or reordered tools", async () => {
    const { snapshot } = await readSnapshot();
    for (const mutate of [
      (copy: Snapshot) => copy.tools.pop(),
      (copy: Snapshot) => copy.tools.push(structuredClone(copy.tools[0])),
      (copy: Snapshot) => { copy.tools[0].name = "render_experience_cards"; },
      (copy: Snapshot) => { [copy.tools[0], copy.tools[1]] = [copy.tools[1], copy.tools[0]]; },
    ]) {
      const copy = structuredClone(snapshot);
      mutate(copy);
      expect(() => contract.assertPublicAgentSnapshot(copy)).toThrow(
        /tool closure differs/,
      );
    }
  });

  it("rejects unsafe annotations and permissive schemas", async () => {
    const { snapshot } = await readSnapshot();

    const writable = structuredClone(snapshot);
    writable.tools[0].annotations.readOnlyHint = false;
    expect(() => contract.assertPublicAgentSnapshot(writable)).toThrow(
      /unsafe annotations/,
    );

    const destructive = structuredClone(snapshot);
    destructive.tools[0].annotations.destructiveHint = true;
    expect(() => contract.assertPublicAgentSnapshot(destructive)).toThrow(
      /unsafe annotations/,
    );

    const permissive = structuredClone(snapshot);
    permissive.tools[0].outputSchema.additionalProperties = true;
    expect(() => contract.assertPublicAgentSnapshot(permissive)).toThrow(
      /closed object outputSchema root/,
    );

    const emptyInput = structuredClone(snapshot);
    emptyInput.tools[0].inputSchema = {};
    expect(() => contract.assertPublicAgentSnapshot(emptyInput)).toThrow(
      /closed object inputSchema root/,
    );

    const dynamicOutput = structuredClone(snapshot);
    dynamicOutput.tools[0].outputSchema = {
      type: "object",
      additionalProperties: false,
      patternProperties: { ".*": { type: "string" } },
    };
    expect(() => contract.assertPublicAgentSnapshot(dynamicOutput)).toThrow(
      /dynamic patternProperties/,
    );

    const indirectOutput = structuredClone(snapshot);
    indirectOutput.tools[0].outputSchema = {
      type: "object",
      additionalProperties: false,
      properties: { result: { $ref: "#/$defs/result" } },
      $defs: {
        result: { type: "object", additionalProperties: false, properties: {} },
      },
    };
    expect(() => contract.assertPublicAgentSnapshot(indirectOutput)).toThrow(
      /unresolved schema indirection/,
    );

    const externalSchema = structuredClone(snapshot);
    externalSchema.tools[0].schemaVersion = "https://schemas.example.com/search/1.0";
    expect(() => contract.assertPublicAgentSnapshot(externalSchema)).toThrow(
      /canonical tickadoo schemaVersion/,
    );

    const smuggledSchema = structuredClone(snapshot);
    smuggledSchema.tools[0].schemaVersion =
      "https://mcp.tickadoo.com/schemas/search/1.0?next=https://example.org";
    expect(() => contract.assertPublicAgentSnapshot(smuggledSchema)).toThrow(
      /canonical tickadoo schemaVersion/,
    );

    const unverifiedAvailability = structuredClone(snapshot);
    unverifiedAvailability.tools[0].description =
      "Return currently available experience candidates.";
    expect(() =>
      contract.assertPublicAgentSnapshot(unverifiedAvailability),
    ).toThrow(/claims live availability without a verification call/);

    const widgetMetadata = structuredClone(snapshot);
    widgetMetadata.tools[0]._meta = {
      "openai/outputTemplate": "ui://widget/availability/v2",
    };
    expect(() => contract.assertPublicAgentSnapshot(widgetMetadata)).toThrow(
      /must not expose Apps or widget metadata/,
    );

    const resourceCapability = structuredClone(snapshot);
    resourceCapability.capabilities.resources = { listChanged: false };
    expect(() => contract.assertPublicAgentSnapshot(resourceCapability)).toThrow(
      /must advertise only the tools capability/,
    );

    const promptCapability = structuredClone(snapshot);
    promptCapability.capabilities.prompts = { listChanged: false };
    expect(() => contract.assertPublicAgentSnapshot(promptCapability)).toThrow(
      /must advertise only the tools capability/,
    );

    const unstableToolCapability = structuredClone(snapshot);
    unstableToolCapability.capabilities.tools = { listChanged: true };
    expect(() => contract.assertPublicAgentSnapshot(unstableToolCapability)).toThrow(
      /tools capability must be closed and stable/,
    );
  });

  it("rejects a paginated tools/list response instead of accepting page one", () => {
    const tools = [{ name: "search_experiences" }];
    expect(contract.extractCompletePublicAgentToolsPage({ tools })).toEqual(tools);
    expect(() =>
      contract.extractCompletePublicAgentToolsPage({
        tools,
        nextCursor: "unsafe-second-page",
      }),
    ).toThrow(/complete catalogue without pagination/);
  });

  it("rejects transactional fields, service URLs, and purchase guidance", async () => {
    const { snapshot } = await readSnapshot();

    for (const field of [
      "booking_url",
      "book_now_confidence",
      "book_now_action",
      "checkout_url",
      "product_url",
      "href",
      "transactionLink",
      "booking_reference",
      "order_id",
      "website",
    ]) {
      const copy = structuredClone(snapshot);
      const properties = copy.tools[0].outputSchema.properties as Record<string, unknown>;
      properties[field] = { type: "string" };
      expect(() => contract.assertPublicAgentSnapshot(copy)).toThrow(
        /forbidden transactional field/,
      );
    }

    const serviceUrl = structuredClone(snapshot);
    serviceUrl.tools[0].description += " Visit https://www.tickadoo.com/example.";
    expect(() => contract.assertPublicAgentSnapshot(serviceUrl)).toThrow(
      /unreviewed URL or domain metadata/,
    );

    const rootServiceUrl = structuredClone(snapshot);
    rootServiceUrl.tools[0].description += " Visit https://tickadoo.com/example.";
    expect(() => contract.assertPublicAgentSnapshot(rootServiceUrl)).toThrow(
      /unreviewed URL or domain metadata/,
    );

    const externalServiceUrl = structuredClone(snapshot);
    externalServiceUrl.tools[0].description += " Visit tickets.example.org/checkout.";
    expect(() => contract.assertPublicAgentSnapshot(externalServiceUrl)).toThrow(
      /unreviewed URL or domain metadata/,
    );

    const dottedFieldPath = structuredClone(snapshot);
    dottedFieldPath.tools[0].description += " Reads products.tags when present.";
    expect(() => contract.assertPublicAgentSnapshot(dottedFieldPath)).not.toThrow();

    const purchaseGuidance = structuredClone(snapshot);
    purchaseGuidance.instructions += " Go directly to checkout.";
    expect(() => contract.assertPublicAgentSnapshot(purchaseGuidance)).toThrow(
      /transactional service-link guidance/,
    );

    const serverServiceUrl = structuredClone(snapshot);
    serverServiceUrl.instructions += " Continue at https://tickadoo.com/example.";
    expect(() => contract.assertPublicAgentSnapshot(serverServiceUrl)).toThrow(
      /unreviewed URL or domain metadata/,
    );

    const purchaseDescriptor = structuredClone(snapshot);
    purchaseDescriptor.tools[0].description += " Use this result to purchase tickets.";
    expect(() => contract.assertPublicAgentSnapshot(purchaseDescriptor)).toThrow(
      /transactional service-link metadata/,
    );

    const transactionalCapability = structuredClone(snapshot);
    transactionalCapability.capabilities = {
      ...transactionalCapability.capabilities,
      checkout: {},
    };
    expect(() => contract.assertPublicAgentSnapshot(transactionalCapability)).toThrow(
      /must advertise only the tools capability/,
    );

    const staleCoverage = structuredClone(snapshot);
    staleCoverage.instructions += " Available across 1,100+ cities.";
    expect(() => contract.assertPublicAgentSnapshot(staleCoverage)).toThrow(
      /stale count-bearing coverage claim/,
    );

    const staleToolCoverage = structuredClone(snapshot);
    staleToolCoverage.tools[0].description += " Searches 12,000 experiences.";
    expect(() => contract.assertPublicAgentSnapshot(staleToolCoverage)).toThrow(
      /stale count-bearing coverage claim/,
    );

    const vagueToolCoverage = structuredClone(snapshot);
    vagueToolCoverage.tools[0].description += " Searches thousands of products.";
    expect(() => contract.assertPublicAgentSnapshot(vagueToolCoverage)).toThrow(
      /stale count-bearing coverage claim/,
    );

    const adjectiveSeparatedCoverage = structuredClone(snapshot);
    adjectiveSeparatedCoverage.tools[0].description +=
      " Uses ~5,000 outdoor products tagged in the catalogue.";
    expect(() =>
      contract.assertPublicAgentSnapshot(adjectiveSeparatedCoverage),
    ).toThrow(/stale count-bearing coverage claim/);

    const boundedSelection = structuredClone(snapshot);
    boundedSelection.tools[0].description +=
      " Compare 2-5 selected experiences or 2-5 specific products.";
    expect(() => contract.assertPublicAgentSnapshot(boundedSelection)).not.toThrow();

    const untrustedImageHost = structuredClone(snapshot);
    const outputProperties = untrustedImageHost.tools[0].outputSchema
      .properties as Record<string, unknown>;
    outputProperties.image_url = {
      type: ["string", "null"],
      pattern: "^https://images.example.com/",
    };
    expect(() => contract.assertPublicAgentSnapshot(untrustedImageHost)).toThrow(
      /image_url outside the public CDN/,
    );
  });
});
