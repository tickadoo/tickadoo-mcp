import { describe, expect, it } from "vitest";

import { buildLlmsFullTxt, buildLlmsTxt } from "../src/shared/llms.js";
import {
  SEARCH_MOOD_OPTIONS,
  getSearchMoodFilters,
  normalizeSearchMood,
} from "../src/shared/server.js";

describe("search_by_mood", () => {
  it("normalizes accepted mood values and rejects unknown ones", () => {
    expect(normalizeSearchMood("romantic")).toBe("romantic");
    expect(normalizeSearchMood("family-fun")).toBe("family_fun");
    expect(normalizeSearchMood("RAINY_DAY")).toBe("rainy_day");
    expect(normalizeSearchMood("cozy")).toBeUndefined();
  });

  it("maps each mood to the expected search filters", () => {
    expect(getSearchMoodFilters("adventurous")).toEqual({
      tags: "Adventure,Outdoor,WaterSport",
      sort: "rating",
    });
    expect(getSearchMoodFilters("romantic")).toEqual({
      audience: "Couples",
      tags: "Evening,Cruise,Dining",
      sort: "rating",
    });
    expect(getSearchMoodFilters("relaxing")).toEqual({
      tags: "Spa,Cruise",
      physicalLevel: "Easy",
      sort: "best_value",
    });
    expect(getSearchMoodFilters("family_fun")).toEqual({
      audience: "Family",
      tags: "KidsAttraction,Outdoor",
      sort: "popular",
    });
    expect(getSearchMoodFilters("cultural")).toEqual({
      tags: "Museum,WalkingTour,GuidedTour",
      sort: "rating",
    });
    expect(getSearchMoodFilters("thrill_seeking")).toEqual({
      tags: "Adventure,Helicopter,WaterSport",
      sort: "popular",
    });
    expect(getSearchMoodFilters("foodie")).toEqual({
      tags: "FoodTour,Dining,Workshop",
      sort: "rating",
    });
    expect(getSearchMoodFilters("budget_friendly")).toEqual({
      maxPrice: 30,
      sort: "price_low",
    });
    expect(getSearchMoodFilters("luxury")).toEqual({
      minRating: 4.5,
      sort: "price_high",
    });
    expect(getSearchMoodFilters("rainy_day")).toEqual({
      setting: "Indoor",
      tags: "Museum,Show,Theatre",
      sort: "popular",
    });
  });

  it("documents the mood tool and supported moods in llms docs", () => {
    const sharedSnippets = [
      "search_by_mood",
      "Search experiences by emotional intent instead of category.",
      "## Valid Moods",
      "Mood search maps emotional intent to audience, tag, setting, rating, and price filters before searching.",
    ];
    const fullOnlySnippets = [
      `mood (required): valid enum ${SEARCH_MOOD_OPTIONS.join(", ")}`,
    ];

    const shortDoc = buildLlmsTxt();
    const fullDoc = buildLlmsFullTxt();

    for (const snippet of sharedSnippets) {
      expect(shortDoc).toContain(snippet);
      expect(fullDoc).toContain(snippet);
    }

    for (const snippet of fullOnlySnippets) {
      expect(fullDoc).toContain(snippet);
    }
  });
});
