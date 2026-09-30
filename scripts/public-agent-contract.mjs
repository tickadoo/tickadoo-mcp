import { createHash } from "node:crypto";

export const expectedPublicAgentTools = [
  "search_experiences",
  "search_local_experiences",
  "whats_on_tonight",
  "get_last_minute",
  "get_whats_on_this_week",
  "recommend_experiences",
  "get_city_guide",
  "get_travel_tips",
  "compare_experiences",
  "get_hidden_gems",
  "get_family_day",
  "get_date_night",
  "plan_itinerary",
  "list_cities",
  "get_experience_details",
  "get_related_experiences",
  "get_availability",
  "check_availability",
  "search_by_mood",
  "render_experience_cards",
];

export const expectedOpenAIStoreCardTools = [
  "search_experiences",
  "search_local_experiences",
  "whats_on_tonight",
  "get_last_minute",
  "get_whats_on_this_week",
  "recommend_experiences",
  "get_city_guide",
  "get_travel_tips",
  "compare_experiences",
  "get_hidden_gems",
  "get_family_day",
  "get_date_night",
  "plan_itinerary",
  "list_cities",
  "get_experience_details",
  "get_availability",
  "check_availability",
  "search_by_mood",
  "get_transfer_info",
  "render_experience_cards",
];

// Frozen from tickadoo/howard commit 4bbc8b213c4230e31cb65e10634b99a146d4f530.
// The digest covers the published name, title, description, complete input and
// output schemas, and the five standard MCP annotations. A sync therefore fails
// closed if Howard adds a tool, restores a removed argument, relaxes schema
// closure, or changes safety metadata without a reviewed distribution update.
export const publicAgentContractSource =
  "tickadoo/howard@4bbc8b213c4230e31cb65e10634b99a146d4f530";

export const expectedPublicAgentToolDigests = Object.freeze({
  search_experiences: "8ff27cdb48a1cb5d601de263f32eb62765440bb67037821b44835b80c75026df",
  search_local_experiences: "c05d946afcc6463d8958a3052ef144c069447fd1ed627dce779c5694ce5ec38f",
  whats_on_tonight: "f8d182c51d4507b9b60992f17e6a346292db57e3171abbd55ec9658723224de0",
  get_last_minute: "9c02b7d4961ef662f12b85c1362c2ff13bd264bbe37145aef33f731dd5d33eb6",
  get_whats_on_this_week: "f4bb37c579d0798e0b1a7b58653303100a0c85e5d4d08e7dd934cf140725873f",
  recommend_experiences: "2650e709d09fdb58ccf0e7ade506c8fe9d2da4f515b0ac702f3a753e1f5edf22",
  get_city_guide: "ddd15b5df0ffa1a239641aa3f04f4c21adac917abcf2fb32146593f4f88bf0f5",
  get_travel_tips: "f74a2bde22cbf872513c71cfd6cf9831f75d15715301183447178aa60e579e7b",
  compare_experiences: "1bae541fcc0e5768a6f4d039b04bb93531a09580c46f257456e2fae14df40f38",
  get_hidden_gems: "dc1f6520af62c38528580deeac64d8e77362bf5cadafbfb344e372a3cd8fb485",
  get_family_day: "4ae74d4d8d779ad88bea2a9757752f1c149853838af43a381cf7093cbd5ae121",
  get_date_night: "bae3a79d944259a672148fd5095d89973725230c2487f925cc20c9a9f08c4699",
  plan_itinerary: "ee858b18971aba4ea60241c7ee1b98c7b6cea17592b6343a8dafd9e3b9c2528b",
  list_cities: "6302355d67cc4979fe690fbac97cdd2dd10c5e136d519f29d8890360220febc4",
  get_experience_details: "1977a61603d22d8c4c43ee9660782ebe107a06cb755990b9e19950d78145d2d2",
  get_related_experiences: "583d2c1001826e02f0c2f50dfb44c647e4082b61cad8d79426f270b5321ff32f",
  get_availability: "e73cd3abd4c36d9560e15f51ee89c029cb4e95c9846315f5c836cb050b9ed827",
  check_availability: "e8390c1b2e1000621c3152bb11baf23989757d6df2ff345630d55899529ca56a",
  search_by_mood: "f40715c86bc0a2498c488e341747e1b170a8dd3112e4425724d38f6b3db63dac",
  render_experience_cards: "7e8847e29c53bcf32b0ec1da847f3cac21f4f7e516a22af66c9e4b29e9663700",
});

