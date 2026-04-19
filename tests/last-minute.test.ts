import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildLastMinuteResult,
  formatLastMinuteText,
  type LastMinuteCandidate,
} from "../src/last-minute.js";
import type { Product, StructuredDataDatePrice, StructuredDataResponse } from "../src/shared/types.js";

function buildProduct(input: {
  slug: string;
  title: string;
  minPrice: number;
  rating: number;
}): Product {
  return {
    id: input.slug,
    cityId: "london",
    slug: input.slug,
    title: input.title,
    description: `${input.title} description`,
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
    verticalImageUrl: null,
    provider: "tickadoo",
    providerId: input.slug,
    averageRating: input.rating,
    currency: "GBP",
    address: "London",
    minPrice: input.minPrice,
    mcpProduct: {
      niceId: 1,
      name: input.title,
      url: input.slug,
      minPrice: input.minPrice,
      reviewRating: input.rating,
      reviewCount: 700,
      indoorOutdoor: "Indoor",
      physicalLevel: "Easy",
      audience: ["Couples"],
      tags: ["Evening"],
      wheelchairAccessible: true,
      strollerFriendly: false,
      languageOptions: ["en"],
      variants: [],
    },
  };
}

function buildDetails(dates: StructuredDataDatePrice[]): StructuredDataResponse {
  return {
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
    mobileFeatureImageUrl: "https://cdn.tickadoo.com/example/mobile.jpg",
    currencyCode: "GBP",
    address: "London",
    locationWithAddress: {
      latitude: 51.5,
      longitude: -0.12,
      address: "London",
    },
    dates,
    mcpProduct: {
      niceId: 1,
      name: "Test Product",
      url: "test-product",
      minPrice: dates[0]?.minPrice ?? 0,
      reviewRating: 4.8,
      reviewCount: 900,
      indoorOutdoor: "Indoor",
      physicalLevel: "Easy",
      audience: ["Couples"],
      tags: ["Evening"],
      wheelchairAccessible: true,
      strollerFriendly: false,
      languageOptions: ["en"],
      variants: [],
    },
  };
}

function buildCandidate(
  product: Product,
  dates: StructuredDataDatePrice[],
): LastMinuteCandidate {
  return {
    product,
    details: buildDetails(dates),
    bookingPath: `london/${product.slug}`,
    language: "en",
    popular: true,
  };
}

describe("buildLastMinuteResult", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters to the requested window, sorts by soonest start, and adds urgency signals", () => {
    const soonProduct = buildProduct({
      slug: "river-jazz",
      title: "River Jazz Cruise",
      minPrice: 39,
      rating: 4.9,
    });
    const laterProduct = buildProduct({
      slug: "skyline-bar",
      title: "Skyline Bar Entry",
      minPrice: 22,
      rating: 4.6,
    });
    const outsideWindowProduct = buildProduct({
      slug: "night-show",
      title: "Night Show",
      minPrice: 55,
      rating: 4.8,
    });

    const result = buildLastMinuteResult([
      buildCandidate(soonProduct, [
        {
          date: "2026-03-30",
          endDate: "2026-03-30",
          minPrice: 39,
          variantName: "Standard",
          startTime: "09:47",
          ticketsRemaining: 4,
          inventoryLevel: 2,
        },
        {
          date: "2026-03-30",
          endDate: "2026-03-30",
          minPrice: 39,
          variantName: "Standard",
          startTime: "11:00",
        },
      ]),
      buildCandidate(laterProduct, [
        {
          date: "2026-03-30",
          endDate: "2026-03-30",
          minPrice: 22,
          variantName: "Entry",
          startTime: "10:15",
        },
      ]),
      buildCandidate(outsideWindowProduct, [
        {
          date: "2026-03-30",
          endDate: "2026-03-30",
          minPrice: 55,
          variantName: "Standard",
          startTime: "13:30",
        },
      ]),
    ], {
      city: "London",
      citySlug: "london",
      hours: 3,
    });

    expect(result.results.map(entry => entry.slug)).toEqual(["river-jazz", "skyline-bar"]);
    expect(result.results[0].countdownText).toBe("starts in 47 minutes");
    expect(result.results[0].urgencyBadges).toContain("Starting soon");
    expect(result.results[0].urgencyBadges).toContain("Only 4 left");
    expect(result.results[0].highUrgency).toBe(true);
    expect(result.results[1].countdownText).toBe("starts in 1 hour 15 minutes");
    expect(result.total).toBe(2);
    expect(result.showing).toBe(2);
  });

  it("formats a helpful empty-state message when nothing qualifies", () => {
    const payload = buildLastMinuteResult([], {
      city: "London",
      citySlug: "london",
      hours: 3,
    });

    expect(formatLastMinuteText(payload)).toBe("No bookable experiences found in London starting within the next 3 hours.");
  });
});
