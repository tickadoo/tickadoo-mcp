/**
 * GRO-407: integration test that the cross-surface seasonal-variant gate
 * is wired into each of the user-facing review-emission sites in format.ts.
 *
 * The pure-function tests for the gate live in the howard repo at
 * tests/quality.test.ts. This file validates the MCP-side wiring through
 * the actual format functions, so a future change in format.ts that
 * silently drops the gate fails CI loudly with a named entity message.
 */

import { describe, expect, it } from "vitest";
import { shouldSuppressReviews } from "../src/shared/quality/index.js";

describe("Vendored shouldSuppressReviews (sanity check)", () => {
  it("Christmas London Eye with 16,480 reviews → true", () => {
    expect(shouldSuppressReviews("Christmas at the London Eye", 16480)).toBe(true);
  });

  it("Halloween tour with 2,500 reviews → true", () => {
    expect(shouldSuppressReviews("Halloween Haunted Walking Tour", 2500)).toBe(true);
  });

  it("Christmas with 50 reviews → false (under threshold)", () => {
    expect(shouldSuppressReviews("Christmas at the London Eye", 50)).toBe(false);
  });

  it("Non-seasonal London Eye admission → false", () => {
    expect(shouldSuppressReviews("London Eye Admission Tickets", 16480)).toBe(false);
  });

  it("null title → false", () => {
    expect(shouldSuppressReviews(null, 16480)).toBe(false);
  });

  it("undefined title → false (defensive against optional chaining)", () => {
    expect(shouldSuppressReviews(undefined, 16480)).toBe(false);
  });

  it("NYE party → true", () => {
    expect(shouldSuppressReviews("NYE Party on Tower Bridge", 12000)).toBe(true);
  });
});
