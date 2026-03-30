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
  dateFrom?: string;
  dateTo?: string;
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
  dateFrom?: string;
  dateTo?: string;
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
const runDateFilteringTests = Boolean(process.env.MCP_URL?.trim());
const itWhenDateFiltering = runDateFilteringTests ? it : it.skip;
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
const expectedSortEnum = ["relevance", "popular", "price_low", "price_high", "rating", "best_value"];
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
        "audience",
        "bookingAvailable",
        "bookingScope",
        "bookingUrl",
        "cancellation",
        "description",
        "duration",
        "imageUrl",
        "indoorOutdoor",
        "physicalLevel",
        "popular",
        "priceAmount",
        "priceCurrency",
        "reviewCount",
        "slug",
        "tags",
        "tickadooProductId",
        "title",
      ]
    `);

    expect(new Set(cards.map(card => card.title)).size).toBe(cards.length);
  }, 30_000);

  it("search_experiences exposes the canonical category and sort enums in tools/list", async () => {
    const toolsResult = await client.listTools();
    const searchTool = toolsResult.tools.find(tool => tool.name === "search_experiences");
    const nearbyTool = toolsResult.tools.find(tool => tool.name === "find_nearby_experiences");
    const searchSchema = (searchTool?.inputSchema as {
      properties?: {
        category?: {
          enum?: string[];
          anyOf?: Array<{ enum?: string[] }>;
        };
        dateFrom?: {
          type?: string;
        };
        dateTo?: {
          type?: string;
        };
        sort?: {
          enum?: string[];
          anyOf?: Array<{ enum?: string[] }>;
        };
      };
    } | undefined)?.properties;
    const nearbySchema = (nearbyTool?.inputSchema as {
      properties?: {
        dateFrom?: {
          type?: string;
        };
        dateTo?: {
          type?: string;
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
    if (runDateFilteringTests) {
      expect(searchSchema?.dateFrom?.type).toBe("string");
      expect(searchSchema?.dateTo?.type).toBe("string");
      expect(nearbySchema?.dateFrom?.type).toBe("string");
      expect(nearbySchema?.dateTo?.type).toBe("string");
    }
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

  itWhenDateFiltering("search_experiences supports date filtering", async () => {
    const [datedResult, unfilteredResult] = await Promise.all([
      client.callTool({
        name: "search_experiences",
        arguments: {
          city: "london",
          dateFrom: "2026-03-27",
          dateTo: "2026-03-28",
          language: "en",
          max_results: 5,
          format: "json",
        },
      }),
      client.callTool({
        name: "search_experiences",
        arguments: {
          city: "london",
          language: "en",
          max_results: 5,
          format: "json",
        },
      }),
    ]);

    expect(datedResult.isError).not.toBe(true);
    expect(unfilteredResult.isError).not.toBe(true);

    const datedJson = parseJsonText<{
      filters?: { date_from?: string; date_to?: string };
      total?: number;
      showing?: number;
      results?: Array<{ booking_url?: string }>;
    }>(firstTextContent(datedResult), "search_experiences(dateFrom/dateTo, format=json)");
    const unfilteredJson = parseJsonText<{
      total?: number;
    }>(firstTextContent(unfilteredResult), "search_experiences(no dates, format=json)");
    const datedStructured = getStructuredContent<SearchStructuredContent>(datedResult);

    expect(datedJson.filters?.date_from).toBe("2026-03-27");
    expect(datedJson.filters?.date_to).toBe("2026-03-28");
    expect(datedJson.showing).toBeGreaterThan(0);
    expect(datedJson.total).toBeGreaterThan(0);
    expect(datedJson.total).toBeLessThan(unfilteredJson.total ?? Number.POSITIVE_INFINITY);
    expect(datedStructured.dateFrom).toBe("2026-03-27");
    expect(datedStructured.dateTo).toBe("2026-03-28");
    expectTrackedBookingUrl(datedJson.results?.[0]?.booking_url);
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

  itWhenDateFiltering("find_nearby_experiences supports date filtering", async () => {
    const result = await client.callTool({
      name: "find_nearby_experiences",
      arguments: {
        latitude: 40.758,
        longitude: -73.985,
        radius_km: 10,
        dateFrom: "2026-03-28",
        dateTo: "2026-03-29",
        language: "en",
        format: "json",
      },
    });

    expect(result.isError).not.toBe(true);
    const json = parseJsonText<{
      date_from?: string;
      date_to?: string;
      total?: number;
      showing?: number;
      results?: Array<{ booking_url?: string }>;
    }>(firstTextContent(result), "find_nearby_experiences(dateFrom/dateTo, format=json)");
    const structured = getStructuredContent<NearbyStructuredContent>(result);

    expect(json.date_from).toBe("2026-03-28");
    expect(json.date_to).toBe("2026-03-29");
    expect(json.total).toBeGreaterThan(0);
    expect(json.showing).toBeGreaterThan(0);
    expect(structured.dateFrom).toBe("2026-03-28");
    expect(structured.dateTo).toBe("2026-03-29");
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
        "mcpProduct",
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

const ISSUE74_MCP_ENDPOINT = process.env.MCP_URL ?? "https://mcp.tickadoo.com/mcp";
const ISSUE74_TIMEOUT_MS = 20_000;
const ISSUE74_CITY = "london";
const ISSUE74_DATE = "2026-04-15";
const ISSUE74_COORDINATES = {
  latitude: 51.5074,
  longitude: -0.1278,
} as const;
const ISSUE74_SLUG = "oliver-tickets";
const ISSUE74_COMPARISON_SLUGS = ["oliver-tickets", "the-producers-tickets"] as const;
const ISSUE74_EXPECTED_TOOL_NAMES = [
  "search_experiences",
  "find_nearby_experiences",
  "list_cities",
  "get_experience_details",
  "compare_experiences",
  "plan_itinerary",
  "whats_on_tonight",
  "get_city_guide",
  "check_availability",
  "get_whats_on_this_week",
  "search_by_mood",
  "get_hidden_gems",
  "get_date_night",
  "get_family_day",
  "get_transfer_info",
  "get_free_things",
  "get_last_minute",
  "search_knowledge_base",
  "get_gift_ideas",
  "get_accessibility_guide",
  "get_travel_tips",
] as const;

type Issue74ExpectedToolName = (typeof ISSUE74_EXPECTED_TOOL_NAMES)[number];

type Issue74LiveToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, Record<string, unknown>>;
  };
};

type Issue74JsonRpcEnvelope = {
  error?: {
    code?: number;
    message?: string;
  };
  result?: {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
    structuredContent?: unknown;
    isError?: boolean;
  };
};

type Issue74ToolCase = {
  name: Issue74ExpectedToolName;
  scenario: string;
  buildArgs: (tool: Issue74LiveToolDefinition) => Record<string, unknown>;
  validate: (response: unknown) => void;
};

const issue74LiveTools = await issue74FetchLiveTools();
const issue74LiveToolMap = new Map(issue74LiveTools.map((tool) => [tool.name, tool] as const));

function issue74IsRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function issue74IsHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function issue74ToolProperties(tool: Issue74LiveToolDefinition): Record<string, Record<string, unknown>> {
  return tool.inputSchema?.properties ?? {};
}

function issue74ResolvePropertyName(tool: Issue74LiveToolDefinition, aliases: string[]): string | undefined {
  const properties = issue74ToolProperties(tool);
  return aliases.find((alias) => alias in properties);
}

function issue74MaybeSetArg(
  tool: Issue74LiveToolDefinition,
  args: Record<string, unknown>,
  aliases: string[],
  value: unknown,
): void {
  const property = issue74ResolvePropertyName(tool, aliases);
  if (property) {
    args[property] = value;
  }
}

function issue74MaybeAddJsonFormat(tool: Issue74LiveToolDefinition, args: Record<string, unknown>): void {
  const format = issue74ToolProperties(tool).format;
  const supportedFormats = Array.isArray(format?.enum) ? format.enum : [];
  if (supportedFormats.includes("json")) {
    args.format = "json";
  }
}

function issue74MaybeAddLanguage(
  tool: Issue74LiveToolDefinition,
  args: Record<string, unknown>,
  language = "en",
): void {
  issue74MaybeSetArg(tool, args, ["language", "locale"], language);
}

function issue74GetPathValue(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (Array.isArray(value) && /^\d+$/.test(segment)) {
      return value[Number(segment)];
    }
    if (issue74IsRecord(value)) {
      return value[segment];
    }
    return undefined;
  }, source);
}

function issue74FindFirstPathValue(source: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = issue74GetPathValue(source, path);
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function issue74ExpectPathValue(source: unknown, paths: string[], label: string): unknown {
  const value = issue74FindFirstPathValue(source, paths);
  if (value === undefined || value === null) {
    throw new Error(`Expected ${label} at one of: ${paths.join(", ")}`);
  }
  return value;
}

function issue74ExpectArrayAtPaths(source: unknown, paths: string[], label: string, minLength = 1): unknown[] {
  const value = issue74ExpectPathValue(source, paths, label);
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an array`);
  }
  expect(value.length).toBeGreaterThanOrEqual(minLength);
  return value;
}

