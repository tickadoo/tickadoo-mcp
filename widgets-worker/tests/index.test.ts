import { describe, expect, it } from "vitest";
import {
  EXPERIENCE_CARD_HTML,
  EXPERIENCE_MAP_HTML,
  EXPERIENCE_TRIO_HTML,
} from "../src/widgets-html.js";

describe("widgets-worker widget constants", () => {
  it("card html is non-empty and contains tickadoo brand mark", () => {
    expect(EXPERIENCE_CARD_HTML.length).toBeGreaterThan(1000);
    expect(EXPERIENCE_CARD_HTML).toContain("tickadoo®");
  });

  it("map html references Leaflet", () => {
    expect(EXPERIENCE_MAP_HTML).toContain("leaflet");
  });

  it("trio html references experience-trio", () => {
    expect(EXPERIENCE_TRIO_HTML).toContain("experience-trio");
  });
});
