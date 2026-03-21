import { describe, expect, it } from "vitest";

import { isPopularSearchProduct, sortProductsForSearch } from "../src/shared/server.js";
import type { Product } from "../src/shared/types.js";

function makeProduct(overrides: Partial<Product>): Product {
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
    address: null,
    minPrice: 25,
    ...overrides,
  };
}

describe("search sorting", () => {
  it("marks popular experiences using the public ranking contract", () => {
    expect(isPopularSearchProduct(makeProduct({
      slug: "popular-product",
      title: "Popular Product",
    }))).toBe(true);

    expect(isPopularSearchProduct(makeProduct({
      slug: "no-image",
      title: "No Image",
      desktopFeatureImageUrl: null,
      verticalImageUrl: null,
    }))).toBe(false);

    expect(isPopularSearchProduct(makeProduct({
      slug: "no-description",
      title: "No Description",
      description: "   ",
    }))).toBe(false);

    expect(isPopularSearchProduct(makeProduct({
      slug: "low-rating",
      title: "Low Rating",
      averageRating: 3.9,
    }))).toBe(false);
  });

  it("sorts popular results with popular items first and highest rated first", () => {
    const products = [
      makeProduct({
        slug: "top-popular",
        title: "Top Popular",
        averageRating: 4.9,
        minPrice: 45,
      }),
      makeProduct({
        slug: "second-popular",
        title: "Second Popular",
        averageRating: 4.6,
        minPrice: 35,
      }),
      makeProduct({
        slug: "not-popular-no-image",
        title: "Not Popular No Image",
        averageRating: 5.0,
        minPrice: 15,
        desktopFeatureImageUrl: null,
        verticalImageUrl: null,
      }),
      makeProduct({
        slug: "not-popular-no-price",
        title: "Not Popular No Price",
        averageRating: 4.8,
        minPrice: null,
      }),
    ];

    expect(sortProductsForSearch(products, "popular").map(product => product.slug)).toEqual([
      "top-popular",
      "second-popular",
      "not-popular-no-image",
      "not-popular-no-price",
    ]);
  });

  it("supports low-to-high and high-to-low price sorting", () => {
    const products = [
      makeProduct({ slug: "mid", title: "Mid", minPrice: 40, averageRating: 4.2 }),
      makeProduct({ slug: "low", title: "Low", minPrice: 10, averageRating: 4.9 }),
      makeProduct({ slug: "high", title: "High", minPrice: 90, averageRating: 4.1 }),
      makeProduct({ slug: "unpriced", title: "Unpriced", minPrice: null, averageRating: 5.0 }),
    ];

    expect(sortProductsForSearch(products, "price_low").map(product => product.slug)).toEqual([
      "low",
      "mid",
      "high",
      "unpriced",
    ]);

    expect(sortProductsForSearch(products, "price_high").map(product => product.slug)).toEqual([
      "high",
      "mid",
      "low",
      "unpriced",
    ]);
  });

  it("supports rating sorting with higher rated products first", () => {
    const products = [
      makeProduct({ slug: "four-two", title: "Four Two", averageRating: 4.2, minPrice: 25 }),
      makeProduct({ slug: "four-eight", title: "Four Eight", averageRating: 4.8, minPrice: 55 }),
      makeProduct({ slug: "no-rating", title: "No Rating", averageRating: null, minPrice: 10 }),
    ];

    expect(sortProductsForSearch(products, "rating").map(product => product.slug)).toEqual([
      "four-eight",
      "four-two",
      "no-rating",
    ]);
  });
});
