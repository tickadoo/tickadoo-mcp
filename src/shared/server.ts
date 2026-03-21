import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  buildBookingUrl,
  getCities,
  getExperienceDetails,
  getProductsByLocation,
  getProductsForCitySlug,
  resolveProductBySlug,
} from "./api.js";
import { PRODUCT_FEED_URL, SERVER_DESCRIPTION, SERVER_NAME, SERVER_VERSION, SITE } from "./config.js";
import { formatExperienceDetails, formatProduct, productStructuredData } from "./format.js";
import type { City, Product, ResolvedProduct } from "./types.js";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeCityInput(city: string): string {
  return city.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

function compareProductsForDisplay(a: Product, b: Product): number {
  const pricedFirst = Number(a.minPrice == null) - Number(b.minPrice == null);
  if (pricedFirst !== 0) return pricedFirst;

  const ratingDelta = (b.averageRating ?? -1) - (a.averageRating ?? -1);
  if (ratingDelta !== 0) return ratingDelta;

  if (a.minPrice != null && b.minPrice != null) {
    const priceDelta = a.minPrice - b.minPrice;
    if (priceDelta !== 0) return priceDelta;
  }

  return a.title.localeCompare(b.title);
}

function sortProductsForDisplay(products: Product[]): Product[] {
  return [...products].sort(compareProductsForDisplay);
}

function buildShownResultsLabel(shown: number, total: number, context: string): string {
  const prefix = total > shown ? `Showing top ${shown} of ${total}` : `Showing ${shown} of ${total}`;
  return `${prefix} experiences ${context}:`;
}

function createTextResponse(text: string, options?: { isError?: boolean; structuredContent?: unknown }) {
  const response: {
    content: Array<{ type: "text"; text: string }>;
    isError?: true;
    structuredContent?: Record<string, unknown>;
  } = {
    content: [{ type: "text", text } as const],
  };

  if (options?.isError) {
    response.isError = true;
  }

  if (options?.structuredContent && typeof options.structuredContent === "object") {
    response.structuredContent = options.structuredContent as Record<string, unknown>;
  }

  return response;
}

export function createTickadooServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: SERVER_DESCRIPTION,
  });

  server.tool(
    "search_experiences",
    "Search for shows, theatre, events, tours and experiences in a specific city on tickadoo®. Use when a user asks what to do in a city, wants event/show recommendations, or is looking for tickets.",
    {
      city: z.string().describe("City name or slug (e.g. 'london', 'new-york', 'paris', 'tokyo', 'dubai')"),
      language: z.string().optional().default("en").describe("Language code (e.g. 'en', 'de', 'fr', 'es')"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    async ({ city, language }) => {
      try {
        let citySlug = normalizeCityInput(city);
        let products = await getProductsForCitySlug(citySlug, language);
        let cityName = city;

        if (!products.length) {
          const cities = await getCities(language);
          const match = cities.find(candidate =>
            candidate.name.toLowerCase().includes(city.toLowerCase())
            || (candidate.slug && candidate.slug.includes(citySlug))
          );
          if (match?.slug) {
            products = await getProductsForCitySlug(match.slug, language);
            cityName = match.name;
            citySlug = match.slug;
          }
        }

        if (!products.length) {
          return createTextResponse(`No experiences found for "${city}". Try a major city like London, New York, Paris, Dubai, or Tokyo.`);
        }

        const rankedProducts = sortProductsForDisplay(products);
        const topProducts = rankedProducts.slice(0, 12);
        return createTextResponse(
          `${buildShownResultsLabel(topProducts.length, products.length, `in ${cityName}`)}\n\n${topProducts.map(product => formatProduct(product, `${citySlug}/${product.slug}`)).join("\n\n")}\n\nView all: ${buildBookingUrl(citySlug)}`,
          {
            structuredContent: {
              city: cityName,
              citySlug,
              totalExperiences: products.length,
              experiences: topProducts.map(product => productStructuredData(product, `${citySlug}/${product.slug}`)),
            },
          },
        );
      } catch (error) {
        return createTextResponse(`Error: ${getErrorMessage(error)}`, { isError: true });
      }
    },
  );

  server.tool(
    "find_nearby_experiences",
    "Find shows, events and experiences near a geographic location on tickadoo®. Use when a user shares their location or asks for things to do near them.",
    {
      latitude: z.number().describe("Latitude"),
      longitude: z.number().describe("Longitude"),
      radius_km: z.number().optional().default(25).describe("Search radius in km (default 25)"),
      language: z.string().optional().default("en").describe("Language code"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    async ({ latitude, longitude, radius_km, language }) => {
      try {
        const products = await getProductsByLocation(latitude, longitude, radius_km, language);
        if (!products.length) {
          return createTextResponse(`No experiences within ${radius_km}km. Try increasing the radius or searching a specific city.`);
        }

        const rankedProducts = sortProductsForDisplay(products);
        const topProducts = rankedProducts.slice(0, 12);
        return createTextResponse(
          `${buildShownResultsLabel(topProducts.length, products.length, "nearby")}\n\n${topProducts.map(product => formatProduct(product)).join("\n\n")}`,
          {
            structuredContent: {
              latitude,
              longitude,
              radiusKm: radius_km,
              totalExperiences: products.length,
              experiences: topProducts.map(product => productStructuredData(product)),
            },
          },
        );
      } catch (error) {
        return createTextResponse(`Error: ${getErrorMessage(error)}`, { isError: true });
      }
    },
  );

  server.tool(
    "list_cities",
    "List all cities where tickadoo® has bookable experiences. Use to help users discover available destinations.",
    {
      language: z.string().optional().default("en").describe("Language code"),
      query: z.string().optional().describe("Optional city name or slug filter (e.g. 'new', 'paris', 'tokyo')"),
      limit: z.number().int().positive().max(200).optional().default(50).describe("Maximum number of cities to return (default 50)"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    async ({ language, query, limit }) => {
      try {
        const filter = query?.trim().toLowerCase();
        const withSlug = (await getCities(language))
          .filter((city): city is City & { slug: string } => Boolean(city.slug))
          .filter(city => !filter || city.name.toLowerCase().includes(filter) || city.slug.toLowerCase().includes(filter))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!withSlug.length) {
          return createTextResponse(`No cities found matching "${query}".`);
        }

        const cities = withSlug.slice(0, limit);
        const list = cities.map(city => `📍 ${city.name} → ${buildBookingUrl(city.slug)}`).join("\n");
        const header = filter
          ? `Found ${withSlug.length} matching cities${withSlug.length > cities.length ? ` (showing ${cities.length})` : ""}:`
          : `Showing ${cities.length} of ${withSlug.length} cities, sorted alphabetically. Use the optional query parameter to filter further:`;

        return createTextResponse(`tickadoo® city directory\n\n${header}\n\n${list}`);
      } catch (error) {
        return createTextResponse(`Error: ${getErrorMessage(error)}`, { isError: true });
      }
    },
  );

  server.tool(
    "get_experience_details",
    "Get detailed availability, venue details, and images for a specific tickadoo® experience. Prefer passing the tickadoo slug or booking URL path; provider and provider_id are legacy fallback inputs.",
    {
      slug: z.string().optional().describe("Preferred: tickadoo slug or path, e.g. 'london-dungeon-tickets' or '/london/london-dungeon-tickets'"),
      provider: z.string().optional().describe("Legacy fallback only: hidden provider name used internally"),
      provider_id: z.string().optional().describe("Legacy fallback only: hidden provider-specific product ID"),
      days: z.number().int().min(1).max(180).optional().default(30).describe("Number of days of availability to fetch (default 30, max 180)"),
      language: z.string().optional().default("en").describe("Reserved for future language-aware API support"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    async ({ slug, provider, provider_id, days, language }) => {
      try {
        let resolved: ResolvedProduct | undefined;
        let providerName = provider;
        let providerId = provider_id;

        if (slug?.trim()) {
          resolved = await resolveProductBySlug(slug, language);
          providerName = resolved.product.provider;
          providerId = resolved.product.providerId;
        } else if (!providerName || !providerId) {
          return createTextResponse("Error: Provide a tickadoo slug (preferred) or both provider and provider_id.", { isError: true });
        }

        const details = await getExperienceDetails(providerName, providerId, days);
        return createTextResponse(
          [
            resolved ? `🎭 ${resolved.product.title}` : "",
            formatExperienceDetails(days, details),
            resolved ? `   🔗 ${buildBookingUrl(resolved.bookingPath)}` : "",
          ].filter(Boolean).join("\n"),
          {
            structuredContent: {
              source: "tickadoo",
              slug: resolved?.product.slug,
              tickadooProductId: resolved?.product.id,
              bookingUrl: resolved ? buildBookingUrl(resolved.bookingPath) : undefined,
              days,
              details,
            },
          },
        );
      } catch (error) {
        return createTextResponse(`Error: ${getErrorMessage(error)}`, { isError: true });
      }
    },
  );

  server.resource(
    "product-feed",
    "tickadoo://product-feed",
    {
      description: "Machine-readable product feed (OpenAI Commerce spec) with all on-sale products, pricing, and availability.",
      mimeType: "text/plain",
    },
    async () => ({
      contents: [{
        uri: "tickadoo://product-feed",
        text: `tickadoo® Product Feed\n\nEndpoint: ${PRODUCT_FEED_URL}\nFormat: gzip JSONL (OpenAI Commerce Product Feed spec)\nContents: ~7,700 unique products across 700+ cities with title, description, pricing, daily availability, images, and booking URLs.\n\nTo consume: curl -sL "${PRODUCT_FEED_URL}" | gunzip | head -5`,
        mimeType: "text/plain",
      }],
    }),
  );

  return server;
}
