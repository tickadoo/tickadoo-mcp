import { describe, expect, it } from "vitest";

import {
  appendNextStepHint,
  cityDirectoryJsonPayload,
  experienceDetailsJsonPayload,
  formatCancellation,
  formatDidYouMeanRecovery,
  formatEmptyCategoryRecovery,
  formatDuration,
  formatExperienceDetails,
  formatJsonText,
  formatNearbyEmptyRecovery,
  formatNoCoverageRecovery,
  formatOmittedResultsHint,
  formatProduct,
  formatSearchFiltersLine,
  formatSearchSortLine,
  nearbyJsonPayload,
  productJsonData,
  productStructuredData,
  searchJsonPayload,
  summarizeProductDescription,
} from "../src/shared/format.js";
import { normalizeCurrencyCode } from "../src/shared/api.js";
import type { McpProduct, Product } from "../src/shared/types.js";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-id",
    cityId: "city-id",
    slug: "product-slug",
    title: "Product",
    description: "A short description.",
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/product.jpg",
    verticalImageUrl: null,
    provider: "Provider",
    providerId: "provider-id",
    averageRating: 4.5,
    currency: "GBP",
    address: "123 Example Street, London",
    minPrice: 25,
    ...overrides,
  };
}

function makeMcpProduct(overrides: Partial<McpProduct> = {}): McpProduct {
  return {
    niceId: 5917,
    name: "Product",
    url: "https://www.tickadoo.com/london/product-slug",
    minPrice: 25,
    reviewRating: 4.7,
    reviewCount: 21,
    indoorOutdoor: "Indoor",
    physicalLevel: "Easy",
    audience: ["Couples", "Solo"],
    tags: ["MustSee"],
    wheelchairAccessible: false,
    strollerFriendly: true,
    languageOptions: ["en", "fr"],
    variants: [
      {
        niceId: 2,
        name: "Standard",
        duration: "01:30:00",
        ageMinimum: 12,
        groupSizeMin: 1,
        groupSizeMax: 6,
        cancellationPolicy: "BeforeTimeslot",
        cancellationPeriod: "12:00:00",
      },
    ],
    ...overrides,
  };
}

describe("summarizeProductDescription", () => {
  it("returns undefined for nullish or blank values", () => {
    expect(summarizeProductDescription(null)).toBeUndefined();
    expect(summarizeProductDescription(undefined)).toBeUndefined();
    expect(summarizeProductDescription("   \n   ")).toBeUndefined();
  });

  it("normalizes whitespace and keeps short descriptions intact", () => {
    expect(summarizeProductDescription("  A fun   walking tour.\nWith local stories.  ")).toBe(
      "A fun walking tour. With local stories.",
    );
  });

  it("caps long descriptions at 150 characters with an ellipsis", () => {
    const longDescription = "A".repeat(80) + " " + "B".repeat(80) + " " + "C".repeat(80);
    const summary = summarizeProductDescription(longDescription);

    expect(summary).toBeTruthy();
    expect(summary!.length).toBeLessThanOrEqual(150);
    expect(summary).toMatch(/\.\.\.$/);
  });
});

