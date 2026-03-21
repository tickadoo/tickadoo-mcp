import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

type ToolCallResult = Awaited<ReturnType<Client["callTool"]>>;
type TextContentItem = { type: "text"; text: string };

type SearchStructuredContent = {
  city?: string;
  citySlug?: string;
  totalExperiences?: number;
  experiences?: Array<{
    tickadooProductId: string;
    slug: string;
    title: string;
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
  price: number | null;
  rating: number | null;
  bookingUrl: string | null;
  imageUrl: string | null;
  block: string;
};

const endpoint = new URL(process.env.MCP_URL ?? "https://mcp.tickadoo.com/mcp");
const client = new Client({ name: "tickadoo-vitest-integration", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(endpoint);
const expectedUtmParams = new URLSearchParams(
  process.env.MCP_EXPECTED_UTM_QUERY ?? "utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
);

function firstTextContent(result: ToolCallResult): string {
  return ((result.content ?? []) as TextContentItem[]).find(item => item.type === "text")?.text ?? "";
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
      const priceMatch = block.match(/💰 From [A-Z]{3} ([0-9]+(?:\.[0-9]{2})?)/);
      const ratingMatch = block.match(/⭐ ([0-9]+(?:\.[0-9])?)\/5/);
      const bookingUrlMatch = block.match(/🔗 (https?:\/\/\S+)/);
      const imageUrlMatch = block.match(/🖼️ (https?:\/\/\S+)/);

      return {
        title,
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

    const cards = parseExperienceCards(text);
    expect(cards.length).toBeGreaterThan(3);
    const searchStructured = getStructuredContent<SearchStructuredContent>(result);

    const [firstCard] = cards;
    expect(firstCard.title).toBeTruthy();
    expect(firstCard.price).not.toBeNull();
    expect(firstCard.rating).not.toBeNull();
    expect(firstCard.bookingUrl).toMatch(/^https:\/\/www\.tickadoo\.com\//);
    expect(firstCard.imageUrl).toMatch(/^https?:\/\//);
    expectTrackedBookingUrl(firstCard.bookingUrl);

    const firstExperience = searchStructured.experiences?.[0];
    expect(firstExperience).toBeTruthy();
    expectTrackedBookingUrl(firstExperience?.bookingUrl);
    expect(Object.keys(firstExperience ?? {}).sort()).toMatchInlineSnapshot(`
      [
        "bookingUrl",
        "imageUrl",
        "slug",
        "tickadooProductId",
        "title",
      ]
    `);

    const sortedTitles = [...cards].sort(compareCardsForDisplay).map(card => card.title);
    expect(cards.map(card => card.title)).toEqual(sortedTitles);
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

    expect(result.isError).toBe(true);
    const text = firstTextContent(result);
    expect(text).toContain("No exact city match found");
    expect(text).toContain("Try");
  }, 30_000);

  it("search_experiences returns a helpful error for a blank category", async () => {
    const result = await client.callTool({
      name: "search_experiences",
      arguments: { city: "vegas", category: "   ", language: "en" },
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain("Invalid category");
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
    const nearbyStructured = getStructuredContent<NearbyStructuredContent>(result);

    const cards = parseExperienceCards(text);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]?.title).toBeTruthy();
    expect(cards[0]?.imageUrl).toMatch(/^https?:\/\//);
    expect(cards[0]?.bookingUrl).toMatch(/^https:\/\/www\.tickadoo\.com\//);
    expectTrackedBookingUrl(cards[0]?.bookingUrl);

    expect(nearbyStructured.radiusKm).toBe(5);
    expect(nearbyStructured.latitude).toBe(51.502606);
    expect(nearbyStructured.longitude).toBe(-0.118117);
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
    expect(firstTextContent(result)).toContain("No experiences within 1km");
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

    const filteredResult = await client.callTool({
      name: "list_cities",
      arguments: { query: "paris", limit: 5, language: "en" },
    });

    expect(filteredResult.isError).not.toBe(true);
    const filteredText = firstTextContent(filteredResult);
    expect(filteredText).toContain("Found");
    expect(filteredText).toContain("PARIS");
    expect(filteredText).toContain("utm_source=mcp");
    expect(extractCount(filteredText, /Found (\d+) matching cities/i, "list_cities filtered count")).toBeGreaterThanOrEqual(1);
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
});
