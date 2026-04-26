import { afterEach, describe, expect, it, vi } from "vitest";
import app, { SLUG_REGEX, VALID_TRIO_CONTEXTS } from "../src/index.js";

const htmlAssets = {
  "/cards.html": "<!doctype html><html><head><title>Cards</title></head><body><script>window.__cards = true;</script></body></html>",
  "/cards-empty.html": "<!doctype html><html><head><title>Empty</title></head><body>No cards</body></html>",
};

function testEnv() {
  return {
    NEON_URL: "postgres://example.test/db",
    MCP_INTERNAL_URL: "https://mcp.tickadoo.com",
    ADMIN_API_KEY: "admin",
    ASSETS: {
      fetch: async (request: Request) => {
        const pathname = new URL(request.url).pathname as keyof typeof htmlAssets;
        const html = htmlAssets[pathname];
        if (!html) return new Response("Not found", { status: 404 });
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

  describe("cards static routes", () => {
    it("/cards.html returns HTML with the ChatGPT frame CSP", async () => {
      const response = await app.fetch(new Request("https://widgets.tickadoo.com/cards.html"), testEnv());
      const csp = response.headers.get("Content-Security-Policy") ?? "";

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("script-src 'self' https://cdn.openai.com 'sha256-");
      expect(csp).toContain("frame-ancestors https://chatgpt.com https://*.chatgpt.com");
      expect(await response.text()).toContain("<title>Cards</title>");
    });

    it("/cards-empty.html returns HTML with the same strict CSP", async () => {
      const response = await app.fetch(new Request("https://widgets.tickadoo.com/cards-empty.html"), testEnv());
      const csp = response.headers.get("Content-Security-Policy") ?? "";

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("frame-ancestors https://chatgpt.com https://*.chatgpt.com");
      expect(await response.text()).toContain("No cards");
    });
  });

  describe("cards REST proxy", () => {
    it("/api/widget/cards proxies ids to MCP and returns CORS headers", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ _product_map: { "1": { title: "Test" } } }), {
          headers: { "Content-Type": "application/json" },
        }),
      );

      const response = await app.fetch(new Request("https://widgets.tickadoo.com/api/widget/cards?ids=1,2,3"), testEnv());

      expect(fetchSpy).toHaveBeenCalledWith(new URL("https://mcp.tickadoo.com/api/widget/cards?ids=1%2C2%2C3"), {
        headers: { accept: "application/json" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://widgets.tickadoo.com");
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=300");
      expect(await response.json()).toEqual({ _product_map: { "1": { title: "Test" } } });
    });
  });

  describe("legacy widget routes", () => {
    it("still require partner keys on /map, /card, and /trio", async () => {
      await expect(app.fetch(new Request("https://widgets.tickadoo.com/map"), testEnv()).then((r) => r.status)).resolves.toBe(400);
      await expect(app.fetch(new Request("https://widgets.tickadoo.com/card"), testEnv()).then((r) => r.status)).resolves.toBe(400);
      await expect(app.fetch(new Request("https://widgets.tickadoo.com/trio"), testEnv()).then((r) => r.status)).resolves.toBe(400);
    });
  });
});
