const REQUIRED_TOOLS = [
  "search_experiences",
  "find_nearby_experiences",
  "list_cities",
  "get_experience_details",
];
const EXPECTED_SERVER_VERSION = "1.1.0";

const REQUIRED_RESOURCE = "tickadoo://product-feed";

function firstTextContent(result) {
  return result?.content?.find(item => item.type === "text")?.text ?? "";
}

function requireIncludes(haystack, needle, label) {
  if (!haystack.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`${label} did not include "${needle}". Received: ${haystack}`);
  }
}

function requireExcludes(haystack, needle, label) {
  if (haystack.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`${label} unexpectedly included "${needle}". Received: ${haystack}`);
  }
}

function requireMissingKey(value, key, label) {
  if (value && Object.prototype.hasOwnProperty.call(value, key)) {
    throw new Error(`${label} unexpectedly exposed "${key}". Received: ${JSON.stringify(value)}`);
  }
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireToolAnnotations(tool, label) {
  requireCondition(Boolean(tool), `${label} was not returned by tools/list.`);
  requireCondition(tool.annotations?.readOnlyHint === true, `${label} is missing readOnlyHint=true. Received: ${JSON.stringify(tool)}`);
  requireCondition(tool.annotations?.destructiveHint === false, `${label} is missing destructiveHint=false. Received: ${JSON.stringify(tool)}`);
  requireCondition(tool.annotations?.openWorldHint === true, `${label} is missing openWorldHint=true. Received: ${JSON.stringify(tool)}`);
}

export async function runE2ESmoke(client, options = {}) {
  const {
    target = "unknown",
    searchCity = process.env.MCP_SEARCH_CITY ?? "vegas",
    expectedSlug = process.env.MCP_EXPECTED_SLUG ?? "las-vegas",
    missingCity = process.env.MCP_MISSING_CITY ?? "__definitely-not-a-real-city__",
    nearbyLatitude = Number(process.env.MCP_NEARBY_LATITUDE ?? 51.502606),
    nearbyLongitude = Number(process.env.MCP_NEARBY_LONGITUDE ?? -0.118117),
    nearbyRadiusKm = Number(process.env.MCP_NEARBY_RADIUS_KM ?? 5),
    cityQuery = process.env.MCP_CITY_QUERY ?? "paris",
    cityLimit = Number(process.env.MCP_CITY_LIMIT ?? 5),
    directoryLimit = Number(process.env.MCP_DIRECTORY_LIMIT ?? 3),
    detailsSlug = process.env.MCP_DETAILS_SLUG ?? "london-dungeon-tickets",
    bogusDetailsSlug = process.env.MCP_BOGUS_DETAILS_SLUG ?? "__definitely-not-a-real-experience-slug__",
    detailsProvider = process.env.MCP_DETAILS_PROVIDER ?? "Headout",
    detailsProviderId = process.env.MCP_DETAILS_PROVIDER_ID ?? "5187",
    detailsDays = Number(process.env.MCP_DETAILS_DAYS ?? 7),
  } = options;

  const toolsResult = await client.listTools();
  requireCondition(
    client.getServerVersion()?.version === EXPECTED_SERVER_VERSION,
    `Expected server version ${EXPECTED_SERVER_VERSION}, received ${JSON.stringify(client.getServerVersion())}`,
  );
  const toolNames = toolsResult.tools.map(tool => tool.name);
  for (const requiredTool of REQUIRED_TOOLS) {
    if (!toolNames.includes(requiredTool)) {
      throw new Error(`Missing required tool "${requiredTool}" on ${target}`);
    }
    requireToolAnnotations(
      toolsResult.tools.find(tool => tool.name === requiredTool),
      `tools/list ${requiredTool}`,
    );
  }

  const resourcesResult = await client.listResources();
  const resourceUris = resourcesResult.resources.map(resource => resource.uri);
  if (!resourceUris.includes(REQUIRED_RESOURCE)) {
    throw new Error(`Missing required resource "${REQUIRED_RESOURCE}" on ${target}`);
  }

  const searchResult = await client.callTool({
    name: "search_experiences",
    arguments: { city: searchCity, language: "en" },
  });
  const searchText = firstTextContent(searchResult);
  requireIncludes(searchText, expectedSlug, `search_experiences(${searchCity})`);
  requireIncludes(searchText, "Showing top", `search_experiences(${searchCity})`);
  requireExcludes(searchText, "provider_id=", `search_experiences(${searchCity})`);
  requireExcludes(searchText, "Details lookup", `search_experiences(${searchCity})`);
  const firstExperience = searchResult.structuredContent?.experiences?.[0];
  requireMissingKey(firstExperience, "provider", `search_experiences(${searchCity}) structuredContent`);
  requireMissingKey(firstExperience, "providerId", `search_experiences(${searchCity}) structuredContent`);
  requireCondition(Boolean(firstExperience?.imageUrl), `search_experiences(${searchCity}) structuredContent did not include an imageUrl.`);

  const missingSearchResult = await client.callTool({
    name: "search_experiences",
    arguments: { city: missingCity, language: "en" },
  });
  const missingSearchText = firstTextContent(missingSearchResult);
  requireIncludes(missingSearchText, "No experiences found", `search_experiences(${missingCity})`);
  requireExcludes(missingSearchText, "Error:", `search_experiences(${missingCity})`);

  const nearbyResult = await client.callTool({
    name: "find_nearby_experiences",
    arguments: {
      latitude: nearbyLatitude,
      longitude: nearbyLongitude,
      radius_km: nearbyRadiusKm,
      language: "en",
    },
  });
  const nearbyText = firstTextContent(nearbyResult);
  requireIncludes(nearbyText, "Showing top", `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude})`);
  requireIncludes(nearbyText, "🖼️", `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude})`);
  requireExcludes(nearbyText, "No experiences within", `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude})`);
  requireCondition(
    Array.isArray(nearbyResult.structuredContent?.experiences) && nearbyResult.structuredContent.experiences.length > 0,
    `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude}) did not return structured experiences.`,
  );
  requireCondition(
    Boolean(nearbyResult.structuredContent?.experiences?.[0]?.imageUrl),
    `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude}) structuredContent did not include an imageUrl.`,
  );

  const citiesResult = await client.callTool({
    name: "list_cities",
    arguments: { query: cityQuery, limit: cityLimit, language: "en" },
  });
  const citiesText = firstTextContent(citiesResult);
  requireIncludes(citiesText, cityQuery, `list_cities(query=${cityQuery})`);

  const directoryResult = await client.callTool({
    name: "list_cities",
    arguments: { limit: directoryLimit, language: "en" },
  });
  const directoryText = firstTextContent(directoryResult);
  requireIncludes(directoryText, `Showing ${directoryLimit} of`, `list_cities(limit=${directoryLimit})`);
  const directoryLines = directoryText.split("\n").filter(line => line.startsWith("📍 "));
  requireCondition(
    directoryLines.length === directoryLimit,
    `list_cities(limit=${directoryLimit}) returned ${directoryLines.length} city lines instead of ${directoryLimit}. Received: ${directoryText}`,
  );

  const detailsResult = await client.callTool({
    name: "get_experience_details",
    arguments: {
      slug: detailsSlug,
      days: detailsDays,
      language: "en",
    },
  });
  const detailsText = firstTextContent(detailsResult);
  requireIncludes(detailsText, "tickadoo", `get_experience_details(slug=${detailsSlug})`);
  requireIncludes(detailsText, "London Dungeon", `get_experience_details(slug=${detailsSlug})`);
  requireIncludes(detailsText, detailsSlug, `get_experience_details(slug=${detailsSlug})`);
  requireExcludes(detailsText, detailsProvider, `get_experience_details(slug=${detailsSlug})`);
  requireExcludes(detailsText, detailsProviderId, `get_experience_details(slug=${detailsSlug})`);
  requireMissingKey(detailsResult.structuredContent, "provider", `get_experience_details(slug=${detailsSlug}) structuredContent`);
  requireMissingKey(detailsResult.structuredContent, "providerId", `get_experience_details(slug=${detailsSlug}) structuredContent`);

  const bogusDetailsResult = await client.callTool({
    name: "get_experience_details",
    arguments: {
      slug: bogusDetailsSlug,
      days: detailsDays,
      language: "en",
    },
  });
  const bogusDetailsText = firstTextContent(bogusDetailsResult);
  requireIncludes(bogusDetailsText, "Could not resolve tickadoo slug", `get_experience_details(slug=${bogusDetailsSlug})`);
  requireCondition(
    bogusDetailsResult.isError === true,
    `get_experience_details(slug=${bogusDetailsSlug}) did not return an error result.`,
  );

  const resourceResult = await client.readResource({ uri: REQUIRED_RESOURCE });
  const resourceText = resourceResult.contents?.[0]?.text ?? "";
  requireIncludes(resourceText, "Product Feed", "product-feed resource");

  return {
    target,
    server: client.getServerVersion(),
    toolMetadata: toolsResult.tools.map(tool => ({
      name: tool.name,
      annotations: tool.annotations,
    })),
    tools: toolNames,
    resources: resourceUris,
    searchPreview: searchText.slice(0, 220),
    missingSearchPreview: missingSearchText.slice(0, 220),
    nearbyPreview: nearbyText.slice(0, 220),
    citiesPreview: citiesText.slice(0, 220),
    directoryPreview: directoryText.slice(0, 220),
    detailsPreview: detailsText.slice(0, 220),
    bogusDetailsPreview: bogusDetailsText.slice(0, 220),
    resourcePreview: resourceText.slice(0, 220),
  };
}
