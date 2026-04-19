import { describe, it, expect } from "vitest";
import { EXPERIENCE_TRIO_URI, TICKADOO_UI_RESOURCES } from "../src/shared/ui-resources.js";

describe("product edges + trio widget", () => {
  it("exports EXPERIENCE_TRIO_URI", () => {
    expect(EXPERIENCE_TRIO_URI).toBe("ui://tickadoo/experience-trio.html");
  });

  it("registers experience-trio in UI_RESOURCES", () => {
    const trio = TICKADOO_UI_RESOURCES.find(r => r.name === "experience-trio");
    expect(trio).toBeDefined();
    expect(trio!.uri).toBe(EXPERIENCE_TRIO_URI);
    expect(trio!.html).toContain("tickadoo\u00ae");
    expect(trio!.html).toContain("experience-trio");
  });

  it("trio widget includes initialize retry pattern", () => {
    const trio = TICKADOO_UI_RESOURCES.find(r => r.name === "experience-trio");
    expect(trio!.html).toContain("sendInitialize");
    expect(trio!.html).toContain("setInterval");
    expect(trio!.html).toContain("rendered = true");
  });
});
