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
let hadTransportError = false;
let isClosing = false;

transport.onerror = error => {
  const message = error?.message ?? String(error);
  if (isClosing && message.toLowerCase().includes("aborted")) {
    return;
  }
  hadTransportError = true;
  console.error("transport_error", message);
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
  if (hadTransportError) {
    throw new Error("Stdio transport emitted unexpected errors; see transport_error output above.");
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("E2E_STDIO_FAILURE");
  console.error(error);
  process.exitCode = 1;
} finally {
  isClosing = true;
  await transport.close().catch(() => undefined);
}
