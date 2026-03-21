const REQUIRED_TOOLS = [
  "search_experiences",
  "find_nearby_experiences",
  "list_cities",
  "get_experience_details",
];
const EXPECTED_SERVER_VERSION = "1.1.0";
const EXPECTED_UTM_PARAMS = new URLSearchParams(
  process.env.MCP_EXPECTED_UTM_QUERY ?? "utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
);

const REQUIRED_RESOURCE = "tickadoo://product-feed";
const SEARCH_NEXT_STEP_HINT = "💡 Tip: Use get_experience_details(slug) for availability & pricing. Use find_nearby_experiences(lat, lng) for location-based discovery.";
const NEARBY_NEXT_STEP_HINT = "💡 Tip: Use get_experience_details(slug) for full details. Results sorted by distance from your coordinates.";
const FILTERED_CITIES_NEXT_STEP_HINT = "💡 Tip: Use search_experiences(city) to see what's available in any of these cities.";
const DETAILS_NEXT_STEP_HINT = "💡 Tip: Share the booking URL with the user. For similar experiences, use search_experiences(city).";

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

function requireErrorResult(result, label) {
  requireCondition(result?.isError === true, `${label} did not return isError=true. Received: ${JSON.stringify(result)}`);
}

function requireToolAnnotations(tool, label) {
  requireCondition(Boolean(tool), `${label} was not returned by tools/list.`);
  requireCondition(tool.annotations?.readOnlyHint === true, `${label} is missing readOnlyHint=true. Received: ${JSON.stringify(tool)}`);
  requireCondition(tool.annotations?.destructiveHint === false, `${label} is missing destructiveHint=false. Received: ${JSON.stringify(tool)}`);
  requireCondition(tool.annotations?.openWorldHint === true, `${label} is missing openWorldHint=true. Received: ${JSON.stringify(tool)}`);
}

function requireTrackedBookingUrl(value, label) {
  requireCondition(typeof value === "string" && value.length > 0, `${label} did not include a booking URL. Received: ${value}`);
  const parsed = new URL(value);
  for (const [key, expectedValue] of EXPECTED_UTM_PARAMS.entries()) {
    requireCondition(
      parsed.searchParams.get(key) === expectedValue,
      `${label} is missing ${key}=${expectedValue}. Received: ${value}`,
    );
  }
}

function parseExperienceCards(text) {
  return [...text.matchAll(/🎭 [\s\S]*?(?=\n\n🎭 |\n\nView all:|$)/g)].map(match => match[0]);
}

function extractCardPrice(cardText) {
  const priceMatch = cardText.match(/💰 From [A-Z]{3} ([0-9]+(?:\.[0-9]{2})?)/);
  return priceMatch ? Number(priceMatch[1]) : null;
}

