import { describe, expect, it } from "vitest";
import { resolveRemoteUrl } from "../src/bridge.js";
import { DEFAULT_TICKADOO_MCP_URL } from "../src/config.js";

describe("stdio bridge default remote", () => {
  it("pins the published default to the Howard public MCP", () => {
    expect(DEFAULT_TICKADOO_MCP_URL).toBe("https://mcp.tickadoo.com/mcp");
    const resolved = resolveRemoteUrl(DEFAULT_TICKADOO_MCP_URL);
    expect(resolved.protocol).toBe("https:");
    expect(resolved.host).toBe("mcp.tickadoo.com");
    expect(resolved.pathname).toBe("/mcp");
  });

  it("rejects a value that is not a URL", () => {
    expect(() => resolveRemoteUrl("not a url")).toThrow(
      /Invalid TICKADOO_MCP_URL/,
    );
  });
});