function issue74CollectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => issue74CollectStrings(entry));
  }
  if (issue74IsRecord(value)) {
    return Object.values(value).flatMap((entry) => issue74CollectStrings(entry));
  }
  return [];
}

function issue74CollectBookingUrls(value: unknown, lineage: string[] = []): string[] {
  if (typeof value === "string") {
    const key = lineage[lineage.length - 1] ?? "";
    const parent = lineage[lineage.length - 2] ?? "";
    const isBookingLikeKey = /(booking_?url|booking_urls|_booking_urls)$/i.test(key);
    const isBookingMapValue = /(booking_?urls|_booking_urls|reserve_action)$/i.test(parent);
    const isReserveTemplate = key === "url_template" && parent === "reserve_action";
    if (issue74IsHttpUrl(value) && (isBookingLikeKey || isBookingMapValue || isReserveTemplate)) {
      return [value];
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => issue74CollectBookingUrls(entry, [...lineage, String(index)]));
  }

  if (issue74IsRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) => issue74CollectBookingUrls(entry, [...lineage, key]));
  }

  return [];
}

function issue74ExpectBookingUrls(source: unknown, minimum = 1): void {
  const urls = issue74CollectBookingUrls(source);
  expect(urls.length).toBeGreaterThanOrEqual(minimum);
  for (const url of urls) {
    expect(issue74IsHttpUrl(url)).toBe(true);
  }
}

