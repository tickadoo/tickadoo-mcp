import { beforeEach, describe, expect, it, vi } from "vitest";

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
  resolveProductBySlug: vi.fn(async () => null),
  heuristicEnrich: vi.fn(product => product),
  normalizeSlugOrPath: (value: string) => value.trim().replace(/^\/+|\/+$/g, ""),
}));

import { createTickadooServer } from "../src/shared/server.js";

function firstTextContent(result: { content?: Array<{ type?: string; text?: string }> }): string {
  return result.content?.find(item => item.type === "text")?.text ?? "";
}

function upcomingIsoDate(daysAhead = 10): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

function buildProduct(input: {
  slug: string;
  title: string;
  minPrice: number;
  address: string;
  averageRating?: number;
}) {
  return {
    id: input.slug,
    cityId: "london",
    slug: input.slug,
    title: input.title,
    description: `${input.title} in London`,
    desktopFeatureImageUrl: null,
    verticalImageUrl: null,
    provider: "tickadoo",
    providerId: input.slug,
    averageRating: input.averageRating ?? 4.7,
    currency: "GBP",
    address: input.address,
  };
}

function buildMcpProduct(input: {
  slug: string;
  title: string;
  minPrice: number;
  rating?: number;
  reviewCount?: number;
  indoorOutdoor: "Indoor" | "Outdoor" | "Mixed";
  physicalLevel: "Easy" | "Moderate" | "Demanding";
  audience: string[];
  tags: string[];
  wheelchairAccessible: boolean;
  strollerFriendly: boolean;
  duration: string;
}) {
  return {
    niceId: input.slug.length + input.title.length,
    name: input.title,
    url: input.slug,
    minPrice: input.minPrice,
    reviewRating: input.rating ?? 4.7,
    reviewCount: input.reviewCount ?? 1000,
    indoorOutdoor: input.indoorOutdoor,
    physicalLevel: input.physicalLevel,
    audience: input.audience,
    tags: input.tags,
    wheelchairAccessible: input.wheelchairAccessible,
    strollerFriendly: input.strollerFriendly,
    languageOptions: ["en"],
    variants: [
      {
        niceId: 1,
        name: "Standard",
        duration: input.duration,
        ageMinimum: null,
        groupSizeMin: null,
        groupSizeMax: null,
        cancellationPolicy: "Unknown" as const,
        cancellationPeriod: null,
      },
    ],
  };
}

function buildDetails(input: {
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  minPrice: number;
}) {
  return {
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
    mobileFeatureImageUrl: "https://cdn.tickadoo.com/example/mobile.jpg",
    currencyCode: "GBP",
    address: input.address,
    locationWithAddress: {
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
    },
    dates: [
      {
        date: input.date,
        endDate: input.date,
        minPrice: input.minPrice,
        variantName: "Standard",
      },
    ],
  };
}

