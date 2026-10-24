#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import {
  createPublicAgentSnapshot,
  publicAgentContractDigest,
  readLivePublicAgentContract,
} from "./public-agent-contract.mjs";

const howardCommit = process.env.HOWARD_COMMIT;
if (!/^[0-9a-f]{40}$/.test(howardCommit ?? "")) {
  throw new Error("HOWARD_COMMIT must be the exact deployed 40-character Howard commit");
}

const source = `tickadoo/howard@${howardCommit}`;
const live = await readLivePublicAgentContract();
const snapshot = createPublicAgentSnapshot(live, source);
const outputDirectoryUrl = new URL("../metadata/", import.meta.url);
const outputUrl = new URL("../metadata/public-agent-tools.json", import.meta.url);
await mkdir(outputDirectoryUrl, { recursive: true });
await writeFile(outputUrl, `${JSON.stringify(snapshot, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({
    endpoint: snapshot.endpoint,
    source,
    tools: snapshot.tools.length,
    sha256: publicAgentContractDigest(snapshot),
    updated: true,
  }, null, 2)}\n`,
);
