import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

export const PUBLIC_AGENT_ENDPOINT = "https://mcp.tickadoo.com/mcp/agents";
export const PUBLIC_AGENT_SCHEMA_VERSION = 1;
export const EXPECTED_PUBLIC_AGENT_TOOLS = Object.freeze([
  "search_experiences",
  "search_local_experiences",
  "whats_on_tonight",
  "get_last_minute",
  "get_whats_on_this_week",
  "recommend_experiences",
  "get_city_highlights",
  "search_experiences_by_topic",
  "compare_experiences",
  "get_hidden_gems",
  "get_family_day",
  "get_date_night",
  "get_itinerary_candidates",
  "list_cities",
  "get_experience_details",
  "get_show_guide",
  "get_theatre_weekend",
  "ask_theatre_concierge",
  "find_theatre_for_occasion",
  "get_related_experiences",
  "get_availability",
  "check_availability",
  "search_by_mood",
]);

const annotationKeys = [
  "destructiveHint",
  "idempotentHint",
  "openWorldHint",
  "readOnlyHint",
  "title",
];
const forbiddenToolNames = new Set([
  "render_experience_cards",
  "report_quality_signal",
  "get_transfer_info",
  "find_nearby_experiences",
]);
const availabilityVerificationTools = new Set(["get_availability", "check_availability"]);
const forbiddenPropertyName =
  /^(?:_?(?:book(?:able|ed|ings?)?|book_now|buy|purchase|checkout|payment|transaction(?:al)?|orders?|reservations?|reserve|cart)(?:_.+)?|deep_links?|action_urls?)$/i;
const linkLikePropertyName = /(?:^|_)(?:url|uri|href|link|website|webpage)s?$/i;
const forbiddenTransactionalText =
  /(?:booking_url|book_now_confidence|_booking_urls|https:\/\/(?:www\.)?tickadoo\.com|deep[-_ ]?links?|\b(?:book(?:able|ed|ing|ings?)?|buy(?:ing)?|purchase(?:d|s|ing)?|checkouts?|payments?|transactions?|transactional|orders?|carts?|reserv(?:e|ed|es|ing|ations?))\b)/i;
const countBearingCoverageClaim =
  /\b(?:(?:~\d[\d,]*|\d[\d,]*\+|\d{3,}|\d{1,3}(?:,\d{3})+|dozens|hundreds|thousands|millions)(?:\s+(?:of|[a-z][a-z-]*)){0,4}\s+(?:products?|experiences?|cities|countries)|(?:\d+|dozens|hundreds|thousands|millions)(?:\s+(?:of|[a-z][a-z-]*)){0,4}\s+tools)\b/i;
const PUBLIC_IMAGE_URL_PATTERN = "^https://cdn\\.tickadoo\\.com/";
const canonicalSchemaVersion =
  /^https:\/\/mcp\.tickadoo\.com\/schemas\/[A-Za-z0-9._~/-]+$/;
const urlOrDomain =
  /(?:https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+|(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|co(?:\.[a-z]{2})?|[a-z]{2})(?![A-Za-z0-9-])(?:[^\s"'<>]*)?)/i;
const rawListToolsResultSchema = z
  .object({
    tools: z.array(z.object({}).passthrough()),
    nextCursor: z.string().min(1).optional(),
  })
  .passthrough();
const packageVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
if (typeof packageVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  throw new Error("package.json must provide a semantic release version");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter(key => value[key] !== undefined)
      .map(key => [key, stableClone(value[key])]),
  );
}

function assertClosedObjectSchemas(value, toolName, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertClosedObjectSchemas(item, toolName, `${path}[${index}]`),
    );
    return;
  }
  if (!isRecord(value)) return;

  if (
    Object.prototype.hasOwnProperty.call(value, "$ref") ||
    Object.prototype.hasOwnProperty.call(value, "$dynamicRef")
  ) {
    throw new Error(`${toolName} uses unresolved schema indirection at ${path}`);
  }
  if (Object.prototype.hasOwnProperty.call(value, "patternProperties")) {
    throw new Error(`${toolName} uses dynamic patternProperties at ${path}`);
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "unevaluatedProperties") &&
    value.unevaluatedProperties !== false
  ) {
    throw new Error(`${toolName} has permissive unevaluatedProperties at ${path}`);
  }
  const isObjectSchema =
    value.type === "object" ||
    (Array.isArray(value.type) && value.type.includes("object")) ||
    Object.prototype.hasOwnProperty.call(value, "properties") ||
    Object.prototype.hasOwnProperty.call(value, "additionalProperties") ||
    Object.prototype.hasOwnProperty.call(value, "unevaluatedProperties") ||
    (Array.isArray(value.required) && value.required.length > 0) ||
    typeof value.minProperties === "number" ||
    typeof value.maxProperties === "number" ||
    Object.prototype.hasOwnProperty.call(value, "dependentRequired") ||
    Object.prototype.hasOwnProperty.call(value, "dependentSchemas");
  if (isObjectSchema && value.additionalProperties !== false) {
    throw new Error(`${toolName} has a permissive object schema at ${path}`);
  }
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/-/g, "_")
      .toLowerCase();
    const isAllowedImageUrl = normalizedKey === "image_url";
    if (
      forbiddenPropertyName.test(normalizedKey) ||
      (linkLikePropertyName.test(normalizedKey) && !isAllowedImageUrl)
    ) {
      throw new Error(`${toolName} exposes forbidden transactional field ${key} at ${path}`);
    }
    if (
      isAllowedImageUrl &&
      (!isRecord(child) || child.pattern !== PUBLIC_IMAGE_URL_PATTERN)
    ) {
      throw new Error(`${toolName} has an image_url outside the public CDN at ${path}`);
    }
    assertClosedObjectSchemas(child, toolName, `${path}.${key}`);
  }
}

