import { describe, expect, it } from "vitest";

import {
  buildAvailabilityCheckPayload,
  calculateAvailabilityWindowDays,
  formatAvailabilityCheck,
} from "../src/shared/availability.js";
import type { StructuredDataResponse } from "../src/shared/types.js";

function makeDetails(overrides: Partial<StructuredDataResponse> = {}): StructuredDataResponse {
  return {
    desktopFeatureImageUrl: "https://cdn.tickadoo.com/example/desktop.jpg",
    mobileFeatureImageUrl: "https://cdn.tickadoo.com/example/mobile.jpg",
    currencyCode: "GBP",
    address: "County Hall, London",
    locationWithAddress: {
      latitude: 51.5,
      longitude: -0.1,
      address: "County Hall, London",
    },
    dates: [
      {
        date: "2026-04-05",
        endDate: "2026-04-05",
        minPrice: 45,
        variantName: "19:30 Standard Entry",
        time: "19:30",
        ticketsRemaining: 12,
      },
      {
        date: "2026-04-05",
        endDate: "2026-04-05",
        minPrice: 35,
        variantName: "14:00 Standard Entry",
        startTime: "14:00",
        tickets_remaining: 3,
      },
      {
        date: "2026-04-06",
        endDate: "2026-04-06",
        minPrice: 29,
        variantName: "Anytime Entry",
      },
    ],
    ...overrides,
  };
}

describe("check_availability helpers", () => {
  it("builds a date-specific payload with sorted slots, party totals, and Ghost Checkout metadata", () => {
    const payload = buildAvailabilityCheckPayload(
      "2026-04-05",
      2,
      makeDetails(),
      {
        title: "London Dungeon Tickets",
        slug: "london-dungeon-tickets",
        bookingPath: "london/london-dungeon-tickets",
        language: "de",
      },
    );

    expect(payload).toMatchObject({
      available: true,
      title: "London Dungeon Tickets",
      slug: "london-dungeon-tickets",
      date: "2026-04-05",
      total_for_party: {
        party_size: 2,
        cheapest: 70,
        currency: "GBP",
      },
      booking_url: "https://www.tickadoo.com/de/london/london-dungeon-tickets?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp&date=2026-04-05&adults=2&lang=de",
      _intent_token: {
        endpoint: "https://concierge.tickadoo.com/api/intent-token",
        payload: {
          productSlug: "london-dungeon-tickets",
          date: "2026-04-05",
          partySize: 2,
          language: "de",
        },
      },
    });

    expect(payload.slots).toEqual([
      {
        time: "14:00",
        label: "14:00 Standard Entry",
        price_per_person: 35,
        currency: "GBP",
        tickets_remaining: 3,
        availability_status: "InStock",
      },
      {
        time: "19:30",
        label: "19:30 Standard Entry",
        price_per_person: 45,
        currency: "GBP",
        tickets_remaining: 12,
        availability_status: "InStock",
      },
    ]);
  });

  it("returns an unavailable payload when the date has no matching slots", () => {
    const payload = buildAvailabilityCheckPayload(
      "2026-04-07",
      4,
      makeDetails(),
      {
        title: "London Dungeon Tickets",
        slug: "london-dungeon-tickets",
        bookingPath: "london/london-dungeon-tickets",
      },
    );

    expect(payload.available).toBe(false);
    expect(payload.slots).toEqual([]);
    expect(payload.total_for_party).toEqual({
      party_size: 4,
      cheapest: null,
      currency: "GBP",
    });

    const text = formatAvailabilityCheck(payload);
    expect(text).toContain("No availability returned for 4 guests on this date.");
    expect(text).toContain("Ghost Checkout");
    expect(text).toContain("Booking URL:");
  });

  it("calculates the minimum structured-data window needed for the requested date", () => {
    expect(calculateAvailabilityWindowDays("2026-04-05", new Date("2026-03-30T18:00:00.000Z"))).toBe(7);
    expect(() => calculateAvailabilityWindowDays("2026-03-29", new Date("2026-03-30T18:00:00.000Z"))).toThrow(
      "Date must be today or later.",
    );
    expect(() => calculateAvailabilityWindowDays("not-a-date", new Date("2026-03-30T18:00:00.000Z"))).toThrow(
      "Date must be a valid ISO date in YYYY-MM-DD format.",
    );
  });
});
