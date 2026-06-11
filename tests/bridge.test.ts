import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  JSONRPCMessageSchema,
  LATEST_PROTOCOL_VERSION,
  type JSONRPCMessage,
  type JSONRPCRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { createTickadooBridge, type TickadooBridge } from "../src/bridge.js";
import { DEFAULT_TICKADOO_MCP_URL } from "../src/config.js";

type RemoteHandler = (request: JSONRPCRequest) => {
  error?: {
    code: number;
    data?: unknown;
    message: string;
  };
  result?: Record<string, unknown>;
};

type ToolCallParams = {
  arguments?: Record<string, unknown>;
  name: string;
};

const bridges: TickadooBridge[] = [];
const mockServers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.allSettled(bridges.splice(0).map(bridge => bridge.close()));
  await Promise.allSettled(mockServers.splice(0).map(server => server.close()));
});

describe("tickadoo stdio bridge", () => {
  it("passes tools/list through to the remote server", async () => {
    const remote = await startMockRemote(request => {
      if (request.method === "tools/list") {
        return {
          result: {
            tools: [
              {
                name: "search_experiences",
                description: "Search live tickadoo experiences.",
                inputSchema: { type: "object", properties: {} },
              },
            ],
          },
        };
      }

      return { result: {} };
    });

    const { client } = await startBridgeClient(remote.url);
    const result = await client.listTools();

    expect(result.tools).toEqual([
      {
        name: "search_experiences",
        description: "Search live tickadoo experiences.",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
    expect(remote.seenMethods()).toContain("tools/list");
  });

  it("passes tools/call through with arguments", async () => {
    const remote = await startMockRemote(request => {
      if (request.method === "tools/call") {
        const params = request.params as ToolCallParams;
        const args = params.arguments ?? {};

        return {
          result: {
            content: [
              {
                type: "text",
                text: `called ${params.name} for ${String(args.city)}`,
              },
            ],
            structuredContent: {
              arguments: params.arguments,
              name: params.name,
            },
          },
        };
      }

      return { result: {} };
    });

    const { client } = await startBridgeClient(remote.url);
    const result = await client.callTool({
      name: "search_experiences",
      arguments: {
        city: "London",
        limit: 3,
      },
    });

    expect(result.content).toEqual([
      { type: "text", text: "called search_experiences for London" },
    ]);
    expect(result.structuredContent).toEqual({
      arguments: { city: "London", limit: 3 },
      name: "search_experiences",
    });
    expect(remote.requestsFor("tools/call")).toMatchObject([
      {
        params: {
          name: "search_experiences",
          arguments: {
            city: "London",
            limit: 3,
          },
        },
      },
    ]);
  });

  it("forwards remote JSON-RPC errors faithfully", async () => {
    const remote = await startMockRemote(request => {
      if (request.method === "tools/call") {
        return {
          error: {
            code: -32042,
            message: "Remote catalogue unavailable",
            data: {
              retryAfterSeconds: 30,
            },
          },
        };
      }

      return { result: {} };
    });

    const transport = await startBridgeRawTransport(remote.url);
    await initialiseRawClient(transport);
    const response = await sendRawRequest(transport, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "search_experiences",
        arguments: { city: "Paris" },
      },
    });

    expect(response).toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: {
        code: -32042,
        message: "Remote catalogue unavailable",
        data: {
          retryAfterSeconds: 30,
        },
      },
    });
  });
});

const liveIt = process.env.LIVE === "1" ? it : it.skip;

liveIt("lists tools from the live remote through the bridge", async () => {
  const { client } = await startBridgeClient(DEFAULT_TICKADOO_MCP_URL);
  const result = await client.listTools();

  expect(result.tools.length).toBeGreaterThan(0);
});

async function startBridgeClient(remoteUrl: string) {
  const { bridge, clientTransport, serverTransport } = await createBridgeTransports(remoteUrl);
  await bridge.server.connect(serverTransport);

  const client = new Client(
    { name: "bridge-test-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(clientTransport);

  return { bridge, client };
}

async function startBridgeRawTransport(remoteUrl: string) {
  const { bridge, clientTransport, serverTransport } = await createBridgeTransports(remoteUrl);
  await bridge.server.connect(serverTransport);
  await clientTransport.start();
  return clientTransport;
}

async function createBridgeTransports(remoteUrl: string) {
  const bridge = await createTickadooBridge({
    remoteUrl,
    requestTimeoutMs: 2_000,
  });
  bridges.push(bridge);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  return { bridge, clientTransport, serverTransport };
}

async function initialiseRawClient(transport: InMemoryTransport): Promise<void> {
  const response = await sendRawRequest(transport, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "raw-bridge-test-client",
        version: "1.0.0",
      },
    },
  });

  expect(response).toMatchObject({
    jsonrpc: "2.0",
    id: 1,
    result: {
      serverInfo: {
        name: "tickadoo",
      },
    },
  });

  await transport.send({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
}

async function sendRawRequest(
  transport: InMemoryTransport,
  request: JSONRPCRequest,
): Promise<JSONRPCMessage> {
  return new Promise((resolve, reject) => {
    transport.onmessage = message => {
      resolve(message);
    };
    transport.onerror = reject;
    transport.send(request).catch(reject);
  });
}

async function startMockRemote(handler: RemoteHandler) {
  const requests: JSONRPCRequest[] = [];
  const server = createServer(async (req, res) => {
    if (req.method === "GET") {
      res.writeHead(405).end();
      return;
    }

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
    requests.push(request);

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
          capabilities: {
            tools: {},
            resources: {},
          },
        },
      });
      return;
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
    requestsFor: (method: string) => requests.filter(request => request.method === method),
    seenMethods: () => requests.map(request => request.method),
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