function assertNoUnexpectedUrls(value, toolName, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoUnexpectedUrls(item, toolName, `${path}[${index}]`),
    );
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      assertNoUnexpectedUrls(child, toolName, `${path}.${key}`);
    }
    return;
  }
  if (typeof value !== "string") return;

  const isCanonicalSchemaVersion =
    path === "tool.schemaVersion" &&
    canonicalSchemaVersion.test(value);
  const isCanonicalImagePattern = value === PUBLIC_IMAGE_URL_PATTERN;
  if (!isCanonicalSchemaVersion && !isCanonicalImagePattern && urlOrDomain.test(value)) {
    throw new Error(`${toolName} contains unreviewed URL or domain metadata at ${path}`);
  }
}

function assertTool(tool) {
  if (!isRecord(tool) || typeof tool.name !== "string") {
    throw new Error("Public-agent tool descriptors must be objects with names");
  }
  if (Object.prototype.hasOwnProperty.call(tool, "_meta")) {
    throw new Error(`${tool.name} must not expose Apps or widget metadata`);
  }
  if (forbiddenToolNames.has(tool.name)) {
    throw new Error(`Forbidden tool on public-agent surface: ${tool.name}`);
  }
  if (typeof tool.description !== "string" || tool.description.trim() === "") {
    throw new Error(`${tool.name} must have a non-empty description`);
  }
  if (
    !availabilityVerificationTools.has(tool.name) &&
    /\bcurrently available\b/i.test(tool.description)
  ) {
    throw new Error(`${tool.name} claims live availability without a verification call`);
  }
  if (
    typeof tool.schemaVersion !== "string" ||
    !canonicalSchemaVersion.test(tool.schemaVersion)
  ) {
    throw new Error(`${tool.name} must have a canonical tickadoo schemaVersion`);
  }
  if (!isRecord(tool.inputSchema) || !isRecord(tool.outputSchema)) {
    throw new Error(`${tool.name} must have input and output schemas`);
  }
  for (const [schemaName, schema] of [
    ["inputSchema", tool.inputSchema],
    ["outputSchema", tool.outputSchema],
  ]) {
    if (schema.type !== "object" || schema.additionalProperties !== false) {
      throw new Error(`${tool.name} must have a closed object ${schemaName} root`);
    }
  }
  assertClosedObjectSchemas(tool.inputSchema, tool.name, "inputSchema");
  assertClosedObjectSchemas(tool.outputSchema, tool.name, "outputSchema");
  assertNoUnexpectedUrls(tool, tool.name, "tool");

  if (!isRecord(tool.annotations)) {
    throw new Error(`${tool.name} must have MCP safety annotations`);
  }
  const actualAnnotationKeys = Object.keys(tool.annotations).sort();
  if (
    JSON.stringify(actualAnnotationKeys) !== JSON.stringify(annotationKeys) ||
    typeof tool.annotations.title !== "string" ||
    tool.annotations.readOnlyHint !== true ||
    tool.annotations.destructiveHint !== false ||
    typeof tool.annotations.idempotentHint !== "boolean" ||
    typeof tool.annotations.openWorldHint !== "boolean"
  ) {
    throw new Error(`${tool.name} has incomplete, unexpected, or unsafe annotations`);
  }

  const toolMetadata = JSON.stringify(tool);
  if (forbiddenTransactionalText.test(toolMetadata)) {
    throw new Error(`${tool.name} contains transactional service-link metadata`);
  }
  if (countBearingCoverageClaim.test(toolMetadata)) {
    throw new Error(`${tool.name} contains a stale count-bearing coverage claim`);
  }
}

