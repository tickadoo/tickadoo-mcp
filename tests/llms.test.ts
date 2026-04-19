import { describe, expect, it } from "vitest";

import {
  MCP_CAPABILITY_CATEGORIES,
  MCP_PUBLIC_TOOL_COUNT,
} from "../src/shared/discovery.js";
import { SERVER_VERSION } from "../src/shared/config.js";
import { buildLlmsFullTxt, buildLlmsTxt } from "../src/shared/llms.js";

describe("llms docs", () => {
  it("advertises the v1.4 catalog size and capabilities", () => {
    const shortDoc = buildLlmsTxt();
    const fullDoc = buildLlmsFullTxt();

    for (const snippet of [
      `Version: ${SERVER_VERSION}`,
      `Tool count: ${MCP_PUBLIC_TOOL_COUNT}`,
      `Capabilities: ${MCP_CAPABILITY_CATEGORIES.join(", ")}`,
    ]) {
      expect(shortDoc).toContain(snippet);
      expect(fullDoc).toContain(snippet);
    }
  });

  it("documents the valid category enum for search_experiences", () => {
    const expectedSnippet = [
      "## Valid Categories",
      "The following category values are accepted by search_experiences:",
      "theatre, musicals, tours, food, family, nightlife, sightseeing, concerts,",
      "comedy, shows, outdoor, workshops, cruises, sports",
      "Note: Category matching is fuzzy",
    ];

    const shortDoc = buildLlmsTxt();
    const fullDoc = buildLlmsFullTxt();

    for (const snippet of expectedSnippet) {
      expect(shortDoc).toContain(snippet);
      expect(fullDoc).toContain(snippet);
    }
  });

  it("documents date filtering for search and nearby tools", () => {
    const expectedSnippets = [
      "optional date filtering",
      "dateFrom (optional): ISO start date YYYY-MM-DD; must be provided together with dateTo",
      "dateTo (optional): ISO end date YYYY-MM-DD; must be provided together with dateFrom",
      "City-based search with fuzzy matching, optional category/query/price/tags filters, and optional date filtering",
      "Nearby search from latitude/longitude coordinates with configurable radius and optional date filtering",
    ];

    const fullDoc = buildLlmsFullTxt();

    for (const snippet of expectedSnippets) {
      expect(fullDoc).toContain(snippet);
    }
  });

  it("documents the check_availability tool and its date-specific payload", () => {
    const expectedSnippets = [
      "check_availability",
      "Fast date-specific availability check for one experience.",
      "date (required): ISO date YYYY-MM-DD to check, such as 2026-04-05",
      "party_size (optional): integer guest count for total pricing, default 2",
      "available, slots, total_for_party, booking_url, and _intent_token payload metadata",
    ];

    const fullDoc = buildLlmsFullTxt();

    for (const snippet of expectedSnippets) {
      expect(fullDoc).toContain(snippet);
    }
  });

  it("documents compare_experiences inputs and winner callouts", () => {
    const fullDoc = buildLlmsFullTxt();

    expect(fullDoc).toContain("compare_experiences");
    expect(fullDoc).toContain("Compare 2-5 experiences side-by-side");
    expect(fullDoc).toContain("slugs (required): array of 2-5 tickadoo slugs or booking paths to compare");
    expect(fullDoc).toContain("winner callouts (best_value, highest_rated, most_popular, best_for_families)");
  });

  it("documents get_whats_on_this_week inputs and weekly highlights", () => {
    const fullDoc = buildLlmsFullTxt();

    expect(fullDoc).toContain("get_whats_on_this_week");
    expect(fullDoc).toContain("Build a 7-day city planner");
    expect(fullDoc).toContain("city (required): city name or slug such as london, new-york, paris, tokyo, or dubai");
    expect(fullDoc).toContain("grouped into morning, afternoon, and evening");
  });

  it("documents get_last_minute countdown behavior and inputs", () => {
    const fullDoc = buildLlmsFullTxt();

    expect(fullDoc).toContain("get_last_minute");
    expect(fullDoc).toContain("starting within the next few hours");
    expect(fullDoc).toContain("starts in 47 minutes");
    expect(fullDoc).toContain("hours (optional): number of hours ahead to search, default 3, max 12");
    expect(fullDoc).toContain("latitude (optional): latitude for blending nearby experiences close to the user's exact location");
    expect(fullDoc).toContain("prefer get_last_minute(city, hours=3)");
  });

  it("documents get_family_day planning behavior", () => {
    const fullDoc = buildLlmsFullTxt();

    expect(fullDoc).toContain("get_family_day");
    expect(fullDoc).toContain("morning activity, lunch tip, afternoon attraction, and optional evening stop");
    expect(fullDoc).toContain("kids_ages (optional): array of child ages");
    expect(fullDoc).toContain("Under 3 triggers wheelchair-accessible filtering");
    expect(fullDoc).toContain("clusters picks geographically to reduce travel");
  });

  it("documents Google Place ID exposure in experience details", () => {
    const fullDoc = buildLlmsFullTxt();

    expect(fullDoc).toContain("google_place_id: Google Maps Place ID when venue enrichment is available");
    expect(fullDoc).toContain("_accessibility: wheelchair, stroller, google_place_id mirror, venue accessibility API hint");
    expect(fullDoc).toContain("Experience detail JSON responses expose google_place_id when venue enrichment is available");
  });

  it("documents the expanded v1.4 tool catalog", () => {
    const shortDoc = buildLlmsTxt();
    const fullDoc = buildLlmsFullTxt();

    for (const snippet of [
      "search_experiences",
      "search_by_mood",
      "find_nearby_experiences",
      "compare_experiences",
      "get_related_experiences",
      "whats_on_tonight",
      "get_whats_on_this_week",
      "get_city_guide",
      "get_travel_tips",
      "get_transfer_info",
      "get_family_day",
      "product_id (required): source experience slug",
      "context (optional): pair, after, nearby, or similar. Default pair",
      "mood (required): valid enum adventurous, romantic, relaxing, family_fun, cultural, thrill_seeking, foodie, budget_friendly, luxury, rainy_day",
      "city (required): city name or slug such as london, new-york, paris, tokyo, or dubai",
    ]) {
      expect(fullDoc).toContain(snippet);
    }

    for (const snippet of [
      "- search_experiences:",
      "- search_by_mood:",
      "- get_related_experiences:",
      "- whats_on_tonight:",
      "- get_city_guide:",
      "- get_travel_tips:",
    ]) {
      expect(shortDoc).toContain(snippet);
    }
  });

  it("documents data freshness and limitations honestly", () => {
    const shortFreshnessSnippet = [
      "## Data Freshness & Cache Policy",
      "- Pricing: updated daily from tickadoo product feed",
      "- Availability: based on daily-refreshed inventory with urgency signals (inventoryLevel) — link to booking page for final seat selection and payment",
      "- Ratings: aggregated, may lag behind live reviews",
      "- City coverage: updated with each server release",
      "- Results are cached for up to 5 minutes on the server",
    ];

    const shortLimitationsSnippet = [
      "## Limitations",
      "- Booking handoff: the server provides discovery, recommendations, and direct booking deep links with ReserveAction — final payment is completed on tickadoo.com",
      "- Inventory freshness: availability is refreshed daily with inventoryLevel urgency signals — users confirm final seat selection on the booking page",
      "- Not all experiences have duration, accessibility, audience suitability, or indoor/outdoor data",
      "- Prices shown are 'from' prices — final price may vary by date, party size, or variant",
      "- Indoor/outdoor classification and audience/accessibility data is available for all experiences but may contain inaccuracies from automated classification",
      "- Reviews and ratings may not be available for newer listings",
    ];

    const shortDoc = buildLlmsTxt();
    const fullDoc = buildLlmsFullTxt();

    for (const snippet of [...shortFreshnessSnippet, ...shortLimitationsSnippet]) {
      expect(shortDoc).toContain(snippet);
    }

    expect(fullDoc).toContain("## Data Freshness");
    expect(fullDoc).toContain("Results are cached for up to 5 minutes on the server");
    expect(fullDoc).toContain("## Limitations");
    expect(fullDoc).toContain("Booking handoff");
    expect(fullDoc).toContain("Inventory freshness");
    expect(fullDoc).not.toContain("Date filtering is not yet available");
    expect(fullDoc).toContain("Prices shown are 'from' prices");
  });
});
