import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

type JsonSchema = {
  type?: unknown;
  properties?: Record<string, unknown>;
  required?: unknown;
  additionalProperties?: unknown;
  [key: string]: unknown;
};

type ContractTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  annotations: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    [key: string]: unknown;
  };
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = (await import(
  pathToFileURL(path.join(root, "scripts/public-agent-contract.mjs")).href
)) as {
  expectedPublicAgentTools: string[];
  expectedOpenAIStoreCardTools: string[];
  expectedPublicAgentInputProperties: Record<string, string[]>;
  expectedPublicAgentToolDigests: Record<string, string>;
  publicAgentContractSource: string;
  publicAgentToolMetadata: (tool: ContractTool) => ContractTool;
  publicAgentToolDigest: (tool: ContractTool) => string;
  assertPublicAgentContract: (tools: ContractTool[]) => void;
};
const sync = (await import(
  pathToFileURL(path.join(root, "scripts/sync-server-json.mjs")).href
)) as {
  canonicalRemoteUrl: string;
  approvedSourceRemoteUrl: (raw?: string) => URL;
  sourceRemoteLabel: (url: URL) => string;
  createNoRedirectFetch: (baseFetch?: typeof fetch) => typeof fetch;
  createSyncTransport: (
    url: URL,
    baseFetch?: typeof fetch,
  ) => {
    start: () => Promise<void>;
    send: (message: Record<string, unknown>) => Promise<void>;
    close: () => Promise<void>;
  };
};

async function snapshotTools(): Promise<ContractTool[]> {
  const snapshot = JSON.parse(
    await readFile(path.join(root, "metadata/public-agent-tools.json"), "utf8"),
  ) as {
    tools: ContractTool[];
  };
  return snapshot.tools;
}

function cloneTools(tools: ContractTool[]): ContractTool[] {
  return structuredClone(tools);
}

