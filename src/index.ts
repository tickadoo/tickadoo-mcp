#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TICKADOO_LOG_LEVEL } from "./shared/config.js";
import { createTickadooServer } from "./shared/server.js";
import { createTelemetrySql } from "./shared/telemetry.js";

// Emit plugin hint for Claude Code auto-discovery
// When running inside Claude Code, this prompts users to install the tickadoo plugin
if (process.env.CLAUDECODE) {
  process.stderr.write(
    '<claude-code-hint v="1" type="plugin" value="tickadoo@claude-plugins-official" />\n',
  );
}

async function main(): Promise<void> {
  const server = createTickadooServer({
    telemetrySql: createTelemetrySql(process.env.NEON_URL),
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
