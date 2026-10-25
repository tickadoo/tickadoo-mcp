import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ElicitRequestSchema,
  JSONRPCMessageSchema,
  type ElicitResult,
  type JSONRPCMessage,
  type JSONRPCRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { createTickadooBridge, type TickadooBridge } from "../src/bridge.js";
import { readElicitationFlag } from "../src/config.js";

type RemoteHandler = (request: JSONRPCRequest) => {
  error?: { code: number; message: string; data?: unknown };
  result?: Record<string, unknown>;
};

type ToolCallParams = {
  arguments?: Record<string, unknown>;
  name: string;
};

const bridges: TickadooBridge[] = [];
const mockServers: Array<{ close: () => Promise<void> }> = [];

const bookingTools = [
  {
    name: "search_experiences",
    description: "Search experiences for a booking.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        date: { type: "string" },
        party_size: { type: "integer" },
        seat_preference: { type: "string" },
      },
    },
  },
  {
    name: "hold",
    description: "Hold inventory.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        date: { type: "string" },
        party_size: { type: "integer" },
        seat_preference: { type: "string" },
        fail: { type: "boolean" },
      },
    },
  },
  {
    name: "checkout_handoff",
    description: "Hand off a hold to checkout.",
    inputSchema: {
      type: "object",
      properties: {
        hold_id: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
      },
    },
  },
  {
    name: "list_cities",
    description: "List cities.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer" } },
    },
  },
];

const catalogueSearchTools = [
  {
    name: "search_experiences",
    description: "Search the catalogue.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        query: { type: "string" },
      },
    },
  },
];

afterEach(async () => {
  await Promise.allSettled(bridges.splice(0).map(bridge => bridge.close()));
  await Promise.allSettled(mockServers.splice(0).map(server => server.close()));
});

describe("elicitation flag", () => {
  it("stays off unless the env value is an explicit on switch", () => {
    expect(readElicitationFlag(undefined)).toBe(false);
    expect(readElicitationFlag("")).toBe(false);
    expect(readElicitationFlag("0")).toBe(false);
    expect(readElicitationFlag("false")).toBe(false);
    expect(readElicitationFlag("off")).toBe(false);
    expect(readElicitationFlag("no")).toBe(false);
    for (const value of ["1", "true", "TRUE", " yes ", "on"]) {
      expect(readElicitationFlag(value), value).toBe(true);
    }
  });
});