function normalizeCategoryText(value) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function runE2ESmoke(client, options = {}) {
  const {
    target = "unknown",
    searchCity = process.env.MCP_SEARCH_CITY ?? "vegas",
    expectedSlug = process.env.MCP_EXPECTED_SLUG ?? "las-vegas",
    categorySearchCity = process.env.MCP_CATEGORY_SEARCH_CITY ?? searchCity,
    categorySearchValue = process.env.MCP_CATEGORY_SEARCH_VALUE ?? "comedy",
    categoryRegressionCity = process.env.MCP_CATEGORY_REGRESSION_CITY ?? "london",
    categoryRegressionValue = process.env.MCP_CATEGORY_REGRESSION_VALUE ?? "tours",
    filteredSearchCity = process.env.MCP_FILTERED_SEARCH_CITY ?? searchCity,
    filteredSearchMinPrice = Number(process.env.MCP_FILTERED_SEARCH_MIN_PRICE ?? 1),
    filteredSearchMaxPrice = Number(process.env.MCP_FILTERED_SEARCH_MAX_PRICE ?? 50),
    emptyCategorySearchCity = process.env.MCP_EMPTY_CATEGORY_SEARCH_CITY ?? searchCity,
    emptyCategorySearchValue = process.env.MCP_EMPTY_CATEGORY_SEARCH_VALUE ?? "snowboarding",
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
  requireCondition(
    typeof firstExperience?.description === "string" && firstExperience.description.length > 0,
    `search_experiences(${searchCity}) structuredContent did not include a description.`,
  );
  requireCondition(
    firstExperience.description.length <= 150,
    `search_experiences(${searchCity}) structuredContent description exceeded 150 chars. Received: ${firstExperience.description}`,
  );
  requireCondition(
    typeof firstExperience?.priceAmount === "number" && firstExperience.priceAmount > 0,
    `search_experiences(${searchCity}) structuredContent did not include a numeric priceAmount.`,
  );
  requireCondition(
    typeof firstExperience?.priceCurrency === "string" && /^[A-Z]{3}$/.test(firstExperience.priceCurrency),
    `search_experiences(${searchCity}) structuredContent did not include a valid ISO priceCurrency. Received: ${firstExperience?.priceCurrency}`,
  );
  requireCondition(Boolean(firstExperience?.imageUrl), `search_experiences(${searchCity}) structuredContent did not include an imageUrl.`);
  requireTrackedBookingUrl(firstExperience?.bookingUrl, `search_experiences(${searchCity}) structuredContent`);
  requireIncludes(searchText, "utm_source=mcp", `search_experiences(${searchCity})`);
  requireIncludes(searchText, SEARCH_NEXT_STEP_HINT, `search_experiences(${searchCity})`);

  const categorySearchResult = await client.callTool({
    name: "search_experiences",
    arguments: {
      city: categorySearchCity,
      category: categorySearchValue,
      max_results: 5,
      language: "en",
    },
  });
  const categorySearchText = firstTextContent(categorySearchResult);
  requireIncludes(categorySearchText, categorySearchCity, `search_experiences(${categorySearchCity}, category=${categorySearchValue})`);
  requireIncludes(categorySearchText, categorySearchValue, `search_experiences(${categorySearchCity}, category=${categorySearchValue})`);
  const categoryCards = parseExperienceCards(categorySearchText);
  requireCondition(
    categoryCards.length > 0,
    `search_experiences(${categorySearchCity}, category=${categorySearchValue}) returned no cards. Received: ${categorySearchText}`,
  );
  requireCondition(
    categoryCards.some(card => normalizeCategoryText(card).includes(normalizeCategoryText(categorySearchValue))),
    `search_experiences(${categorySearchCity}, category=${categorySearchValue}) did not return any visible category match. Received: ${categorySearchText}`,
  );

  const categoryRegressionResult = await client.callTool({
    name: "search_experiences",
    arguments: {
      city: categoryRegressionCity,
      category: categoryRegressionValue,
      max_results: 5,
      language: "en",
    },
  });
  const categoryRegressionText = firstTextContent(categoryRegressionResult);
  requireCondition(
    categoryRegressionResult?.isError !== true,
    `search_experiences(${categoryRegressionCity}, category=${categoryRegressionValue}) unexpectedly errored. Received: ${JSON.stringify(categoryRegressionResult)}`,
  );
  requireIncludes(
    categoryRegressionText,
    categoryRegressionCity,
    `search_experiences(${categoryRegressionCity}, category=${categoryRegressionValue})`,
  );
  requireIncludes(
    categoryRegressionText,
    categoryRegressionValue,
    `search_experiences(${categoryRegressionCity}, category=${categoryRegressionValue})`,
  );
  requireCondition(
    parseExperienceCards(categoryRegressionText).length > 0,
    `search_experiences(${categoryRegressionCity}, category=${categoryRegressionValue}) returned no cards. Received: ${categoryRegressionText}`,
  );

  const filteredSearchResult = await client.callTool({
    name: "search_experiences",
    arguments: {
      city: filteredSearchCity,
      min_price: filteredSearchMinPrice,
      max_price: filteredSearchMaxPrice,
      max_results: 5,
      language: "en",
    },
  });
  const filteredSearchText = firstTextContent(filteredSearchResult);
  requireIncludes(filteredSearchText, filteredSearchCity, `search_experiences(${filteredSearchCity}, price filter)`);
  const filteredCards = parseExperienceCards(filteredSearchText);
  requireCondition(filteredCards.length > 0, `search_experiences(${filteredSearchCity}, price filter) returned no cards. Received: ${filteredSearchText}`);
  for (const card of filteredCards) {
    const price = extractCardPrice(card);
    requireCondition(
      price != null && price >= filteredSearchMinPrice && price <= filteredSearchMaxPrice,
      `search_experiences(${filteredSearchCity}, price filter) returned a card outside the requested range ${filteredSearchMinPrice}-${filteredSearchMaxPrice}. Card: ${card}`,
    );
  }

  const missingSearchResult = await client.callTool({
    name: "search_experiences",
    arguments: { city: missingCity, language: "en" },
  });
  const missingSearchText = firstTextContent(missingSearchResult);
  requireIncludes(missingSearchText, "doesn't have experiences", `search_experiences(${missingCity})`);
  requireCondition(missingSearchResult?.isError !== true, `search_experiences(${missingCity}) unexpectedly returned isError=true.`);

  const emptyCategoryResult = await client.callTool({
    name: "search_experiences",
    arguments: { city: emptyCategorySearchCity, category: emptyCategorySearchValue, language: "en" },
  });
  const emptyCategoryText = firstTextContent(emptyCategoryResult);
  requireIncludes(
    emptyCategoryText,
    `No ${emptyCategorySearchValue} experiences`,
    `search_experiences(${emptyCategorySearchCity}, category=${emptyCategorySearchValue})`,
  );
  requireIncludes(
    emptyCategoryText,
    "Available categories:",
    `search_experiences(${emptyCategorySearchCity}, category=${emptyCategorySearchValue})`,
  );
  requireCondition(
    emptyCategoryResult?.isError !== true,
    `search_experiences(${emptyCategorySearchCity}, category=${emptyCategorySearchValue}) unexpectedly returned isError=true.`,
  );

  const blankSearchResult = await client.callTool({
    name: "search_experiences",
    arguments: { city: "   ", language: "en" },
  });
  requireIncludes(firstTextContent(blankSearchResult), "City is required", "search_experiences(blank city)");
  requireErrorResult(blankSearchResult, "search_experiences(blank city)");

  const invalidSearchLimitResult = await client.callTool({
    name: "search_experiences",
    arguments: { city: searchCity, max_results: 0, language: "en" },
  });
  requireIncludes(firstTextContent(invalidSearchLimitResult), "Invalid max_results", "search_experiences(max_results=0)");
  requireErrorResult(invalidSearchLimitResult, "search_experiences(max_results=0)");

  const invalidSearchCategoryResult = await client.callTool({
    name: "search_experiences",
    arguments: { city: searchCity, category: "   ", language: "en" },
  });
  requireIncludes(firstTextContent(invalidSearchCategoryResult), "Invalid category", "search_experiences(category=blank)");
  requireErrorResult(invalidSearchCategoryResult, "search_experiences(category=blank)");

  const invalidSearchPriceRangeResult = await client.callTool({
    name: "search_experiences",
    arguments: {
      city: searchCity,
      min_price: 100,
      max_price: 10,
      language: "en",
    },
  });
  requireIncludes(firstTextContent(invalidSearchPriceRangeResult), "Invalid price range", "search_experiences(min_price=100,max_price=10)");
  requireErrorResult(invalidSearchPriceRangeResult, "search_experiences(min_price=100,max_price=10)");

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
  requireCondition(
    typeof nearbyResult.structuredContent?.experiences?.[0]?.description === "string"
      && nearbyResult.structuredContent.experiences[0].description.length > 0,
    `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude}) structuredContent did not include a description.`,
  );
  requireCondition(
    nearbyResult.structuredContent.experiences[0].description.length <= 150,
    `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude}) structuredContent description exceeded 150 chars. Received: ${nearbyResult.structuredContent.experiences[0].description}`,
  );
  requireCondition(
    typeof nearbyResult.structuredContent?.experiences?.[0]?.priceAmount === "number"
      && nearbyResult.structuredContent.experiences[0].priceAmount > 0,
    `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude}) structuredContent did not include a numeric priceAmount.`,
  );
  requireCondition(
    typeof nearbyResult.structuredContent?.experiences?.[0]?.priceCurrency === "string"
      && /^[A-Z]{3}$/.test(nearbyResult.structuredContent.experiences[0].priceCurrency),
    `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude}) structuredContent did not include a valid ISO priceCurrency. Received: ${nearbyResult.structuredContent?.experiences?.[0]?.priceCurrency}`,
  );
  requireTrackedBookingUrl(
    nearbyResult.structuredContent?.experiences?.[0]?.bookingUrl,
    `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude}) structuredContent`,
  );
  requireIncludes(nearbyText, NEARBY_NEXT_STEP_HINT, `find_nearby_experiences(${nearbyLatitude},${nearbyLongitude})`);

  const invalidNearbyLatitudeResult = await client.callTool({
    name: "find_nearby_experiences",
    arguments: {
      latitude: 999,
      longitude: nearbyLongitude,
      radius_km: nearbyRadiusKm,
      language: "en",
    },
  });
  requireIncludes(firstTextContent(invalidNearbyLatitudeResult), "Latitude must be between -90 and 90", "find_nearby_experiences(latitude=999)");
  requireErrorResult(invalidNearbyLatitudeResult, "find_nearby_experiences(latitude=999)");

  const invalidNearbyRadiusResult = await client.callTool({
    name: "find_nearby_experiences",
    arguments: {
      latitude: nearbyLatitude,
      longitude: nearbyLongitude,
      radius_km: 0,
      language: "en",
    },
  });
  requireIncludes(firstTextContent(invalidNearbyRadiusResult), "Invalid radius_km", "find_nearby_experiences(radius_km=0)");
  requireErrorResult(invalidNearbyRadiusResult, "find_nearby_experiences(radius_km=0)");

  const emptyNearbyResult = await client.callTool({
    name: "find_nearby_experiences",
    arguments: {
      latitude: -75,
      longitude: 0,
      radius_km: 1,
      language: "en",
    },
  });
  const emptyNearbyText = firstTextContent(emptyNearbyResult);
  requireIncludes(emptyNearbyText, "No experiences found within 1km.", "find_nearby_experiences(empty area)");
  requireIncludes(emptyNearbyText, "Try increasing the radius to 2km", "find_nearby_experiences(empty area)");
  requireCondition(emptyNearbyResult?.isError !== true, "find_nearby_experiences(empty area) unexpectedly returned isError=true.");

  const citiesResult = await client.callTool({
    name: "list_cities",
    arguments: { query: cityQuery, limit: cityLimit, language: "en" },
  });
  const citiesText = firstTextContent(citiesResult);
  requireIncludes(citiesText, cityQuery, `list_cities(query=${cityQuery})`);
  requireIncludes(citiesText, "utm_source=mcp", `list_cities(query=${cityQuery})`);
  requireIncludes(citiesText, FILTERED_CITIES_NEXT_STEP_HINT, `list_cities(query=${cityQuery})`);

  const invalidCitiesQueryResult = await client.callTool({
    name: "list_cities",
    arguments: { query: "   ", language: "en" },
  });
  requireIncludes(firstTextContent(invalidCitiesQueryResult), "Invalid query", "list_cities(query=blank)");
  requireErrorResult(invalidCitiesQueryResult, "list_cities(query=blank)");

  const invalidCitiesLimitResult = await client.callTool({
    name: "list_cities",
    arguments: { limit: 0, language: "en" },
  });
  requireIncludes(firstTextContent(invalidCitiesLimitResult), "Invalid limit", "list_cities(limit=0)");
  requireErrorResult(invalidCitiesLimitResult, "list_cities(limit=0)");

  const directoryResult = await client.callTool({
    name: "list_cities",
    arguments: { limit: directoryLimit, language: "en" },
  });
  const directoryText = firstTextContent(directoryResult);
  requireIncludes(directoryText, `Showing ${directoryLimit} of`, `list_cities(limit=${directoryLimit})`);
  requireExcludes(directoryText, FILTERED_CITIES_NEXT_STEP_HINT, `list_cities(limit=${directoryLimit})`);
  const directoryLines = directoryText.split("\n").filter(line => line.startsWith("📍 "));
  requireCondition(
    directoryLines.length === directoryLimit,
    `list_cities(limit=${directoryLimit}) returned ${directoryLines.length} city lines instead of ${directoryLimit}. Received: ${directoryText}`,
  );
  requireIncludes(directoryText, "utm_source=mcp", `list_cities(limit=${directoryLimit})`);

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
  requireTrackedBookingUrl(detailsResult.structuredContent?.bookingUrl, `get_experience_details(slug=${detailsSlug}) structuredContent`);
  requireIncludes(detailsText, "utm_source=mcp", `get_experience_details(slug=${detailsSlug})`);
  requireIncludes(detailsText, DETAILS_NEXT_STEP_HINT, `get_experience_details(slug=${detailsSlug})`);

  const blankDetailsSlugResult = await client.callTool({
    name: "get_experience_details",
    arguments: {
      slug: "   ",
      days: detailsDays,
      language: "en",
    },
  });
  requireIncludes(firstTextContent(blankDetailsSlugResult), "Invalid slug", "get_experience_details(slug=blank)");
  requireErrorResult(blankDetailsSlugResult, "get_experience_details(slug=blank)");

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
  requireIncludes(bogusDetailsText, "searching by city first", `get_experience_details(slug=${bogusDetailsSlug})`);
  requireErrorResult(bogusDetailsResult, `get_experience_details(slug=${bogusDetailsSlug})`);

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
