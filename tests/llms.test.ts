import { describe, expect, it } from "vitest";

import { buildLlmsFullTxt, buildLlmsTxt } from "../src/shared/llms.js";

describe("llms docs", () => {
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
      "City-based search with fuzzy matching, optional category/query/price filters, and optional date filtering",
      "Nearby search from latitude/longitude coordinates with configurable radius and optional date filtering",
    ];

    const fullDoc = buildLlmsFullTxt();

    for (const snippet of expectedSnippets) {
      expect(fullDoc).toContain(snippet);
    }
  });

  it("documents data freshness and limitations honestly", () => {
    const shortFreshnessSnippet = [
      "## Data Freshness",
      "- Pricing: updated daily from tickadoo product feed",
      "- Availability: indicative, not real-time — always link to booking page for final confirmation",
      "- Ratings: aggregated, may lag behind live reviews",
      "- City coverage: updated with each server release",
      "- Results are cached for up to 5 minutes on the server",
    ];

    const shortLimitationsSnippet = [
      "## Limitations",
      "- No booking completion — the server provides discovery and links, not checkout",
      "- No real-time inventory — availability shown is indicative, users should check the booking page",
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
    expect(fullDoc).toContain("No booking completion");
    expect(fullDoc).toContain("No real-time inventory");
    expect(fullDoc).not.toContain("Date filtering is not yet available");
    expect(fullDoc).toContain("Prices shown are 'from' prices");
  });
});