describe("booking elicitation", () => {
  it("accepts a missing date, party size, and seat preference", async () => {
    const session = await startSession({
      elicitation: true,
      capabilities: { elicitation: { form: {} } },
      onElicit: () => ({
        action: "accept",
        content: {
          date: "2026-11-07",
          party_size: 4,
          seat_preference: "stalls",
        },
      }),
    });

    await session.client.listTools();
    const result = await session.client.callTool({
      name: "search_experiences",
      arguments: { city: "london" },
    });

    expect(session.prompts).toEqual([
      "Please provide the missing date, party size, seat preference for this booking. If you dismiss this, the request continues without a guessed value.",
    ]);
    expect(result.structuredContent).toEqual({
      name: "search_experiences",
      arguments: {
        city: "london",
        date: "2026-11-07",
        party_size: 4,
        seat_preference: "stalls",
      },
    });
    expect(session.elicit).toHaveBeenCalledTimes(1);
  });

  it("treats an empty elicitation capability as form support", async () => {
    const session = await startSession({
      elicitation: true,
      capabilities: { elicitation: {} },
      onElicit: () => ({
        action: "accept",
        content: { date: "2026-12-01", party_size: 2, seat_preference: "balcony" },
      }),
    });

    await session.client.listTools();
    await session.client.callTool({
      name: "search_experiences",
      arguments: { city: "paris" },
    });

    expect(session.prompts).toHaveLength(1);
    expect(session.remote.calls()).toMatchObject([
      {
        name: "search_experiences",
        arguments: {
          city: "paris",
          date: "2026-12-01",
          party_size: 2,
          seat_preference: "balcony",
        },
      },
    ]);
  });

  it.each(["decline", "cancel"] as const)(
    "forwards the original arguments when the user %s the details form",
    async action => {
      const session = await startSession({
        elicitation: true,
        capabilities: { elicitation: { form: {} } },
        onElicit: () => ({ action }),
      });

      await session.client.listTools();
      await session.client.callTool({
        name: "search_experiences",
        arguments: { city: "london" },
      });

      expect(session.prompts).toHaveLength(1);
      expect(session.remote.calls()).toEqual([
        { name: "search_experiences", arguments: { city: "london" } },
      ]);
    },
  );

  it("keeps today's call when the client does not advertise elicitation", async () => {
    const session = await startSession({
      elicitation: true,
      capabilities: {},
    });

    await session.client.listTools();
    await session.client.callTool({
      name: "search_experiences",
      arguments: { city: "london" },
    });

    expect(session.elicit).not.toHaveBeenCalled();
    expect(session.remote.calls()).toEqual([
      { name: "search_experiences", arguments: { city: "london" } },
    ]);
  });

  it("keeps today's call when the flag is off, even if the client can elicit", async () => {
    const session = await startSession({
      elicitation: false,
      capabilities: { elicitation: { form: {} } },
      onElicit: () => {
        throw new Error("elicitation should stay off");
      },
    });

    await session.client.listTools();
    await session.client.callTool({
      name: "search_experiences",
      arguments: { city: "london" },
    });

    expect(session.elicit).not.toHaveBeenCalled();
    expect(session.prompts).toEqual([]);
    expect(session.remote.calls()).toEqual([
      { name: "search_experiences", arguments: { city: "london" } },
    ]);
  });

  it("does not ask for fields the tool schema does not accept", async () => {
    const session = await startSession({
      elicitation: true,
      capabilities: { elicitation: { form: {} } },
      tools: catalogueSearchTools,
      onElicit: () => {
        throw new Error("catalogue search has no date, party, or seat field");
      },
    });

    await session.client.listTools();
    await session.client.callTool({
      name: "search_experiences",
      arguments: { city: "london" },
    });

    expect(session.elicit).not.toHaveBeenCalled();
    expect(session.remote.calls()).toEqual([
      { name: "search_experiences", arguments: { city: "london" } },
    ]);
  });

  it("does not elicit for tools outside the booking handoff", async () => {
    const session = await startSession({
      elicitation: true,
      capabilities: { elicitation: { form: {} } },
      onElicit: () => {
        throw new Error("list_cities is not a booking handoff");
      },
    });

    await session.client.listTools();
    await session.client.callTool({ name: "list_cities", arguments: {} });

    expect(session.elicit).not.toHaveBeenCalled();
    expect(session.remote.calls()).toEqual([{ name: "list_cities", arguments: {} }]);
  });

  it("asks the user to confirm the held price before checkout handoff", async () => {
    const session = await startSession({
      elicitation: true,
      capabilities: { elicitation: { form: {} } },
      onElicit: message => {
        expect(message).toContain("120.00 GBP");
        expect(message).not.toContain("1 USD");
        return { action: "accept", content: { confirm_held_price: true } };
      },
    });

    await session.client.listTools();
    await session.client.callTool({
      name: "hold",
      arguments: {
        product_id: "prod_1",
        date: "2026-11-07",
        party_size: 2,
        seat_preference: "stalls",
      },
    });
    const result = await session.client.callTool({
      name: "checkout_handoff",
      arguments: { hold_id: "h1", amount: 1, currency: "USD" },
    });

    expect(session.prompts).toHaveLength(1);
    expect(result.structuredContent).toMatchObject({
      name: "checkout_handoff",
      arguments: { hold_id: "h1", amount: 1, currency: "USD" },
    });
    expect(session.remote.calls().map(call => call.name)).toEqual(["hold", "checkout_handoff"]);
  });

  it.each([
    ["decline", { action: "decline" as const }],
    ["cancel", { action: "cancel" as const }],
    ["reject", { action: "accept" as const, content: { confirm_held_price: false } }],
  ])("does not start checkout when the price confirmation is %s", async (action, response) => {
    const session = await startSession({
      elicitation: true,
      capabilities: { elicitation: { form: {} } },
      onElicit: () => response,
    });

    await session.client.listTools();
    await session.client.callTool({
      name: "hold",
      arguments: {
        product_id: "prod_1",
        date: "2026-11-07",
        party_size: 2,
        seat_preference: "stalls",
      },
    });
    const result = await session.client.callTool({
      name: "checkout_handoff",
      arguments: { hold_id: "h1", amount: 1, currency: "USD" },
    });

    expect(result.isError).toBe(true);
    const message = JSON.stringify(result.content);
    expect(message).toContain(`Checkout handoff was not confirmed (${action}).`);
    expect(message).toContain("120.00 GBP");
    expect(session.remote.calls().map(call => call.name)).toEqual(["hold"]);
  });

  it("confirms a price carried on the checkout arguments", async () => {
    const session = await startSession({
      elicitation: true,
      capabilities: { elicitation: { form: {} } },
      onElicit: message => {
        expect(message).toContain("88.50 EUR");
        return { action: "decline" };
      },
    });

    await session.client.listTools();
    const result = await session.client.callTool({
      name: "checkout-handoff",
      arguments: { hold_id: "h1", amount: "88.50", currency: "EUR" },
    });

    expect(result.isError).toBe(true);
    expect(session.remote.calls()).toEqual([]);
  });

  it("does not invent a price confirmation when no held price is known", async () => {
    const session = await startSession({
      elicitation: true,
      capabilities: { elicitation: { form: {} } },
      onElicit: () => {
        throw new Error("no held price to confirm");
      },
    });

    await session.client.listTools();
    await session.client.callTool({
      name: "checkout_handoff",
      arguments: { hold_id: "h1" },
    });

    expect(session.elicit).not.toHaveBeenCalled();
    expect(session.remote.calls()).toEqual([
      { name: "checkout_handoff", arguments: { hold_id: "h1" } },
    ]);
  });

  it("does not keep a price from a failed hold", async () => {
    const session = await startSession({
      elicitation: true,
      capabilities: { elicitation: { form: {} } },
      onElicit: () => {
        throw new Error("failed hold must not confirm a price");
      },
    });

    await session.client.listTools();
    await session.client.callTool({
      name: "hold",
      arguments: {
        product_id: "prod_1",
        date: "2026-11-07",
        party_size: 2,
        seat_preference: "stalls",
        fail: true,
      },
    });
    await session.client.callTool({
      name: "checkout_handoff",
      arguments: { hold_id: "h1" },
    });

    expect(session.elicit).not.toHaveBeenCalled();
    expect(session.remote.calls().map(call => call.name)).toEqual(["hold", "checkout_handoff"]);
  });
});

