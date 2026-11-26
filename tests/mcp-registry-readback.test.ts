import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/publish-mcp-registry.yml", import.meta.url),
  "utf8",
);
const block = workflow.match(/python3 - <<'EOF'\n([\s\S]*?)\n {10}EOF/);
if (!block) throw new Error("Registry read-back Python block is missing");
const script = block[1].split("\n").map(line => line.slice(10)).join("\n");

const name = "io.github.tickadoo/tickadoo-mcp";
const version = "2.1.0+build.1";
const publisherKey = "io.modelcontextprotocol.registry/publisher-provided";
const officialKey = "io.modelcontextprotocol.registry/official";
const manifest = {
  $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  name,
  version,
  title: "tickadoo Experiences and Events",
  description: "Discover and book live experiences worldwide.",
  websiteUrl: "https://mcp.tickadoo.com",
  repository: {
    url: "https://github.com/tickadoo/tickadoo-mcp",
    source: "github",
  },
  remotes: [{ type: "streamable-http", url: "https://mcp.tickadoo.com/mcp" }],
  _meta: {
    [publisherKey]: {
      license: "MIT",
      tools: [
        {
          name: "search_experiences",
          annotations: { readOnlyHint: true, destructiveHint: false },
        },
        {
          name: "report_quality_signal",
          annotations: { readOnlyHint: false, destructiveHint: false },
        },
      ],
    },
  },
};

const official = {
  status: "active",
  isLatest: true,
  publishedAt: "2026-10-24T12:00:00Z",
  updatedAt: "2026-10-24T12:00:01+00:00",
  statusChangedAt: "2026-10-24T12:00:02.123456Z",
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

type RegistryRecord = {
  server: typeof manifest;
  _meta: Record<string, unknown>;
};

function record(
  mutate?: (value: RegistryRecord) => void,
) {
  const value: RegistryRecord = {
    server: clone(manifest),
    _meta: {
      [officialKey]: clone(official),
      "registry/additive": { ignored: true },
    },
  };
  mutate?.(value);
  return value;
}

// Execute the workflow's actual verifier with fixture-only HTTP responses.
function verify(records: unknown[], manifestFixture: unknown = manifest) {
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
        with patch('time.sleep'):
            exec(compile(fixture['script'], 'registry-readback', 'exec'), {})
print(json.dumps(requests))
`], {
    input: JSON.stringify({ script, manifest: manifestFixture, records }),
    encoding: "utf8",
    timeout: 5000,
  });
}

describe("MCP Registry publishing read-back", () => {
  it("limits publication to one protected main-branch job", () => {
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toMatch(/^\s{4}environment: mcp-registry$/m);
    expect(workflow).toMatch(/^\s{2}group: publish-mcp-registry$/m);
    expect(workflow).toMatch(/^\s{2}cancel-in-progress: false$/m);
  });

  it("accepts exact publisher metadata while ignoring object order and additive Registry metadata", () => {
    const reordered = record(value => {
      value.server = {
        ...value.server,
        repository: {
          source: value.server.repository.source,
          url: value.server.repository.url,
        },
      };
      Object.assign(value.server, { registryOwnedFutureField: true });
    });
    const result = verify([reordered, reordered]);
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

  it("retries transient HTTP and incomplete metadata responses", () => {
    const older = record(value => {
      value.server.version = "2.0.0";
    });
    const result = verify([{ http_error: 503 }, record(), older, record()]);
    expect(result.status, result.stderr || result.error?.message).toBe(0);
    expect(JSON.parse(result.stdout.trim().split("\n").at(-1)!)).toHaveLength(4);
  });

  const rejected = [
    ["wrong name", (value: ReturnType<typeof record>) => { value.server.name = "io.github.other/server"; }],
    ["wrong version", (value: ReturnType<typeof record>) => { value.server.version = "2.0.0"; }],
    ["schema drift", (value: ReturnType<typeof record>) => { value.server.$schema = "https://example.test/schema"; }],
    ["title drift", (value: ReturnType<typeof record>) => { value.server.title = "Other title"; }],
    ["description drift", (value: ReturnType<typeof record>) => { value.server.description = "Other description"; }],
    ["website drift", (value: ReturnType<typeof record>) => { value.server.websiteUrl = "https://example.test"; }],
    ["repository drift", (value: ReturnType<typeof record>) => { value.server.repository.source = "gitlab"; }],
    ["remote drift", (value: ReturnType<typeof record>) => { value.server.remotes[0].url += "/agents"; }],
    ["publisher metadata drift", (value: ReturnType<typeof record>) => { value.server._meta[publisherKey].license = "Apache-2.0"; }],
    ["tool order drift", (value: ReturnType<typeof record>) => { value.server._meta[publisherKey].tools.reverse(); }],
    ["JSON type drift", (value: ReturnType<typeof record>) => { value.server._meta[publisherKey].tools[0].annotations.readOnlyHint = 1 as unknown as boolean; }],
    ["inactive status", (value: ReturnType<typeof record>) => { (value._meta[officialKey] as typeof official).status = "deleted"; }],
    ["not latest", (value: ReturnType<typeof record>) => { (value._meta[officialKey] as typeof official).isLatest = false; }],
    ["missing timestamp", (value: ReturnType<typeof record>) => { delete (value._meta[officialKey] as Partial<typeof official>).updatedAt; }],
    ["invalid timestamp", (value: ReturnType<typeof record>) => { (value._meta[officialKey] as typeof official).publishedAt = "yesterday"; }],
  ] as const;

  it.each(rejected)("rejects %s", (_label, mutate) => {
    const bad = record(mutate);
    const result = verify(Array(12).fill(bad));
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });

  it("rejects drift on latest even when exact-version metadata matches", () => {
    const badLatest = record(value => {
      value.server.remotes[0].type = "sse";
    });
    const result = verify([record(), ...Array(12).fill(badLatest)]);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });

  it.each([
    ["missing ServerResponse wrapper", { ...manifest }],
    ["missing official metadata", { server: manifest, _meta: {} }],
    ["HTTP failure", { http_error: 404 }],
  ])("rejects %s", (_label, bad) => {
    const result = verify(Array(12).fill(bad));
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });
});
