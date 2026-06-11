import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ErrorCode,
  McpError,
  PingRequestSchema,
  ResultSchema,
  type Implementation,
  type JSONRPCRequest,
  type Notification,
  type Request,
  type Result,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import {
  BRIDGE_NAME,
  BRIDGE_VERSION,
  BRIDGE_WEBSITE_URL,
  DEFAULT_TICKADOO_MCP_URL,
  TICKADOO_MCP_URL,
} from "./config.js";

type LogWriter = (message: string) => void;

export type TickadooBridgeOptions = {
  remoteUrl?: string;
  requestTimeoutMs?: number;
  logWriter?: LogWriter;
};

export type TickadooBridge = {
  client: Client<Request, Notification, Result>;
  remoteUrl: URL;
  server: Server<Request, Notification, Result>;
  close: () => Promise<void>;
};

const BRIDGEABLE_METHODS = new Set([
  "tools/list",
  "tools/call",
  "resources/list",
  "resources/read",
]);

export function resolveRemoteUrl(remoteUrl = TICKADOO_MCP_URL): URL {
  try {
    return new URL(remoteUrl);
  } catch {
    throw new Error(`Invalid TICKADOO_MCP_URL: ${remoteUrl}`);
  }
}

export async function createTickadooBridge(
  options: TickadooBridgeOptions = {},
): Promise<TickadooBridge> {
  const remoteUrl = resolveRemoteUrl(options.remoteUrl);
  const client = new Client<Request, Notification, Result>(
    {
      name: BRIDGE_NAME,
      title: "tickadoo stdio bridge",
      version: BRIDGE_VERSION,
      websiteUrl: BRIDGE_WEBSITE_URL,
    },
    { capabilities: {} },
  );

  const remoteTransport = new StreamableHTTPClientTransport(remoteUrl);
  await client.connect(remoteTransport, requestOptions(options));

  const server = new Server<Request, Notification, Result>(
    serverInfoFromRemote(client.getServerVersion()),
    {
      capabilities: bridgeCapabilities(client.getServerCapabilities()),
      instructions: client.getInstructions(),
    },
  );

  server.setRequestHandler(PingRequestSchema, async (_request, extra) => {
    return preserveRemoteError(
      client.request({ method: "ping" }, ResultSchema, {
        ...requestOptions(options),
        signal: extra.signal,
      }),
    );
  });

  server.fallbackRequestHandler = async (request, extra) => {
    if (!BRIDGEABLE_METHODS.has(request.method)) {
      throw new McpError(ErrorCode.MethodNotFound, "Method not found");
    }

    return forwardRequest(client, request, {
      ...requestOptions(options),
      signal: extra.signal,
    });
  };

  return {
    client,
    remoteUrl,
    server,
    close: async () => {
      await server.close();
      await client.close();
    },
  };
}

export async function runStdioBridge(options: TickadooBridgeOptions = {}): Promise<void> {
  const bridge = await createTickadooBridge(options);
  const transport = new StdioServerTransport();
  await bridge.server.connect(transport);

  bridge.server.onclose = () => {
    void bridge.client.close();
  };

  options.logWriter?.(`tickadoo MCP bridge connected to ${bridge.remoteUrl.href}`);
}

function requestOptions(options: TickadooBridgeOptions) {
  return options.requestTimeoutMs === undefined ? undefined : { timeout: options.requestTimeoutMs };
}

async function forwardRequest(
  client: Client<Request, Notification, Result>,
  request: JSONRPCRequest,
  options:
    | {
        signal?: AbortSignal;
        timeout?: number;
      }
    | undefined,
): Promise<Result> {
  const outboundRequest: Request = {
    method: request.method,
    ...(request.params === undefined ? {} : { params: request.params }),
  };

  return preserveRemoteError(client.request(outboundRequest, ResultSchema, options));
}

async function preserveRemoteError<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof McpError) {
      const forwarded = new Error(stripMcpPrefix(error.message, error.code)) as Error & {
        code: number;
        data?: unknown;
      };
      forwarded.name = error.name;
      forwarded.code = error.code;
      if (error.data !== undefined) {
        forwarded.data = error.data;
      }
      throw forwarded;
    }

    throw error;
  }
}

function stripMcpPrefix(message: string, code: number): string {
  const prefix = `MCP error ${code}: `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function serverInfoFromRemote(remoteInfo: Implementation | undefined): Implementation {
  return {
    name: remoteInfo?.name ?? "tickadoo",
    title: remoteInfo?.title ?? "tickadoo",
    version: remoteInfo?.version ?? BRIDGE_VERSION,
    websiteUrl: remoteInfo?.websiteUrl ?? BRIDGE_WEBSITE_URL,
    description:
      remoteInfo?.description ??
      `Bridge to the tickadoo remote MCP server at ${DEFAULT_TICKADOO_MCP_URL}.`,
    ...(remoteInfo?.icons === undefined ? {} : { icons: remoteInfo.icons }),
  };
}

function bridgeCapabilities(remoteCapabilities: ServerCapabilities | undefined): ServerCapabilities {
  const capabilities: ServerCapabilities = {};

  if (remoteCapabilities?.tools) {
    capabilities.tools = { ...remoteCapabilities.tools };
  }

  if (remoteCapabilities?.resources) {
    const { subscribe: _subscribe, ...resources } = remoteCapabilities.resources;
    capabilities.resources = resources;
  }

  return capabilities;
}
