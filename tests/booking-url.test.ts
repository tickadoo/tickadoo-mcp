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
});
