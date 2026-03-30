import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  geocodeCityQueryMock,
  getCitiesMock,
  getExperienceDetailsMock,
  getMcpEnrichedProductsMock,
  getNearestCoveredCitiesMock,
  getProductsForCitySlugMock,
} = vi.hoisted(() => ({
  geocodeCityQueryMock: vi.fn(),
  getCitiesMock: vi.fn(),
  getExperienceDetailsMock: vi.fn(),
  getMcpEnrichedProductsMock: vi.fn(),
  getNearestCoveredCitiesMock: vi.fn(),
  getProductsForCitySlugMock: vi.fn(),
}));

vi.mock("../src/shared/api.js", () => ({
  buildBookingUrl: (path: string, language = "en") => `https://www.tickadoo.com/${language}/${path}?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp`,
  geocodeCityQuery: geocodeCityQueryMock,
  getCities: getCitiesMock,
  getExperienceDetails: getExperienceDetailsMock,
  getMcpEnrichedProducts: getMcpEnrichedProductsMock,
  getNearestCoveredCities: getNearestCoveredCitiesMock,
  getProductsByLocation: vi.fn(async () => []),
  getProductsForCitySlug: getProductsForCitySlugMock,
  resolveProductBySlug: vi.fn(async () => {
    throw new Error("not used");
  }),
  heuristicEnrich: vi.fn(product => product),
  normalizeSlugOrPath: (value: string) => value.trim().replace(/^\/+|\/+$/g, ""),
}));

import { buildLlmsFullTxt, buildLlmsTxt } from "../src/shared/llms.js";
import { createTickadooServer } from "../src/shared/server.js";
import { buildTonightResult, formatTonightText, toWhatsOnTonightPayload } from "../src/shared/tonight.js";

function firstTextContent(result: { content?: Array<{ type?: string; text?: string }> }): string {
  return result.content?.find(item => item.type === "text")?.text ?? "";
}

function buildMcpProduct(input: { name: string; minPrice: number; reviewRating: number; reviewCount: number; tags: string[] }) {
  return {
    niceId: 1,
    name: input.name,
    url: input.name.toLowerCase().replace(/\s+/g, "-"),
    minPrice: input.minPrice,
    reviewRating: input.reviewRating,
    reviewCount: input.reviewCount,
    indoorOutdoor: "Indoor" as const,
    physicalLevel: "Easy" as const,
    audience: ["Couples", "Groups"],
    tags: input.tags,
    wheelchairAccessible: true,
    strollerFriendly: true,
    languageOptions: ["en"],
    variants: [],
  };
}

