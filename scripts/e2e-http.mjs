import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { runE2ESmoke } from "./e2e-common.mjs";

const endpoint = new URL(process.env.MCP_URL ?? "https://mcp.tickadoo.com/mcp");
const REQUIRED_CSP_SNIPPETS = [
  "default-src 'none'",
  "https://api.tickadoo.com",
  "https://content.tickadoo.com",
  "https://www.tickadoo.com",
];
const REQUIRED_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
const REQUIRED_DISCOVERY_CACHE_CONTROL = "public, max-age=3600";
const EXPECTED_ENDPOINT = "https://mcp.tickadoo.com/mcp";
const EXPECTED_VERSION = "1.1.0";
const EXPECTED_TOOL_COUNT = 4;

async function verifyHealthResponse(target) {
  const healthResponse = await fetch(target, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!healthResponse.ok) {
    throw new Error(`GET ${target} returned ${healthResponse.status}`);
  }

  const csp = healthResponse.headers.get("content-security-policy") ?? "";
  for (const snippet of REQUIRED_CSP_SNIPPETS) {
    if (!csp.includes(snippet)) {
      throw new Error(`GET ${target} missing CSP snippet "${snippet}". Received: ${csp}`);
    }
  }

  const cacheControl = healthResponse.headers.get("cache-control") ?? "";
  if (!cacheControl.includes(REQUIRED_CACHE_CONTROL)) {
    throw new Error(`GET ${target} missing Cache-Control "${REQUIRED_CACHE_CONTROL}". Received: ${cacheControl}`);
  }

  const healthText = await healthResponse.text();
  if (!healthText.includes("\"status\":\"ok\"") || !healthText.includes("\"transport\":\"streamable-http\"")) {
    throw new Error(`GET ${target} did not return the expected health payload. Received: ${healthText}`);
  }

  return {
    status: healthResponse.status,
    csp,
    cacheControl,
    bodyPreview: healthText.slice(0, 220),
  };
}

async function verifyStandaloneHealthResponse(target) {
  const healthResponse = await fetch(target, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!healthResponse.ok) {
    throw new Error(`GET ${target} returned ${healthResponse.status}`);
  }

  const cacheControl = healthResponse.headers.get("cache-control") ?? "";
  if (!cacheControl.includes(REQUIRED_CACHE_CONTROL)) {
    throw new Error(`GET ${target} missing Cache-Control "${REQUIRED_CACHE_CONTROL}". Received: ${cacheControl}`);
  }

  const payload = await healthResponse.json();
  if (
    payload.status !== "ok"
    || payload.version !== EXPECTED_VERSION
    || payload.uptime !== "running"
    || payload.tools !== EXPECTED_TOOL_COUNT
    || payload.transport !== "streamable-http"
    || payload.endpoint !== EXPECTED_ENDPOINT
  ) {
    throw new Error(`GET ${target} returned an unexpected health payload: ${JSON.stringify(payload)}`);
  }

  return {
    status: healthResponse.status,
    cacheControl,
    payload,
  };
}

async function verifyDiscoveryDocument(target) {
  const response = await fetch(target, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${target} returned ${response.status}`);
  }

  const cacheControl = response.headers.get("cache-control") ?? "";
  if (!cacheControl.includes(REQUIRED_DISCOVERY_CACHE_CONTROL)) {
    throw new Error(`GET ${target} missing Cache-Control "${REQUIRED_DISCOVERY_CACHE_CONTROL}". Received: ${cacheControl}`);
  }

  const manifest = await response.json();
  const tools = manifest?._meta?.["io.modelcontextprotocol.registry/publisher-provided"]?.tools ?? [];
  const remote = manifest?.remotes?.find(item => item.type === "streamable-http") ?? manifest?.remotes?.[0];

  if (manifest?.version !== EXPECTED_VERSION || remote?.url !== EXPECTED_ENDPOINT || remote?.type !== "streamable-http" || tools.length !== EXPECTED_TOOL_COUNT) {
    throw new Error(`GET ${target} returned an unexpected discovery document: ${JSON.stringify(manifest)}`);
  }

  return {
    status: response.status,
    cacheControl,
    manifestPreview: {
      name: manifest.name,
      version: manifest.version,
      remote,
      tools: tools.map(tool => tool.name),
    },
  };
}

const client = new Client({ name: "tickadoo-e2e-http", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(endpoint);
let isClosing = false;

transport.onerror = error => {
  const message = error?.message ?? String(error);
  if (isClosing && message.toLowerCase().includes("aborted")) {
    return;
  }
  console.error("transport_error", message);
};

try {
  const health = await verifyHealthResponse(endpoint);
  const standaloneHealth = await verifyStandaloneHealthResponse(new URL("/health", endpoint));
  const discovery = await verifyDiscoveryDocument(new URL("/.well-known/mcp.json", endpoint));
  await client.connect(transport);
  const result = await runE2ESmoke(client, { target: endpoint.toString() });
  console.log(JSON.stringify({ health, standaloneHealth, discovery, ...result }, null, 2));
} catch (error) {
  console.error("E2E_HTTP_FAILURE");
  console.error(error);
  process.exitCode = 1;
} finally {
  isClosing = true;
  await transport.close().catch(() => undefined);
}
