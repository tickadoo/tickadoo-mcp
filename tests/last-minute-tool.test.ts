import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCitiesMock,
  getExperienceDetailsMock,
  getMcpEnrichedProductsMock,
  getProductsByLocationMock,
  getProductsForCitySlugMock,
} = vi.hoisted(() => ({
  getCitiesMock: vi.fn(),
  getExperienceDetailsMock: vi.fn(),
  getMcpEnrichedProductsMock: vi.fn(),
  getProductsByLocationMock: vi.fn(),
  getProductsForCitySlugMock: vi.fn(),
}));

vi.mock("../src/shared/api.js", () => ({
  buildBookingUrl: (path: string, language = "en") => `https://www.tickadoo.com/${language}/${path}?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp`,
  geocodeCityQuery: vi.fn(async () => null),
  getCities: getCitiesMock,
  getExperienceDetails: getExperienceDetailsMock,
  getMcpEnrichedProducts: getMcpEnrichedProductsMock,
  getNearestCoveredCities: vi.fn(async () => []),
  getProductsByLocation: getProductsByLocationMock,
  getProductsForCitySlug: getProductsForCitySlugMock,
  resolveProductBySlug: vi.fn(),
  heuristicEnrich: vi.fn(product => product),
  normalizeSlugOrPath: (value: string) => value.trim().replace(/^\/+|\/+$/g, ""),
}));

import { createTickadooServer } from "../src/shared/server.js";

function firstTextContent(result: { content?: Array<{ type?: string; text?: string }> }): string {
  return result.content?.find(item => item.type === "text")?.text ?? "";
}

function buildProduct(input: {
  cityId?: string;
  slug: string;
  title: string;
  minPrice: number;
  rating: number;
}) {
  return {
    id: input.slug,
    cityId: input.cityId ?? "london",
    slug: input.slug,
    title: input.title,
    description: `${input.title} in London`,
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
    verticalImageUrl: null,
    provider: "tickadoo",
    providerId: input.slug,
    averageRating: input.rating,
    currency: "GBP",
    address: "London",
  };
}

function buildDetails(input: {
  date: string;
  startTime: string;
  minPrice: number;
  ticketsRemaining?: number;
  inventoryLevel?: number;
}) {
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
    dates: [
      {
        date: input.date,
        endDate: input.date,
        minPrice: input.minPrice,
        variantName: "Standard",
        startTime: input.startTime,
        ticketsRemaining: input.ticketsRemaining ?? null,
        inventoryLevel: input.inventoryLevel ?? null,
      },
    ],
    mcpProduct: {
      niceId: 1,
      name: "Test Product",
      url: "test-product",
      minPrice: input.minPrice,
      reviewRating: 4.8,
      reviewCount: 1200,
      indoorOutdoor: "Indoor",
      physicalLevel: "Easy",
      audience: ["Couples"],
      tags: ["Evening"],
      wheelchairAccessible: true,
      strollerFriendly: false,
      languageOptions: ["en"],
      variants: [],
    },
  };
}

describe("get_last_minute tool", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T09:00:00Z"));

    getCitiesMock.mockReset();
    getExperienceDetailsMock.mockReset();
    getMcpEnrichedProductsMock.mockReset();
    getProductsByLocationMock.mockReset();
    getProductsForCitySlugMock.mockReset();

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
    getMcpEnrichedProductsMock.mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers the tool and returns last-minute results sorted by soonest start", async () => {
    getProductsForCitySlugMock.mockResolvedValue([
      buildProduct({
        slug: "late-museum",
        title: "Late Museum Entry",
        minPrice: 18,
        rating: 4.6,
      }),
    ]);
    getProductsByLocationMock.mockResolvedValue([
      buildProduct({
        slug: "jazz-cruise",
        title: "Jazz Cruise",
        minPrice: 35,
        rating: 4.9,
      }),
    ]);
    getExperienceDetailsMock.mockImplementation(async (_provider: string, providerId: string) => {
      if (providerId === "jazz-cruise") {
        return buildDetails({
          date: "2026-03-30",
          startTime: "09:47",
          minPrice: 35,
          ticketsRemaining: 3,
          inventoryLevel: 2,
        });
      }

      return buildDetails({
        date: "2026-03-30",
        startTime: "10:30",
        minPrice: 18,
      });
    });

    const server = createTickadooServer() as any;
    const tool = server._registeredTools.get_last_minute;
    const schema = tool.inputSchema.shape;

    expect(tool).toBeTruthy();
    expect(schema.city).toBeTruthy();
    expect(schema.hours).toBeTruthy();
    expect(schema.latitude._def.typeName).toBe("ZodOptional");
    expect(schema.longitude._def.typeName).toBe("ZodOptional");
    expect(schema.format._def.innerType._def.innerType._def.values).toEqual(["text", "json"]);

    const result = await tool.handler({
      city: "london",
      hours: 3,
      latitude: 51.5,
      longitude: -0.12,
      format: "json",
    });

    expect(result.isError).not.toBe(true);
    const json = JSON.parse(firstTextContent(result));

    expect(json.city).toBe("London");
    expect(json.citySlug).toBe("london");
    expect(json.hours).toBe(3);
    expect(json.results.map((entry: { slug: string }) => entry.slug)).toEqual(["jazz-cruise", "late-museum"]);
    expect(json.results[0].countdownText).toBe("starts in 47 minutes");
    expect(json.results[0].urgencyBadges).toContain("Starting soon");
    expect(json.results[0].urgencyBadges).toContain("Only 3 left");
    expect(json.results[0].highUrgency).toBe(true);
    expect(getProductsForCitySlugMock).toHaveBeenCalledWith("london", "en", {
      dateFrom: "2026-03-30",
      dateTo: "2026-03-30",
    });
    expect(getProductsByLocationMock).toHaveBeenCalledWith(51.5, -0.12, 25, "en", {
      dateFrom: "2026-03-30",
      dateTo: "2026-03-30",
    });
  });
});
