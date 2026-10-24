#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  assertLivePublicAgentMatchesSnapshot,
  assertPublicAgentSnapshot,
  publicAgentContractDigest,
  readLivePublicAgentContract,
} from "./public-agent-contract.mjs";

const snapshotUrl = new URL("../metadata/public-agent-tools.json", import.meta.url);
const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
assertPublicAgentSnapshot(snapshot);
const live = await readLivePublicAgentContract();
assertLivePublicAgentMatchesSnapshot(live, snapshot);
process.stdout.write(
  `${JSON.stringify({
    endpoint: snapshot.endpoint,
    source: snapshot.source,
    tools: snapshot.tools.length,
    sha256: publicAgentContractDigest(snapshot),
    verified: true,
  }, null, 2)}\n`,
);