describe("public agent metadata sync guard", () => {
  it("accepts exactly the frozen 20-tool Howard public-agent contract", async () => {
    const tools = await snapshotTools();
    expect(contract.publicAgentContractSource).toBe(
      "tickadoo/howard@fae9cf5c705b1f24e38d72afb4f4352e22fb0f73",
    );
    expect(contract.expectedPublicAgentTools).toHaveLength(20);
    expect(new Set(contract.expectedPublicAgentTools).size).toBe(20);
    expect(tools.map(tool => tool.name)).toEqual(contract.expectedPublicAgentTools);
    expect(() => contract.assertPublicAgentContract(tools)).not.toThrow();
    expect(Object.keys(contract.expectedPublicAgentToolDigests)).toEqual(
      contract.expectedPublicAgentTools,
    );
    for (const tool of tools) {
      expect(contract.publicAgentToolDigest(tool), tool.name).toBe(
        contract.expectedPublicAgentToolDigests[tool.name],
      );
    }
  });

  it("stores the frozen snapshot in the sync script's deterministic form", async () => {
    const raw = await readFile(
      path.join(root, "metadata/public-agent-tools.json"),
      "utf8",
    );
    const snapshot = JSON.parse(raw) as { source: string; tools: ContractTool[] };
    expect(Object.keys(snapshot)).toEqual(["source", "tools"]);
    expect(snapshot.source).toBe(contract.publicAgentContractSource);
    expect(raw).toBe(
      `${JSON.stringify({
        source: contract.publicAgentContractSource,
        tools: snapshot.tools.map(contract.publicAgentToolMetadata),
      }, null, 2)}\n`,
    );
  });

  it("freezes the exact closed input property set for every public tool", async () => {
    const tools = await snapshotTools();
    expect(Object.keys(contract.expectedPublicAgentInputProperties)).toEqual(
      contract.expectedPublicAgentTools,
    );
    for (const tool of tools) {
      expect(tool.inputSchema.type, `${tool.name}: object schema`).toBe("object");
      expect(tool.inputSchema.additionalProperties, `${tool.name}: closed schema`).toBe(false);
      expect(Object.keys(tool.inputSchema.properties ?? {}), `${tool.name}: exact inputs`).toEqual(
        contract.expectedPublicAgentInputProperties[tool.name],
      );
    }
  });

  it("includes an exact, recursively closed output schema for every public tool", async () => {
    const tools = await snapshotTools();
    expect(tools).toHaveLength(20);
    for (const tool of tools) {
      expect(tool.outputSchema, `${tool.name}: output schema`).toBeTypeOf("object");
    }
    expect(() => contract.assertPublicAgentContract(tools)).not.toThrow();
  });

  it("rejects permissive or unreviewed supplier fields in an output schema", async () => {
    const tools = await snapshotTools();
    const permissive = cloneTools(tools);
    permissive[0].outputSchema.additionalProperties = true;
    permissive[0].outputSchema.properties!.supplier_secret = { type: "string" };
    expect(() => contract.assertPublicAgentContract(permissive)).toThrow(
      /permissive object at outputSchema/,
    );

    const closedButChanged = cloneTools(tools);
    closedButChanged[0].outputSchema.properties!.supplier_secret = { type: "string" };
    expect(() => contract.assertPublicAgentContract(closedButChanged)).toThrow(
      /metadata differs/,
    );
  });

  it("describes result filtering without implying that a read-only tool is destructive", async () => {
    const search = (await snapshotTools()).find(
      tool => tool.name === "search_experiences",
    );
    const metadata = JSON.stringify(search);
    expect(metadata).toContain("HARD RESULT FILTER");
    expect(metadata).toContain("hard top-rated result filter");
    expect(metadata).not.toMatch(/DESTRUCTIVE FILTER|destructive top-rated filter/i);
  });

  it("keeps removed integrator and coordinate-bearing tools out of the portable surface", () => {
    for (const denied of [
      "report_quality_signal",
      "find_nearby_experiences",
      "get_transfer_info",
    ]) {
      expect(contract.expectedPublicAgentTools).not.toContain(denied);
    }
  });

  it("defines the distinct exact 20-tool OpenAI store-card surface", () => {
    expect(contract.expectedOpenAIStoreCardTools).toHaveLength(20);
    expect(new Set(contract.expectedOpenAIStoreCardTools).size).toBe(20);
    expect(contract.expectedOpenAIStoreCardTools).not.toEqual(
      contract.expectedPublicAgentTools,
    );
    expect(contract.expectedPublicAgentTools).toContain("get_related_experiences");
    expect(contract.expectedPublicAgentTools).not.toContain("get_transfer_info");
    expect(contract.expectedOpenAIStoreCardTools).not.toContain("get_related_experiences");
    expect(contract.expectedOpenAIStoreCardTools).toContain("get_transfer_info");
  });

  it("rejects missing, unexpected, duplicate, and reordered tools", async () => {
    const tools = await snapshotTools();
    expect(() => contract.assertPublicAgentContract(tools.slice(1))).toThrow(
      /non-public tool set/,
    );

    const unexpected = cloneTools(tools);
    unexpected[0].name = "unexpected_write_tool";
    expect(() => contract.assertPublicAgentContract(unexpected)).toThrow(
      /non-public tool set/,
    );

    const duplicate = cloneTools(tools);
    duplicate[0] = structuredClone(duplicate[1]);
    expect(() => contract.assertPublicAgentContract(duplicate)).toThrow(
      /non-public tool set/,
    );

    const reordered = cloneTools(tools);
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    expect(() => contract.assertPublicAgentContract(reordered)).toThrow(
      /order_changed=true/,
    );
  });

  it("rejects unsafe, incomplete, unexpected, and inconsistent annotations", async () => {
    const tools = await snapshotTools();
    for (const mutate of [
      (tool: ContractTool) => { tool.annotations.readOnlyHint = false; },
      (tool: ContractTool) => { tool.annotations.destructiveHint = true; },
      (tool: ContractTool) => { tool.annotations.openWorldHint = true; },
      (tool: ContractTool) => { delete tool.annotations.idempotentHint; },
      (tool: ContractTool) => { tool.annotations.unknownHint = true; },
      (tool: ContractTool) => { tool.title = "Different title"; },
    ]) {
      const changed = cloneTools(tools);
      mutate(changed[0]);
      expect(() => contract.assertPublicAgentContract(changed)).toThrow(
        /incomplete, unexpected, or unsafe annotations/,
      );
    }
  });

  it("rejects permissive, restored, removed, or otherwise changed input metadata", async () => {
    const tools = await snapshotTools();

    const permissive = cloneTools(tools);
    permissive[0].inputSchema.additionalProperties = true;
    expect(() => contract.assertPublicAgentContract(permissive)).toThrow(
      /closed object input schema/,
    );

    const restored = cloneTools(tools);
    restored.find(tool => tool.name === "recommend_experiences")!.inputSchema.properties!.pax = {
      type: "integer",
    };
    expect(() => contract.assertPublicAgentContract(restored)).toThrow(
      /input properties differ/,
    );

    const removed = cloneTools(tools);
    delete removed.find(tool => tool.name === "get_availability")!.inputSchema.properties!.fresh;
    expect(() => contract.assertPublicAgentContract(removed)).toThrow(
      /input properties differ/,
    );

    const relaxedConstraint = cloneTools(tools);
    const searchLimit = relaxedConstraint.find(
      tool => tool.name === "search_experiences",
    )!.inputSchema.properties!.limit as Record<string, unknown>;
    searchLimit.maximum = 500;
    expect(() => contract.assertPublicAgentContract(relaxedConstraint)).toThrow(
      /metadata differs/,
    );

    const requiredDrift = cloneTools(tools);
    requiredDrift.find(tool => tool.name === "search_local_experiences")!
      .inputSchema.required = [];
    expect(() => contract.assertPublicAgentContract(requiredDrift)).toThrow(
      /metadata differs/,
    );
  });

  it("rejects description drift even when tool names and schemas are unchanged", async () => {
    const tools = cloneTools(await snapshotTools());
    tools[0].description += " Unreviewed claim.";
    expect(() => contract.assertPublicAgentContract(tools)).toThrow(
      /metadata differs/,
    );
  });
});

