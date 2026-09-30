#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  assertPublicAgentContract,
  publicAgentContractSource,
  publicAgentToolMetadata,
} from "./public-agent-contract.mjs";

export const canonicalRemoteUrl = "https://mcp.tickadoo.com/mcp/agents";
const canonicalRemote = new URL(canonicalRemoteUrl);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function approvedSourceRemoteUrl(rawValue = canonicalRemoteUrl) {
  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error("TICKADOO_MCP_URL must be an approved public-agent URL");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = loopbackHosts.has(hostname);
  const hasForbiddenUrlData =
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.href.includes("?") ||
    parsed.href.includes("#");
  const hasExactPath = parsed.pathname === canonicalRemote.pathname;
  const isCanonical =
    parsed.href === canonicalRemoteUrl;
  const isSafeLocalTestUrl =
    isLoopback &&
    (parsed.protocol === "http:" || parsed.protocol === "https:") &&
    hasExactPath;

  if (hasForbiddenUrlData || (!isCanonical && !isSafeLocalTestUrl)) {
    throw new Error("TICKADOO_MCP_URL must be the canonical HTTPS public-agent URL or a loopback test URL on the exact /mcp/agents path");
  }

  return parsed;
}

export function sourceRemoteLabel(sourceRemoteUrl) {
  return sourceRemoteUrl.href === canonicalRemoteUrl
    ? canonicalRemoteUrl
    : "approved loopback public-agent test endpoint";
}

export function createNoRedirectFetch(baseFetch = globalThis.fetch) {
  if (typeof baseFetch !== "function") {
    throw new Error("A fetch implementation is required for server.json sync");
  }
  return (input, init = {}) => baseFetch(input, { ...init, redirect: "error" });
}

export function createSyncTransport(sourceRemoteUrl, baseFetch = globalThis.fetch) {
  return new StreamableHTTPClientTransport(sourceRemoteUrl, {
    // The SDK uses this function for POST, GET/SSE, DELETE, and auth metadata
    // requests. Overriding redirect here prevents an approved URL from being
    // converted into an unapproved destination after validation.
    fetch: createNoRedirectFetch(baseFetch),
  });
}

export async function syncServerJson({
  sourceUrl = process.env.TICKADOO_MCP_URL || canonicalRemoteUrl,
  outputUrl = new URL("../server.json", import.meta.url),
  snapshotOutputUrl = new URL("../metadata/public-agent-tools.json", import.meta.url),
  fetchImpl = globalThis.fetch,
} = {}) {
  const sourceRemoteUrl = approvedSourceRemoteUrl(sourceUrl);
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const serverJson = JSON.parse(await readFile(outputUrl, "utf8"));
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
    await client.connect(createSyncTransport(sourceRemoteUrl, fetchImpl));
    const result = await client.listTools();
    assertPublicAgentContract(result.tools);

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
    serverJson._meta ??= {};
    serverJson._meta["io.modelcontextprotocol.registry/publisher-provided"] = {
      license: "MIT",
    };
    const snapshot = {
      source: publicAgentContractSource,
      tools: result.tools.map(publicAgentToolMetadata),
    };

    await writeFile(outputUrl, `${JSON.stringify(serverJson, null, 2)}\n`);
    await writeFile(snapshotOutputUrl, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(
      `Updated server.json and metadata/public-agent-tools.json with ${result.tools.length} tools from ${sourceRemoteLabel(sourceRemoteUrl)}`,
    );
  } finally {
    await client.close();
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;

if (import.meta.url === invokedPath) {
  syncServerJson().catch(error => {
    console.error(error instanceof Error ? error.message : "server.json sync failed");
    process.exitCode = 1;
  });
}
