import http from "node:http";
import healthHandler from "../api/health.ts";
import indexHandler from "../api/index.ts";
import llmsFullHandler from "../api/llms-full.ts";
import llmsHandler from "../api/llms.ts";
import handler from "../api/mcp.ts";
import wellKnownAgentCardHandler from "../api/well-known-agent-card.ts";
import wellKnownMcpHandler from "../api/well-known-mcp.ts";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8788);

const routes = [
  { match: (url: string) => url === "/health" || url.startsWith("/health?"), handler: healthHandler },
  { match: (url: string) => url === "/llms.txt", handler: llmsHandler },
  { match: (url: string) => url === "/llms-full.txt", handler: llmsFullHandler },
  { match: (url: string) => url === "/.well-known/agent-card.json" || url.startsWith("/.well-known/agent-card.json?"), handler: wellKnownAgentCardHandler },
  { match: (url: string) => url === "/.well-known/mcp.json" || url.startsWith("/.well-known/mcp.json?"), handler: wellKnownMcpHandler },
  { match: (url: string) => url.startsWith("/mcp"), handler },
  { match: (url: string) => url === "/" || url.startsWith("/?"), handler: indexHandler },
] as const;

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  const route = routes.find(candidate => candidate.match(url));

  if (!route) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  void Promise.resolve(route.handler(req, res)).catch(error => {
    console.error("Unhandled MCP dev server error:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Internal Server Error");
  });
});

server.listen(port, host, () => {
  console.log(`tickadoo MCP dev HTTP server listening at http://${host}:${port}/mcp`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
