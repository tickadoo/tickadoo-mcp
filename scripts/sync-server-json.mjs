#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const defaultRemoteUrl = "https://mcp.tickadoo.com/mcp";
const remoteUrl = new URL(process.env.TICKADOO_MCP_URL || defaultRemoteUrl);
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
  await client.connect(new StreamableHTTPClientTransport(remoteUrl));
  const result = await client.listTools();

  serverJson.version = packageJson.version;
  serverJson.title = "tickadoo Experiences and Events";
  serverJson.description =
    "Discover and book theatre, tours, attractions, and live experiences worldwide. Search, compare, check live availability, plan itineraries, and get direct tickadoo booking links. No API key required.";
  serverJson.websiteUrl = "https://mcp.tickadoo.com";
  serverJson.remotes = [
    {
      type: "streamable-http",
      url: remoteUrl.href,
    },
  ];
  serverJson._meta["io.modelcontextprotocol.registry/publisher-provided"].tools =
    result.tools.map(tool => ({
      name: tool.name,
      description: normaliseDescription(tool.description ?? ""),
    }));

  await writeFile(serverJsonUrl, `${JSON.stringify(serverJson, null, 2)}\n`);
  console.log(
    `Updated server.json with ${result.tools.length} tools from ${remoteUrl.href}`,
  );
} finally {
  await client.close();
}

function normaliseDescription(description) {
  return description.replace(/[\u2013\u2014]/g, ":");
}
