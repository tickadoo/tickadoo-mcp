import { describe, expect, it } from "vitest";

import {
  buildComparisonPayload,
  formatComparisonText,
  type ComparableExperience,
} from "../src/shared/compare.js";

const sampleExperiences: ComparableExperience[] = [
  {
    slug: "hamilton-london",
    title: "Hamilton",
    priceFrom: 65,
    currency: "GBP",
    duration: "2h 45m",
    rating: 4.9,
    reviewCount: 5400,
    tags: ["Musical", "Bestseller", "Evening"],
    audience: ["Family", "Couples", "Kids"],
    wheelchairAccessible: true,
    strollerFriendly: true,
    cancellationPolicy: "Non-refundable",
    bookingUrl: "https://www.tickadoo.com/en/london/hamilton-london?utm_source=mcp",
  },
  {
    slug: "wicked-london",
    title: "Wicked",
    priceFrom: 54,
    currency: "GBP",
    duration: "2h 30m",
    rating: 4.8,
    reviewCount: 4700,
    tags: ["Musical", "Family", "Popular"],
    audience: ["Family", "Couples", "Kids"],
    wheelchairAccessible: true,
    strollerFriendly: true,
    cancellationPolicy: "Free cancellation up to 24h before",
    bookingUrl: "https://www.tickadoo.com/en/london/wicked-london?utm_source=mcp",
  },
  {
    slug: "cabaret-london",
    title: "Cabaret",
    priceFrom: 89,
    currency: "GBP",
    duration: "2h 40m",
    rating: 4.6,
    reviewCount: 980,
    tags: ["Show", "NightLife"],
    audience: ["AdultsOnly", "Couples"],
    wheelchairAccessible: false,
    strollerFriendly: false,
    cancellationPolicy: "Non-refundable",
    bookingUrl: "https://www.tickadoo.com/en/london/cabaret-london?utm_source=mcp",
  },
];

describe("compare formatting", () => {
  it("builds winner callouts, booking URLs, and key differences", () => {
    const payload = buildComparisonPayload(sampleExperiences);

    expect(payload.comparison).toHaveLength(3);
    expect(payload.winner.highest_rated).toBe("hamilton-london");
    expect(payload.winner.most_popular).toBe("hamilton-london");
    expect(payload.winner.best_value).toBe("wicked-london");
    expect(payload.winner.best_for_families).toBe("wicked-london");
    expect(payload._booking_urls["wicked-london"]).toContain("/wicked-london");
    expect(payload.differences.join(" ")).toContain("free cancellation");
    expect(payload.differences.join(" ")).toContain("cheaper than");
  });

  it("renders a side-by-side text table", () => {
    const payload = buildComparisonPayload(sampleExperiences.slice(0, 2));
    const text = formatComparisonText(payload);

    expect(text).toContain("Winner callouts");
    expect(text).toContain("| Metric | Hamilton | Wicked |");
    expect(text).toContain("Key differences");
    expect(text).toContain("Booking URLs");
  });
});