describe("product formatting", () => {
  it("formats duration and cancellation helpers from .NET timespans", () => {
    expect(formatDuration("01:30:00")).toBe("1h 30m");
    expect(formatDuration("00:45:00")).toBe("45m");
    expect(formatDuration("03:00:00")).toBe("3h");
    expect(formatDuration("2.00:00:00")).toBe("2 days");
    expect(formatCancellation("BeforeTimeslot", "12:00:00")).toBe("Free cancellation up to 12h before");
    expect(formatCancellation("BeforeTimeslot", "2.00:00:00")).toBe("Free cancellation up to 2 days before");
    expect(formatCancellation("Never", null)).toBe("Non-refundable");
    expect(formatCancellation("Unknown", null)).toBeNull();
  });

  it("normalizes ISO currency codes and infers them from symbols", () => {
    expect(normalizeCurrencyCode("gbp")).toBe("GBP");
    expect(normalizeCurrencyCode("£")).toBe("GBP");
    expect(normalizeCurrencyCode("€")).toBe("EUR");
    expect(normalizeCurrencyCode("$")).toBe("USD");
  });

  it("appends next-step hints as a final line when provided", () => {
    expect(appendNextStepHint("Body", "💡 Tip: Try another tool.")).toBe("Body\n\n💡 Tip: Try another tool.");
    expect(appendNextStepHint("Body")).toBe("Body");
  });

  it("formats misspelling recovery guidance with nearby cities", () => {
    expect(formatDidYouMeanRecovery("Birminghan", { name: "Birmingham", slug: "birmingham" }, [
      { name: "London", slug: "london", distanceKm: 180.2, experienceCount: 546 },
    ])).toContain("💡 Did you mean Birmingham? Try: search_experiences(city: 'Birmingham')");
    expect(formatDidYouMeanRecovery("Birminghan", { name: "Birmingham", slug: "birmingham" }, [
      { name: "London", slug: "london", distanceKm: 180.2, experienceCount: 546 },
    ])).toContain("  • London (180km) — 546 experiences");
  });

  it("formats no-coverage recovery guidance with nearby cities", () => {
    expect(formatNoCoverageRecovery("Oxford", [
      { name: "London", slug: "london", distanceKm: 92.6, experienceCount: 546 },
    ])).toContain("tickadoo doesn't have experiences in \"Oxford\" yet.");
    expect(formatNoCoverageRecovery("Oxford", [
      { name: "London", slug: "london", distanceKm: 92.6, experienceCount: 546 },
    ])).toContain("  • London (93km) — 546 experiences");
  });

  it("formats nearby empty-state recovery with a bigger radius and nearest city", () => {
    expect(formatNearbyEmptyRecovery(5, 10, { name: "London" })).toContain("💡 Try increasing the radius to 10km, or search in London.");
    expect(formatNearbyEmptyRecovery(5, 10, { name: "London" })).toContain("Try: search_experiences(city: 'London')");
  });

  it("formats empty-category recovery with available categories", () => {
    expect(formatEmptyCategoryRecovery("opera", "Las Vegas", ["shows", "comedy", "tours"])).toBe(
      "No opera experiences in Las Vegas.\n\nAvailable categories: shows, comedy, tours.",
    );
  });

  it("includes the summarized description in structured search output", () => {
    const description = "Experience a dazzling 60-minute cabaret journey through pop culture with live vocals, bold choreography, and immersive staging.";
    const product = makeProduct({ description, mcpProduct: makeMcpProduct() });

    expect(productStructuredData({ ...product, popular: true }, product.slug, "de")).toMatchObject({
      tickadooProductId: "product-id",
      slug: "product-slug",
      title: "Product",
      description,
      popular: true,
      priceAmount: 25,
      priceCurrency: "GBP",
      duration: "1h 30m",
      reviewCount: 21,
      tags: ["MustSee"],
      audience: ["Couples", "Solo"],
      indoorOutdoor: "Indoor",
      physicalLevel: "Easy",
      cancellation: "Free cancellation up to 12h before",
      bookingUrl: "https://www.tickadoo.com/de/product-slug?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    });
  });

  it("builds structured json payloads for search and nearby results", () => {
    const product = makeProduct({ slug: "ghost-tour", mcpProduct: makeMcpProduct() });

    expect(productJsonData({ ...product, popular: true }, product.slug, "de")).toMatchObject({
      title: "Product",
      slug: "ghost-tour",
      popular: true,
      duration: "1h 30m",
      review_count: 21,
      tags: ["MustSee"],
      audience: ["Couples", "Solo"],
      indoor_outdoor: "Indoor",
      physical_level: "Easy",
      cancellation: "Free cancellation up to 12h before",
      booking_url: "https://www.tickadoo.com/de/ghost-tour?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
      price: {
        amount: 25,
        currency: "GBP",
      },
      location: {
        address: "123 Example Street, London",
      },
    });

    expect(searchJsonPayload("london", "London", 10, [{ ...product, popular: true }], {
      language: "de",
      sort: "popular",
      filters: {
        query: "ghost tour",
        maxPrice: 50,
        language: "de",
      },
      omittedResults: {
        total: 9,
        reasons: [
          { filter: "price", count: 9, reason: "outside price range" },
        ],
      },
    })).toMatchObject({
      city: "london",
      city_name: "London",
      sort: "popular",
      total: 10,
      showing: 1,
      filters: {
        query: "ghost tour",
        max_price: 50,
        language: "de",
      },
      omitted_results: {
        total: 9,
        reasons: [
          {
            filter: "price",
            count: 9,
            reason: "outside price range",
          },
        ],
      },
      view_all_url: "https://www.tickadoo.com/de/london?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    });

    expect(nearbyJsonPayload(51.5, -0.1, 5, 10, [product], "de")).toMatchObject({
      latitude: 51.5,
      longitude: -0.1,
      radius_km: 5,
      total: 10,
      showing: 1,
    });
  });

  it("builds structured json payloads for city lists and details", () => {
    expect(cityDirectoryJsonPayload("paris", 3, [{ name: "PARIS", slug: "paris" }], "de")).toMatchObject({
      query: "paris",
      total: 3,
      showing: 1,
      results: [
        {
          name: "PARIS",
          slug: "paris",
          booking_url: "https://www.tickadoo.com/de/paris?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
        },
      ],
    });

    const detailsPayload = experienceDetailsJsonPayload(7, {
      desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
      mobileFeatureImageUrl: "https://cdn.tickadoo.com/example/mobile.jpg",
      currencyCode: "GBP",
      address: "Riverside Building",
      locationWithAddress: {
        latitude: 51.5,
        longitude: -0.1,
        address: "Riverside Building",
      },
      dates: [
        {
          date: "2026-03-21",
          endDate: "2026-03-21",
          minPrice: 25,
          variantName: "Standard",
        },
      ],
      mcpProduct: makeMcpProduct(),
    }, {
      title: "London Dungeon",
      slug: "london-dungeon-tickets",
      bookingPath: "london/london-dungeon-tickets",
      language: "de",
    });

    expect(detailsPayload).toMatchObject({
      title: "London Dungeon",
      slug: "london-dungeon-tickets",
      booking_url: "https://www.tickadoo.com/de/london/london-dungeon-tickets?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
      days: 7,
      currency: "GBP",
      duration: "1h 30m",
      review_count: 21,
      tags: ["MustSee"],
      audience: ["Couples", "Solo"],
      indoor_outdoor: "Indoor",
      physical_level: "Easy",
      cancellation: "Free cancellation up to 12h before",
      wheelchair_accessible: false,
      stroller_friendly: true,
      language_options: ["en", "fr"],
      age_minimum: 12,
      group_size: {
        min: 1,
        max: 6,
      },
      variants: [
        {
          name: "Standard",
          duration: "1h 30m",
          cancellation: "Free cancellation up to 12h before",
          age_minimum: 12,
          group_size: {
            min: 1,
            max: 6,
          },
        },
      ],
      availability: {
        total_price_points: 1,
        total_dates: 1,
      },
    });

    expect(detailsPayload).not.toHaveProperty("google_place_id");
    expect(detailsPayload._accessibility).not.toHaveProperty("google_place_id");

    const payloadWithPlaceId = experienceDetailsJsonPayload(7, {
      desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
      mobileFeatureImageUrl: "https://cdn.tickadoo.com/example/mobile.jpg",
      currencyCode: "GBP",
      address: "Riverside Building",
      locationWithAddress: {
        latitude: 51.5,
        longitude: -0.1,
        address: "Riverside Building",
      },
      dates: [
        {
          date: "2026-03-21",
          endDate: "2026-03-21",
          minPrice: 25,
          variantName: "Standard",
        },
      ],
      mcpProduct: makeMcpProduct({ googlePlaceId: "ChIJ123examplePlaceId" }),
    }, {
      title: "London Dungeon",
      slug: "london-dungeon-tickets",
      bookingPath: "london/london-dungeon-tickets",
      language: "de",
    });

    expect(payloadWithPlaceId.google_place_id).toBe("ChIJ123examplePlaceId");
    expect(payloadWithPlaceId._accessibility?.google_place_id).toBe("ChIJ123examplePlaceId");
  });

  it("adds enriched fields to text search and details output", () => {
    const product = makeProduct({ mcpProduct: makeMcpProduct() });
    const productText = formatProduct(product, "london/product-slug", "de");
    expect(productText).toContain("⏱️ Duration: 1h 30m");
    expect(productText).toContain("🗳️ 21 reviews");
    expect(productText).toContain("🏷️ Tags: Must See");
    expect(productText).toContain("👥 Audience: Couples · Solo");
    expect(productText).toContain("↩️ Cancellation: Free cancellation up to 12h before");

    const detailsText = formatExperienceDetails(7, {
      desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
      mobileFeatureImageUrl: "https://cdn.tickadoo.com/example/mobile.jpg",
      currencyCode: "GBP",
      address: "Riverside Building",
      locationWithAddress: {
        latitude: 51.5,
        longitude: -0.1,
        address: "Riverside Building",
      },
      dates: [
        {
          date: "2026-03-21",
          endDate: "2026-03-21",
          minPrice: 25,
          variantName: "Standard",
        },
      ],
      mcpProduct: makeMcpProduct({ googlePlaceId: "ChIJ123examplePlaceId" }),
    });
    expect(detailsText).toContain("♿ Wheelchair accessible: No");
    expect(detailsText).toContain("🍼 Stroller friendly: Yes");
    expect(detailsText).toContain("🗣️ Languages: EN · FR");
    expect(detailsText).toContain("🗺️ Google Place ID: ChIJ123examplePlaceId");
    expect(detailsText).toContain("Variant details:");
    expect(detailsText).toContain("• Standard");
  });

  it("renders json payloads as pretty-printed text", () => {
    expect(formatJsonText({ hello: "world" })).toBe('{\n  "hello": "world"\n}');
  });

  it("formats search filter echoes and omitted-results hints", () => {
    expect(formatSearchFiltersLine({
      category: "tours",
      maxPrice: 50,
      language: "de",
    })).toBe("🔎 Filters: category=tours, max_price=50, language=de");
    expect(formatSearchSortLine("popular")).toBe("🔀 Sort: popular");
    expect(formatSearchSortLine("relevance")).toBeUndefined();

    expect(formatOmittedResultsHint({
      total: 196,
      reasons: [
        { filter: "price", count: 150, reason: "outside price range" },
        { filter: "category", count: 46, reason: "didn't match category" },
      ],
    })).toBe("💡 196 experiences were filtered out (150 outside price range, 46 didn't match category)");
  });

  it("uses the summarized one-line description in visible result cards", () => {
    const longDescription = "Discover London's haunted alleys, chilling legends, historic pubs, and theatrical storytelling on this unforgettable after-dark walking tour through the city's eeriest corners.";
    const product = makeProduct({ title: "Ghost Tour", description: longDescription });
    const summary = summarizeProductDescription(longDescription);

    expect(summary).toBeTruthy();
    expect(formatProduct(product, product.slug, "de")).toContain(`   ${summary}`);
    expect(formatProduct(product, product.slug, "de")).toContain("   🔖 Slug: product-slug");
    expect(formatProduct(product, product.slug, "de")).toContain("https://www.tickadoo.com/de/product-slug");
    expect(formatProduct(product, product.slug, "de")).not.toContain(longDescription);
  });
});
