import { describe, expect, it } from "vitest";

import { filterProductsByPrice } from "../src/shared/server.js";
import type { Product } from "../src/shared/types.js";

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: "product-id",
    cityId: "city-id",
    slug: "product-slug",
    title: "Product",
    description: null,
    desktopFeatureImageUrl: null,
    verticalImageUrl: null,
    provider: "Provider",
    providerId: "provider-id",
    averageRating: 4.5,
    currency: "GBP",
    address: null,
    minPrice: 25,
    ...overrides,
  };
}

describe("filterProductsByPrice", () => {
  it("includes free and null-priced experiences when min_price is omitted or zero", () => {
    const products = [
      makeProduct({ slug: "free", minPrice: 0 }),
      makeProduct({ slug: "unknown", minPrice: null }),
      makeProduct({ slug: "paid", minPrice: 25 }),
      makeProduct({ slug: "too-expensive", minPrice: 80 }),
    ];

    expect(filterProductsByPrice(products, undefined, 30).map(product => product.slug)).toEqual([
      "free",
      "unknown",
      "paid",
    ]);

    expect(filterProductsByPrice(products, 0, 30).map(product => product.slug)).toEqual([
      "free",
      "unknown",
      "paid",
    ]);
  });

  it("excludes free and null-priced experiences when min_price is above zero", () => {
    const products = [
      makeProduct({ slug: "free", minPrice: 0 }),
      makeProduct({ slug: "unknown", minPrice: null }),
      makeProduct({ slug: "cheap", minPrice: 15 }),
      makeProduct({ slug: "premium", minPrice: 60 }),
    ];

    expect(filterProductsByPrice(products, 10, 50).map(product => product.slug)).toEqual([
      "cheap",
    ]);
  });
});
