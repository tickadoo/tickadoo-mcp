import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCitiesMock,
  getMcpEnrichedProductsMock,
  getProductsForCitySlugMock,
} = vi.hoisted(() => ({
  getCitiesMock: vi.fn(),
  getMcpEnrichedProductsMock: vi.fn(),
  getProductsForCitySlugMock: vi.fn(),
}));

vi.mock("../src/shared/api.js", () => ({
  buildBookingUrl: (path: string, language = "en") => `https://www.tickadoo.com/${language}/${path}?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp`,
  geocodeCityQuery: vi.fn(async () => null),
  getCities: getCitiesMock,
  getExperienceDetails: vi.fn(),
  getMcpEnrichedProducts: getMcpEnrichedProductsMock,
  getNearestCoveredCities: vi.fn(async () => []),
  getProductsByLocation: vi.fn(async () => []),
  getProductsForCitySlug: getProductsForCitySlugMock,
  resolveProductBySlug: vi.fn(),
  heuristicEnrich: vi.fn(product => product),
  normalizeSlugOrPath: (value: string) => value.trim().replace(/^\/+|\/+$/g, ""),
}));

import { buildLlmsFullTxt, buildLlmsTxt } from "../src/shared/llms.js";
import { createTickadooServer } from "../src/shared/server.js";

function firstTextContent(result: { content?: Array<{ type?: string; text?: string }> }): string {
  return result.content?.find(item => item.type === "text")?.text ?? "";
}

describe("get_city_guide tool", () => {
  beforeEach(() => {
    getCitiesMock.mockReset();
    getMcpEnrichedProductsMock.mockReset();
    getProductsForCitySlugMock.mockReset();

    getCitiesMock.mockResolvedValue([
      {
        id: "city-id",
        name: "London",
        slug: "london",
        location: null,
      },
    ]);
    getMcpEnrichedProductsMock.mockResolvedValue(new Map());
    getProductsForCitySlugMock.mockResolvedValue([
      {
        id: "product-id",
        cityId: "city-id",
        slug: "hamilton-london",
        title: "Hamilton",
        description: "Award-winning West End musical in London.",
        desktopFeatureImageUrl: null,
        verticalImageUrl: null,
        provider: "tickadoo",
        providerId: "provider-id",
        averageRating: 4.9,
        currency: "GBP",
        address: "London",
        minPrice: 45,
        mcpProduct: {
          niceId: 1,
          name: "Hamilton",
          url: "hamilton-london",
          minPrice: 45,
          reviewRating: 4.9,
          reviewCount: 5400,
          indoorOutdoor: "Indoor",
          physicalLevel: "Easy",
          audience: ["Family", "Couples", "Kids"],
          tags: ["Musical", "WestEnd", "Show"],
          wheelchairAccessible: true,
          strollerFriendly: true,
          languageOptions: ["en"],
          variants: [],
        },
      },
      {
        id: "product-id-2",
        cityId: "city-id",
        slug: "thames-evening-cruise",
        title: "Thames Evening Cruise",
        description: "An evening river cruise with skyline views.",
        desktopFeatureImageUrl: null,
        verticalImageUrl: null,
        provider: "tickadoo",
        providerId: "provider-id-2",
        averageRating: 4.8,
        currency: "GBP",
        address: "London",
        minPrice: 35,
        mcpProduct: {
          niceId: 2,
          name: "Thames Evening Cruise",
          url: "thames-evening-cruise",
          minPrice: 35,
          reviewRating: 4.8,
          reviewCount: 2100,
          indoorOutdoor: "Outdoor",
          physicalLevel: "Easy",
          audience: ["Couples", "Solo", "Groups"],
          tags: ["Cruise", "Evening", "MustSee"],
          wheelchairAccessible: true,
          strollerFriendly: false,
          languageOptions: ["en"],
          variants: [],
        },
      },
    ]);
  });

  it("registers the expected schema and returns a structured guide payload", async () => {
    const server = createTickadooServer() as any;
    const tool = server._registeredTools.get_city_guide;
    const schema = tool.inputSchema.shape;

    expect(tool).toBeTruthy();
    expect(schema.city._def.typeName).toBe("ZodString");
    expect(schema.format._def.innerType._def.innerType._def.values).toEqual(["text", "json"]);

    const result = await tool.handler({
      city: "london",
      language: "de",
      format: "json",
    });

    expect(result.isError).not.toBe(true);
    const json = JSON.parse(firstTextContent(result));

    expect(json.city).toEqual({
      name: "London",
      slug: "london",
      country: null,
      experience_count: 2,
    });
    expect(json.highlights).toHaveLength(2);
    expect(json.highlights[0].booking_url).toContain("https://www.tickadoo.com/de/hamilton-london");
    expect(json.categories).toMatchObject({
      theatre: 1,
      musicals: 1,
      cruises: 1,
    });
    expect(json.best_for).toContain("Theatre and musical nights");
    expect(result.structuredContent.city.slug).toBe("london");
  });

  it("documents get_city_guide in llms docs", () => {
    const shortDoc = buildLlmsTxt();
    const fullDoc = buildLlmsFullTxt();

    expect(shortDoc).toContain("get_city_guide");
    expect(shortDoc).toContain("curated city overview for trip planning");
    expect(fullDoc).toContain("get_city_guide");
    expect(fullDoc).toContain("top 5 highlights, category counts, price range, best_for suggestions");
    expect(fullDoc).toContain("city (required): city name or slug such as london, prague, rome, or tokyo");
  });
});
