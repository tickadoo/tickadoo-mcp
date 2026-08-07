#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const canonicalRemoteUrl = "https://mcp.tickadoo.com/mcp";
const sourceRemoteUrl = new URL(process.env.TICKADOO_MCP_URL || canonicalRemoteUrl);
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const serverJsonUrl = new URL("../server.json", import.meta.url);
const serverJson = JSON.parse(await readFile(serverJsonUrl, "utf8"));

const client = new Client(
  {
    name: "tickadoo-server-json-sync",
    title: "tickadoo server.json sync",
    version: packageJson.version,
    websiteUrl: "https://mcp.tickadoo.com",
  },
  { capabilities: {} },
);

try {
  await client.connect(new StreamableHTTPClientTransport(sourceRemoteUrl));
  const result = await client.listTools();

  serverJson.version = packageJson.version;
  serverJson.title = "tickadoo Experiences and Events";
  serverJson.description =
    "Discover and book theatre, tours, attractions, and live experiences worldwide. No API key required.";
  serverJson.websiteUrl = "https://mcp.tickadoo.com";
  serverJson.remotes = [
    {
      type: "streamable-http",
      url: canonicalRemoteUrl,
    },
  ];
  serverJson._meta["io.modelcontextprotocol.registry/publisher-provided"].tools =
    result.tools.map(tool => ({
      name: tool.name,
      title: tool.title ?? tool.annotations?.title,
      description: normaliseDescription(tool.description ?? ""),
      annotations: selectStandardAnnotations(tool.annotations),
    }));

  await writeFile(serverJsonUrl, `${JSON.stringify(serverJson, null, 2)}\n`);
  console.log(
    `Updated server.json with ${result.tools.length} tools from ${sourceRemoteUrl.href}`,
  );
} finally {
  await client.close();
}

function normaliseDescription(description) {
  return description.replace(/[\u2013\u2014]/g, ":");
}

function selectStandardAnnotations(annotations = {}) {
  return Object.fromEntries(
    ["title", "readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]
      .filter(key => annotations[key] !== undefined)
      .map(key => [key, annotations[key]]),
  );
}
