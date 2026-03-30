import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCitiesMock,
  getExperienceDetailsMock,
  getMcpEnrichedProductsMock,
  getProductsForCitySlugMock,
} = vi.hoisted(() => ({
  getCitiesMock: vi.fn(),
  getExperienceDetailsMock: vi.fn(),
  getMcpEnrichedProductsMock: vi.fn(),
  getProductsForCitySlugMock: vi.fn(),
}));

vi.mock("../src/shared/api.js", () => ({
  buildBookingUrl: (path: string, language = "en") => `https://www.tickadoo.com/${language}/${path}?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp`,
  geocodeCityQuery: vi.fn(async () => null),
  getCities: getCitiesMock,
  getExperienceDetails: getExperienceDetailsMock,
  getMcpEnrichedProducts: getMcpEnrichedProductsMock,
  getNearestCoveredCities: vi.fn(async () => []),
  getProductsByLocation: vi.fn(async () => []),
  getProductsForCitySlug: getProductsForCitySlugMock,
  resolveProductBySlug: vi.fn(),
  heuristicEnrich: vi.fn(product => product),
  normalizeSlugOrPath: (value: string) => value.trim().replace(/^\/+|\/+$/g, ""),
}));

import { createTickadooServer } from "../src/shared/server.js";
import { buildWhatsOnThisWeek } from "../src/whats-on-this-week.js";
import type { Product, StructuredDataDatePrice, StructuredDataResponse } from "../src/shared/types.js";

function firstTextContent(result: { content?: Array<{ type?: string; text?: string }> }): string {
  return result.content?.find(item => item.type === "text")?.text ?? "";
}

function buildProduct(input: {
  slug: string;
  title: string;
  minPrice: number;
  rating: number;
  reviewCount?: number;
  tags?: string[];
  audience?: string[];
}): Product {
  return {
    id: input.slug,
    cityId: "london",
    slug: input.slug,
    title: input.title,
    description: `${input.title} description`,
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
    verticalImageUrl: null,
    provider: "tickadoo",
    providerId: input.slug,
    averageRating: input.rating,
    currency: "GBP",
    address: "London",
    minPrice: input.minPrice,
    mcpProduct: {
      niceId: 1,
      name: input.title,
      url: input.slug,
      minPrice: input.minPrice,
      reviewRating: input.rating,
      reviewCount: input.reviewCount ?? 500,
      indoorOutdoor: "Indoor",
      physicalLevel: "Easy",
      audience: input.audience ?? [],
      tags: input.tags ?? [],
      wheelchairAccessible: true,
      strollerFriendly: true,
      languageOptions: ["en"],
      variants: [],
    },
  };
}

function buildDetails(input: {
  dates: StructuredDataDatePrice[];
  rating: number;
  reviewCount?: number;
  tags?: string[];
  audience?: string[];
}): StructuredDataResponse {
  return {
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
    mobileFeatureImageUrl: "https://cdn.tickadoo.com/example/mobile.jpg",
    currencyCode: "GBP",
    address: "London",
    locationWithAddress: {
      latitude: 51.5,
      longitude: -0.12,
      address: "London",
    },
    dates: input.dates,
    mcpProduct: {
      niceId: 1,
      name: "Test Product",
      url: "test-product",
      minPrice: input.dates[0]?.minPrice ?? 0,
      reviewRating: input.rating,
      reviewCount: input.reviewCount ?? 1000,
      indoorOutdoor: "Indoor",
      physicalLevel: "Easy",
      audience: input.audience ?? [],
      tags: input.tags ?? [],
      wheelchairAccessible: true,
      strollerFriendly: true,
      languageOptions: ["en"],
      variants: [],
    },
  };
}