describe("whats_on_tonight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T17:00:00"));

    geocodeCityQueryMock.mockReset();
    getCitiesMock.mockReset();
    getExperienceDetailsMock.mockReset();
    getMcpEnrichedProductsMock.mockReset();
    getNearestCoveredCitiesMock.mockReset();
    getProductsForCitySlugMock.mockReset();

    geocodeCityQueryMock.mockResolvedValue(null);
    getNearestCoveredCitiesMock.mockResolvedValue([]);
    getMcpEnrichedProductsMock.mockResolvedValue(new Map());

    getCitiesMock.mockResolvedValue([
      {
        id: "london-id",
        name: "London",
        slug: "london",
        location: { latitude: 51.5072, longitude: -0.1276 },
      },
    ]);

    getProductsForCitySlugMock.mockImplementation(async (citySlug: string) => {
      if (citySlug !== "london") {
        return [];
      }

      return [
        {
          id: "comedy-id",
          cityId: "london-id",
          slug: "comedy-night",
          title: "Comedy Night Show",
          description: "Late laughs in the West End",
          desktopFeatureImageUrl: "https://cdn.tickadoo.com/comedy.jpg",
          verticalImageUrl: null,
          provider: "tickadoo",
          providerId: "comedy-night",
          averageRating: 4.7,
          currency: "GBP",
          address: "Leicester Square Theatre, London",
          minPrice: 28,
          mcpProduct: buildMcpProduct({
            name: "Comedy Night Show",
            minPrice: 28,
            reviewRating: 4.7,
            reviewCount: 900,
            tags: ["Evening", "Show", "Comedy"],
          }),
        },
        {
          id: "museum-id",
          cityId: "london-id",
          slug: "museum-lates",
          title: "Museum Lates",
          description: "Open after hours",
          desktopFeatureImageUrl: "https://cdn.tickadoo.com/museum.jpg",
          verticalImageUrl: null,
          provider: "tickadoo",
          providerId: "museum-lates",
          averageRating: 4.9,
          currency: "GBP",
          address: "Natural History Museum, London",
          minPrice: 32,
          mcpProduct: buildMcpProduct({
            name: "Museum Lates",
            minPrice: 32,
            reviewRating: 4.9,
            reviewCount: 1200,
            tags: ["Attraction"],
          }),
        },
        {
          id: "opera-id",
          cityId: "london-id",
          slug: "late-opera",
          title: "Late Opera",
          description: "Opera performance",
          desktopFeatureImageUrl: "https://cdn.tickadoo.com/opera.jpg",
          verticalImageUrl: null,
          provider: "tickadoo",
          providerId: "late-opera",
          averageRating: 4.8,
          currency: "GBP",
          address: "Royal Opera House, Bow Street, London",
          minPrice: 54,
          mcpProduct: buildMcpProduct({
            name: "Late Opera",
            minPrice: 54,
            reviewRating: 4.8,
            reviewCount: 1500,
            tags: ["Show", "Theatre"],
          }),
        },
        {
          id: "past-id",
          cityId: "london-id",
          slug: "past-cruise",
          title: "Past Cruise",
          description: "Already departed",
          desktopFeatureImageUrl: "https://cdn.tickadoo.com/cruise.jpg",
          verticalImageUrl: null,
          provider: "tickadoo",
          providerId: "past-cruise",
          averageRating: 4.6,
          currency: "GBP",
          address: "Tower Pier, London",
          minPrice: 35,
          mcpProduct: buildMcpProduct({
            name: "Past Cruise",
            minPrice: 35,
            reviewRating: 4.6,
            reviewCount: 400,
            tags: ["Evening", "Cruise"],
          }),
        },
      ];
    });

    getExperienceDetailsMock.mockImplementation(async (_provider: string, providerId: string) => {
      if (providerId === "comedy-night") {
        return {
          desktopFeatureImageUrl: "https://cdn.tickadoo.com/comedy.jpg",
          mobileFeatureImageUrl: "https://cdn.tickadoo.com/comedy-mobile.jpg",
          currencyCode: "GBP",
          address: "Leicester Square Theatre, London",
          locationWithAddress: {
            latitude: 51.51,
            longitude: -0.13,
            address: "Leicester Square Theatre, London",
          },
          dates: [
            {
              date: "2026-03-30",
              endDate: "2026-03-30",
              minPrice: 28,
              variantName: "Evening",
              startTime: "19:30",
              inventoryLevel: 14,
              availabilityStatus: "LimitedAvailability",
            },
          ],
          mcpProduct: buildMcpProduct({
            name: "Comedy Night Show",
            minPrice: 28,
            reviewRating: 4.7,
            reviewCount: 900,
            tags: ["Evening", "Show", "Comedy"],
          }),
        };
      }

      if (providerId === "museum-lates") {
        return {
          desktopFeatureImageUrl: "https://cdn.tickadoo.com/museum.jpg",
          mobileFeatureImageUrl: "https://cdn.tickadoo.com/museum-mobile.jpg",
          currencyCode: "GBP",
          address: "Natural History Museum, London",
          locationWithAddress: {
            latitude: 51.49,
            longitude: -0.17,
            address: "Natural History Museum, London",
          },
          dates: [
            {
              date: "2026-03-30",
              endDate: "2026-03-30",
              minPrice: 32,
              variantName: "Late opening",
              startTime: "19:30",
              inventoryLevel: 40,
              availabilityStatus: "InStock",
            },
          ],
          mcpProduct: buildMcpProduct({
            name: "Museum Lates",
            minPrice: 32,
            reviewRating: 4.9,
            reviewCount: 1200,
            tags: ["Attraction"],
          }),
        };
      }

      if (providerId === "late-opera") {
        return {
          desktopFeatureImageUrl: "https://cdn.tickadoo.com/opera.jpg",
          mobileFeatureImageUrl: "https://cdn.tickadoo.com/opera-mobile.jpg",
          currencyCode: "GBP",
          address: "Royal Opera House, Bow Street, London",
          locationWithAddress: {
            latitude: 51.51,
            longitude: -0.12,
            address: "Royal Opera House, Bow Street, London",
          },
          dates: [
            {
              date: "2026-03-30",
              endDate: "2026-03-30",
              minPrice: 54,
              variantName: "Late performance",
              startTime: "21:00",
              inventoryLevel: 4,
              availabilityStatus: "InStock",
            },
          ],
          mcpProduct: buildMcpProduct({
            name: "Late Opera",
            minPrice: 54,
            reviewRating: 4.8,
            reviewCount: 1500,
            tags: ["Show", "Theatre"],
          }),
        };
      }

      return {
        desktopFeatureImageUrl: "https://cdn.tickadoo.com/cruise.jpg",
        mobileFeatureImageUrl: "https://cdn.tickadoo.com/cruise-mobile.jpg",
        currencyCode: "GBP",
        address: "Tower Pier, London",
        locationWithAddress: {
          latitude: 51.5,
          longitude: -0.08,
          address: "Tower Pier, London",
        },
        dates: [
          {
            date: "2026-03-30",
            endDate: "2026-03-30",
            minPrice: 35,
            variantName: "Sunset cruise",
            startTime: "16:30",
            inventoryLevel: 20,
            availabilityStatus: "InStock",
          },
        ],
        mcpProduct: buildMcpProduct({
          name: "Past Cruise",
          minPrice: 35,
          reviewRating: 4.6,
          reviewCount: 400,
          tags: ["Evening", "Cruise"],
        }),
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters already-started events, sorts by start time, and boosts evening shows on ties", () => {
    const result = buildTonightResult({
      city: "london",
      date: "2026-03-30",
      currentTime: "17:00",
      maxResults: 3,
      experiences: [
        {
          slug: "past-cruise",
          title: "Past Cruise",
          tags: ["Evening", "Cruise"],
          bookingUrl: "https://www.tickadoo.com/en/london/past-cruise",
          slots: [{ date: "2026-03-30", startTime: "16:30", minPrice: 35 }],
        },
        {
          slug: "museum-lates",
          title: "Museum Lates",
          rating: 4.9,
          venueAddress: "Natural History Museum, London",
          bookingUrl: "https://www.tickadoo.com/en/london/museum-lates",
          slots: [{ date: "2026-03-30", startTime: "19:30", minPrice: 32, inventoryLevel: 40 }],
        },
        {
          slug: "comedy-night",
          title: "Comedy Night",
          tags: ["Evening", "Show", "Comedy"],
          rating: 4.7,
          venueAddress: "Leicester Square Theatre, London",
          bookingUrl: "https://www.tickadoo.com/en/london/comedy-night",
          slots: [{ date: "2026-03-30", startTime: "19:30", minPrice: 28, inventoryLevel: 14, availabilityStatus: "LimitedAvailability" }],
        },
        {
          slug: "late-opera",
          title: "Late Opera",
          tags: ["Show", "Theatre"],
          rating: 4.8,
          venueName: "Royal Opera House",
          venueAddress: "Royal Opera House, Bow Street, London",
          bookingUrl: "https://www.tickadoo.com/en/london/late-opera",
          slots: [{ date: "2026-03-30", startTime: "21:00", minPrice: 54, inventoryLevel: 4 }],
        },
      ],
    });

    expect(result.tonight).toHaveLength(3);
    expect(result.tonight.map(entry => entry.slug)).toEqual([
      "comedy-night",
      "museum-lates",
      "late-opera",
    ]);
    expect(result.tonight[0].starts_in).toBe("2h 30m");
    expect(result.tonight[0].urgency).toBe("selling_fast");
    expect(result.tonight[1].venue.name).toBe("Natural History Museum");
    expect(result.tonight[2].urgency).toBe("last_few_tickets");
    expect(result._summary).toMatch(/3 shows tonight in London/i);
  });

  it("formats text output and JSON payload with countdowns, venue info, and urgency enums", () => {
    const result = buildTonightResult({
      city: "new-york",
      date: "2026-11-12",
      currentTime: "16:00",
      experiences: [
        {
          slug: "hamilton",
          title: "Hamilton",
          tags: ["Evening", "Show", "Musical"],
          rating: 4.9,
          venueName: "Richard Rodgers Theatre",
          venueAddress: "226 W 46th St, New York",
          bookingUrl: "https://www.tickadoo.com/en/new-york/hamilton",
          slots: [{ date: "2026-11-12", startTime: "19:30", minPrice: 125, inventoryLevel: 3 }],
          currency: "USD",
        },
      ],
    });

    const payload = toWhatsOnTonightPayload(result);
    const text = formatTonightText(result);

    expect(payload.tonight[0].urgency).toBe("last_few_tickets");
    expect(payload.tonight[0].start_time).toBe("19:30");
    expect(payload.tonight[0].booking_url).toBe("https://www.tickadoo.com/en/new-york/hamilton");
    expect(text).toContain("Tonight in New York");
    expect(text).toContain("starts in 3h 30m");
    expect(text).toContain("Richard Rodgers Theatre");
    expect(text).toContain("Last few tickets!");
  });

  it("registers the tool, returns tonight listings in JSON, and documents it in llms docs", async () => {
    const server = createTickadooServer() as any;
    const tool = server._registeredTools.whats_on_tonight;

    expect(tool).toBeTruthy();
    expect(tool.inputSchema.shape.city._def.typeName).toBe("ZodString");
    expect(tool.inputSchema.shape.format._def.innerType._def.innerType._def.values).toEqual(["text", "json"]);

    const result = await tool.handler({
      city: "london",
      format: "json",
    });

    expect(result.isError).not.toBe(true);
    const json = JSON.parse(firstTextContent(result));

    expect(getProductsForCitySlugMock).toHaveBeenCalledWith(
      "london",
      "en",
      expect.objectContaining({
        dateFrom: "2026-03-30",
        dateTo: "2026-03-30",
      }),
    );
    expect(json.tonight.map((entry: { slug: string }) => entry.slug)).toEqual([
      "comedy-night",
      "museum-lates",
      "late-opera",
    ]);
    expect(json.tonight[0].starts_in).toBe("2h 30m");
    expect(json.tonight[0].urgency).toBe("selling_fast");
    expect(json.tonight[2].urgency).toBe("last_few_tickets");
    expect(json.tonight[0].booking_url).toContain("https://www.tickadoo.com/en/london/comedy-night");
    expect(json._summary).toMatch(/Comedy Night Show starts in 2h 30m/);
    expect(result.structuredContent.tonight).toHaveLength(3);

    const shortDoc = buildLlmsTxt();
    const fullDoc = buildLlmsFullTxt();
    expect(shortDoc).toContain("whats_on_tonight");
    expect(fullDoc).toContain("whats_on_tonight");
    expect(fullDoc).toContain("use whats_on_tonight(city)");
  });
});
