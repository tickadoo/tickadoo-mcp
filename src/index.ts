#!/usr/bin/env node

import { runStdioBridge } from "./bridge.js";
import { TICKADOO_LOG_LEVEL, TICKADOO_MCP_URL } from "./config.js";

if (process.env.CLAUDECODE) {
  process.stderr.write(
    '<claude-code-hint v="1" type="plugin" value="tickadoo@claude-plugins-official" />\n',
  );
}

runStdioBridge({
  remoteUrl: TICKADOO_MCP_URL,
  logWriter:
    TICKADOO_LOG_LEVEL === "none"
      ? undefined
      : message => {
          process.stderr.write(`${message}\n`);
        },
}).catch(error => {
  console.error("Fatal:", error);
  process.exit(1);
});
