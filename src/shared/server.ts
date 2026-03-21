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

const DEFAULT_SEARCH_RESULT_LIMIT = 12;
const MAX_SEARCH_RESULT_LIMIT = 50;
const DEFAULT_CITY_DIRECTORY_LIMIT = 50;
const MAX_CITY_DIRECTORY_LIMIT = 200;
const DEFAULT_RADIUS_KM = 25;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 200;
const AUTO_MATCH_CONFIDENCE = 0.88;
const SUGGESTION_CONFIDENCE = 0.45;
const CITY_SUGGESTION_LIMIT = 5;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeCityInput(city: string): string {
  return city.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function normalizeCityToken(city: string): string {
  return normalizeCityInput(city).replace(/-/g, "");
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

function createErrorResponse(message: string) {
  return createTextResponse(`Error: ${message}`, { isError: true });
}

type ToolResponse = ReturnType<typeof createTextResponse>;
type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: ToolResponse };

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim() ? `"${value}"` : "empty string";
  }

  if (value == null) {
    return String(value);
  }

  return Number.isNaN(value) ? "NaN" : String(value);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1).fill(0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function scoreStringSimilarity(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (candidate === query) return 1;
  if (candidate.startsWith(query)) return 0.96;
  if (candidate.includes(query)) return 0.9;

  const maxLength = Math.max(query.length, candidate.length);
  if (!maxLength) return 0;
  return 1 - (levenshteinDistance(query, candidate) / maxLength);
}

function scoreCityMatch(query: string, city: City): number {
  const normalizedQuerySlug = normalizeCityInput(query);
  const normalizedQueryName = normalizeCityToken(query);
  const normalizedCitySlug = city.slug ? normalizeCityInput(city.slug) : "";
  const normalizedCityName = normalizeCityToken(city.name);

  return Math.max(
    scoreStringSimilarity(normalizedQuerySlug, normalizedCitySlug),
    scoreStringSimilarity(normalizedQuerySlug, normalizedCityName),
    scoreStringSimilarity(normalizedQueryName, normalizedCitySlug.replace(/-/g, "")),
    scoreStringSimilarity(normalizedQueryName, normalizedCityName),
  );
}

function findCityCandidates(query: string, cities: City[]): Array<{ city: City & { slug: string }; score: number }> {
  return cities
    .filter((city): city is City & { slug: string } => Boolean(city.slug))
    .map(city => ({ city, score: scoreCityMatch(query, city) }))
    .sort((left, right) => right.score - left.score || left.city.name.localeCompare(right.city.name));
}

function formatCitySuggestions(suggestions: City[]): string {
  return suggestions.map(city => city.name).join(", ");
}

function validateSearchArgs(args: { city: string; language?: string; max_results?: number }): ValidationResult<{
  city: string;
  language: string;
  maxResults: number;
}> {
  const city = args.city.trim();
  if (!city) {
    return {
      ok: false,
      error: createErrorResponse("City is required. Provide a city name or slug like \"london\" or \"new-york\"."),
    };
  }

  const maxResults = args.max_results ?? DEFAULT_SEARCH_RESULT_LIMIT;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > MAX_SEARCH_RESULT_LIMIT) {
    return {
      ok: false,
      error: createErrorResponse(
        `Invalid max_results. It must be an integer between 1 and ${MAX_SEARCH_RESULT_LIMIT} (got: ${formatValue(args.max_results)}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      city,
      language: args.language ?? "en",
      maxResults,
    },
  };
}

function validateNearbyArgs(args: {
  latitude: number;
  longitude: number;
  radius_km?: number;
  language?: string;
}): ValidationResult<{
  latitude: number;
  longitude: number;
  radiusKm: number;
  language: string;
}> {
  if (!Number.isFinite(args.latitude) || args.latitude < -90 || args.latitude > 90) {
    return {
      ok: false,
      error: createErrorResponse(
        `Invalid coordinates. Latitude must be between -90 and 90 (got: ${formatValue(args.latitude)}). Please check the coordinates and try again.`,
      ),
    };
  }

  if (!Number.isFinite(args.longitude) || args.longitude < -180 || args.longitude > 180) {
    return {
      ok: false,
      error: createErrorResponse(
        `Invalid coordinates. Longitude must be between -180 and 180 (got: ${formatValue(args.longitude)}). Please check the coordinates and try again.`,
      ),
    };
  }

  const radiusKm = args.radius_km ?? DEFAULT_RADIUS_KM;
  if (!Number.isFinite(radiusKm) || radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM) {
    return {
      ok: false,
      error: createErrorResponse(
        `Invalid radius_km. It must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM} kilometers (got: ${formatValue(args.radius_km)}). Please adjust the search radius and try again.`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      latitude: args.latitude,
      longitude: args.longitude,
      radiusKm,
      language: args.language ?? "en",
    },
  };
}

function validateListCitiesArgs(args: { language?: string; query?: string; limit?: number }): ValidationResult<{
  language: string;
  query?: string;
  limit: number;
}> {
  if (args.query != null && !args.query.trim()) {
    return {
      ok: false,
      error: createErrorResponse("Invalid query. If provided, query must be a non-empty string such as \"paris\" or \"new\"."),
    };
  }

  const limit = args.limit ?? DEFAULT_CITY_DIRECTORY_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CITY_DIRECTORY_LIMIT) {
    return {
      ok: false,
      error: createErrorResponse(
        `Invalid limit. It must be an integer between 1 and ${MAX_CITY_DIRECTORY_LIMIT} (got: ${formatValue(args.limit)}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      language: args.language ?? "en",
      query: args.query?.trim(),
      limit,
    },
  };
}

function validateExperienceDetailsArgs(args: {
  slug?: string;
  provider?: string;
  provider_id?: string;
  days?: number;
  language?: string;
}): ValidationResult<{
  slug?: string;
  provider?: string;
  providerId?: string;
  days: number;
  language: string;
}> {
  if (args.slug != null && !args.slug.trim()) {
    return {
      ok: false,
      error: createErrorResponse(
        "Invalid slug. Provide a non-empty tickadoo slug or path, like \"london-dungeon-tickets\" or \"/london/london-dungeon-tickets\".",
      ),
    };
  }

  const provider = args.provider?.trim();
  const providerId = args.provider_id?.trim();
  if (!args.slug?.trim() && (!provider || !providerId)) {
    return {
      ok: false,
      error: createErrorResponse(
        "Provide a tickadoo slug or path, or both provider and provider_id. If you do not have a slug yet, search by city first.",
      ),
    };
  }

  return {
    ok: true,
    data: {
      slug: args.slug?.trim(),
      provider,
      providerId,
      days: args.days ?? 30,
      language: args.language ?? "en",
    },
  };
}

function formatSearchMiss(city: string, suggestions: City[]): string {
  if (suggestions.length) {
    return `No exact city match found for "${city}". Try one of: ${formatCitySuggestions(suggestions)}.`;
  }

  return `No exact city match found for "${city}". Try a major city like London, New York, Paris, Dubai, or Tokyo.`;
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
      max_results: z.number().optional().default(DEFAULT_SEARCH_RESULT_LIMIT).describe(`Maximum number of experiences to return (default ${DEFAULT_SEARCH_RESULT_LIMIT}, max ${MAX_SEARCH_RESULT_LIMIT})`),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    async args => {
      const validated = validateSearchArgs(args);
      if (!validated.ok) {
        return validated.error;
      }

      const { city, language, maxResults } = validated.data;

      try {
        let citySlug = normalizeCityInput(city);
        let products = await getProductsForCitySlug(citySlug, language);
        let cityName = city;
        let matchedKnownCity = Boolean(products.length);

        if (!products.length) {
          const cities = await getCities(language);
          const candidates = findCityCandidates(city, cities);
          const bestMatch = candidates[0];

          if (bestMatch?.score >= AUTO_MATCH_CONFIDENCE) {
            products = await getProductsForCitySlug(bestMatch.city.slug, language);
            cityName = bestMatch.city.name;
            citySlug = bestMatch.city.slug;
            matchedKnownCity = true;
          } else {
            const suggestions = candidates
              .filter(candidate => candidate.score >= SUGGESTION_CONFIDENCE)
              .slice(0, CITY_SUGGESTION_LIMIT)
              .map(candidate => candidate.city);
            return createErrorResponse(formatSearchMiss(city, suggestions));
          }
        }

        if (!products.length) {
          if (!matchedKnownCity) {
            return createErrorResponse(formatSearchMiss(city, []));
          }

          return createTextResponse(`No experiences found for "${cityName}". Try a major city like London, New York, Paris, Dubai, or Tokyo.`);
        }

        const rankedProducts = sortProductsForDisplay(products);
        const topProducts = rankedProducts.slice(0, maxResults);
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
        return createErrorResponse(getErrorMessage(error));
      }
    },
  );

  server.tool(
    "find_nearby_experiences",
    "Find shows, events and experiences near a geographic location on tickadoo®. Use when a user shares their location or asks for things to do near them.",
    {
      latitude: z.number().describe("Latitude"),
      longitude: z.number().describe("Longitude"),
      radius_km: z.number().optional().default(DEFAULT_RADIUS_KM).describe(`Search radius in km (default ${DEFAULT_RADIUS_KM})`),
      language: z.string().optional().default("en").describe("Language code"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    async args => {
      const validated = validateNearbyArgs(args);
      if (!validated.ok) {
        return validated.error;
      }

      const { latitude, longitude, radiusKm, language } = validated.data;

      try {
        const products = await getProductsByLocation(latitude, longitude, radiusKm, language);
        if (!products.length) {
          return createTextResponse(`No experiences within ${radiusKm}km. Try increasing the radius or searching a specific city.`);
        }

        const rankedProducts = sortProductsForDisplay(products);
        const topProducts = rankedProducts.slice(0, DEFAULT_SEARCH_RESULT_LIMIT);
        return createTextResponse(
          `${buildShownResultsLabel(topProducts.length, products.length, "nearby")}\n\n${topProducts.map(product => formatProduct(product)).join("\n\n")}`,
          {
            structuredContent: {
              latitude,
              longitude,
              radiusKm,
              totalExperiences: products.length,
              experiences: topProducts.map(product => productStructuredData(product)),
            },
          },
        );
      } catch (error) {
        return createErrorResponse(getErrorMessage(error));
      }
    },
  );

  server.tool(
    "list_cities",
    "List all cities where tickadoo® has bookable experiences. Use to help users discover available destinations.",
    {
      language: z.string().optional().default("en").describe("Language code"),
      query: z.string().optional().describe("Optional city name or slug filter (e.g. 'new', 'paris', 'tokyo')"),
      limit: z.number().optional().default(DEFAULT_CITY_DIRECTORY_LIMIT).describe(`Maximum number of cities to return (default ${DEFAULT_CITY_DIRECTORY_LIMIT})`),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    async args => {
      const validated = validateListCitiesArgs(args);
      if (!validated.ok) {
        return validated.error;
      }

      const { language, query, limit } = validated.data;

      try {
        const filter = query?.toLowerCase();
        const withSlug = (await getCities(language))
          .filter((city): city is City & { slug: string } => Boolean(city.slug))
          .filter(city => !filter || city.name.toLowerCase().includes(filter) || city.slug.toLowerCase().includes(filter))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!withSlug.length) {
          return createErrorResponse(`No cities found matching "${query}". Try a broader filter like "new", "paris", or "tokyo".`);
        }

        const cities = withSlug.slice(0, limit);
        const list = cities.map(city => `📍 ${city.name} → ${buildBookingUrl(city.slug)}`).join("\n");
        const header = filter
          ? `Found ${withSlug.length} matching cities${withSlug.length > cities.length ? ` (showing ${cities.length})` : ""}:`
          : `Showing ${cities.length} of ${withSlug.length} cities, sorted alphabetically. Use the optional query parameter to filter further:`;

        return createTextResponse(`tickadoo® city directory\n\n${header}\n\n${list}`);
      } catch (error) {
        return createErrorResponse(getErrorMessage(error));
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
    async args => {
      const validated = validateExperienceDetailsArgs(args);
      if (!validated.ok) {
        return validated.error;
      }

      const {
        slug,
        provider,
        providerId,
        days,
        language,
      } = validated.data;

      try {
        let resolved: ResolvedProduct | undefined;
        let providerName = provider;
        let detailsProviderId = providerId;

        if (slug) {
          resolved = await resolveProductBySlug(slug, language);
          providerName = resolved.product.provider;
          detailsProviderId = resolved.product.providerId;
        }

        const details = await getExperienceDetails(providerName!, detailsProviderId!, days);
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
        return createErrorResponse(getErrorMessage(error));
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
