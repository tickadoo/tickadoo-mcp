import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTickadooServer } from "./shared/server.js";

async function main(): Promise<void> {
  const server = createTickadooServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("tickadoo MCP server running on stdio");
}

main().catch(error => {
  console.error("Fatal:", error);
  process.exit(1);
});
