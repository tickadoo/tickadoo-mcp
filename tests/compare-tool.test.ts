import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveProductBySlugMock,
  getExperienceDetailsMock,
  getMcpEnrichedProductsMock,
} = vi.hoisted(() => ({
  resolveProductBySlugMock: vi.fn(),
  getExperienceDetailsMock: vi.fn(),
  getMcpEnrichedProductsMock: vi.fn(),
}));

vi.mock("../src/shared/api.js", () => ({
  buildBookingUrl: (path: string, language = "en") => `https://www.tickadoo.com/${language}/${path}?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp`,
  geocodeCityQuery: vi.fn(async () => null),
  getCities: vi.fn(async () => []),
  getExperienceDetails: getExperienceDetailsMock,
  getMcpEnrichedProducts: getMcpEnrichedProductsMock,
  getNearestCoveredCities: vi.fn(async () => []),
  getProductsByLocation: vi.fn(async () => []),
  getProductsForCitySlug: vi.fn(async () => []),
  resolveProductBySlug: resolveProductBySlugMock,
  heuristicEnrich: vi.fn(product => product),
  normalizeSlugOrPath: (value: string) => value.trim().replace(/^\/+|\/+$/g, ""),
}));

import { createTickadooServer } from "../src/shared/server.js";

function firstTextContent(result: { content?: Array<{ type?: string; text?: string }> }): string {
  return result.content?.find(item => item.type === "text")?.text ?? "";
}

function buildDetails(input: {
  currencyCode?: string;
  minPrice: number;
  rating: number;
  reviewCount: number;
  duration: string;
  cancellationPolicy: "Unknown" | "Never" | "BeforeTimeslot" | "BeforeDate";
  cancellationPeriod?: string | null;
  audience: string[];
  tags: string[];
  wheelchairAccessible: boolean;
  strollerFriendly: boolean;
}) {
  return {
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
    mobileFeatureImageUrl: "https://cdn.tickadoo.com/example/mobile.jpg",
    currencyCode: input.currencyCode ?? "GBP",
    address: "London",
    locationWithAddress: {
      latitude: 51.5,
      longitude: -0.12,
      address: "London",
    },
    dates: [
      {
        date: "2026-03-30",
        endDate: "2026-03-30",
        minPrice: input.minPrice,
        variantName: "Standard",
      },
    ],
    mcpProduct: {
      niceId: 1,
      name: "Test Product",
      url: "test-product",
      minPrice: input.minPrice,
      reviewRating: input.rating,
      reviewCount: input.reviewCount,
      indoorOutdoor: "Indoor",
      physicalLevel: "Easy",
      audience: input.audience,
      tags: input.tags,
      wheelchairAccessible: input.wheelchairAccessible,
      strollerFriendly: input.strollerFriendly,
      languageOptions: ["en", "de"],
      variants: [
        {
          niceId: 1,
          name: "Standard",
          duration: input.duration,
          ageMinimum: null,
          groupSizeMin: null,
          groupSizeMax: null,
          cancellationPolicy: input.cancellationPolicy,
          cancellationPeriod: input.cancellationPeriod ?? null,
        },
      ],
    },
  };
}

describe("compare_experiences tool", () => {
  beforeEach(() => {
    resolveProductBySlugMock.mockReset();
    getExperienceDetailsMock.mockReset();
    getMcpEnrichedProductsMock.mockReset();
    getMcpEnrichedProductsMock.mockResolvedValue(new Map());

    resolveProductBySlugMock.mockImplementation(async (slug: string) => ({
      bookingPath: `london/${slug}`,
      product: {
        id: slug,
        cityId: "london",
        slug,
        title: slug === "hamilton-london" ? "Hamilton" : "Wicked",
        description: null,
        desktopFeatureImageUrl: null,
        verticalImageUrl: null,
        provider: "tickadoo",
        providerId: slug,
        averageRating: slug === "hamilton-london" ? 4.9 : 4.8,
        currency: "GBP",
        address: "London",
        minPrice: slug === "hamilton-london" ? 65 : 54,
      },
    }));

    getExperienceDetailsMock.mockImplementation(async (_provider: string, providerId: string) => {
      if (providerId === "hamilton-london") {
        return buildDetails({
          minPrice: 65,
          rating: 4.9,
          reviewCount: 5400,
          duration: "2h 45m",
          cancellationPolicy: "Never",
          audience: ["Family", "Couples", "Kids"],
          tags: ["Musical", "Bestseller"],
          wheelchairAccessible: true,
          strollerFriendly: true,
        });
      }

      return buildDetails({
        minPrice: 54,
        rating: 4.8,
        reviewCount: 4700,
        duration: "2h 30m",
        cancellationPolicy: "BeforeTimeslot",
        cancellationPeriod: "24h",
        audience: ["Family", "Couples", "Kids"],
        tags: ["Musical", "Family"],
        wheelchairAccessible: true,
        strollerFriendly: true,
      });
    });
  });

  it("registers compare_experiences with the expected array schema", () => {
    const server = createTickadooServer() as any;
    const tool = server._registeredTools.compare_experiences;
    const schema = tool.inputSchema.shape;

    expect(tool).toBeTruthy();
    expect(schema.slugs._def.typeName).toBe("ZodArray");
    expect(schema.slugs._def.minLength?.value).toBe(2);
    expect(schema.slugs._def.maxLength?.value).toBe(5);
    expect(schema.format._def.innerType._def.innerType._def.values).toEqual(["text", "json"]);
  });

  it("returns localized JSON comparisons with winner callouts", async () => {
    const server = createTickadooServer() as any;
    const result = await server._registeredTools.compare_experiences.handler({
      slugs: ["hamilton-london", "wicked-london"],
      language: "de",
      format: "json",
    });

    expect(result.isError).not.toBe(true);
    const json = JSON.parse(firstTextContent(result));

    expect(json.comparison).toHaveLength(2);
    expect(json.comparison.map((entry: { slug: string }) => entry.slug)).toEqual(["hamilton-london", "wicked-london"]);
    expect(json.winner.highest_rated).toBe("hamilton-london");
    expect(json.winner.best_value).toBe("wicked-london");
    expect(json._booking_urls["hamilton-london"]).toContain("https://www.tickadoo.com/de/london/hamilton-london");
    expect(json.differences.join(" ")).toContain("free cancellation");
    expect(result.structuredContent.winner.best_value).toBe("wicked-london");
  });

  it("returns text output and rejects invalid slug counts", async () => {
    const server = createTickadooServer() as any;
    const textResult = await server._registeredTools.compare_experiences.handler({
      slugs: ["hamilton-london", "wicked-london"],
      format: "text",
    });

    expect(textResult.isError).not.toBe(true);
    expect(firstTextContent(textResult)).toContain("Winner callouts");
    expect(firstTextContent(textResult)).toContain("| Metric | Hamilton | Wicked |");
    expect(textResult.structuredContent.comparison).toHaveLength(2);

    const errorResult = await server._registeredTools.compare_experiences.handler({
      slugs: ["hamilton-london"],
      format: "json",
    });

    expect(errorResult.isError).toBe(true);
    expect(firstTextContent(errorResult)).toContain("between 2 and 5 unique slugs");
  });
});
