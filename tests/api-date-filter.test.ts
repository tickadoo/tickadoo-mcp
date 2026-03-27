import { afterEach, describe, expect, it, vi } from "vitest";

type MockProduct = {
  id: string;
  cityId: string;
  slug: string;
  title: string;
  description: string | null;
  desktopFeatureImageUrl: string | null;
  verticalImageUrl: string | null;
  provider: string;
  providerId: string;
  averageRating: number | null;
  currency: string;
  address: string | null;
  minPrice: number | null;
};

type MockMcpProduct = {
  niceId: number;
  name: string;
  url: string;
  minPrice: number;
  reviewRating: number | null;
  reviewCount: number | null;
  indoorOutdoor: "Indoor" | "Outdoor" | "Mixed" | null;
  physicalLevel: "Easy" | "Moderate" | "Demanding" | null;
  audience: string[];
  tags: string[];
  wheelchairAccessible: boolean | null;
  strollerFriendly: boolean | null;
  languageOptions: string[];
  variants: unknown[];
};

function createProduct(overrides: Partial<MockProduct> = {}): MockProduct {
  return {
    id: "product-1",
    cityId: "city-1",
    slug: "hamilton-london",
    title: "Hamilton Tickets London",
    description: "Award-winning musical tickets in London.",
    desktopFeatureImageUrl: "https://cdn.example.com/hamilton.jpg",
    verticalImageUrl: null,
    provider: "Headout",
    providerId: "provider-1",
    averageRating: 4.8,
    currency: "GBP",
    address: "Victoria Palace Theatre, London",
    minPrice: 45,
    ...overrides,
  };
}

function createMcpProduct(overrides: Partial<MockMcpProduct> = {}): MockMcpProduct {
  return {
    niceId: 101,
    name: "Hamilton Tickets London",
    url: "https://www.tickadoo.com/london/hamilton-london",
    minPrice: 45,
    reviewRating: 4.8,
    reviewCount: 1200,
    indoorOutdoor: "Indoor",
    physicalLevel: "Easy",
    audience: ["Family"],
    tags: ["Musical"],
    wheelchairAccessible: true,
    strollerFriendly: false,
    languageOptions: ["en"],
    variants: [],
    ...overrides,
  };
}

const originalToken = process.env.TICKADOO_MCP_API_TOKEN;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals?.();
  vi.resetModules();

  if (originalToken == null) {
    delete process.env.TICKADOO_MCP_API_TOKEN;
  } else {
    process.env.TICKADOO_MCP_API_TOKEN = originalToken;
  }
});

describe("date-filtered product API", () => {
  it("uses the private MCP products endpoint for date-filtered city searches", async () => {
    process.env.TICKADOO_MCP_API_TOKEN = "test-token";

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);

      if (url.pathname === "/api/maps/products") {
        return new Response(JSON.stringify({
          products: [
            createProduct(),
            createProduct({
              id: "product-2",
              slug: "london-dungeon",
              title: "London Dungeon",
              minPrice: 29,
            }),
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/integrations-api/v1.0/mcp/products") {
        expect(url.searchParams.get("onlyOnSale")).toBe("true");
        expect(url.searchParams.get("from")).toBe("2026-03-27");
        expect(url.searchParams.get("to")).toBe("2026-03-28");
        expect(url.searchParams.get("citySlug")).toBe("london");
        expect((init?.headers as Record<string, string> | undefined)?.["x-api-token"]).toBe("test-token");

        return new Response(JSON.stringify([
          createMcpProduct(),
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      throw new Error(`Unexpected URL: ${url.toString()}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { getProductsForCitySlug } = await import("../src/shared/api.js");
    const products = await getProductsForCitySlug("london", "en", {
      dateFrom: "2026-03-27",
      dateTo: "2026-03-28",
    });

    expect(products).toHaveLength(1);
    expect(products[0]?.slug).toBe("hamilton-london");
    expect(products[0]?.mcpProduct?.reviewRating).toBe(4.8);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses the private MCP products endpoint for date-filtered nearby searches", async () => {
    process.env.TICKADOO_MCP_API_TOKEN = "test-token";

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);

      if (url.pathname === "/api/maps/products-by-location") {
        return new Response(JSON.stringify({
          products: [
            createProduct({
              slug: "times-square-walking-tour",
              title: "Times Square Walking Tour",
              currency: "USD",
              minPrice: 39,
            }),
            createProduct({
              id: "product-3",
              slug: "broadway-backstage-tour",
              title: "Broadway Backstage Tour",
              currency: "USD",
              minPrice: 59,
            }),
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/integrations-api/v1.0/mcp/products") {
        expect(url.searchParams.get("onlyOnSale")).toBe("true");
        expect(url.searchParams.get("from")).toBe("2026-03-28");
        expect(url.searchParams.get("to")).toBe("2026-03-29");
        expect(url.searchParams.get("latitude")).toBe("40.758");
        expect(url.searchParams.get("longitude")).toBe("-73.985");
        expect(url.searchParams.get("radiusKm")).toBe("10");
        expect((init?.headers as Record<string, string> | undefined)?.["x-api-token"]).toBe("test-token");

        return new Response(JSON.stringify([
          createMcpProduct({
            niceId: 202,
            name: "Times Square Walking Tour",
            url: "https://www.tickadoo.com/new-york/times-square-walking-tour",
            minPrice: 39,
          }),
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      throw new Error(`Unexpected URL: ${url.toString()}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { getProductsByLocation } = await import("../src/shared/api.js");
    const products = await getProductsByLocation(40.758, -73.985, 10, "en", {
      dateFrom: "2026-03-28",
      dateTo: "2026-03-29",
    });

    expect(products).toHaveLength(1);
    expect(products[0]?.slug).toBe("times-square-walking-tour");
    expect(products[0]?.mcpProduct?.niceId).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the no-date city search path on the cached public endpoint", async () => {
    process.env.TICKADOO_MCP_API_TOKEN = "test-token";

    const fetchMock = vi.fn(async (input: string) => {
      const url = new URL(input);

      if (url.pathname !== "/api/maps/products") {
        throw new Error(`Unexpected URL: ${url.toString()}`);
      }

      return new Response(JSON.stringify({
        products: [
          createProduct({
            slug: "cache-proof-product",
            title: "Cached Product",
          }),
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    vi.stubGlobal("fetch", fetchMock);

    const { getProductsForCitySlug } = await import("../src/shared/api.js");

    const first = await getProductsForCitySlug("cache-city", "en");
    const second = await getProductsForCitySlug("cache-city", "en");

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/maps/products");
  });
});
