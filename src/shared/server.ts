import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  buildBookingUrl,
  geocodeCityQuery,
  getCities,
  getExperienceDetails,
  getNearestCoveredCities,
  getProductsByLocation,
  getProductsForCitySlug,
  resolveProductBySlug,
} from "./api.js";
import {
  PRODUCT_FEED_URL,
  SERVER_DESCRIPTION,
  SERVER_NAME,
  SERVER_VERSION,
  SITE,
  TICKADOO_LOG_LEVEL,
} from "./config.js";
import {
  appendNextStepHint,
  DETAILS_NEXT_STEP_HINT,
  FILTERED_CITIES_NEXT_STEP_HINT,
  formatDidYouMeanRecovery,
  formatEmptyCategoryRecovery,
  formatExperienceDetails,
  formatNearbyEmptyRecovery,
  formatNoCoverageRecovery,
  formatProduct,
  NEARBY_NEXT_STEP_HINT,
  productStructuredData,
  SEARCH_NEXT_STEP_HINT,
} from "./format.js";
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
const SPELLING_CORRECTION_CONFIDENCE = 0.75;
const CITY_SUGGESTION_LIMIT = 5;
const NEARBY_CITY_SUGGESTION_LIMIT = 3;
const AVAILABLE_SEARCH_CATEGORIES = [
  "theatre",
  "musicals",
  "tours",
  "food",
  "family",
  "nightlife",
  "sightseeing",
  "concerts",
  "comedy",
  "shows",
] as const;

type SearchCategory = (typeof AVAILABLE_SEARCH_CATEGORIES)[number];
type LogWriter = (message: string) => void;
type ToolLogSummary = Record<string, boolean | number | string | undefined>;
type CreateTickadooServerOptions = {
  logWriter?: LogWriter;
};

const SEARCH_CATEGORY_ALIASES: Record<string, SearchCategory> = {
  theatre: "theatre",
  theater: "theatre",
  play: "theatre",
  plays: "theatre",
  musical: "musicals",
  musicals: "musicals",
  tour: "tours",
  tours: "tours",
  food: "food",
  foodie: "food",
  family: "family",
  families: "family",
  kid: "family",
  kids: "family",
  nightlife: "nightlife",
  "night life": "nightlife",
  sightseeing: "sightseeing",
  attraction: "sightseeing",
  attractions: "sightseeing",
  concert: "concerts",
  concerts: "concerts",
  comedy: "comedy",
  comedian: "comedy",
  show: "shows",
  shows: "shows",
};

const SEARCH_CATEGORY_KEYWORDS: Record<SearchCategory, string[]> = {
  theatre: ["theatre", "theater", "play", "plays", "west end", "broadway", "stage"],
  musicals: ["musical", "musicals", "show tunes", "west end musical", "broadway musical"],
  tours: ["tour", "tours", "guided tour", "walking tour", "bus tour", "day trip", "excursion", "hop on hop off", "hop-on-hop-off"],
  food: ["food", "culinary", "dining", "afternoon tea", "tea", "brunch", "dinner", "cocktail", "cocktails", "wine", "beer", "tasting", "restaurant"],
  family: ["family", "families", "kids", "kid", "children", "child", "all ages", "interactive", "aquarium", "zoo", "dinosaur"],
  nightlife: ["nightlife", "late night", "late-night", "bar", "bars", "club", "clubs", "cabaret", "party", "after dark"],
  sightseeing: ["sightseeing", "landmark", "landmarks", "view", "views", "observation", "attraction", "attractions", "museum", "city pass", "hop on hop off", "hop-on-hop-off"],
  concerts: ["concert", "concerts", "live music", "gig", "band", "orchestra", "symphony", "recital"],
  comedy: ["comedy", "comedian", "comic", "stand up", "stand-up", "improv", "laugh"],
  shows: ["show", "shows", "performance", "performances", "cabaret", "magic", "circus", "spectacular"],
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeCityInput(city: string): string {
  return city.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function normalizeCityToken(city: string): string {
  return normalizeCityInput(city).replace(/-/g, "");
}

function normalizeCategoryText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function singularizeToken(token: string): string {
  if (token.endsWith("ies") && token.length > 3) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && token.length > 3 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }

  return token;
}

function stemCategoryText(value: unknown): string {
  return normalizeCategoryText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeToken)
    .join(" ");
}

