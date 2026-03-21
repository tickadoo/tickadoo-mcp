import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DETAILS_NEXT_STEP_HINT,
  FILTERED_CITIES_NEXT_STEP_HINT,
  NEARBY_NEXT_STEP_HINT,
  SEARCH_NEXT_STEP_HINT,
} from "../src/shared/format.js";

type ToolCallResult = Awaited<ReturnType<Client["callTool"]>>;
type TextContentItem = { type: "text"; text: string };

type SearchStructuredContent = {
  city?: string;
  citySlug?: string;
  sort?: string;
  totalExperiences?: number;
  experiences?: Array<{
    tickadooProductId: string;
    slug: string;
    title: string;
    description?: string;
    popular?: boolean;
    priceAmount?: number;
    priceCurrency?: string;
    bookingUrl: string;
    imageUrl?: string;
  }>;
};

type NearbyStructuredContent = {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  totalExperiences?: number;
  experiences?: Array<{
    tickadooProductId: string;
    slug: string;
    title: string;
    description?: string;
    priceAmount?: number;
    priceCurrency?: string;
    bookingUrl: string;
    imageUrl?: string;
  }>;
};

type DetailsStructuredContent = {
  source?: string;
  slug?: string;
  tickadooProductId?: string;
  bookingUrl?: string;
  days?: number;
  details?: {
    desktopFeatureImageUrl?: string;
    mobileFeatureImageUrl?: string;
    currencyCode?: string;
    address?: string | null;
    locationWithAddress?: {
      latitude?: number | null;
      longitude?: number | null;
      address?: string | null;
    };
    dates?: Array<{
      date: string;
      endDate: string;
      minPrice: number;
      variantName: string;
    }>;
  };
};

type ParsedExperienceCard = {
  title: string;
  description: string | null;
  price: number | null;
  rating: number | null;
  bookingUrl: string | null;
  imageUrl: string | null;
  block: string;
};

const endpoint = new URL(process.env.MCP_URL ?? "https://mcp.tickadoo.com/mcp");
const client = new Client({ name: "tickadoo-vitest-integration", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(endpoint);
const expectedCategoryEnum = [
  "theatre",
  "musicals",
  "tours",
  "food",
  "family",
  "nightlife",
  "sightseeing",
  "concerts",
  "comedy",
  "shows",
  "outdoor",
  "workshops",
  "cruises",
  "sports",
];
const expectedSortEnum = ["relevance", "popular", "price_low", "price_high", "rating"];
const expectedUtmParams = new URLSearchParams(
  process.env.MCP_EXPECTED_UTM_QUERY ?? "utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
);

function firstTextContent(result: ToolCallResult): string {
  return ((result.content ?? []) as TextContentItem[]).find(item => item.type === "text")?.text ?? "";
}

function parseJsonText<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`${label} did not return valid JSON. Received: ${text}\n${error}`);
  }
}

function getStructuredContent<T extends Record<string, unknown>>(result: ToolCallResult): T {
  return (result.structuredContent ?? {}) as T;
}

function parseExperienceCards(text: string): ParsedExperienceCard[] {
  return [...text.matchAll(/🎭 [\s\S]*?(?=\n\n🎭 |\n\nView all:|$)/g)]
    .map(match => {
      const block = match[0];
      const lines = block.split("\n");
      const title = lines[0]?.replace(/^🎭\s+/, "") ?? "";
      const descriptionLine = lines.find(line => /^\s{3}(?![💰⭐📍🖼️🔗])\S/.test(line));
      const priceMatch = block.match(/💰 From [A-Z]{3} ([0-9]+(?:\.[0-9]{2})?)/);
      const ratingMatch = block.match(/⭐ ([0-9]+(?:\.[0-9])?)\/5/);
      const bookingUrlMatch = block.match(/🔗 (https?:\/\/\S+)/);
      const imageUrlMatch = block.match(/🖼️ (https?:\/\/\S+)/);

      return {
        title,
        description: descriptionLine?.trim() ?? null,
        price: priceMatch ? Number(priceMatch[1]) : null,
        rating: ratingMatch ? Number(ratingMatch[1]) : null,
        bookingUrl: bookingUrlMatch?.[1] ?? null,
        imageUrl: imageUrlMatch?.[1] ?? null,
        block,
      };
    });
}

