import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { runE2ESmoke } from "./e2e-common.mjs";

const command = process.env.MCP_STDIO_COMMAND ?? "node";
const args = process.env.MCP_STDIO_ARGS ? JSON.parse(process.env.MCP_STDIO_ARGS) : ["dist/index.js"];
const cwd = process.env.MCP_STDIO_CWD ?? process.cwd();

const client = new Client({ name: "tickadoo-e2e-stdio", version: "1.0.0" });
const transport = new StdioClientTransport({
  command,
  args,
  cwd,
  stderr: "pipe",
});

transport.onerror = error => {
  console.error("transport_error", error?.message ?? error);
};

if (transport.stderr) {
  transport.stderr.on("data", chunk => {
    process.stderr.write(`[server] ${chunk}`);
  });
}

try {
  await client.connect(transport);
  const result = await runE2ESmoke(client, {
    target: `${command} ${args.join(" ")}`.trim(),
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("E2E_STDIO_FAILURE");
  console.error(error);
  process.exitCode = 1;
} finally {
  await transport.close().catch(() => undefined);
}