describe("get_family_day tool", () => {
  beforeEach(() => {
    getCitiesMock.mockReset();
    getExperienceDetailsMock.mockReset();
    getMcpEnrichedProductsMock.mockReset();
    getProductsForCitySlugMock.mockReset();

    getCitiesMock.mockResolvedValue([]);
    getMcpEnrichedProductsMock.mockResolvedValue(new Map());
    getProductsForCitySlugMock.mockResolvedValue([]);
  });

  it("registers get_family_day with the expected schema", () => {
    const server = createTickadooServer() as any;
    const tool = server._registeredTools.get_family_day;
    const schema = tool.inputSchema.shape;

    expect(tool).toBeTruthy();
    expect(schema.city.isOptional()).toBe(false);
    expect(schema.kids_ages._def.typeName).toBe("ZodOptional");
    expect(schema.kids_ages._def.innerType._def.typeName).toBe("ZodArray");
    expect(schema.format._def.innerType._def.innerType._def.values).toEqual(["text", "json"]);
  });

  it("returns a clustered, toddler-friendly JSON family day", async () => {
    const requestedDate = upcomingIsoDate();
    const products = [
      buildProduct({
        slug: "story-garden",
        title: "Story Garden",
        minPrice: 18,
        address: "South Bank, London",
      }),
      buildProduct({
        slug: "aquarium-world",
        title: "Aquarium World",
        minPrice: 25,
        address: "South Bank, London",
      }),
      buildProduct({
        slug: "skyline-climb",
        title: "Skyline Climb",
        minPrice: 42,
        address: "North Greenwich, London",
      }),
    ];

    getProductsForCitySlugMock.mockImplementation(async (slug: string, _language: string, dates?: { dateFrom?: string; dateTo?: string }) => (
      slug === "london" && dates?.dateFrom === requestedDate && dates?.dateTo === requestedDate
        ? products
        : []
    ));

    getMcpEnrichedProductsMock.mockResolvedValue(new Map([
      [
        "story-garden",
        buildMcpProduct({
          slug: "story-garden",
          title: "Story Garden",
          minPrice: 18,
          indoorOutdoor: "Mixed",
          physicalLevel: "Easy",
          audience: ["Family", "Kids"],
          tags: ["KidsAttraction", "Family", "Outdoor", "Morning", "Garden"],
          wheelchairAccessible: true,
          strollerFriendly: true,
          duration: "1h 15m",
          reviewCount: 1400,
        }),
      ],
      [
        "aquarium-world",
        buildMcpProduct({
          slug: "aquarium-world",
          title: "Aquarium World",
          minPrice: 25,
          indoorOutdoor: "Indoor",
          physicalLevel: "Easy",
          audience: ["Family", "Kids"],
          tags: ["KidsAttraction", "Family", "Interactive"],
          wheelchairAccessible: true,
          strollerFriendly: true,
          duration: "2h",
          reviewCount: 1800,
        }),
      ],
      [
        "skyline-climb",
        buildMcpProduct({
          slug: "skyline-climb",
          title: "Skyline Climb",
          minPrice: 42,
          indoorOutdoor: "Outdoor",
          physicalLevel: "Demanding",
          audience: ["Teens"],
          tags: ["Adventure", "Outdoor"],
          wheelchairAccessible: false,
          strollerFriendly: false,
          duration: "2h 30m",
          reviewCount: 2200,
        }),
      ],
    ]));

    getExperienceDetailsMock.mockImplementation(async (_provider: string, providerId: string) => {
      if (providerId === "story-garden") {
        return buildDetails({
          date: requestedDate,
          address: "South Bank, London",
          latitude: 51.506,
          longitude: -0.116,
          minPrice: 18,
        });
      }

      if (providerId === "aquarium-world") {
        return buildDetails({
          date: requestedDate,
          address: "South Bank, London",
          latitude: 51.503,
          longitude: -0.119,
          minPrice: 25,
        });
      }

      return buildDetails({
        date: requestedDate,
        address: "North Greenwich, London",
        latitude: 51.5,
        longitude: 0.005,
        minPrice: 42,
      });
    });

    const server = createTickadooServer() as any;
    const result = await server._registeredTools.get_family_day.handler({
      city: "London",
      kids_ages: [2, 8],
      date: requestedDate,
      budget: 80,
      format: "json",
    });

    expect(result.isError).not.toBe(true);

    const json = JSON.parse(firstTextContent(result));
    const selectedSlugs = [
      json.plan.morning.slug,
      json.plan.afternoon.slug,
    ].sort();

    expect(selectedSlugs).toEqual(["aquarium-world", "story-garden"]);
    expect(json.plan.evening).toBeNull();
    expect(json.plan.lunch_tip).toContain("South Bank");
    expect(json.all_wheelchair_accessible).toBe(true);
    expect(json.total_cost).toBe(43);
    expect(Object.keys(json.booking_urls).sort()).toEqual(["aquarium-world", "story-garden"]);
    expect(Object.keys(json.booking_urls)).not.toContain("skyline-climb");
    expect(result.structuredContent.plan.evening).toBeNull();
  });

  it("adds an evening stop for older kids when a good nearby option exists", async () => {
    const requestedDate = upcomingIsoDate();
    const products = [
      buildProduct({
        slug: "story-garden",
        title: "Story Garden",
        minPrice: 18,
        address: "South Bank, London",
      }),
      buildProduct({
        slug: "aquarium-world",
        title: "Aquarium World",
        minPrice: 25,
        address: "South Bank, London",
      }),
      buildProduct({
        slug: "lantern-show",
        title: "Lantern Show",
        minPrice: 22,
        address: "South Bank, London",
        averageRating: 4.4,
      }),
    ];

    getProductsForCitySlugMock.mockImplementation(async (slug: string) => (
      slug === "london" ? products : []
    ));

    getMcpEnrichedProductsMock.mockResolvedValue(new Map([
      [
        "story-garden",
        buildMcpProduct({
          slug: "story-garden",
          title: "Story Garden",
          minPrice: 18,
          indoorOutdoor: "Outdoor",
          physicalLevel: "Easy",
          audience: ["Family", "Kids"],
          tags: ["KidsAttraction", "Family", "Outdoor", "Interactive"],
          wheelchairAccessible: true,
          strollerFriendly: true,
          duration: "1h 30m",
          reviewCount: 1400,
        }),
      ],
      [
        "aquarium-world",
        buildMcpProduct({
          slug: "aquarium-world",
          title: "Aquarium World",
          minPrice: 25,
          indoorOutdoor: "Indoor",
          physicalLevel: "Easy",
          audience: ["Family", "Kids"],
          tags: ["KidsAttraction", "Family", "Interactive"],
          wheelchairAccessible: true,
          strollerFriendly: true,
          duration: "2h",
          reviewCount: 1800,
        }),
      ],
      [
        "lantern-show",
        buildMcpProduct({
          slug: "lantern-show",
          title: "Lantern Show",
          minPrice: 22,
          indoorOutdoor: "Indoor",
          physicalLevel: "Easy",
          audience: ["Family"],
          tags: ["Family", "Evening", "Show", "Light"],
          wheelchairAccessible: true,
          strollerFriendly: true,
          duration: "1h",
          reviewCount: 900,
          rating: 4.4,
        }),
      ],
    ]));

    getExperienceDetailsMock.mockImplementation(async (_provider: string, providerId: string) => {
      if (providerId === "story-garden") {
        return buildDetails({
          date: requestedDate,
          address: "South Bank, London",
          latitude: 51.506,
          longitude: -0.116,
          minPrice: 18,
        });
      }

      if (providerId === "aquarium-world") {
        return buildDetails({
          date: requestedDate,
          address: "South Bank, London",
          latitude: 51.503,
          longitude: -0.119,
          minPrice: 25,
        });
      }

      return buildDetails({
        date: requestedDate,
        address: "South Bank, London",
        latitude: 51.501,
        longitude: -0.115,
        minPrice: 22,
      });
    });

    const server = createTickadooServer() as any;
    const result = await server._registeredTools.get_family_day.handler({
      city: "london",
      kids_ages: [9, 12],
      format: "text",
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent.plan.evening.slug).toBe("lantern-show");
    expect(firstTextContent(result)).toContain("Evening: Lantern Show");
    expect(result.structuredContent.booking_urls["lantern-show"]).toContain("/en/london/lantern-show");
  });
});