export const expectedPublicAgentInputProperties = Object.freeze({
  search_experiences: [
    "city",
    "query",
    "category",
    "tags",
    "indoor_outdoor",
    "min_review_count",
    "min_rating",
    "restrict_to_top_rated",
    "popular_only",
    "max_price",
    "limit",
    "language",
  ],
  search_local_experiences: [
    "place_hint",
    "city",
    "neighbourhood",
    "radius_hint",
    "tags",
    "date_from",
    "date_to",
    "limit",
    "language",
  ],
  whats_on_tonight: ["city", "category", "max_results", "language"],
  get_last_minute: ["city", "hours", "language"],
  get_whats_on_this_week: ["city", "language"],
  recommend_experiences: ["query", "city", "limit", "language"],
  get_city_guide: ["city", "language"],
  get_travel_tips: ["city", "language"],
  compare_experiences: ["slugs", "language"],
  get_hidden_gems: ["city", "max_results", "language"],
  get_family_day: ["city", "date", "language"],
  get_date_night: ["city", "date", "language"],
  plan_itinerary: ["city", "days", "audience", "language"],
  list_cities: ["country", "limit", "language"],
  get_experience_details: ["product_id", "slug", "language"],
  get_related_experiences: ["product_id", "context", "max_results", "language"],
  get_availability: [
    "product_id",
    "slug",
    "city_slug",
    "date_from",
    "date_to",
    "party_size",
    "preferred_time",
    "as_of",
    "fresh",
  ],
  check_availability: ["slug", "date", "party_size", "language"],
  search_by_mood: ["city", "mood", "limit", "language"],
  render_experience_cards: ["experience_ids", "render_type"],
});

const standardAnnotationKeys = [
  "title",
  "readOnlyHint",
  "destructiveHint",
  "idempotentHint",
  "openWorldHint",
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => [key, sortJson(value[key])]),
  );
}

function selectStandardAnnotations(annotations) {
  if (!isRecord(annotations)) return {};
  return Object.fromEntries(
    standardAnnotationKeys
      .filter(key => annotations[key] !== undefined)
      .map(key => [key, annotations[key]]),
  );
}

export function publicAgentToolMetadata(tool) {
  const annotations = selectStandardAnnotations(tool.annotations);
  return {
    name: tool.name,
    title: tool.title ?? annotations.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations,
  };
}

function assertClosedObjectSchemas(schema, toolName, path = "outputSchema") {
  if (Array.isArray(schema)) {
    schema.forEach((value, index) =>
      assertClosedObjectSchemas(value, toolName, `${path}[${index}]`),
    );
    return;
  }
  if (!isRecord(schema)) return;

  const declaresObject =
    schema.type === "object" ||
    (Array.isArray(schema.type) && schema.type.includes("object")) ||
    Object.prototype.hasOwnProperty.call(schema, "properties");
  if (declaresObject && schema.additionalProperties !== false) {
    throw new Error(
      `Refusing to sync public-agent metadata because ${toolName} has a permissive object at ${path}`,
    );
  }

  for (const [key, value] of Object.entries(schema)) {
    assertClosedObjectSchemas(value, toolName, `${path}.${key}`);
  }
}

export function publicAgentToolDigest(tool) {
  return createHash("sha256")
    .update(JSON.stringify(sortJson(publicAgentToolMetadata(tool))))
    .digest("hex");
}

