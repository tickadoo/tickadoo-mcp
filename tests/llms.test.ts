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
      "- Date filtering is not yet available — cannot filter by specific travel dates",
      "- Not all experiences have duration, accessibility, or audience suitability data",
      "- Prices shown are 'from' prices — final price may vary by date, party size, or variant",
      "- Indoor/outdoor classification is not yet available for all experiences",
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
    expect(fullDoc).toContain("Date filtering is not yet available");
    expect(fullDoc).toContain("Prices shown are 'from' prices");
  });
});
