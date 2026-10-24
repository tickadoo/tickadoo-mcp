#!/usr/bin/env node

import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { publisherMetadataKey } from "./registry-metadata.mjs";

const FULL_MCP_ENDPOINT = "https://mcp.tickadoo.com/mcp";
const MAX_TOOL_PAGES = 100;
const REQUEST_TIMEOUT_MS = 30_000;

export async function smokePackedBridge(binaryPath) {
  if (!binaryPath) {
    throw new Error("Usage: node scripts/smoke-packed-bridge.mjs <installed-mcp-server-binary>");
  }

  const binary = await realpath(resolve(binaryPath));
  const installedPackageRoot = resolve(dirname(binary), "..");
  const manifest = JSON.parse(await readFile(resolve(installedPackageRoot, "server.json"), "utf8"));
  const expectedTools = manifest._meta?.[publisherMetadataKey]?.tools?.map(tool => tool.name);
  if (!Array.isArray(expectedTools) || expectedTools.length !== 27) {
    throw new Error("server.json must contain the exact 27-tool full-MCP catalogue");
  }
  if (new Set(expectedTools).size !== expectedTools.length) {
    throw new Error("server.json contains duplicate full-MCP tool names");
  }

  const transport = new StdioClientTransport({
    command: resolve(binaryPath),
    env: {
      ...getDefaultEnvironment(),
      TICKADOO_LOG_LEVEL: "none",
      TICKADOO_MCP_URL: FULL_MCP_ENDPOINT,
    },
    stderr: "pipe",
  });
  const client = new Client(
    { name: "tickadoo-packed-release-smoke", version: manifest.version },
    { capabilities: {} },
  );

  let childStderr = "";
  transport.stderr?.on("data", chunk => {
    childStderr += chunk.toString();
  });

  try {
    await client.connect(transport, { timeout: REQUEST_TIMEOUT_MS });

    const tools = [];
    const seenCursors = new Set();
    let cursor;
    for (let page = 0; page < MAX_TOOL_PAGES; page += 1) {
      const result = await client.listTools(
        cursor === undefined ? undefined : { cursor },
        { timeout: REQUEST_TIMEOUT_MS },
      );
      tools.push(...result.tools);
      if (!result.nextCursor) break;
      if (seenCursors.has(result.nextCursor)) {
        throw new Error(`tools/list repeated cursor ${result.nextCursor}`);
      }
      seenCursors.add(result.nextCursor);
      cursor = result.nextCursor;
      if (page === MAX_TOOL_PAGES - 1) {
        throw new Error(`tools/list exceeded ${MAX_TOOL_PAGES} pages`);
      }
    }

    const actualTools = tools.map(tool => tool.name);
    if (new Set(actualTools).size !== actualTools.length) {
      throw new Error("Packed bridge returned duplicate full-MCP tool names");
    }
    if (JSON.stringify(actualTools) !== JSON.stringify(expectedTools)) {
      throw new Error(
        `Packed bridge tool catalogue differs from server.json\n` +
          `expected=${JSON.stringify(expectedTools)}\nactual=${JSON.stringify(actualTools)}`,
      );
    }

    const listCities = tools.find(tool => tool.name === "list_cities");
    if (
      listCities?.annotations?.readOnlyHint !== true ||
      listCities?.annotations?.destructiveHint !== false
    ) {
      throw new Error("list_cities must remain explicitly read-only and non-destructive");
    }

    const result = await client.callTool(
      { name: "list_cities", arguments: { limit: 1 } },
      undefined,
      { timeout: REQUEST_TIMEOUT_MS },
    );
    if (
      result.isError === true ||
      !Array.isArray(result.content) ||
      result.content.length === 0 ||
      !Array.isArray(result.structuredContent?.cities) ||
      result.structuredContent.cities.length !== 1
    ) {
      throw new Error(`Packed bridge list_cities smoke failed: ${JSON.stringify(result)}`);
    }

    process.stdout.write(
      `Packed npm bridge verified against ${FULL_MCP_ENDPOINT}: ${actualTools.length} tools and list_cities call\n`,
    );
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    if (childStderr.trim()) {
      failure.message = `${failure.message}\nPacked bridge stderr:\n${childStderr.trim()}`;
    }
    throw failure;
  } finally {
    await client.close().catch(() => undefined);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await smokePackedBridge(process.argv[2]);
}
