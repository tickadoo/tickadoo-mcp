#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { assertPublisherMetadataSize, compactToolMetadata, publisherMetadataKey } from "./registry-metadata.mjs";

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
  serverJson._meta[publisherMetadataKey].tools = result.tools.map(compactToolMetadata);
  assertPublisherMetadataSize(serverJson);

  await writeFile(serverJsonUrl, `${JSON.stringify(serverJson, null, 2)}\n`);
  console.log(
    `Updated server.json with ${result.tools.length} tools from ${sourceRemoteUrl.href}`,
  );
} finally {
  await client.close();
}
