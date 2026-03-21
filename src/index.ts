#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TICKADOO_LOG_LEVEL } from "./shared/config.js";
import { createTickadooServer } from "./shared/server.js";

async function main(): Promise<void> {
  const server = createTickadooServer({
    logWriter: message => {
      process.stderr.write(`${message}\n`);
    },
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  if (TICKADOO_LOG_LEVEL !== "none") {
    console.error("tickadoo MCP server running on stdio");
  }
}

main().catch(error => {
  console.error("Fatal:", error);
  process.exit(1);
});
