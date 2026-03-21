import { describe, expect, it } from "vitest";

import { filterProductsByCategory, filterProductsByQuery } from "../src/shared/server.js";
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

type UnsafeQueryProduct = Omit<Product, "title" | "description"> & {
  title: string | null;
  description: string | null;
};

describe("filterProductsByQuery", () => {
  it("matches free-text queries against title and description case-insensitively", () => {
    const products = [
      makeProduct({
        slug: "ghost-tour-edinburgh",
        title: "Edinburgh Ghost Tour",
        description: "Explore haunted closes and dark history with a local guide.",
      }),
      makeProduct({
        slug: "pizza-making-class-rome",
        title: "Roman Cooking Workshop",
        description: "Hands-on pizza making class with a chef in central Rome.",
      }),
      makeProduct({
        slug: "sunset-cruise-dubai",
        title: "Dubai Marina Cruise",
        description: "Watch the skyline glow on a sunset cruise with dinner.",
      }),
    ];

    expect(filterProductsByQuery(products, "ghost tour").map(product => product.slug)).toEqual([
      "ghost-tour-edinburgh",
    ]);
    expect(filterProductsByQuery(products, "pizza making").map(product => product.slug)).toEqual([
      "pizza-making-class-rome",
    ]);
    expect(filterProductsByQuery(products, "sunset cruise").map(product => product.slug)).toEqual([
      "sunset-cruise-dubai",
    ]);
  });

  it("works alongside the existing category filter and ignores null text fields safely", () => {
    const products: UnsafeQueryProduct[] = [
      {
        ...makeProduct({
          slug: "ghost-bus-tour",
          title: "Ghost Bus Tour",
          description: "A theatrical ghost tour through the city after dark.",
        }),
      },
      {
        ...makeProduct({
          slug: "ghost-theatre-show",
          title: "Ghost Stories",
          description: "A supernatural theatre show on stage.",
        }),
      },
      {
        ...makeProduct({
          slug: "mystery-product",
        }),
        title: null,
        description: null,
      },
    ];

    const tours = filterProductsByCategory(products as Product[], "tours");
    expect(filterProductsByQuery(tours, "ghost").map(product => product.slug)).toEqual([
      "ghost-bus-tour",
    ]);
    expect(() => filterProductsByQuery(products as Product[], "ghost")).not.toThrow();
  });
});