async function startSession(options: {
  elicitation: boolean;
  capabilities: { elicitation?: { form?: Record<string, unknown> } | Record<string, never> };
  tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  onElicit?: (message: string) => ElicitResult | Promise<ElicitResult>;
}) {
  const remote = await startMockRemote(request => {
    if (request.method === "tools/list") {
      return { result: { tools: options.tools ?? bookingTools } };
    }
    if (request.method === "tools/call") {
      const params = request.params as ToolCallParams;
      if (params.name === "hold" && params.arguments?.fail === true) {
        return {
          result: {
            isError: true,
            content: [{ type: "text", text: "Hold failed." }],
            structuredContent: {
              price: { amount: "120.00", currency: "GBP" },
            },
          },
        };
      }
      if (params.name === "hold") {
        return {
          result: {
            content: [{ type: "text", text: "Held." }],
            structuredContent: {
              hold_id: "h1",
              price: { amount: "120.00", currency: "GBP" },
            },
          },
        };
      }
      return {
        result: {
          content: [{ type: "text", text: "ok" }],
          structuredContent: {
            arguments: params.arguments ?? {},
            name: params.name,
          },
        },
      };
    }
    return { result: {} };
  });

  const bridge = await createTickadooBridge({
    remoteUrl: remote.url,
    requestTimeoutMs: 2_000,
    elicitation: options.elicitation,
  });
  bridges.push(bridge);
  const elicit = vi.spyOn(bridge.server, "elicitInput");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await bridge.server.connect(serverTransport);

  const prompts: string[] = [];
  const client = new Client(
    { name: "elicitation-test-client", version: "1.0.0" },
    { capabilities: options.capabilities },
  );
  if (options.onElicit) {
    client.setRequestHandler(ElicitRequestSchema, async request => {
      if (!("requestedSchema" in request.params)) return { action: "cancel" };
      prompts.push(request.params.message);
      return await options.onElicit!(request.params.message);
    });
  }
  await client.connect(clientTransport);

  return { bridge, client, elicit, prompts, remote };
}

async function startMockRemote(handler: RemoteHandler) {
  const calls: ToolCallParams[] = [];
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }

    const message = await readJsonRpcMessage(req);
    if (!("id" in message)) {
      res.writeHead(202).end();
      return;
    }

    const request = message as JSONRPCRequest;
    if (request.method === "initialize") {
      const initParams = request.params as { protocolVersion: string };
      writeJson(res, {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: initParams.protocolVersion,
          serverInfo: {
            name: "tickadoo",
            title: "tickadoo",
            version: "remote-test",
            websiteUrl: "https://mcp.tickadoo.com",
          },
          capabilities: { tools: {} },
        },
      });
      return;
    }

    if (request.method === "tools/call") {
      calls.push(request.params as ToolCallParams);
    }

    const response = handler(request);
    writeJson(res, {
      jsonrpc: "2.0",
      id: request.id,
      ...(response.error ? { error: response.error } : { result: response.result ?? {} }),
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  mockServers.push({ close });

  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    calls: () => calls,
  };
}

function writeJson(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonRpcMessage(req: IncomingMessage): Promise<JSONRPCMessage> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  return JSONRPCMessageSchema.parse(parsed);
}