describe("server.json sync source boundary", () => {
  it("accepts only the canonical endpoint or exact-path loopback test endpoints", () => {
    expect(sync.approvedSourceRemoteUrl().href).toBe(sync.canonicalRemoteUrl);
    expect(sync.approvedSourceRemoteUrl(sync.canonicalRemoteUrl).href).toBe(
      sync.canonicalRemoteUrl,
    );
    expect(
      sync.approvedSourceRemoteUrl("http://127.0.0.1:4317/mcp/agents").href,
    ).toBe("http://127.0.0.1:4317/mcp/agents");
    expect(
      sync.approvedSourceRemoteUrl("https://localhost:8443/mcp/agents").href,
    ).toBe("https://localhost:8443/mcp/agents");
    expect(
      sync.approvedSourceRemoteUrl("http://[::1]:4317/mcp/agents").href,
    ).toBe("http://[::1]:4317/mcp/agents");
  });

  it.each([
    "http://mcp.tickadoo.com/mcp/agents",
    "https://mcp.tickadoo.com/mcp",
    "https://mcp.tickadoo.com/mcp/agents/",
    "https://mcp.tickadoo.com/mcp/store-cards",
    "https://mcp.tickadoo.com:444/mcp/agents",
    "https://evil.example/mcp/agents",
    "https://sub.mcp.tickadoo.com/mcp/agents",
    "ftp://localhost/mcp/agents",
    "http://localhost/mcp",
    "https://user:password@mcp.tickadoo.com/mcp/agents",
    "https://mcp.tickadoo.com/mcp/agents?token=secret",
    "https://mcp.tickadoo.com/mcp/agents?",
    "https://mcp.tickadoo.com/mcp/agents#secret",
    "https://mcp.tickadoo.com/mcp/agents#",
    "http://localhost:4317/mcp/agents?api_key=secret",
    "not a url",
  ])("rejects an unapproved or credential-bearing override without echoing it: %s", raw => {
    expect(() => sync.approvedSourceRemoteUrl(raw)).toThrow(
      /approved public-agent URL|canonical HTTPS public-agent URL/,
    );
    try {
      sync.approvedSourceRemoteUrl(raw);
    } catch (error) {
      expect(String(error)).not.toContain("password");
      expect(String(error)).not.toContain("token=secret");
      expect(String(error)).not.toContain("api_key=secret");
    }
  });

  it("logs a fixed label rather than a caller-controlled loopback URL", () => {
    const local = sync.approvedSourceRemoteUrl("http://localhost:4317/mcp/agents");
    expect(sync.sourceRemoteLabel(local)).toBe(
      "approved loopback public-agent test endpoint",
    );
    expect(sync.sourceRemoteLabel(local)).not.toContain("4317");
    expect(sync.sourceRemoteLabel(sync.approvedSourceRemoteUrl())).toBe(
      sync.canonicalRemoteUrl,
    );
  });

  it.each([
    sync.canonicalRemoteUrl,
    "http://127.0.0.1:4317/mcp/agents",
  ])("blocks redirects for every approved source class: %s", async raw => {
    const approved = sync.approvedSourceRemoteUrl(raw);
    const redirectingFetch = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.redirect === "error") {
        throw new TypeError("redirect blocked");
      }
      return new Response(null, { status: 202 });
    });
    const transport = sync.createSyncTransport(approved, redirectingFetch);
    await transport.start();
    await expect(
      transport.send({
        jsonrpc: "2.0",
        method: "notifications/cancelled",
        params: { requestId: 1, reason: "test" },
      }),
    ).rejects.toThrow(/redirect blocked/);
    expect(redirectingFetch).toHaveBeenCalledTimes(1);
    expect(redirectingFetch.mock.calls[0]?.[1]?.redirect).toBe("error");
    await transport.close();
  });

  it("overrides a caller-provided redirect mode before issuing a request", async () => {
    const baseFetch = vi.fn<typeof fetch>(async () =>
      new Response(null, { status: 202 }),
    );
    const guardedFetch = sync.createNoRedirectFetch(baseFetch);
    await guardedFetch(sync.canonicalRemoteUrl, { redirect: "follow" });
    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch.mock.calls[0]?.[1]?.redirect).toBe("error");
  });
});
