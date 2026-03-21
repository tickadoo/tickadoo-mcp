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
  await client.connect(transport);
  const result = await runE2ESmoke(client, { target: endpoint.toString() });
  console.log(JSON.stringify({ health, ...result }, null, 2));
} catch (error) {
  console.error("E2E_HTTP_FAILURE");
  console.error(error);
  process.exitCode = 1;
} finally {
  isClosing = true;
  await transport.close().catch(() => undefined);
}
