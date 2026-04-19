import { describe, expect, it } from "vitest";
import { extractTopProductIds, inferHostHint, stampAgentCallId } from "../src/shared/telemetry.js";

describe("telemetry helpers", () => {
  describe("inferHostHint", () => {
    it("recognises Claude UA", () => {
      expect(inferHostHint("Mozilla/5.0 Claude/1.0", "")).toBe("claude");
    });

    it("recognises Anthropic origin", () => {
      expect(inferHostHint("", "https://anthropic.com")).toBe("claude");
    });

    it("recognises ChatGPT origin", () => {
      expect(inferHostHint("", "https://chatgpt.com")).toBe("chatgpt");
    });

    it("recognises Goose UA", () => {
      expect(inferHostHint("goose/0.9", "")).toBe("goose");
    });

    it("recognises VS Code UA", () => {
      expect(inferHostHint("vscode-1.96", "")).toBe("vscode");
    });

    it("falls back to unknown", () => {
      expect(inferHostHint("MysteryBot/1.0", "")).toBe("unknown");
    });
  });

  describe("extractTopProductIds", () => {
    it("extracts from results array", () => {
      const sc = { results: [{ slug: "wicked" }, { slug: "lion-king" }, { slug: "tower" }, { slug: "fourth" }] };
      expect(extractTopProductIds(sc)).toEqual(["wicked", "lion-king", "tower"]);
    });

    it("extracts from single experience", () => {
      const sc = { experience: { slug: "wicked" } };
      expect(extractTopProductIds(sc)).toEqual(["wicked"]);
    });

    it("extracts top-level slug for details payloads", () => {
      const sc = { slug: "wicked", details: { currencyCode: "GBP" } };
      expect(extractTopProductIds(sc)).toEqual(["wicked"]);
    });

    it("returns empty for malformed input", () => {
      expect(extractTopProductIds(null)).toEqual([]);
      expect(extractTopProductIds(undefined)).toEqual([]);
      expect(extractTopProductIds("nope")).toEqual([]);
    });
  });

  describe("stampAgentCallId", () => {
    it("stamps top-level and per-result _meta", () => {
      const sc: any = { results: [{ slug: "a" }, { slug: "b" }] };
      stampAgentCallId(sc, "abc123");
      expect(sc._meta.agent_call_id).toBe("abc123");
      expect(sc.results[0]._meta.agent_call_id).toBe("abc123");
      expect(sc.results[1]._meta.agent_call_id).toBe("abc123");
    });

    it("stamps experiences list _meta", () => {
      const sc: any = { experiences: [{ slug: "a" }, { slug: "b" }] };
      stampAgentCallId(sc, "exp123");
      expect(sc._meta.agent_call_id).toBe("exp123");
      expect(sc.experiences[0]._meta.agent_call_id).toBe("exp123");
      expect(sc.experiences[1]._meta.agent_call_id).toBe("exp123");
    });

    it("stamps single-experience _meta", () => {
      const sc: any = { experience: { slug: "wicked" } };
      stampAgentCallId(sc, "xyz789");
      expect(sc._meta.agent_call_id).toBe("xyz789");
      expect(sc.experience._meta.agent_call_id).toBe("xyz789");
    });

    it("preserves existing _meta entries", () => {
      const sc: any = { _meta: { utm_source: "partner_xyz" }, results: [{ slug: "a" }] };
      stampAgentCallId(sc, "id1");
      expect(sc._meta.utm_source).toBe("partner_xyz");
      expect(sc._meta.agent_call_id).toBe("id1");
    });
  });
});
