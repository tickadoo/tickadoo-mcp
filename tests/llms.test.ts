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
});