function canonicalizeSearchCategory(value: unknown): SearchCategory | undefined {
  const normalized = normalizeCategoryText(value);
  const stemmed = stemCategoryText(value);
  return SEARCH_CATEGORY_ALIASES[normalized] ?? SEARCH_CATEGORY_ALIASES[stemmed];
}

function formatAvailableSearchCategories(): string {
  return AVAILABLE_SEARCH_CATEGORIES.join(", ");
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

export function productMatchesPriceRange(product: Product, minPrice?: number, maxPrice?: number): boolean {
  const price = product.minPrice;

  if (price == null) {
    return minPrice == null || minPrice === 0;
  }

  if (minPrice != null && price < minPrice) {
    return false;
  }

  if (maxPrice != null && price > maxPrice) {
    return false;
  }

  return true;
}

export function filterProductsByPrice(products: Product[], minPrice?: number, maxPrice?: number): Product[] {
  if (minPrice == null && maxPrice == null) {
    return products;
  }

  return products.filter(product => productMatchesPriceRange(product, minPrice, maxPrice));
}

function buildCategoryTerms(category: string): string[] {
  const normalized = normalizeCategoryText(category);
  const canonical = canonicalizeSearchCategory(category);
  const terms = new Set<string>();

  const addTerm = (term: string) => {
    const normalizedTerm = normalizeCategoryText(term);
    if (normalizedTerm) {
      terms.add(normalizedTerm);
    }

    const stemmedTerm = stemCategoryText(term);
    if (stemmedTerm) {
      terms.add(stemmedTerm);
    }
  };

  addTerm(category);
  if (normalized.endsWith("s")) {
    addTerm(normalized.slice(0, -1));
  } else if (normalized) {
    addTerm(`${normalized}s`);
  }

  if (canonical) {
    addTerm(canonical);
    for (const keyword of SEARCH_CATEGORY_KEYWORDS[canonical]) {
      addTerm(keyword);
    }
  }

  return [...terms];
}

export function productMatchesCategory(product: Product, category: string): boolean {
  const safeTitle = typeof product.title === "string" ? product.title : "";
  const safeDescription = typeof product.description === "string" ? product.description : "";
  const safeSlug = typeof product.slug === "string" ? product.slug.replace(/-/g, " ") : "";
  const haystackSource = `${safeTitle} ${safeDescription} ${safeSlug}`;
  const normalizedHaystack = normalizeCategoryText(haystackSource);
  const stemmedHaystack = stemCategoryText(haystackSource);

  return buildCategoryTerms(category).some(term => {
    const normalizedTerm = normalizeCategoryText(term);
    if (!normalizedTerm) {
      return false;
    }

    const stemmedTerm = stemCategoryText(term);
    return normalizedHaystack.includes(normalizedTerm) || stemmedHaystack.includes(stemmedTerm);
  });
}

export function filterProductsByCategory(products: Product[], category?: string): Product[] {
  if (!category) {
    return products;
  }

  return products.filter(product => productMatchesCategory(product, category));
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
type LoggedToolExecution = {
  response: ToolResponse;
  resultCount: number;
  summary?: ToolLogSummary;
};

function defaultLogWriter(message: string) {
  console.log(message);
}

function formatLogValue(value: boolean | number | string): string {
  if (typeof value === "string") {
    return /^[A-Za-z0-9._:/=-]+$/.test(value) ? value : JSON.stringify(value);
  }

  return String(value);
}

function serializeForDebugLog(value: unknown): string {
  if (value instanceof Error) {
    return JSON.stringify({
      name: value.name,
      message: value.message,
      stack: value.stack,
    });
  }

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}

function writeDebugLog(logWriter: LogWriter, toolName: string, phase: "request" | "response" | "error", value: unknown) {
  if (TICKADOO_LOG_LEVEL !== "debug") {
    return;
  }

  logWriter(`[MCP DEBUG] ${toolName} ts=${new Date().toISOString()} ${phase}=${serializeForDebugLog(value)}`);
}

function writeInfoLog(
  logWriter: LogWriter,
  toolName: string,
  summary: ToolLogSummary | undefined,
  resultCount: number,
  durationMs: number,
  isError: boolean,
) {
  if (TICKADOO_LOG_LEVEL === "none") {
    return;
  }

  const details = Object.entries(summary ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatLogValue(value!)}`);

  logWriter([
    `[MCP] ${toolName}`,
    `ts=${new Date().toISOString()}`,
    ...details,
    `results=${resultCount}`,
    `time=${durationMs}ms`,
    ...(isError ? ["error=true"] : []),
  ].join(" "));
}

function withToolLogging<TArgs>(
  toolName: string,
  logWriter: LogWriter,
  handler: (args: TArgs) => Promise<LoggedToolExecution>,
): (args: TArgs) => Promise<ToolResponse> {
  return async (args: TArgs) => {
    const startedAt = Date.now();
    writeDebugLog(logWriter, toolName, "request", args);

    try {
      const execution = await handler(args);
      writeInfoLog(
        logWriter,
        toolName,
        execution.summary,
        execution.resultCount,
        Date.now() - startedAt,
        execution.response.isError === true,
      );
      writeDebugLog(logWriter, toolName, "response", execution.response);
      return execution.response;
    } catch (error) {
      writeInfoLog(logWriter, toolName, undefined, 0, Date.now() - startedAt, true);
      writeDebugLog(logWriter, toolName, "error", error);
      throw error;
    }
  };
}

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

function getAvailableCategoriesForProducts(products: Product[]): string[] {
  return AVAILABLE_SEARCH_CATEGORIES
    .map(category => ({
      category,
      count: products.filter(product => productMatchesCategory(product, category)).length,
    }))
    .filter(entry => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category))
    .map(entry => entry.category);
}

async function getNearbyCitySuggestions(
  latitude: number,
  longitude: number,
  language: string,
  excludeCitySlugs: string[] = [],
) {
  return getNearestCoveredCities(latitude, longitude, language, NEARBY_CITY_SUGGESTION_LIMIT, excludeCitySlugs);
}

async function buildSearchMissResponse(
  city: string,
  language: string,
  suggestions: Array<{ city: City & { slug: string }; score: number }>,
) {
  const bestSuggestion = suggestions[0];
  if (bestSuggestion?.score >= SPELLING_CORRECTION_CONFIDENCE) {
    const nearbyCities = bestSuggestion.city.location
      ? await getNearbyCitySuggestions(
        bestSuggestion.city.location.latitude,
        bestSuggestion.city.location.longitude,
        language,
        [bestSuggestion.city.slug],
      )
      : [];

    return createTextResponse(formatDidYouMeanRecovery(
      city,
      { name: bestSuggestion.city.name, slug: bestSuggestion.city.slug },
      nearbyCities.map(entry => ({
        name: entry.city.name,
        slug: entry.city.slug,
        distanceKm: entry.distanceKm,
        experienceCount: entry.experienceCount,
      })),
    ));
  }

  const geocodedCity = await geocodeCityQuery(city);
  if (geocodedCity) {
    const nearbyCities = await getNearbyCitySuggestions(
      geocodedCity.latitude,
      geocodedCity.longitude,
      language,
    );

    return createTextResponse(formatNoCoverageRecovery(
      geocodedCity.name,
      nearbyCities.map(entry => ({
        name: entry.city.name,
        slug: entry.city.slug,
        distanceKm: entry.distanceKm,
        experienceCount: entry.experienceCount,
      })),
    ));
  }

  return createTextResponse(formatNoCoverageRecovery(city));
}

function validateSearchArgs(args: {
  city: string;
  language?: string;
  max_results?: number;
  min_price?: number;
  max_price?: number;
  category?: string;
}): ValidationResult<{
  city: string;
  language: string;
  maxResults: number;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
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

  if (args.category != null && !args.category.trim()) {
    return {
      ok: false,
      error: createErrorResponse(
        `Invalid category. If provided, category must be a non-empty string such as ${formatAvailableSearchCategories()}.`,
      ),
    };
  }

  if (args.min_price != null && (!Number.isFinite(args.min_price) || args.min_price < 0)) {
    return {
      ok: false,
      error: createErrorResponse(
        `Invalid min_price. It must be a non-negative number in the local currency (got: ${formatValue(args.min_price)}).`,
      ),
    };
  }

  if (args.max_price != null && (!Number.isFinite(args.max_price) || args.max_price < 0)) {
    return {
      ok: false,
      error: createErrorResponse(
        `Invalid max_price. It must be a non-negative number in the local currency (got: ${formatValue(args.max_price)}).`,
      ),
    };
  }

  if (args.min_price != null && args.max_price != null && args.min_price > args.max_price) {
    return {
      ok: false,
      error: createErrorResponse(
        `Invalid price range. min_price cannot be greater than max_price (got: min_price=${args.min_price}, max_price=${args.max_price}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      city,
      language: args.language ?? "en",
      maxResults,
      minPrice: args.min_price,
      maxPrice: args.max_price,
      category: args.category?.trim(),
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

export function createTickadooServer(options: CreateTickadooServerOptions = {}): McpServer {
  const logWriter = options.logWriter ?? defaultLogWriter;
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: SERVER_DESCRIPTION,
  });

  server.tool(
    "search_experiences",
    `Search for shows, theatre, events, tours and experiences in a specific city on tickadoo. Supports optional category filtering (${formatAvailableSearchCategories()}) plus optional min/max price filtering in the local currency. Use when a user asks what to do in a city, wants event/show recommendations, or is looking for tickets.`,
    {
      city: z.string().describe("City name or slug (e.g. 'london', 'new-york', 'paris', 'tokyo', 'dubai')"),
      language: z.string().optional().default("en").describe("Language code (e.g. 'en', 'de', 'fr', 'es')"),
      max_results: z.number().optional().default(DEFAULT_SEARCH_RESULT_LIMIT).describe(`Maximum number of experiences to return (default ${DEFAULT_SEARCH_RESULT_LIMIT}, max ${MAX_SEARCH_RESULT_LIMIT})`),
      category: z.string().optional().describe(`Optional category filter. Suggested values: ${formatAvailableSearchCategories()}`),
      min_price: z.number().optional().describe("Optional minimum price in the experience's local currency"),
      max_price: z.number().optional().describe("Optional maximum price in the experience's local currency"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("search_experiences", logWriter, async args => {
      const validated = validateSearchArgs(args);
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            city: typeof args.city === "string" ? args.city.trim() || "(empty)" : "(unknown)",
          },
        };
      }

      const {
        city,
        language,
        maxResults,
        minPrice,
        maxPrice,
        category,
      } = validated.data;

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
            return {
              response: await buildSearchMissResponse(city, language, candidates.slice(0, CITY_SUGGESTION_LIMIT)),
              resultCount: 0,
              summary: { city },
            };
          }
        }

        if (!products.length) {
          if (!matchedKnownCity) {
            return {
              response: await buildSearchMissResponse(city, language, []),
              resultCount: 0,
              summary: { city },
            };
          }

          return {
            response: createTextResponse(formatNoCoverageRecovery(cityName)),
            resultCount: 0,
            summary: { city },
          };
        }

        const categoryFilteredProducts = filterProductsByCategory(products, category);
        if (category && !categoryFilteredProducts.length) {
          return {
            response: createTextResponse(formatEmptyCategoryRecovery(
              category,
              cityName,
              getAvailableCategoriesForProducts(products),
            )),
            resultCount: 0,
            summary: { city },
          };
        }

        const matchingProducts = filterProductsByPrice(categoryFilteredProducts, minPrice, maxPrice);
        if (!matchingProducts.length) {
          const priceHint = minPrice != null || maxPrice != null
            ? " within the requested price range"
            : "";
          return {
            response: createTextResponse(
              `No experiences found for "${cityName}"${priceHint}. Try wider price filters, a different city, or location-based discovery with find_nearby_experiences(lat, lng).`,
            ),
            resultCount: 0,
            summary: { city },
          };
        }

        const rankedProducts = sortProductsForDisplay(matchingProducts);
        const topProducts = rankedProducts.slice(0, maxResults);
        const searchContext = category
          ? `in ${cityName} matching category "${category}"`
          : `in ${cityName}`;
        return {
          response: createTextResponse(
            appendNextStepHint(
              `${buildShownResultsLabel(topProducts.length, matchingProducts.length, searchContext)}\n\n${topProducts.map(product => formatProduct(product, `${citySlug}/${product.slug}`)).join("\n\n")}\n\nView all: ${buildBookingUrl(citySlug)}`,
              SEARCH_NEXT_STEP_HINT,
            ),
            {
              structuredContent: {
                city: cityName,
                citySlug,
                totalExperiences: matchingProducts.length,
                ...(category ? { category: canonicalizeSearchCategory(category) ?? category } : {}),
                ...(minPrice != null ? { minPrice } : {}),
                ...(maxPrice != null ? { maxPrice } : {}),
                experiences: topProducts.map(product => productStructuredData(product, `${citySlug}/${product.slug}`)),
              },
            },
          ),
          resultCount: topProducts.length,
          summary: { city },
        };
      } catch (error) {
        return {
          response: createErrorResponse(getErrorMessage(error)),
          resultCount: 0,
          summary: { city },
        };
      }
    }),
  );

  server.tool(
    "find_nearby_experiences",
    "Find shows, events and experiences near a geographic location on tickadoo. Use when a user shares their location or asks for things to do near them.",
    {
      latitude: z.number().describe("Latitude"),
      longitude: z.number().describe("Longitude"),
      radius_km: z.number().optional().default(DEFAULT_RADIUS_KM).describe(`Search radius in km (default ${DEFAULT_RADIUS_KM})`),
      language: z.string().optional().default("en").describe("Language code"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("find_nearby_experiences", logWriter, async args => {
      const validated = validateNearbyArgs(args);
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            lat: typeof args.latitude === "number" ? args.latitude : undefined,
            lng: typeof args.longitude === "number" ? args.longitude : undefined,
          },
        };
      }

      const { latitude, longitude, radiusKm, language } = validated.data;

      try {
        const products = await getProductsByLocation(latitude, longitude, radiusKm, language);
        if (!products.length) {
          const suggestedRadiusKm = Math.min(radiusKm * 2, MAX_RADIUS_KM);
          const [nearestCity] = await getNearbyCitySuggestions(latitude, longitude, language);
          return {
            response: createTextResponse(formatNearbyEmptyRecovery(
              radiusKm,
              suggestedRadiusKm,
              nearestCity ? { name: nearestCity.city.name } : undefined,
            )),
            resultCount: 0,
            summary: { lat: latitude, lng: longitude, radius_km: radiusKm },
          };
        }

        const rankedProducts = sortProductsForDisplay(products);
        const topProducts = rankedProducts.slice(0, DEFAULT_SEARCH_RESULT_LIMIT);
        return {
          response: createTextResponse(
            appendNextStepHint(
              `${buildShownResultsLabel(topProducts.length, products.length, "nearby")}\n\n${topProducts.map(product => formatProduct(product)).join("\n\n")}`,
              NEARBY_NEXT_STEP_HINT,
            ),
            {
              structuredContent: {
                latitude,
                longitude,
                radiusKm,
                totalExperiences: products.length,
                experiences: topProducts.map(product => productStructuredData(product)),
              },
            },
          ),
          resultCount: topProducts.length,
          summary: { lat: latitude, lng: longitude, radius_km: radiusKm },
        };
      } catch (error) {
        return {
          response: createErrorResponse(getErrorMessage(error)),
          resultCount: 0,
          summary: { lat: latitude, lng: longitude, radius_km: radiusKm },
        };
      }
    }),
  );

  server.tool(
    "list_cities",
    "List all cities where tickadoo has bookable experiences. Use to help users discover available destinations.",
    {
      language: z.string().optional().default("en").describe("Language code"),
      query: z.string().optional().describe("Optional city name or slug filter (e.g. 'new', 'paris', 'tokyo')"),
      limit: z.number().optional().default(DEFAULT_CITY_DIRECTORY_LIMIT).describe(`Maximum number of cities to return (default ${DEFAULT_CITY_DIRECTORY_LIMIT})`),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("list_cities", logWriter, async args => {
      const validated = validateListCitiesArgs(args);
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            query: typeof args.query === "string" ? args.query.trim() || "(empty)" : "all",
          },
        };
      }

      const { language, query, limit } = validated.data;

      try {
        const filter = query?.toLowerCase();
        const withSlug = (await getCities(language))
          .filter((city): city is City & { slug: string } => Boolean(city.slug))
          .filter(city => !filter || city.name.toLowerCase().includes(filter) || city.slug.toLowerCase().includes(filter))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!withSlug.length) {
          return {
            response: createErrorResponse(`No cities found matching "${query}". Try a broader filter like "new", "paris", or "tokyo".`),
            resultCount: 0,
            summary: { query: query ?? "all" },
          };
        }

        const cities = withSlug.slice(0, limit);
        const list = cities.map(city => `📍 ${city.name} → ${buildBookingUrl(city.slug)}`).join("\n");
        const header = filter
          ? `Found ${withSlug.length} matching cities${withSlug.length > cities.length ? ` (showing ${cities.length})` : ""}:`
          : `Showing ${cities.length} of ${withSlug.length} cities, sorted alphabetically. Use the optional query parameter to filter further:`;

        return {
          response: createTextResponse(
            appendNextStepHint(
              `tickadoo® city directory\n\n${header}\n\n${list}`,
              filter ? FILTERED_CITIES_NEXT_STEP_HINT : undefined,
            ),
          ),
          resultCount: cities.length,
          summary: { query: query ?? "all" },
        };
      } catch (error) {
        return {
          response: createErrorResponse(getErrorMessage(error)),
          resultCount: 0,
          summary: { query: query ?? "all" },
        };
      }
    }),
  );

  server.tool(
    "get_experience_details",
    "Get detailed availability, venue details, and images for a specific tickadoo experience. Prefer passing the tickadoo slug or booking URL path; provider and provider_id are legacy fallback inputs.",
    {
      slug: z.string().optional().describe("Preferred: tickadoo slug or path, e.g. 'london-dungeon-tickets' or '/london/london-dungeon-tickets'"),
      provider: z.string().optional().describe("Legacy fallback only: hidden provider name used internally"),
      provider_id: z.string().optional().describe("Legacy fallback only: hidden provider-specific product ID"),
      days: z.number().int().min(1).max(180).optional().default(30).describe("Number of days of availability to fetch (default 30, max 180)"),
      language: z.string().optional().default("en").describe("Reserved for future language-aware API support"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("get_experience_details", logWriter, async args => {
      const validated = validateExperienceDetailsArgs(args);
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            slug: typeof args.slug === "string" ? args.slug.trim() || "(empty)" : undefined,
          },
        };
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
        return {
          response: createTextResponse(
            appendNextStepHint([
              resolved ? `🎭 ${resolved.product.title}` : "",
              formatExperienceDetails(days, details),
              resolved ? `   🔗 ${buildBookingUrl(resolved.bookingPath)}` : "",
            ].filter(Boolean).join("\n"), resolved ? DETAILS_NEXT_STEP_HINT : undefined),
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
          ),
          resultCount: 1,
          summary: { slug: slug ?? `${providerName}:${detailsProviderId}` },
        };
      } catch (error) {
        return {
          response: createErrorResponse(getErrorMessage(error)),
          resultCount: 0,
          summary: { slug: slug ?? `${provider ?? ""}:${providerId ?? ""}` },
        };
      }
    }),
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
