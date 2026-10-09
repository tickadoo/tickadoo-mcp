import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertPublisherMetadataSize, compactToolMetadata, publisherMetadataKey } from "../scripts/registry-metadata.mjs";

const server = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const manifest = (metadata: unknown) => ({ _meta: { [publisherMetadataKey]: metadata } });

describe("MCP Registry publisher metadata", () => {
  it("keeps the checked-in publisher extension within the actual 4096-byte limit", () => {
    const json = JSON.stringify(server._meta[publisherMetadataKey]);
    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(4096);
    expect(() => assertPublisherMetadataSize(server)).not.toThrow();
  });

  it("limits only the publisher extension, not the entire server document", () => {
    const metadata = { note: "x".repeat(4085) }; // 11 bytes of JSON overhead.
    expect(() => assertPublisherMetadataSize({ ...manifest(metadata), description: "x".repeat(10000) })).not.toThrow();
    expect(() => assertPublisherMetadataSize(manifest({ note: "x".repeat(4086) }))).toThrow(/4097 bytes/);
  });

  it("counts UTF-8 bytes and Go JSON escaping at the boundary", () => {
    expect(() => assertPublisherMetadataSize(manifest({ note: "é".repeat(2042) + "x" }))).not.toThrow();
    expect(() => assertPublisherMetadataSize(manifest({ note: "é".repeat(2043) }))).toThrow(/4097 bytes/);
    for (const escaped of ["<", ">", "&", "\u2028", "\u2029"]) {
      expect(() => assertPublisherMetadataSize(manifest({ note: escaped.repeat(680) + "xxxxx" }))).not.toThrow();
      expect(() => assertPublisherMetadataSize(manifest({ note: escaped.repeat(681) }))).toThrow(/4097 bytes/);
    }
  });

  it("preserves tool identity, title and all standard behavioral hints without copying full schemas", () => {
    const annotations = {
      title: "Fallback title", readOnlyHint: false, destructiveHint: true,
      idempotentHint: false, openWorldHint: true,
    };
    const tool = { name: "book", title: "Book", description: "Detailed instructions", inputSchema: {}, annotations };
    expect(compactToolMetadata(tool)).toEqual({
      name: "book", title: "Book",
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    });
    expect(compactToolMetadata({ ...tool, title: undefined }).title).toBe("Fallback title");
    expect(compactToolMetadata({ name: "search" })).toEqual({ name: "search", title: undefined, annotations: {} });
    expect(tool.description).toBe("Detailed instructions");
  });
});
