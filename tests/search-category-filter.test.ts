import { describe, expect, it } from "vitest";

import { filterProductsByCategory } from "../src/shared/server.js";
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

type UnsafeCategoryProduct = Omit<Product, "slug" | "title" | "description"> & {
  slug: string | null;
  title: string | null;
  description: string | null;
};

describe("filterProductsByCategory", () => {
  it("matches canonical categories using title, description, and slug keywords", () => {
    const products = [
      makeProduct({
        slug: "hamilton-west-end-musical",
        title: "Hamilton",
        description: "Award-winning West End musical tickets in London.",
      }),
      makeProduct({
        slug: "best-in-stand-up-comedy",
        title: "The Best In Stand Up",
        description: "An evening of top comedy with leading comedians.",
      }),
      makeProduct({
        slug: "big-bus-city-tour",
        title: "Big Bus Tour",
        description: "Hop-on-hop-off sightseeing tour of the city.",
      }),
    ];

    expect(filterProductsByCategory(products, "musicals").map(product => product.slug)).toEqual([
      "hamilton-west-end-musical",
    ]);
    expect(filterProductsByCategory(products, "comedy").map(product => product.slug)).toEqual([
      "best-in-stand-up-comedy",
    ]);
    expect(filterProductsByCategory(products, "tours").map(product => product.slug)).toEqual([
      "big-bus-city-tour",
    ]);
  });

  it("handles fuzzy singular or alias category inputs", () => {
    const products = [
      makeProduct({
        slug: "mean-girls-the-musical",
        title: "Mean Girls the Musical",
        description: "A fetch West End musical comedy.",
      }),
      makeProduct({
        slug: "night-club-cabaret",
        title: "Cabaret Night Out",
        description: "Late-night cabaret with cocktails and live performances.",
      }),
    ];

    expect(filterProductsByCategory(products, "musical").map(product => product.slug)).toEqual([
      "mean-girls-the-musical",
    ]);
    expect(filterProductsByCategory(products, "night life").map(product => product.slug)).toEqual([
      "night-club-cabaret",
    ]);
  });

  it("matches the extended Gemini-facing category enum values", () => {
    const products = [
      makeProduct({
        slug: "park-bike-adventure",
        title: "Park Bike Adventure",
        description: "An outdoor cycling route through gardens and scenic viewpoints.",
      }),
      makeProduct({
        slug: "pasta-making-workshop",
        title: "Pasta Workshop",
        description: "Hands-on cooking class with a local chef.",
      }),
      makeProduct({
        slug: "sunset-harbour-cruise",
        title: "Sunset Harbour Cruise",
        description: "Evening boat cruise with skyline views.",
      }),
      makeProduct({
        slug: "stadium-sports-tour",
        title: "Stadium Matchday Experience",
        description: "Sports fans can explore the stadium and game-day highlights.",
      }),
    ];

    expect(filterProductsByCategory(products, "outdoor").map(product => product.slug)).toEqual([
      "park-bike-adventure",
    ]);
    expect(filterProductsByCategory(products, "workshops").map(product => product.slug)).toEqual([
      "pasta-making-workshop",
    ]);
    expect(filterProductsByCategory(products, "cruises").map(product => product.slug)).toEqual([
      "sunset-harbour-cruise",
    ]);
    expect(filterProductsByCategory(products, "sports").map(product => product.slug)).toEqual([
      "stadium-sports-tour",
    ]);
  });

  it("does not throw when the API returns null string fields", () => {
    const products: UnsafeCategoryProduct[] = [
      {
        ...makeProduct({
          title: "Paddington The Musical",
          description: "The world's most lovable bear takes centre stage in this brand-new West End musical.",
        }),
        slug: null,
      },
      {
        ...makeProduct({
          slug: "london-bike-tour",
          title: "London Bike Tour",
        }),
        description: null,
      },
      {
        ...makeProduct({
          slug: "mystery-experience",
          description: null,
        }),
        title: null,
      },
    ];

    expect(() => filterProductsByCategory(products as Product[], "tours")).not.toThrow();
    expect(filterProductsByCategory(products as Product[], "tours").map(product => product.slug)).toEqual([
      "london-bike-tour",
    ]);
    expect(() => filterProductsByCategory(products as Product[], "musicals")).not.toThrow();
  });
});
