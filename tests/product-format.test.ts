import { describe, expect, it } from "vitest";

import { appendNextStepHint, formatProduct, productStructuredData, summarizeProductDescription } from "../src/shared/format.js";
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
  it("appends next-step hints as a final line when provided", () => {
    expect(appendNextStepHint("Body", "💡 Tip: Try another tool.")).toBe("Body\n\n💡 Tip: Try another tool.");
    expect(appendNextStepHint("Body")).toBe("Body");
  });

  it("includes the summarized description in structured search output", () => {
    const description = "Experience a dazzling 60-minute cabaret journey through pop culture with live vocals, bold choreography, and immersive staging.";
    const product = makeProduct({ description });

    expect(productStructuredData(product)).toMatchObject({
      tickadooProductId: "product-id",
      slug: "product-slug",
      title: "Product",
      description,
    });
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
