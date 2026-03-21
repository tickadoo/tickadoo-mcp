import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const publicHtmlPath = fileURLToPath(new URL("public/index.html", root));
const apiIndexPath = fileURLToPath(new URL("api/index.ts", root));

const html = JSON.stringify(readFileSync(publicHtmlPath, "utf8"));
const output = `import type { IncomingMessage, ServerResponse } from "node:http";

const HTML = ${html};

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.writeHead(200);
  res.end(HTML);
}
`;

writeFileSync(apiIndexPath, output);
console.log("Synced public/index.html -> api/index.ts");
