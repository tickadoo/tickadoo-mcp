import { describe, expect, it } from "vitest";
import { SLUG_REGEX, VALID_TRIO_CONTEXTS } from "../src/index.js";

describe("widgets-worker input validation", () => {
  describe("SLUG_REGEX", () => {
    it("accepts typical product and city slugs", () => {
      expect(SLUG_REGEX.test("harry-potter-studio-tour")).toBe(true);
      expect(SLUG_REGEX.test("tickets-wicked-the-musical-london")).toBe(true);
      expect(SLUG_REGEX.test("london")).toBe(true);
      expect(SLUG_REGEX.test("new-york")).toBe(true);
    });

    it("rejects uppercase and non-hyphen punctuation", () => {
      expect(SLUG_REGEX.test("Harry-Potter")).toBe(false);
      expect(SLUG_REGEX.test("foo/bar")).toBe(false);
      expect(SLUG_REGEX.test("foo bar")).toBe(false);
      expect(SLUG_REGEX.test("foo.bar")).toBe(false);
      expect(SLUG_REGEX.test('"quote')).toBe(false);
      expect(SLUG_REGEX.test("foo\nbar")).toBe(false);
    });

    it("rejects empty and over-length inputs", () => {
      expect(SLUG_REGEX.test("")).toBe(false);
      expect(SLUG_REGEX.test("a".repeat(201))).toBe(false);
    });

    it("rejects traversal-shaped inputs", () => {
      expect(SLUG_REGEX.test("../../etc/passwd")).toBe(false);
      expect(SLUG_REGEX.test("%2e%2e%2f")).toBe(false);
    });
  });

  describe("VALID_TRIO_CONTEXTS", () => {
    it("includes exactly the four canonical contexts", () => {
      expect([...VALID_TRIO_CONTEXTS].sort()).toEqual(["after", "nearby", "pair", "similar"]);
    });

    it("rejects arbitrary values", () => {
      expect(VALID_TRIO_CONTEXTS.has("pair")).toBe(true);
      // Cast-through-any is the expected shape since the set is a const union —
      // the runtime `.has()` check must still reject non-member strings.
      expect(VALID_TRIO_CONTEXTS.has("hacked" as never)).toBe(false);
      expect(VALID_TRIO_CONTEXTS.has("" as never)).toBe(false);
      expect(VALID_TRIO_CONTEXTS.has("../pair" as never)).toBe(false);
    });
  });
});
