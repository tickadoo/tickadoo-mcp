import { describe, expect, it } from "vitest";

import { buildBookingUrl } from "../src/shared/api.js";

describe("buildBookingUrl", () => {
  it("adds the default MCP UTM parameters to slug-based booking URLs", () => {
    expect(buildBookingUrl("london-dungeon-tickets")).toBe(
      "https://www.tickadoo.com/london-dungeon-tickets?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    );
  });

  it("preserves existing query parameters and appends tracking with ampersands", () => {
    expect(buildBookingUrl("/london/london-dungeon-tickets?ref=homepage")).toBe(
      "https://www.tickadoo.com/london/london-dungeon-tickets?ref=homepage&utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    );
  });

  it("adds a language prefix for non-English booking URLs", () => {
    expect(buildBookingUrl("/london/london-dungeon-tickets", "de")).toBe(
      "https://www.tickadoo.com/de/london/london-dungeon-tickets?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    );
  });

  it("replaces an existing language prefix when generating English or another locale", () => {
    expect(buildBookingUrl("/fr/london/london-dungeon-tickets?ref=homepage", "en")).toBe(
      "https://www.tickadoo.com/london/london-dungeon-tickets?ref=homepage&utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    );
    expect(buildBookingUrl("/fr/london/london-dungeon-tickets?ref=homepage", "ja")).toBe(
      "https://www.tickadoo.com/ja/london/london-dungeon-tickets?ref=homepage&utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    );
  });
});
