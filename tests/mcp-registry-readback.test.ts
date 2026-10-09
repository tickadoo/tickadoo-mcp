import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/publish-mcp-registry.yml", import.meta.url),
  "utf8",
);
const block = workflow.match(/python3 - <<'EOF'\n([\s\S]*?)\n {10}EOF/);
if (!block) throw new Error("Registry read-back Python block is missing");
const script = block[1].split("\n").map((line) => line.slice(10)).join("\n");
const name = "io.github.tickadoo/tickadoo-mcp";
const version = "2.1.0+build.1";
const expected = { server: { name, version }, _meta: {} };

// Execute the workflow's actual verifier with fixture-only HTTP responses.
function verify(records: unknown[]) {
  return spawnSync("python3", ["-c", `
import io, json, sys
from unittest.mock import mock_open, patch
from urllib.error import HTTPError

fixture = json.load(sys.stdin)
responses = iter(fixture['records'])
requests = []
def respond(url, timeout):
    requests.append({'url': url, 'timeout': timeout})
    record = next(responses)
    if 'http_error' in record:
        raise HTTPError(url, record['http_error'], 'fixture error', {}, None)
    return io.BytesIO(json.dumps(record).encode('utf-8'))

with patch('builtins.open', mock_open(read_data=json.dumps(fixture['manifest']))):
    with patch('urllib.request.urlopen', side_effect=respond):
        exec(compile(fixture['script'], 'registry-readback', 'exec'), {})
print(json.dumps(requests))
`], {
    input: JSON.stringify({ script, manifest: { name, version }, records }),
    encoding: "utf8",
    timeout: 5000,
  });
}

describe("MCP Registry publishing read-back", () => {
  it("accepts nested ServerResponse data and checks exact version plus latest", () => {
    const result = verify([expected, expected]);
    expect(result.status, result.stderr || result.error?.message).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(JSON.parse(lines.at(-1)!)).toEqual([
      {
        url: "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.tickadoo%2Ftickadoo-mcp/versions/2.1.0%2Bbuild.1",
        timeout: 30,
      },
      {
        url: "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.tickadoo%2Ftickadoo-mcp/versions/latest",
        timeout: 30,
      },
    ]);
  });

  it.each([
    ["wrong exact version", [{ server: { name, version: "2.0.0" } }, expected]],
    ["wrong exact name", [{ server: { name: "io.github.other/server", version }, _meta: { name } }, expected]],
    ["older latest", [expected, { server: { name, version: "2.0.0" } }]],
    ["wrong latest name", [expected, { server: { name: "io.github.other/server", version } }]],
    ["missing ServerResponse wrapper", [{ name, version }, expected]],
    ["HTTP failure on exact version", [{ http_error: 404 }, expected]],
    ["HTTP failure on latest", [expected, { http_error: 503 }]],
  ])("rejects %s", (_label, records) => {
    const result = verify(records);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });
});
