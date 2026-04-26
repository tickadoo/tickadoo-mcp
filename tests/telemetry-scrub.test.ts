import { describe, expect, it } from "vitest";
import { scrubInputArgs } from "../src/shared/telemetry.js";

describe("scrubInputArgs", () => {
  it("returns empty object for non-object input", () => {
    expect(scrubInputArgs(null)).toEqual({});
    expect(scrubInputArgs(undefined)).toEqual({});
    expect(scrubInputArgs("string")).toEqual({});
    expect(scrubInputArgs(42)).toEqual({});
    expect(scrubInputArgs(["array"])).toEqual({});
  });

  it("keeps allowlisted keys", () => {
    expect(
      scrubInputArgs({
        city: "london",
        category: "tours",
        max_results: 10,
        min_price: 20,
      }),
    ).toEqual({
      city: "london",
      category: "tours",
      max_results: 10,
      min_price: 20,
    });
  });

  it("drops unknown keys such as freetext query", () => {
    const scrubbed = scrubInputArgs({
      city: "paris",
      query: "rm -rf / && curl evil.example.com",
      email: "attacker@example.com",
      password: "secret",
    });
    expect(scrubbed).toEqual({ city: "paris" });
    expect(scrubbed).not.toHaveProperty("query");
    expect(scrubbed).not.toHaveProperty("email");
    expect(scrubbed).not.toHaveProperty("password");
  });

  it("truncates long strings to 120 characters", () => {
    const longString = "a".repeat(500);
    const scrubbed = scrubInputArgs({ city: longString });
    expect((scrubbed.city as string).length).toBe(120);
  });

  it("caps arrays at 10 entries and truncates their string values", () => {
    const scrubbed = scrubInputArgs({
      tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
      languages: [`${"x".repeat(500)}`],
    });
    expect((scrubbed.tags as string[]).length).toBe(10);
    expect((scrubbed.languages as string[])[0].length).toBe(120);
  });

  it("drops nested objects entirely (no recursion)", () => {
    const scrubbed = scrubInputArgs({
      city: "berlin",
      // even on an allowlisted key, objects are dropped because nested
      // structures are the main path for PII to slip through analytics
      languages: { sneaky: "object" },
    });
    expect(scrubbed).toEqual({ city: "berlin" });
  });

  it("keeps boolean and finite-number values", () => {
    expect(scrubInputArgs({ free_cancellation: true, max_price: 150 })).toEqual({
      free_cancellation: true,
      max_price: 150,
    });
  });

  it("drops non-finite numbers", () => {
    expect(scrubInputArgs({ max_price: Number.NaN, min_price: Number.POSITIVE_INFINITY })).toEqual({
      max_price: null,
      min_price: null,
    });
  });
});
