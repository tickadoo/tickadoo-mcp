export const publisherMetadataKey = "io.modelcontextprotocol.registry/publisher-provided";

// Registry metadata is a compact discovery index. The remote tools/list owns
// full descriptions and input schemas; retain every tool and behavioral hint.
export function compactToolMetadata(tool) {
  return {
    name: tool.name,
    title: tool.title ?? tool.annotations?.title,
    annotations: Object.fromEntries(
      ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]
        .filter(key => tool.annotations?.[key] !== undefined)
        .map(key => [key, tool.annotations[key]]),
    ),
  };
}

export function assertPublisherMetadataSize(serverJson) {
  const metadata = serverJson._meta?.[publisherMetadataKey];
  if (metadata == null) return;
  // Match the Registry's Go json.Marshal UTF-8 size, including HTML escaping:
  // https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/internal/validators/validators.go#L681
  const json = JSON.stringify(metadata).replace(/[<>&\u2028\u2029]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > 4096) {
    throw new Error(`_meta.${publisherMetadataKey} exceeds the Registry's 4096-byte limit (${bytes} bytes)`);
  }
}