export function assertPublicAgentSnapshot(snapshot) {
  if (!isRecord(snapshot)) throw new Error("Public-agent snapshot must be an object");
  if (snapshot.schema_version !== PUBLIC_AGENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported public-agent snapshot schema: ${snapshot.schema_version}`);
  }
  if (!/^tickadoo\/howard@[0-9a-f]{40}$/.test(snapshot.source)) {
    throw new Error("Public-agent snapshot source must pin an exact Howard commit");
  }
  if (snapshot.endpoint !== PUBLIC_AGENT_ENDPOINT) {
    throw new Error(`Public-agent snapshot must use ${PUBLIC_AGENT_ENDPOINT}`);
  }
  if (typeof snapshot.protocol_version !== "string" || snapshot.protocol_version === "") {
    throw new Error("Public-agent snapshot must pin the negotiated MCP protocol version");
  }
  if (!isRecord(snapshot.server_info) || !isRecord(snapshot.capabilities)) {
    throw new Error("Public-agent snapshot must include server info and capabilities");
  }
  if (JSON.stringify(Object.keys(snapshot.capabilities).sort()) !== '["tools"]') {
    throw new Error("Public-agent endpoint must advertise only the tools capability");
  }
  if (
    !isRecord(snapshot.capabilities.tools) ||
    JSON.stringify(Object.keys(snapshot.capabilities.tools).sort()) !== '["listChanged"]' ||
    snapshot.capabilities.tools.listChanged !== false
  ) {
    throw new Error("Public-agent tools capability must be closed and stable");
  }
  if (typeof snapshot.instructions !== "string" || snapshot.instructions.trim() === "") {
    throw new Error("Public-agent snapshot must include server instructions");
  }
  if (!Array.isArray(snapshot.tools)) {
    throw new Error("Public-agent snapshot tools must be an array");
  }

  const names = snapshot.tools.map(tool => tool?.name);
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_PUBLIC_AGENT_TOOLS)) {
    throw new Error(
      `Public-agent tool closure differs: expected ${EXPECTED_PUBLIC_AGENT_TOOLS.join(",")}; received ${names.join(",")}`,
    );
  }
  snapshot.tools.forEach(assertTool);

  const serverMetadata = JSON.stringify({
    server_info: snapshot.server_info,
    capabilities: snapshot.capabilities,
    instructions: snapshot.instructions,
  });
  assertNoUnexpectedUrls(
    {
      server_info: snapshot.server_info,
      capabilities: snapshot.capabilities,
      instructions: snapshot.instructions,
    },
    "public-agent server",
    "server",
  );
  if (forbiddenTransactionalText.test(serverMetadata)) {
    throw new Error("Public-agent server metadata contains transactional service-link guidance");
  }
  if (countBearingCoverageClaim.test(serverMetadata)) {
    throw new Error("Public-agent server metadata contains a stale count-bearing coverage claim");
  }
}

export function createPublicAgentSnapshot(live, source) {
  const snapshot = {
    schema_version: PUBLIC_AGENT_SCHEMA_VERSION,
    source,
    endpoint: PUBLIC_AGENT_ENDPOINT,
    protocol_version: live.protocol_version,
    server_info: stableClone(live.server_info),
    capabilities: stableClone(live.capabilities),
    instructions: live.instructions,
    tools: live.tools.map(stableClone),
  };
  assertPublicAgentSnapshot(snapshot);
  return snapshot;
}

export function extractCompletePublicAgentToolsPage(result) {
  const parsed = rawListToolsResultSchema.parse(result);
  if (parsed.nextCursor !== undefined) {
    throw new Error("Public-agent tools/list must return the complete catalogue without pagination");
  }
  return parsed.tools;
}

export function publicAgentContractDigest(snapshot) {
  assertPublicAgentSnapshot(snapshot);
  return createHash("sha256").update(JSON.stringify(stableClone(snapshot))).digest("hex");
}

export function assertLivePublicAgentMatchesSnapshot(live, snapshot) {
  assertPublicAgentSnapshot(snapshot);
  const actual = createPublicAgentSnapshot(live, snapshot.source);
  const expectedJson = JSON.stringify(stableClone(snapshot));
  const actualJson = JSON.stringify(stableClone(actual));
  if (actualJson !== expectedJson) {
    throw new Error(
      `Live public-agent contract differs from ${snapshot.source}: expected ${publicAgentContractDigest(snapshot)}, received ${publicAgentContractDigest(actual)}`,
    );
  }
}

export async function readLivePublicAgentContract() {
  const transport = new StreamableHTTPClientTransport(new URL(PUBLIC_AGENT_ENDPOINT), {
    requestInit: { redirect: "error" },
  });
  const client = new Client(
    {
      name: "tickadoo-public-agent-contract-verifier",
      version: packageVersion,
    },
    { capabilities: {} },
  );

  try {
    await client.connect(transport, { timeout: 30_000 });
    // Client.listTools() intentionally strips non-standard descriptor keys.
    // Howard's reviewed contract includes schemaVersion, so use the same MCP
    // request with a pass-through result schema and validate every field below.
    const result = await client.request(
      { method: "tools/list", params: {} },
      rawListToolsResultSchema,
      { timeout: 30_000 },
    );
    return {
      protocol_version: transport.protocolVersion,
      server_info: client.getServerVersion(),
      capabilities: client.getServerCapabilities(),
      instructions: client.getInstructions(),
      tools: extractCompletePublicAgentToolsPage(result),
    };
  } finally {
    await client.close();
  }
}