export function assertPublicAgentContract(tools) {
  if (!Array.isArray(tools)) {
    throw new Error("Refusing to sync public-agent metadata because tools/list did not return an array");
  }

  const actualNames = tools.map(tool => tool?.name);
  const actualNameSet = new Set(actualNames);
  const missing = expectedPublicAgentTools.filter(name => !actualNameSet.has(name));
  const unexpected = actualNames.filter(name => !expectedPublicAgentTools.includes(name));
  const duplicates = actualNames.filter((name, index) => actualNames.indexOf(name) !== index);
  const orderChanged = actualNames.some((name, index) => name !== expectedPublicAgentTools[index]);

  if (
    actualNames.length !== expectedPublicAgentTools.length ||
    missing.length > 0 ||
    unexpected.length > 0 ||
    duplicates.length > 0 ||
    orderChanged
  ) {
    throw new Error(
      `Refusing to sync public-agent metadata from a non-public tool set: expected ${expectedPublicAgentTools.length} unique ordered tools; missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}; duplicates=${[...new Set(duplicates)].join(",") || "none"}; order_changed=${orderChanged}`,
    );
  }

  for (const tool of tools) {
    if (!isRecord(tool)) {
      throw new Error("Refusing to sync public-agent metadata because a public tool descriptor is not an object");
    }
    if (typeof tool.description !== "string" || tool.description.trim() === "") {
      throw new Error(`Refusing to sync public-agent metadata because ${tool.name} has no description`);
    }

    const annotations = tool.annotations;
    const annotationKeys = isRecord(annotations) ? Object.keys(annotations).sort() : [];
    if (
      !isRecord(annotations) ||
      annotationKeys.length !== standardAnnotationKeys.length ||
      annotationKeys.some((key, index) => key !== [...standardAnnotationKeys].sort()[index]) ||
      annotations.title !== (tool.title ?? annotations.title) ||
      annotations.readOnlyHint !== true ||
      annotations.destructiveHint !== false ||
      annotations.openWorldHint !== false ||
      typeof annotations.idempotentHint !== "boolean"
    ) {
      throw new Error(
        `Refusing to sync public-agent metadata because ${tool.name} has incomplete, unexpected, or unsafe annotations`,
      );
    }

    const inputSchema = tool.inputSchema;
    const properties = isRecord(inputSchema) && isRecord(inputSchema.properties)
      ? inputSchema.properties
      : undefined;
    if (
      !isRecord(inputSchema) ||
      inputSchema.type !== "object" ||
      inputSchema.additionalProperties !== false ||
      !properties
    ) {
      throw new Error(
        `Refusing to sync public-agent metadata because ${tool.name} does not have a closed object input schema`,
      );
    }

    const expectedProperties = expectedPublicAgentInputProperties[tool.name];
    const actualProperties = Object.keys(properties);
    if (
      !expectedProperties ||
      actualProperties.length !== expectedProperties.length ||
      actualProperties.some((property, index) => property !== expectedProperties[index])
    ) {
      throw new Error(
        `Refusing to sync public-agent metadata because ${tool.name} input properties differ from the frozen public-agent contract`,
      );
    }

    const required = inputSchema.required ?? [];
    if (
      !Array.isArray(required) ||
      new Set(required).size !== required.length ||
      required.some(property => !Object.prototype.hasOwnProperty.call(properties, property))
    ) {
      throw new Error(
        `Refusing to sync public-agent metadata because ${tool.name} has invalid required input properties`,
      );
    }

    if (!isRecord(tool.outputSchema)) {
      throw new Error(
        `Refusing to sync public-agent metadata because ${tool.name} has no output schema`,
      );
    }
    assertClosedObjectSchemas(tool.outputSchema, tool.name);

    const digest = publicAgentToolDigest(tool);
    if (digest !== expectedPublicAgentToolDigests[tool.name]) {
      throw new Error(
        `Refusing to sync public-agent metadata because ${tool.name} metadata differs from ${publicAgentContractSource}`,
      );
    }
  }
}
