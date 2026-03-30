import { describe, expect, it } from "vitest";

import { buildCityGuide, formatCityGuide } from "../src/shared/city-guide.js";
import type { McpProduct, Product } from "../src/shared/types.js";

function makeMcpProduct(overrides: Partial<McpProduct> = {}): McpProduct {
  return {
    niceId: 1,
    name: "Example product",
    url: "example-product",
    minPrice: 25,
    reviewRating: 4.6,
    reviewCount: 100,
    indoorOutdoor: "Indoor",
    physicalLevel: "Easy",
    audience: ["Couples", "Solo"],
    tags: ["MustSee"],
    wheelchairAccessible: true,
    strollerFriendly: false,
    languageOptions: ["en"],
    variants: [],
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-id",
    cityId: "city-id",
    slug: "product-slug",
    title: "Product",
    description: "A memorable city experience.",
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example.jpg",
    verticalImageUrl: null,
    provider: "tickadoo",
    providerId: "provider-id",
    averageRating: 4.6,
    currency: "GBP",
    address: "London",
    minPrice: 25,
    featured: false,
    mcpProduct: makeMcpProduct(),
    ...overrides,
  };
}

describe("city guide builder", () => {
  it("builds a curated city payload with highlights, pricing, tags, and audiences", () => {
    const products: Product[] = [
      makeProduct({
        slug: "hamilton-london",
        title: "Hamilton",
        description: "Award-winning West End musical in London.",
        averageRating: 4.9,
        minPrice: 45,
        mcpProduct: makeMcpProduct({
          reviewRating: 4.9,
          reviewCount: 5400,
          audience: ["Family", "Couples", "Kids"],
          tags: ["Musical", "WestEnd", "Show"],
        }),
      }),
      makeProduct({
        slug: "thames-evening-cruise",
        title: "Thames Evening Cruise",
        description: "An evening river cruise with skyline views.",
        averageRating: 4.8,
        minPrice: 35,
        mcpProduct: makeMcpProduct({
          reviewRating: 4.8,
          reviewCount: 2100,
          indoorOutdoor: "Outdoor",
          audience: ["Couples", "Solo", "Groups"],
          tags: ["Cruise", "Evening", "MustSee"],
        }),
      }),
      makeProduct({
        slug: "borough-market-food-tour",
        title: "Borough Market Food Tour",
        description: "Guided walking tour through London's best bites.",
        averageRating: 4.7,
        minPrice: 79,
        mcpProduct: makeMcpProduct({
          reviewRating: 4.7,
          reviewCount: 890,
          audience: ["Couples", "Solo", "Groups"],
          tags: ["FoodTour", "WalkingTour", "GuidedTour"],
        }),
      }),
      makeProduct({
        slug: "tower-of-london-tour",
        title: "Tower of London Guided Tour",
        description: "Historic attraction with stories, crowns, and iconic views.",
        averageRating: 4.7,
        minPrice: 28,
        mcpProduct: makeMcpProduct({
          reviewRating: 4.7,
          reviewCount: 3200,
          audience: ["Solo", "Groups", "Seniors"],
          tags: ["WalkingTour", "Museum", "MustSee"],
        }),
      }),
      makeProduct({
        slug: "shrek-adventure-london",
        title: "Shrek's Adventure London",
        description: "Interactive family attraction with live actors and photo moments.",
        averageRating: 4.5,
        minPrice: 32,
        mcpProduct: makeMcpProduct({
          reviewRating: 4.5,
          reviewCount: 1500,
          audience: ["Family", "Kids"],
          tags: ["KidsAttraction", "ThemePark", "Show"],
        }),
      }),
      makeProduct({
        slug: "rooftop-comedy-night",
        title: "Rooftop Comedy Night",
        description: "Late-night laughs and skyline drinks.",
        averageRating: 4.4,
        minPrice: 22,
        mcpProduct: makeMcpProduct({
          reviewRating: 4.4,
          reviewCount: 640,
          audience: ["AdultsOnly", "Couples"],
          tags: ["NightLife", "Comedy", "Rooftop"],
        }),
      }),
    ];

    const guide = buildCityGuide(
      {
        name: "London",
        slug: "london",
        country: "United Kingdom",
      },
      products,
      "de",
    );

    expect(guide.city).toEqual({
      name: "London",
      slug: "london",
      country: "United Kingdom",
      experience_count: 6,
    });
    expect(guide.highlights).toHaveLength(5);
    expect(guide.highlights[0]).toMatchObject({
      slug: "hamilton-london",
      rating: 4.9,
      review_count: 5400,
      booking_url: "https://www.tickadoo.com/de/hamilton-london?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    });
    expect(guide.categories).toMatchObject({
      theatre: 1,
      musicals: 1,
      tours: 2,
      food: 1,
      family: 2,
      nightlife: 2,
      sightseeing: 2,
      comedy: 1,
      shows: 2,
      cruises: 1,
    });
    expect(guide.price_range).toEqual({
      min: 22,
      max: 79,
      median: 33.5,
      currency: "GBP",
    });
    expect(guide.best_for).toEqual([
      "Theatre and musical nights",
      "Walking tours and city orientation",
      "Evening plans and nightlife",
      "Family attractions",
    ]);
    expect(guide.seasonal).toContain("Spring to autumn");
    expect(guide.seasonal).toContain("sell out fastest");
    expect(guide.insider_tips).toContain("Book headline shows at least one to two weeks ahead for the best seat choice and pricing.");
    expect(guide.insider_tips).toContain("Schedule a walking or orientation tour early in the trip so the rest of the stay is easier to plan.");
    expect(guide._top_tags).toMatchObject({
      MustSee: 2,
      Show: 2,
      WalkingTour: 2,
    });
    expect(guide._audience_breakdown).toMatchObject({
      Couples: 4,
      Family: 2,
      Kids: 2,
      Solo: 3,
    });
  });

  it("formats a hotel-friendly city briefing", () => {
    const guide = buildCityGuide(
      {
        name: "Prague",
        slug: "prague",
        country: "Czech Republic",
      },
      [
        makeProduct({
          slug: "prague-castle-tour",
          title: "Prague Castle Tour",
          description: "Historic castle and city views.",
          averageRating: 4.8,
          minPrice: 29,
          currency: "EUR",
          mcpProduct: makeMcpProduct({
            minPrice: 29,
            reviewRating: 4.8,
            reviewCount: 980,
            audience: ["Couples", "Solo", "Groups"],
            tags: ["WalkingTour", "MustSee", "GuidedTour"],
          }),
        }),
      ],
    );

    const text = formatCityGuide(guide);

    expect(text).toContain("Prague, Czech Republic city guide");
    expect(text).toContain("Top highlights:");
    expect(text).toContain("1. Prague Castle Tour (4.8/5, 980 reviews, from EUR 29.00)");
    expect(text).toContain("Categories:");
    expect(text).toContain("Price range: EUR 29.00 to EUR 29.00");
    expect(text).toContain("Insider tips:");
  });
});