describe("get_whats_on_this_week", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T09:00:00Z"));
    getCitiesMock.mockReset();
    getExperienceDetailsMock.mockReset();
    getMcpEnrichedProductsMock.mockReset();
    getProductsForCitySlugMock.mockReset();
    getMcpEnrichedProductsMock.mockResolvedValue(new Map());

    getCitiesMock.mockResolvedValue([
      {
        id: "london",
        name: "London",
        slug: "london",
        location: {
          latitude: 51.5,
          longitude: -0.12,
        },
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups experiences into day parts and generates weekly highlights", () => {
    const bakeryTour = buildProduct({
      slug: "bakery-tour",
      title: "Bakery Tour",
      minPrice: 25,
      rating: 4.6,
      reviewCount: 240,
      tags: ["Morning"],
    });
    const riverCruise = buildProduct({
      slug: "river-cruise",
      title: "River Cruise",
      minPrice: 39,
      rating: 4.8,
      reviewCount: 680,
      tags: ["Cruise"],
    });
    const cabaret = buildProduct({
      slug: "cabaret-night",
      title: "Cabaret Night",
      minPrice: 59,
      rating: 4.9,
      reviewCount: 1200,
      tags: ["Evening", "NightLife"],
    });

    const result = buildWhatsOnThisWeek([
      {
        product: bakeryTour,
        bookingPath: "london/bakery-tour",
        details: buildDetails({
          rating: 4.6,
          reviewCount: 240,
          tags: ["Morning"],
          dates: [
            { date: "2026-03-30", endDate: "2026-03-30", minPrice: 25, variantName: "Standard", startTime: "09:00" },
            { date: "2026-04-02", endDate: "2026-04-02", minPrice: 25, variantName: "Standard", startTime: "09:30" },
          ],
        }),
        language: "en",
        popular: false,
      },
      {
        product: riverCruise,
        bookingPath: "london/river-cruise",
        details: buildDetails({
          rating: 4.8,
          reviewCount: 680,
          tags: ["Cruise"],
          dates: [
            { date: "2026-04-02", endDate: "2026-04-02", minPrice: 39, variantName: "Standard", startTime: "14:00" },
            { date: "2026-04-04", endDate: "2026-04-04", minPrice: 39, variantName: "Standard", startTime: "14:30" },
          ],
        }),
        language: "en",
        popular: true,
      },
      {
        product: cabaret,
        bookingPath: "london/cabaret-night",
        details: buildDetails({
          rating: 4.9,
          reviewCount: 1200,
          tags: ["Evening", "NightLife"],
          dates: [
            { date: "2026-03-31", endDate: "2026-03-31", minPrice: 59, variantName: "Standard", startTime: "20:00" },
            { date: "2026-04-02", endDate: "2026-04-02", minPrice: 59, variantName: "Standard", startTime: "19:30" },
            { date: "2026-04-03", endDate: "2026-04-03", minPrice: 59, variantName: "Standard", startTime: "18:30" },
          ],
        }),
        language: "en",
        popular: true,
      },
    ], {
      city: "London",
      citySlug: "london",
      startDate: "2026-03-30",
      dayCount: 7,
    });

    expect(result.week).toHaveLength(7);
    expect(result.week[0].date).toBe("2026-03-30");
    expect(result.week[0].morning.map(entry => entry.slug)).toEqual(["bakery-tour"]);
    expect(result.week[3].morning.map(entry => entry.slug)).toEqual(["bakery-tour"]);
    expect(result.week[3].afternoon.map(entry => entry.slug)).toEqual(["river-cruise"]);
    expect(result.week[3].evening.map(entry => entry.slug)).toEqual(["cabaret-night"]);
    expect(result.highlights).toContain("Thursday has the most options this week (3).");
    expect(result.highlights).toContain("Evening is the strongest daypart overall.");
    expect(result.highlights).toContain("Cabaret Night is the best-rated standout this week.");
  });

  it("registers the tool and returns JSON day-by-day breakdowns", async () => {
    const products = [
      buildProduct({
        slug: "tower-tour",
        title: "Tower Tour",
        minPrice: 28,
        rating: 4.7,
        reviewCount: 450,
        tags: ["Morning"],
      }),
      buildProduct({
        slug: "jazz-cruise",
        title: "Jazz Cruise",
        minPrice: 48,
        rating: 4.9,
        reviewCount: 980,
        tags: ["Evening"],
      }),
    ];

    getProductsForCitySlugMock.mockImplementation(async (citySlug: string) => citySlug === "london" ? products : []);
    getExperienceDetailsMock.mockImplementation(async (_provider: string, providerId: string) => {
      if (providerId === "tower-tour") {
        return buildDetails({
          rating: 4.7,
          reviewCount: 450,
          tags: ["Morning"],
          dates: [
            { date: "2026-03-30", endDate: "2026-03-30", minPrice: 28, variantName: "Standard", startTime: "10:00" },
            { date: "2026-04-02", endDate: "2026-04-02", minPrice: 28, variantName: "Standard", startTime: "10:30" },
          ],
        });
      }

      return buildDetails({
        rating: 4.9,
        reviewCount: 980,
        tags: ["Evening"],
        dates: [
          { date: "2026-04-02", endDate: "2026-04-02", minPrice: 48, variantName: "Standard", startTime: "19:30" },
        ],
      });
    });

    const server = createTickadooServer() as any;
    const tool = server._registeredTools.get_whats_on_this_week;
    const schema = tool.inputSchema.shape;

    expect(tool).toBeTruthy();
    expect(schema.city).toBeTruthy();
    expect(schema.format._def.innerType._def.innerType._def.values).toEqual(["text", "json"]);

    const result = await tool.handler({
      city: "london",
      language: "en",
      format: "json",
    });

    expect(result.isError).not.toBe(true);
    const json = JSON.parse(firstTextContent(result));

    expect(json.city).toBe("london");
    expect(json.citySlug).toBe("london");
    expect(json.startDate).toBe("2026-03-30");
    expect(json.endDate).toBe("2026-04-05");
    expect(json.week[0].morning.map((entry: { slug: string }) => entry.slug)).toEqual(["tower-tour"]);
    expect(json.week[3].morning.map((entry: { slug: string }) => entry.slug)).toEqual(["tower-tour"]);
    expect(json.week[3].evening.map((entry: { slug: string }) => entry.slug)).toEqual(["jazz-cruise"]);
    expect(json.highlights).toContain("Thursday has the most options this week");
    expect(result.structuredContent.week[3].morning[0].slug).toBe("tower-tour");
    expect(getProductsForCitySlugMock).toHaveBeenCalledWith("london", "en", {
      dateFrom: "2026-03-30",
      dateTo: "2026-04-05",
    });
  });

  it("returns readable text output when requested", async () => {
    getProductsForCitySlugMock.mockResolvedValue([
      buildProduct({
        slug: "sunrise-bus-tour",
        title: "Sunrise Bus Tour",
        minPrice: 22,
        rating: 4.5,
        tags: ["Morning"],
      }),
    ]);
    getExperienceDetailsMock.mockResolvedValue(buildDetails({
      rating: 4.5,
      dates: [
        { date: "2026-03-30", endDate: "2026-03-30", minPrice: 22, variantName: "Standard", startTime: "08:30" },
      ],
      tags: ["Morning"],
    }));

    const server = createTickadooServer() as any;
    const result = await server._registeredTools.get_whats_on_this_week.handler({
      city: "london",
      format: "text",
    });

    expect(result.isError).not.toBe(true);
    expect(firstTextContent(result)).toContain("What's on in london this week (2026-03-30 to 2026-04-05)");
    expect(firstTextContent(result)).toContain("Monday (2026-03-30)");
    expect(firstTextContent(result)).toContain("Sunrise Bus Tour | 08:30 | from 22 GBP | 4.5/5");
  });
});