function compareCardsForDisplay(left: ParsedExperienceCard, right: ParsedExperienceCard): number {
  const pricedFirst = Number(left.price == null) - Number(right.price == null);
  if (pricedFirst !== 0) return pricedFirst;

  const ratingDelta = (right.rating ?? -1) - (left.rating ?? -1);
  if (ratingDelta !== 0) return ratingDelta;

  if (left.price != null && right.price != null) {
    const priceDelta = left.price - right.price;
    if (priceDelta !== 0) return priceDelta;
  }

  return left.title.localeCompare(right.title);
}

function extractCount(text: string, pattern: RegExp, label: string): number {
  const match = text.match(pattern);
  expect(match, `${label} should match ${pattern}`).toBeTruthy();
  return Number(match?.[1]);
}

function expectTrackedBookingUrl(value: string | null | undefined) {
  expect(value).toBeTruthy();
  const parsed = new URL(value!);
  for (const [key, expectedValue] of expectedUtmParams.entries()) {
    expect(parsed.searchParams.get(key)).toBe(expectedValue);
  }
}

function normalizeCategoryText(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

describe.sequential("tickadoo MCP live integration", () => {
  beforeAll(async () => {
    await client.connect(transport);
  }, 30_000);

  afterAll(async () => {
    await transport.close().catch(() => undefined);
  });

  it("search_experiences returns ranked results with the expected public fields", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", language: "en" },
    });

    expect(result.isError).not.toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("Showing top");
    expect(text).toContain("in Las Vegas");
    expect(text).toContain("🔖 Slug:");
    expect(text).toContain(SEARCH_NEXT_STEP_HINT);

    const cards = parseExperienceCards(text);
    expect(cards.length).toBeGreaterThan(3);
    const searchStructured = getStructuredContent<SearchStructuredContent>(result);
    expect(searchStructured.sort).toBe("relevance");

    const [firstCard] = cards;
    expect(firstCard.title).toBeTruthy();
    expect(firstCard.description).toBeTruthy();
    expect(firstCard.description!.length).toBeLessThanOrEqual(150);
    expect(firstCard.price).not.toBeNull();
    expect(firstCard.rating).not.toBeNull();
    expect(firstCard.bookingUrl).toMatch(/^https:\/\/www\.tickadoo\.com\//);
    expect(firstCard.imageUrl).toMatch(/^https?:\/\//);
    expectTrackedBookingUrl(firstCard.bookingUrl);

    const firstExperience = searchStructured.experiences?.[0];
    expect(firstExperience).toBeTruthy();
    expect(firstExperience?.description).toBeTruthy();
    expect(firstExperience?.description?.length).toBeLessThanOrEqual(150);
    expect(typeof firstExperience?.popular).toBe("boolean");
    expect(firstExperience?.priceAmount).toBeGreaterThan(0);
    expect(firstExperience?.priceCurrency).toMatch(/^[A-Z]{3}$/);
    expectTrackedBookingUrl(firstExperience?.bookingUrl);
    expect(Object.keys(firstExperience ?? {}).sort()).toMatchInlineSnapshot(`
      [
        "bookingUrl",
        "description",
        "imageUrl",
        "popular",
        "priceAmount",
        "priceCurrency",
        "slug",
        "tickadooProductId",
        "title",
      ]
    `);

    const sortedTitles = [...cards].sort(compareCardsForDisplay).map(card => card.title);
    expect(cards.map(card => card.title)).toEqual(sortedTitles);
  }, 30_000);

  it("search_experiences exposes the canonical category and sort enums in tools/list", async () => {
    const toolsResult = await client.listTools();
    const searchTool = toolsResult.tools.find(tool => tool.name === "search_experiences");
    const searchSchema = (searchTool?.inputSchema as {
      properties?: {
        category?: {
          enum?: string[];
          anyOf?: Array<{ enum?: string[] }>;
        };
        sort?: {
          enum?: string[];
          anyOf?: Array<{ enum?: string[] }>;
        };
      };
    } | undefined)?.properties;

    const categorySchema = searchSchema?.category;
    const sortSchema = searchSchema?.sort;

    const categoryEnum = Array.isArray(categorySchema?.enum)
      ? categorySchema.enum
      : categorySchema?.anyOf?.find(option => Array.isArray(option.enum))?.enum;
    const sortEnum = Array.isArray(sortSchema?.enum)
      ? sortSchema.enum
      : sortSchema?.anyOf?.find(option => Array.isArray(option.enum))?.enum;

    expect(categoryEnum).toEqual(expectedCategoryEnum);
    expect(sortEnum).toEqual(expectedSortEnum);
  }, 30_000);

  it("search_experiences supports popular sorting", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", sort: "popular", max_results: 5, language: "en", format: "json" },
    });

    expect(result.isError).not.toBe(true);
    const json = parseJsonText<{
      sort?: string;
      results?: Array<{
        title?: string;
        popular?: boolean;
        rating?: number | null;
        booking_url?: string;
      }>;
    }>(firstTextContent(result), "search_experiences(sort=popular, format=json)");

    expect(json.sort).toBe("popular");
    expect(json.results?.length).toBeGreaterThan(0);
    expect(json.results?.[0]?.popular).toBe(true);
    expectTrackedBookingUrl(json.results?.[0]?.booking_url);

    const popularFlags = (json.results ?? []).map(entry => entry.popular === true);
    const firstNonPopularIndex = popularFlags.indexOf(false);
    if (firstNonPopularIndex !== -1) {
      expect(popularFlags.slice(firstNonPopularIndex)).not.toContain(true);
    }

    const popularRatings = (json.results ?? [])
      .filter(entry => entry.popular)
      .map(entry => entry.rating ?? -1);
    expect(popularRatings).toEqual([...popularRatings].sort((left, right) => right - left));
  }, 30_000);

  it("search_experiences supports min_price and max_price filtering", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", min_price: 1, max_price: 50, max_results: 5, language: "en" },
    });

    expect(result.isError).not.toBe(true);
    const text = firstTextContent(result);
    const cards = parseExperienceCards(text);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.price).not.toBeNull();
      expect(card.price).toBeGreaterThanOrEqual(1);
      expect(card.price).toBeLessThanOrEqual(50);
    }
  }, 30_000);

  it("search_experiences supports json output", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", language: "en", max_results: 2, format: "json" },
    });

    expect(result.isError).not.toBe(true);
    const json = parseJsonText<{
      city?: string;
      sort?: string;
      total?: number;
      showing?: number;
      results?: Array<{
        title?: string;
        slug?: string;
        booking_url?: string;
        price?: { amount?: number; currency?: string } | null;
      }>;
    }>(firstTextContent(result), "search_experiences(format=json)");

    expect(json.city).toBe("las-vegas");
    expect(json.sort).toBe("relevance");
    expect(json.showing).toBe(2);
    expect(json.total).toBeGreaterThanOrEqual(2);
    expect(json.results).toHaveLength(2);
    expect(json.results?.[0]?.title).toBeTruthy();
    expectTrackedBookingUrl(json.results?.[0]?.booking_url);
  }, 30_000);

  it("search_experiences supports free-text query filtering", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", query: "walking", max_results: 5, language: "en", format: "json" },
    });

    expect(result.isError).not.toBe(true);
    const json = parseJsonText<{
      filters?: { query?: string };
      results?: Array<{
        title?: string;
        description?: string | null;
        booking_url?: string;
      }>;
    }>(firstTextContent(result), "search_experiences(query=walking, format=json)");

    expect(json.filters?.query).toBe("walking");
    expect(json.results?.length).toBeGreaterThan(0);
    for (const entry of json.results ?? []) {
      const haystack = normalizeCategoryText(`${entry.title ?? ""} ${entry.description ?? ""}`);
      expect(haystack).toContain("walking");
      expectTrackedBookingUrl(entry.booking_url);
    }
  }, 30_000);

  it("search_experiences echoes applied filters and explains significant omissions", async () => {
    const textResult = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", query: "walking", language: "en", max_results: 5 },
    });

    expect(textResult.isError).not.toBe(true);
    const text = firstTextContent(textResult);
    expect(text).toContain("🔎 Filters:");
    expect(text).toContain("query=walking");
    expect(text).toContain("filtered out");

    const jsonResult = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", query: "walking", language: "en", max_results: 5, format: "json" },
    });

    expect(jsonResult.isError).not.toBe(true);
    const json = parseJsonText<{
      filters?: { query?: string; language?: string };
      omitted_results?: {
        total?: number;
        reasons?: Array<{ filter?: string; count?: number; reason?: string }>;
      };
    }>(firstTextContent(jsonResult), "search_experiences(query=walking, format=json)");

    expect(json.filters?.query).toBe("walking");
    expect(json.filters?.language).toBeUndefined();
    expect(json.omitted_results?.total).toBeGreaterThan(0);
    expect(json.omitted_results?.reasons?.some(reason => reason.filter === "query" && reason.count! > 0)).toBe(true);
  }, 30_000);

  it("localizes booking URLs when a supported language is provided", async () => {
    const searchResult = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", language: "de", max_results: 1, format: "json" },
    });
    const searchJson = parseJsonText<{
      filters?: { language?: string };
      results?: Array<{ booking_url?: string }>;
      view_all_url?: string;
    }>(firstTextContent(searchResult), "search_experiences(language=de, format=json)");
    expect(searchJson.filters?.language).toBe("de");
    expect(searchJson.results?.[0]?.booking_url).toContain("https://www.tickadoo.com/de/");
    expect(searchJson.view_all_url).toContain("https://www.tickadoo.com/de/");
    expectTrackedBookingUrl(searchJson.results?.[0]?.booking_url);

    const nearbyResult = await client.callTool({
      name: "find_nearby_experiences",
      arguments: { latitude: 51.502606, longitude: -0.118117, radius_km: 5, language: "de", format: "json" },
    });
    const nearbyJson = parseJsonText<{
      results?: Array<{ booking_url?: string }>;
    }>(firstTextContent(nearbyResult), "find_nearby_experiences(language=de, format=json)");
    expect(nearbyJson.results?.[0]?.booking_url).toContain("https://www.tickadoo.com/de/");
    expectTrackedBookingUrl(nearbyJson.results?.[0]?.booking_url);

    const detailsResult = await client.callTool({
      name: "get_experience_details",
      arguments: { slug: "london-dungeon-tickets", days: 7, language: "de", format: "json" },
    });
    const detailsJson = parseJsonText<{
      booking_url?: string;
    }>(firstTextContent(detailsResult), "get_experience_details(language=de, format=json)");
    expect(detailsJson.booking_url).toContain("https://www.tickadoo.com/de/");
    expectTrackedBookingUrl(detailsJson.booking_url);

    const citiesResult = await client.callTool({
      name: "list_cities",
      arguments: { query: "paris", limit: 1, language: "de", format: "json" },
    });
    const citiesJson = parseJsonText<{
      results?: Array<{ booking_url?: string }>;
    }>(firstTextContent(citiesResult), "list_cities(language=de, format=json)");
    expect(citiesJson.results?.[0]?.booking_url).toContain("https://www.tickadoo.com/de/");
    expectTrackedBookingUrl(citiesJson.results?.[0]?.booking_url);
  }, 30_000);

  it("search_experiences supports category filtering", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", category: "comedy", max_results: 5, language: "en" },
    });

    expect(result.isError).not.toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("category");
    expect(text.toLowerCase()).toContain("comedy");

    const cards = parseExperienceCards(text);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some(card => normalizeCategoryText(card.block).includes("comedy"))).toBe(true);
  }, 30_000);

  it("search_experiences supports combining query and category filters", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", category: "tours", query: "walking", max_results: 5, language: "en", format: "json" },
    });

    expect(result.isError).not.toBe(true);
    const json = parseJsonText<{
      filters?: { category?: string; query?: string };
      results?: Array<{
        title?: string;
        description?: string | null;
      }>;
    }>(firstTextContent(result), "search_experiences(category=tours, query=walking, format=json)");

    expect(json.filters?.category).toBe("tours");
    expect(json.filters?.query).toBe("walking");
    expect(json.results?.length).toBeGreaterThan(0);
    for (const entry of json.results ?? []) {
      const haystack = normalizeCategoryText(`${entry.title ?? ""} ${entry.description ?? ""}`);
      expect(haystack).toContain("walking");
    }
  }, 30_000);

  it("search_experiences handles null-slug products during category filtering", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "london", category: "tours", max_results: 5, language: "en" },
    });

    expect(result.isError).not.toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("London");
    expect(text.toLowerCase()).toContain("tours");

    const cards = parseExperienceCards(text);
    expect(cards.length).toBeGreaterThan(0);
  }, 30_000);

  it("search_experiences supports abbreviated fuzzy matching for supported inputs", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", language: "en", max_results: 3 },
    });

    expect(result.isError).not.toBe(true);
    const text = firstTextContent(result);
    const searchStructured = getStructuredContent<SearchStructuredContent>(result);
    expect(text).toContain("Las Vegas");
    expect(text).toContain("/las-vegas/");
    expect(text).toMatch(/Showing(?: top)? 3 of /);
    expect(text).toContain("utm_source=mcp");
    expect(searchStructured.citySlug).toBe("las-vegas");
    expect(searchStructured.experiences).toHaveLength(3);
  }, 30_000);

  it("search_experiences returns a helpful error for an unknown city", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "__definitely-not-a-real-city__", language: "en" },
    });

    expect(result.isError).not.toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("doesn't have experiences");
  }, 30_000);

  it("search_experiences rejects unsupported category values against the schema enum", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", category: "snowboarding", language: "en" },
    });

    expect(result.isError).toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("Invalid enum value");
  }, 30_000);

  it("search_experiences returns a helpful error for a blank category", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", category: "   ", language: "en" },
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain("Invalid enum value");
  }, 30_000);

  it("search_experiences returns a helpful error for a blank query", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", query: "   ", language: "en" },
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain("Invalid query");
  }, 30_000);

  it("search_experiences returns a helpful error for an unsupported language code", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", language: "zz" },
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain("Invalid language");
  }, 30_000);

  it("search_experiences returns a helpful error for an invalid price range", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "london", min_price: 100, max_price: 10, language: "en" },
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain("Invalid price range");
  }, 30_000);

  it("find_nearby_experiences returns nearby results with radius context", async () => {
    const result = await client.callTool({
      name: "find_nearby_experiences",
      arguments: {
        latitude: 51.502606,
        longitude: -0.118117,
        radius_km: 5,
        language: "en",
      },
    });

    expect(result.isError).not.toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("experiences nearby");
    expect(text).toContain(NEARBY_NEXT_STEP_HINT);
    const nearbyStructured = getStructuredContent<NearbyStructuredContent>(result);

    const cards = parseExperienceCards(text);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]?.title).toBeTruthy();
    expect(cards[0]?.description).toBeTruthy();
    expect(cards[0]?.description?.length).toBeLessThanOrEqual(150);
    expect(cards[0]?.imageUrl).toMatch(/^https?:\/\//);
    expect(cards[0]?.bookingUrl).toMatch(/^https:\/\/www\.tickadoo\.com\//);
    expectTrackedBookingUrl(cards[0]?.bookingUrl);

    expect(nearbyStructured.radiusKm).toBe(5);
    expect(nearbyStructured.latitude).toBe(51.502606);
    expect(nearbyStructured.longitude).toBe(-0.118117);
    expect(nearbyStructured.experiences?.[0]?.description).toBeTruthy();
    expect(nearbyStructured.experiences?.[0]?.description?.length).toBeLessThanOrEqual(150);
    expect(nearbyStructured.experiences?.[0]?.priceAmount).toBeGreaterThan(0);
    expect(nearbyStructured.experiences?.[0]?.priceCurrency).toMatch(/^[A-Z]{3}$/);
    expectTrackedBookingUrl(nearbyStructured.experiences?.[0]?.bookingUrl);
    expect(Object.keys(nearbyStructured).sort()).toMatchInlineSnapshot(`
      [
        "experiences",
        "latitude",
        "longitude",
        "radiusKm",
        "totalExperiences",
      ]
    `);
  }, 30_000);

  it("find_nearby_experiences returns a helpful empty-area message", async () => {
    const result = await client.callTool({
      name: "find_nearby_experiences",
      arguments: {
        latitude: -75,
        longitude: 0,
        radius_km: 1,
        language: "en",
      },
    });

    expect(result.isError).not.toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("No experiences found within 1km.");
    expect(text).toContain("Try increasing the radius to 2km");
  }, 30_000);

  it("find_nearby_experiences supports json output", async () => {
    const result = await client.callTool({
      name: "find_nearby_experiences",
      arguments: {
        latitude: 51.502606,
        longitude: -0.118117,
        radius_km: 5,
        language: "en",
        format: "json",
      },
    });

    expect(result.isError).not.toBe(true);
    const json = parseJsonText<{
      latitude?: number;
      longitude?: number;
      radius_km?: number;
      total?: number;
      showing?: number;
      results?: Array<{ booking_url?: string }>;
    }>(firstTextContent(result), "find_nearby_experiences(format=json)");

    expect(json.latitude).toBe(51.502606);
    expect(json.longitude).toBe(-0.118117);
    expect(json.radius_km).toBe(5);
    expect(json.total).toBeGreaterThan(0);
    expect(json.showing).toBeGreaterThan(0);
    expectTrackedBookingUrl(json.results?.[0]?.booking_url);
  }, 30_000);

  it("list_cities reports the global city count and supports substring filtering", async () => {
    const directoryResult = await client.callTool({
      name: "list_cities",
      arguments: { limit: 5, language: "en" },
    });

    expect(directoryResult.isError).not.toBe(true);
    const directoryText = firstTextContent(directoryResult);
    const totalCities = extractCount(directoryText, /Showing \d+ of (\d+) cities/i, "list_cities directory count");
    expect(totalCities).toBeGreaterThanOrEqual(700);
    expect(directoryText).not.toContain(FILTERED_CITIES_NEXT_STEP_HINT);

    const filteredResult = await client.callTool({
      name: "list_cities",
      arguments: { query: "paris", limit: 5, language: "en" },
    });

    expect(filteredResult.isError).not.toBe(true);
    const filteredText = firstTextContent(filteredResult);
    expect(filteredText).toContain("Found");
    expect(filteredText).toContain("PARIS");
    expect(filteredText).toContain("utm_source=mcp");
    expect(filteredText).toContain(FILTERED_CITIES_NEXT_STEP_HINT);
    expect(extractCount(filteredText, /Found (\d+) matching cities/i, "list_cities filtered count")).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it("list_cities supports json output", async () => {
    const result = await client.callTool({
      name: "list_cities",
      arguments: { query: "paris", limit: 1, language: "en", format: "json" },
    });

    expect(result.isError).not.toBe(true);
    const json = parseJsonText<{
      query?: string | null;
      total?: number;
      showing?: number;
      results?: Array<{ name?: string; slug?: string; booking_url?: string }>;
    }>(firstTextContent(result), "list_cities(format=json)");

    expect(json.query).toBe("paris");
    expect(json.total).toBeGreaterThanOrEqual(1);
    expect(json.showing).toBe(1);
    expect(json.results).toHaveLength(1);
    expect(json.results?.[0]?.slug?.toLowerCase()).toContain("paris");
    expectTrackedBookingUrl(json.results?.[0]?.booking_url);
  }, 30_000);

  it("get_experience_details returns full public details and a tickadoo booking URL", async () => {
    const result = await client.callTool({
      name: "get_experience_details",
      arguments: { slug: "london-dungeon-tickets", days: 7, language: "en" },
    });

    expect(result.isError).not.toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("London Dungeon");
    expect(text).toContain("Availability:");
    expect(text).toContain("Desktop image:");
    expect(text).toContain("Mobile image:");
    expect(text).toContain(DETAILS_NEXT_STEP_HINT);
    const detailsStructured = getStructuredContent<DetailsStructuredContent>(result);

    expect(detailsStructured.bookingUrl).toMatch(/^https:\/\/www\.tickadoo\.com\//);
    expectTrackedBookingUrl(detailsStructured.bookingUrl);
    expect(detailsStructured.slug).toBe("london-dungeon-tickets");
    expect(detailsStructured.days).toBe(7);
    expect(text).toContain("utm_source=mcp");

    expect(Object.keys(detailsStructured).sort()).toMatchInlineSnapshot(`
      [
        "bookingUrl",
        "days",
        "details",
        "slug",
        "source",
        "tickadooProductId",
      ]
    `);

    expect(Object.keys(detailsStructured.details ?? {}).sort()).toMatchInlineSnapshot(`
      [
        "address",
        "currencyCode",
        "dates",
        "desktopFeatureImageUrl",
        "locationWithAddress",
        "mobileFeatureImageUrl",
      ]
    `);

    expect(detailsStructured.details?.dates?.length).toBeGreaterThan(0);
    expect(detailsStructured.details?.currencyCode).toBeTruthy();
    expect(detailsStructured.details?.desktopFeatureImageUrl).toMatch(/^https?:\/\//);
    expect(detailsStructured.details?.mobileFeatureImageUrl).toMatch(/^https?:\/\//);
    expect(detailsStructured.details?.locationWithAddress?.address ?? detailsStructured.details?.address).toBeTruthy();
  }, 30_000);

  it("get_experience_details returns a helpful error for an invalid slug", async () => {
    const result = await client.callTool({
      name: "get_experience_details",
      arguments: { slug: "__definitely-not-a-real-experience-slug__", days: 7, language: "en" },
    });

    expect(result.isError).toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("Could not resolve tickadoo slug");
    expect(text).toContain("searching by city first");
  }, 30_000);

  it("get_experience_details supports json output", async () => {
    const result = await client.callTool({
      name: "get_experience_details",
      arguments: { slug: "london-dungeon-tickets", days: 7, language: "en", format: "json" },
    });

    expect(result.isError).not.toBe(true);
    const json = parseJsonText<{
      title?: string | null;
      slug?: string | null;
      booking_url?: string | null;
      days?: number;
      availability?: {
        total_price_points?: number;
        total_dates?: number;
        results?: Array<{
          date?: string;
          end_date?: string;
          variant_name?: string;
          price?: { amount?: number; currency?: string };
        }>;
      };
    }>(firstTextContent(result), "get_experience_details(format=json)");

    expect(json.title).toContain("London Dungeon");
    expect(json.slug).toBe("london-dungeon-tickets");
    expect(json.days).toBe(7);
    expectTrackedBookingUrl(json.booking_url);
    expect(json.availability?.total_price_points).toBeGreaterThan(0);
    expect(json.availability?.total_dates).toBeGreaterThan(0);
    expect(json.availability?.results?.[0]?.price?.currency).toBeTruthy();
  }, 30_000);
});