function issue74EnsureObjectResponse(response: unknown): Record<string, unknown> {
  if (!issue74IsRecord(response)) {
    throw new Error(`Expected a JSON object response, received ${typeof response}`);
  }
  return response;
}

function issue74ExpectAnyStringMatch(source: unknown, matcher: RegExp, label: string): void {
  const strings = issue74CollectStrings(source).map((entry) => entry.toLowerCase());
  const matched = strings.some((entry) => matcher.test(entry));
  if (!matched) {
    throw new Error(`Expected ${label} to match ${matcher}`);
  }
}

function issue74ParsePossibleJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence) as unknown;
  } catch {
    return trimmed;
  }
}

function issue74ExtractErrorMessage(result: Issue74JsonRpcEnvelope["result"]): string | undefined {
  return result?.content?.find((entry) => entry.type === "text" && entry.text)?.text?.trim();
}

async function issue74JsonRpc(method: string, params: Record<string, unknown>): Promise<Issue74JsonRpcEnvelope> {
  const response = await fetch(ISSUE74_MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${method}-${crypto.randomUUID()}`,
      method,
      params,
    }),
    signal: AbortSignal.timeout(ISSUE74_TIMEOUT_MS),
  });

  expect(response.ok).toBe(true);
  return await response.json() as Issue74JsonRpcEnvelope;
}

async function issue74FetchLiveTools(): Promise<Issue74LiveToolDefinition[]> {
  const payload = await issue74JsonRpc("tools/list", {});

  if (payload.error?.message) {
    throw new Error(`tools/list failed: ${payload.error.message}`);
  }

  if (issue74IsRecord(payload.result) && Array.isArray(payload.result.tools)) {
    return payload.result.tools as Issue74LiveToolDefinition[];
  }

  if (issue74IsRecord(payload.result?.structuredContent) && Array.isArray(payload.result?.structuredContent.tools)) {
    return payload.result.structuredContent.tools as Issue74LiveToolDefinition[];
  }

  const text = payload.result?.content?.find((entry) => entry.type === "text" && entry.text)?.text;
  const parsed = text ? issue74ParsePossibleJson(text) : undefined;
  if (issue74IsRecord(parsed) && Array.isArray(parsed.tools)) {
    return parsed.tools as Issue74LiveToolDefinition[];
  }

  throw new Error(`Unable to parse tools/list response from ${ISSUE74_MCP_ENDPOINT}`);
}

async function issue74CallTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const payload = await issue74JsonRpc("tools/call", {
    name,
    arguments: args,
  });

  if (payload.error?.message) {
    throw new Error(`tools/call ${name} failed: ${payload.error.message}`);
  }

  if (payload.result?.isError) {
    throw new Error(issue74ExtractErrorMessage(payload.result) ?? `tools/call ${name} returned an MCP error`);
  }

  if (payload.result?.structuredContent !== undefined) {
    return payload.result.structuredContent;
  }

  const text = payload.result?.content?.find((entry) => entry.type === "text" && entry.text)?.text;
  if (!text) {
    throw new Error(`tools/call ${name} returned no structuredContent or text content`);
  }

  const parsed = issue74ParsePossibleJson(text);
  if (typeof parsed === "string" && /^MCP error/i.test(parsed)) {
    throw new Error(parsed);
  }

  return parsed;
}

function issue74BuildSearchArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = { city: ISSUE74_CITY };
  issue74MaybeSetArg(tool, args, ["category"], "theatre");
  issue74MaybeSetArg(tool, args, ["max_results", "limit"], 5);
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildNearbyArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = {
    latitude: ISSUE74_COORDINATES.latitude,
    longitude: ISSUE74_COORDINATES.longitude,
  };
  issue74MaybeSetArg(tool, args, ["max_results", "limit"], 5);
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildListCitiesArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  issue74MaybeSetArg(tool, args, ["query", "filter"], "lon");
  issue74MaybeSetArg(tool, args, ["limit", "max_results"], 10);
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildExperienceDetailsArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = { slug: ISSUE74_SLUG };
  issue74MaybeSetArg(tool, args, ["days"], 14);
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildCompareArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = { slugs: [...ISSUE74_COMPARISON_SLUGS] };
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildAvailabilityArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = {
    slug: ISSUE74_SLUG,
    date: ISSUE74_DATE,
  };
  issue74MaybeSetArg(tool, args, ["party_size", "pax"], 2);
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildSimpleCityArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = { city: ISSUE74_CITY };
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildPlanItineraryArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = {
    city: ISSUE74_CITY,
    days: 2,
  };
  issue74MaybeSetArg(tool, args, ["interests"], "theatre,museums");
  issue74MaybeSetArg(tool, args, ["audience"], "couples");
  issue74MaybeSetArg(tool, args, ["budget"], "medium");
  issue74MaybeSetArg(tool, args, ["pace"], "moderate");
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildMoodArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = {
    city: ISSUE74_CITY,
    mood: "romantic",
  };
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildTransferArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = { city: ISSUE74_CITY };
  issue74MaybeSetArg(tool, args, ["type", "location_type", "query", "origin", "from", "from_type"], "airport");
  issue74MaybeSetArg(tool, args, ["to_latitude", "latitude"], ISSUE74_COORDINATES.latitude);
  issue74MaybeSetArg(tool, args, ["to_longitude", "longitude"], ISSUE74_COORDINATES.longitude);
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildKnowledgeBaseArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  issue74MaybeSetArg(tool, args, ["query", "question"], "cancellation");
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildGiftIdeasArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = { city: ISSUE74_CITY };
  issue74MaybeSetArg(tool, args, ["occasion", "query", "type"], "birthday");
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

function issue74BuildAccessibilityArgs(tool: Issue74LiveToolDefinition): Record<string, unknown> {
  const args: Record<string, unknown> = { slug: ISSUE74_SLUG };
  issue74MaybeAddLanguage(tool, args);
  issue74MaybeAddJsonFormat(tool, args);
  return args;
}

const issue74ToolCases: Issue74ToolCase[] = [
  {
    name: "search_experiences",
    scenario: "search_experiences(\"london\", category=\"theatre\") returns results with booking URLs",
    buildArgs: issue74BuildSearchArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectPathValue(record, ["city", "city_name"], "city");
      const results = issue74ExpectArrayAtPaths(record, ["results"], "results");
      const theatreLike = results.some((entry) => /theatre|musical|show|west end/i.test(issue74CollectStrings(entry).join(" ")));
      expect(theatreLike).toBe(true);
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "find_nearby_experiences",
    scenario: "find_nearby_experiences(51.5074, -0.1278) returns London experiences",
    buildArgs: issue74BuildNearbyArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectPathValue(record, ["latitude"], "latitude");
      issue74ExpectPathValue(record, ["longitude"], "longitude");
      const results = issue74ExpectArrayAtPaths(record, ["results"], "results");
      const hasLondonSignal = results.some((entry) => issue74CollectStrings(entry).some((value) => value.toLowerCase().includes("london")));
      expect(hasLondonSignal).toBe(true);
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "list_cities",
    scenario: "list_cities(query=\"lon\") returns London",
    buildArgs: issue74BuildListCitiesArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      const results = issue74ExpectArrayAtPaths(record, ["results"], "results");
      const hasLondon = results.some((entry) => issue74CollectStrings(entry).map((value) => value.toLowerCase()).includes("london"));
      expect(hasLondon).toBe(true);
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_experience_details",
    scenario: "get_experience_details(slug) returns availability slots",
    buildArgs: issue74BuildExperienceDetailsArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectPathValue(record, ["title"], "title");
      issue74ExpectPathValue(record, ["slug"], "slug");
      issue74ExpectArrayAtPaths(record, ["availability.slots", "slots", "availability.results"], "availability slots");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "compare_experiences",
    scenario: "compare_experiences([slug1, slug2]) returns winner callouts",
    buildArgs: issue74BuildCompareArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectArrayAtPaths(record, ["comparison", "results"], "comparison results", 2);
      issue74ExpectPathValue(record, ["winner", "winners"], "winner callouts");
      issue74ExpectBookingUrls(record, 2);
    },
  },
  {
    name: "plan_itinerary",
    scenario: "plan_itinerary(\"london\", 2) returns a 2-day plan",
    buildArgs: issue74BuildPlanItineraryArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      const itinerary = issue74ExpectArrayAtPaths(record, ["itinerary", "plan.days", "days"], "itinerary", 2);
      expect(itinerary.length).toBeGreaterThanOrEqual(2);
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "whats_on_tonight",
    scenario: "whats_on_tonight(\"london\") returns tonight's shows",
    buildArgs: issue74BuildSimpleCityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectArrayAtPaths(record, ["tonight", "results"], "tonight results");
      issue74ExpectAnyStringMatch(record, /tonight|starts in|evening/, "tonight summary");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_city_guide",
    scenario: "get_city_guide(\"london\") returns highlights and categories",
    buildArgs: issue74BuildSimpleCityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectPathValue(record, ["city.name", "city"], "city");
      issue74ExpectArrayAtPaths(record, ["highlights", "results"], "highlights");
      issue74ExpectPathValue(record, ["categories", "category_breakdown"], "categories");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "check_availability",
    scenario: "check_availability(slug, \"2026-04-15\") returns slots",
    buildArgs: issue74BuildAvailabilityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectPathValue(record, ["available"], "available");
      issue74ExpectArrayAtPaths(record, ["slots", "availability.slots"], "availability slots");
      issue74ExpectPathValue(record, ["booking_url", "bookingUrl"], "booking URL");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_whats_on_this_week",
    scenario: "get_whats_on_this_week(\"london\") returns a weekly calendar",
    buildArgs: issue74BuildSimpleCityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      const week = issue74ExpectArrayAtPaths(record, ["week", "days"], "weekly calendar");
      const hasAnyDayPart = week.some((entry) => {
        const candidate = entry as Record<string, unknown>;
        return ["morning", "afternoon", "evening"].some((key) => Array.isArray(candidate[key]) && candidate[key].length > 0);
      });
      expect(hasAnyDayPart).toBe(true);
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "search_by_mood",
    scenario: "search_by_mood(\"london\", \"romantic\") returns couple experiences",
    buildArgs: issue74BuildMoodArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      const results = issue74ExpectArrayAtPaths(record, ["results"], "results");
      const couplesFriendly = results.some((entry) => issue74CollectStrings(entry).some((value) => value.toLowerCase().includes("couples")));
      expect(couplesFriendly).toBe(true);
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_hidden_gems",
    scenario: "get_hidden_gems(\"london\") returns off-the-beaten-path picks",
    buildArgs: issue74BuildSimpleCityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectArrayAtPaths(record, ["results", "gems", "highlights"], "hidden gem results");
      issue74ExpectPathValue(record, ["local_tip", "localTip", "insider_tip", "insiderTip"], "local tip");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_date_night",
    scenario: "get_date_night(\"london\") returns an evening plan",
    buildArgs: issue74BuildSimpleCityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectPathValue(record, ["plan.pre_dinner", "plan.activity", "plan.show"], "date-night plan");
      issue74ExpectPathValue(record, ["booking_urls", "_booking_urls"], "booking URLs map");
      issue74ExpectBookingUrls(record, 2);
    },
  },
  {
    name: "get_family_day",
    scenario: "get_family_day(\"london\") returns a family itinerary",
    buildArgs: issue74BuildSimpleCityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectPathValue(record, ["plan.morning", "plan.afternoon", "plan"], "family-day plan");
      issue74ExpectPathValue(record, ["booking_urls", "_booking_urls"], "booking URLs map");
      issue74ExpectBookingUrls(record, 2);
    },
  },
  {
    name: "get_transfer_info",
    scenario: "get_transfer_info(\"london\", \"airport\") returns transport details",
    buildArgs: issue74BuildTransferArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectArrayAtPaths(record, ["options", "results", "transfers"], "transfer options");
      issue74ExpectAnyStringMatch(record, /airport|transfer|train|bus|taxi/, "transfer guidance");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_free_things",
    scenario: "get_free_things(\"london\") returns free activities",
    buildArgs: issue74BuildSimpleCityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      const results = issue74ExpectArrayAtPaths(record, ["results", "activities", "highlights"], "free activity results");
      const hasFreeSignal = results.some((entry) => /free|0\b|0\.0/.test(issue74CollectStrings(entry).join(" ").toLowerCase()));
      expect(hasFreeSignal).toBe(true);
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_last_minute",
    scenario: "get_last_minute(\"london\") returns soon-starting experiences",
    buildArgs: issue74BuildSimpleCityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectArrayAtPaths(record, ["results", "tonight"], "last-minute results");
      issue74ExpectPathValue(record, ["results.0.countdown_text", "results.0.starts_in", "tonight.0.starts_in"], "countdown text");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "search_knowledge_base",
    scenario: "search_knowledge_base(\"cancellation\") returns policy guidance",
    buildArgs: issue74BuildKnowledgeBaseArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectArrayAtPaths(record, ["results", "articles", "matches"], "knowledge-base matches");
      issue74ExpectAnyStringMatch(record, /cancellation|refund|policy/, "knowledge-base content");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_gift_ideas",
    scenario: "get_gift_ideas(\"london\", \"birthday\") returns gift experiences",
    buildArgs: issue74BuildGiftIdeasArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectArrayAtPaths(record, ["results", "ideas", "gifts"], "gift ideas");
      issue74ExpectAnyStringMatch(record, /gift|birthday|present/, "gift-idea context");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_accessibility_guide",
    scenario: "get_accessibility_guide(slug) returns accessibility info",
    buildArgs: issue74BuildAccessibilityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectPathValue(record, ["slug", "experience.slug"], "slug");
      issue74ExpectAnyStringMatch(record, /wheelchair|accessibility|accessible|step-free/, "accessibility details");
      issue74ExpectBookingUrls(record);
    },
  },
  {
    name: "get_travel_tips",
    scenario: "get_travel_tips(\"london\") returns insider tips",
    buildArgs: issue74BuildSimpleCityArgs,
    validate(response) {
      const record = issue74EnsureObjectResponse(response);
      issue74ExpectArrayAtPaths(record, ["tips", "results", "insider_tips"], "travel tips");
      issue74ExpectAnyStringMatch(record, /tip|insider|travel|getting around/, "travel tips");
      issue74ExpectBookingUrls(record);
    },
  },
];

describe("issue #74 live MCP coverage", () => {
  it("advertises all 21 expected tools from the issue description", () => {
    const available = Array.from(issue74LiveToolMap.keys()).sort();
    const missing = ISSUE74_EXPECTED_TOOL_NAMES.filter((name) => !issue74LiveToolMap.has(name));

    if (issue74LiveToolMap.size < ISSUE74_EXPECTED_TOOL_NAMES.length || missing.length > 0) {
      throw new Error(
        [
          `Live MCP endpoint ${ISSUE74_MCP_ENDPOINT} is missing issue #74 tools.`,
          `Expected at least ${ISSUE74_EXPECTED_TOOL_NAMES.length} tools, found ${issue74LiveToolMap.size}.`,
          `Missing tools: ${missing.join(", ") || "none"}.`,
          `Available tools: ${available.join(", ") || "none"}.`,
        ].join(" "),
      );
    }
  });

  for (const toolCase of issue74ToolCases) {
    const toolTest = issue74LiveToolMap.has(toolCase.name) ? it : it.skip;

    toolTest(toolCase.scenario, async () => {
      const tool = issue74LiveToolMap.get(toolCase.name);
      expect(tool).toBeDefined();

      const response = await issue74CallTool(toolCase.name, toolCase.buildArgs(tool!));
      toolCase.validate(response);
    }, 30_000);
  }
});
