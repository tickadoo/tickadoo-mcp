import { describe, expect, it } from "vitest";

import {
  buildTravelTipsPayload,
  formatTravelTips,
  normalizeTravelTipTopic,
  SUPPORTED_TRAVEL_TIP_CITIES,
} from "../src/shared/travel-tips.js";

describe("travel tips builder", () => {
  it("covers the initial 20 launch cities", () => {
    expect(SUPPORTED_TRAVEL_TIP_CITIES).toHaveLength(20);
    expect(SUPPORTED_TRAVEL_TIP_CITIES.map(city => city.slug)).toEqual(
      expect.arrayContaining(["tokyo", "new-york", "singapore", "sydney"]),
    );
  });

  it("builds the full payload for a supported city alias", () => {
    const payload = buildTravelTipsPayload("nyc");

    expect(payload).not.toBeNull();
    expect(payload?.city).toBe("New York");
    expect(payload?.tips).toHaveLength(8);
    expect(payload?.tips[0]).toEqual({
      topic: "transport",
      tip: expect.stringContaining("OMNY"),
      importance: "essential",
    });
    expect(payload?.emergency).toEqual({
      police: "911",
      ambulance: "911",
      tourist_helpline: "311",
    });
    expect(payload?.quick_phrases[0]).toEqual({
      local: "Downtown",
      english: "Toward lower Manhattan / southbound",
    });
  });

  it("supports topic filtering and text formatting", () => {
    const payload = buildTravelTipsPayload("tokyo", "food");

    expect(payload).not.toBeNull();
    expect(payload?.tips).toHaveLength(1);
    expect(payload?.tips[0].topic).toBe("food");
    expect(payload?.tips[0].tip).toContain("reservations");

    const text = formatTravelTips(payload!);
    expect(text).toContain("Tokyo travel tips");
    expect(text).toContain("[Food | helpful]");
    expect(text).toContain("Emergency numbers: police 110 | ambulance 119 | tourist helpline +81 50 3816 2787");
    expect(text).toContain("Quick phrases:");
  });

  it("normalizes valid topics and rejects invalid ones", () => {
    expect(normalizeTravelTipTopic("money")).toBe("money");
    expect(normalizeTravelTipTopic(" Money ")).toBe("money");
    expect(normalizeTravelTipTopic("nightlife")).toBeNull();
  });

  it("returns null for unsupported cities", () => {
    expect(buildTravelTipsPayload("atlantis")).toBeNull();
  });
});
