import { describe, expect, it } from "vitest";

import {
  appendNextStepHint,
  cityDirectoryJsonPayload,
  experienceDetailsJsonPayload,
  formatDidYouMeanRecovery,
  formatEmptyCategoryRecovery,
  formatJsonText,
  formatNearbyEmptyRecovery,
  formatNoCoverageRecovery,
  formatProduct,
  nearbyJsonPayload,
  productJsonData,
  productStructuredData,
  searchJsonPayload,
  summarizeProductDescription,
} from "../src/shared/format.js";
import { normalizeCurrencyCode } from "../src/shared/api.js";
import type { Product } from "../src/shared/types.js";

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
    const product = makeProduct({ description });

    expect(productStructuredData(product)).toMatchObject({
      tickadooProductId: "product-id",
      slug: "product-slug",
      title: "Product",
      description,
      priceAmount: 25,
      priceCurrency: "GBP",
    });
  });

  it("builds structured json payloads for search and nearby results", () => {
    const product = makeProduct({ slug: "ghost-tour" });

    expect(productJsonData(product)).toMatchObject({
      title: "Product",
      slug: "ghost-tour",
      booking_url: "https://www.tickadoo.com/ghost-tour?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
      price: {
        amount: 25,
        currency: "GBP",
      },
      location: {
        address: "123 Example Street, London",
      },
    });

    expect(searchJsonPayload("london", "London", 10, [product])).toMatchObject({
      city: "london",
      city_name: "London",
      total: 10,
      showing: 1,
    });

    expect(nearbyJsonPayload(51.5, -0.1, 5, 10, [product])).toMatchObject({
      latitude: 51.5,
      longitude: -0.1,
      radius_km: 5,
      total: 10,
      showing: 1,
    });
  });

  it("builds structured json payloads for city lists and details", () => {
    expect(cityDirectoryJsonPayload("paris", 3, [{ name: "PARIS", slug: "paris" }])).toMatchObject({
      query: "paris",
      total: 3,
      showing: 1,
      results: [
        {
          name: "PARIS",
          slug: "paris",
          booking_url: "https://www.tickadoo.com/paris?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
        },
      ],
    });

    expect(experienceDetailsJsonPayload(7, {
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
    }, {
      title: "London Dungeon",
      slug: "london-dungeon-tickets",
      bookingPath: "london/london-dungeon-tickets",
    })).toMatchObject({
      title: "London Dungeon",
      slug: "london-dungeon-tickets",
      booking_url: "https://www.tickadoo.com/london/london-dungeon-tickets?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
      days: 7,
      currency: "GBP",
      availability: {
        total_price_points: 1,
        total_dates: 1,
      },
    });
  });

  it("renders json payloads as pretty-printed text", () => {
    expect(formatJsonText({ hello: "world" })).toBe('{\n  "hello": "world"\n}');
  });

  it("uses the summarized one-line description in visible result cards", () => {
    const longDescription = "Discover London's haunted alleys, chilling legends, historic pubs, and theatrical storytelling on this unforgettable after-dark walking tour through the city's eeriest corners.";
    const product = makeProduct({ title: "Ghost Tour", description: longDescription });
    const summary = summarizeProductDescription(longDescription);

    expect(summary).toBeTruthy();
    expect(formatProduct(product)).toContain(`   ${summary}`);
    expect(formatProduct(product)).not.toContain(longDescription);
  });
});
