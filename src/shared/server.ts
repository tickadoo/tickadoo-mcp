import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  EXPERIENCE_CARD_URI,
  EXPERIENCE_MAP_URI,
  EXPERIENCE_TRIO_URI,
  registerTickadooUiResources,
  uiMeta,
} from "./ui-resources.js";
import { neonQuery } from "./neon.js";
import {
  extractTopProductIds,
  recordAgentCall,
  stampAgentCallId,
  type SqlClient,
} from "./telemetry.js";
import {
  buildAvailabilityCheckPayload,
  calculateAvailabilityWindowDays,
  CHECK_AVAILABILITY_NEXT_STEP_HINT,
  DEFAULT_PARTY_SIZE,
  formatAvailabilityCheck,
  MAX_PARTY_SIZE,
} from "./availability.js";
import {
  buildComparisonPayload,
  formatComparisonText,
  type ComparableExperience,
} from "./compare.js";
import {
  buildWhatsOnThisWeek,
  createWhatsOnThisWeekWindow,
  formatWhatsOnThisWeekText,
} from "../whats-on-this-week.js";
import {
  DEFAULT_LAST_MINUTE_HOURS,
  MAX_LAST_MINUTE_HOURS,
  buildLastMinuteResult,
  formatLastMinuteText,
} from "../last-minute.js";
import {
  buildFamilyDayPayload,
  deriveFamilyDayProfile,
  formatFamilyDayText,
  scoreFamilyDayCandidate,
  type FamilyDayCandidate,
} from "./family-day.js";
import {
  buildCityGuide,
  formatCityGuide,
  lookupCityCountry,
} from "./city-guide.js";
import {
  buildTravelTipsPayload,
  formatTravelTips,
  normalizeTravelTipTopic,
  SUPPORTED_TRAVEL_TIP_CITIES,
  TRAVEL_TIP_TOPICS,
  type TravelTipTopic,
} from "./travel-tips.js";
import {
  buildBookingUrl,
  geocodeCityQuery,
  getCities,
  getExperienceDetails,
  getMcpEnrichedProducts,
  getNearestCoveredCities,
  getProductsByLocation,
  getProductsForCitySlug,
  resolveProductBySlug,
  heuristicEnrich,
  normalizeSlugOrPath,
} from "./api.js";
import {
  DEFAULT_LANGUAGE,
  PRODUCT_FEED_URL,
  SERVER_DESCRIPTION,
  SERVER_NAME,
  SERVER_VERSION,
  SITE,
  SUPPORTED_LANGUAGE_CODE_SET,
  TICKADOO_LOG_LEVEL,
} from "./config.js";
import {
  appendNextStepHint,
  cityDirectoryJsonPayload,
  DETAILS_NEXT_STEP_HINT,
  didYouMeanRecoveryJson,
  emptyCategoryRecoveryJson,
  experienceDetailsJsonPayload,
  FILTERED_CITIES_NEXT_STEP_HINT,
  formatDidYouMeanRecovery,
  formatEmptyCategoryRecovery,
  formatExperienceDetails,
  formatOmittedResultsHint,
  formatNearbyEmptyRecovery,
  formatNoCoverageRecovery,
  formatJsonText,
  formatProduct,
  formatSearchFiltersLine,
  formatSearchSortLine,
  genericJsonError,
  NEARBY_NEXT_STEP_HINT,
  nearbyEmptyRecoveryJson,
  nearbyJsonPayload,
  noCoverageRecoveryJson,
  productStructuredData,
  RESPONSE_FORMATS,
  type ResponseFormat,
  SEARCH_NEXT_STEP_HINT,
  searchJsonPayload,
  buildAvailableFilters,
  buildRelatedSearches,
  buildBestPicks,
  buildBestPicksText,
  buildPriceTiers,
  buildGroupSummary,
  buildConversationStarters,
  buildResultSummaryLine,
  formatAvailableFiltersHint,
  formatCancellation,
  formatDuration,
  type SearchAppliedFilters,
  type SearchOmittedResults,
} from "./format.js";
import {
  buildTransferPayload,
  formatTransferInfo,
  getSupportedTransferCities,
  isTransferFromType,
  resolveTransferCity,
  TRANSFER_FROM_TYPES,
  type TransferFromType,
} from "./transfer.js";
import {
  buildTonightResult,
  formatLocalClock,
  formatLocalIsoDate,
  formatTonightText,
  toWhatsOnTonightPayload,
  type TonightSourceExperience,
} from "./tonight.js";
import type { City, McpProduct, Product, ResolvedProduct, StructuredDataResponse } from "./types.js";

const DEFAULT_SEARCH_RESULT_LIMIT = 12;
const MAX_SEARCH_RESULT_LIMIT = 200;
const WHATS_ON_THIS_WEEK_PRODUCT_LIMIT = 24;
const DEFAULT_WHATS_ON_TONIGHT_LIMIT = 10;
const MAX_WHATS_ON_TONIGHT_LIMIT = 25;
const TONIGHT_DETAIL_BATCH_SIZE = 8;
const TONIGHT_MIN_CANDIDATES = 18;
const TONIGHT_MAX_CANDIDATES = 40;
const LAST_MINUTE_PRODUCT_LIMIT = 24;
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
  "outdoor",
  "workshops",
  "cruises",
  "sports",
] as const;
export const SEARCH_SORT_OPTIONS = [
  "relevance",
  "popular",
  "price_low",
  "price_high",
  "rating",
  "best_value",
] as const;
export const SEARCH_MOOD_OPTIONS = [
  "adventurous",
  "romantic",
  "relaxing",
  "family_fun",
  "cultural",
  "thrill_seeking",
  "foodie",
  "budget_friendly",
  "luxury",
  "rainy_day",
] as const;
const LANGUAGE_SUPPORT_NOTE = "Supports 40+ languages — pass a language code (e.g. 'de', 'fr', 'es', 'ja') to get localised booking URLs.";
const LANGUAGE_PARAM_DESCRIPTION = "Supported language code for localised booking URLs (e.g. 'en', 'de', 'fr', 'es', 'ja', 'pt-br')";

type SearchCategory = (typeof AVAILABLE_SEARCH_CATEGORIES)[number];
export type SearchSort = (typeof SEARCH_SORT_OPTIONS)[number];
export type SearchMood = (typeof SEARCH_MOOD_OPTIONS)[number];
type LogWriter = (message: string) => void;
type ToolLogSummary = Record<string, boolean | number | string | undefined>;
type CreateTickadooServerOptions = {
  logWriter?: LogWriter;
  telemetrySql?: SqlClient | null;
};
const SEARCH_SORT_OPTION_SET = new Set<string>(SEARCH_SORT_OPTIONS);
const SEARCH_MOOD_OPTION_SET = new Set<string>(SEARCH_MOOD_OPTIONS);

type SearchMoodFilters = {
  audience?: string;
  tags?: string;
  setting?: "Indoor" | "Outdoor" | "Mixed";
  physicalLevel?: "Easy" | "Moderate" | "Demanding";
  maxPrice?: number;
  minRating?: number;
  sort: SearchSort;
};

const SEARCH_MOOD_FILTERS: Record<SearchMood, SearchMoodFilters> = {
  adventurous: {
    tags: "Adventure,Outdoor,WaterSport",
    sort: "rating",
  },
  romantic: {
    audience: "Couples",
    tags: "Evening,Cruise,Dining",
    sort: "rating",
  },
  relaxing: {
    tags: "Spa,Cruise",
    physicalLevel: "Easy",
    sort: "best_value",
  },
  family_fun: {
    audience: "Family",
    tags: "KidsAttraction,Outdoor",
    sort: "popular",
  },
  cultural: {
    tags: "Museum,WalkingTour,GuidedTour",
    sort: "rating",
  },
  thrill_seeking: {
    tags: "Adventure,Helicopter,WaterSport",
    sort: "popular",
  },
  foodie: {
    tags: "FoodTour,Dining,Workshop",
    sort: "rating",
  },
  budget_friendly: {
    maxPrice: 30,
    sort: "price_low",
  },
  luxury: {
    minRating: 4.5,
    sort: "price_high",
  },
  rainy_day: {
    setting: "Indoor",
    tags: "Museum,Show,Theatre",
    sort: "popular",
  },
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
  outdoor: "outdoor",
  outdoors: "outdoor",
  workshop: "workshops",
  workshops: "workshops",
  class: "workshops",
  classes: "workshops",
  cruise: "cruises",
  cruises: "cruises",
  sport: "sports",
  sports: "sports",
  game: "sports",
  games: "sports",
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
  outdoor: ["outdoor", "outdoors", "garden", "park", "nature", "hiking", "bike", "cycling", "kayak", "adventure"],
  workshops: ["workshop", "workshops", "class", "classes", "masterclass", "lesson", "course", "learn", "making"],
  cruises: ["cruise", "cruises", "boat", "river", "harbor", "harbour", "sailing", "catamaran", "yacht", "sunset cruise"],
  sports: ["sport", "sports", "game", "games", "match", "stadium", "race", "racing", "football", "baseball", "basketball", "tennis"],
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

export function normalizeSearchMood(value: string | undefined): SearchMood | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  return SEARCH_MOOD_OPTION_SET.has(normalized)
    ? normalized as SearchMood
    : undefined;
}

export function getSearchMoodFilters(mood: SearchMood): SearchMoodFilters {
  return { ...SEARCH_MOOD_FILTERS[mood] };
}

function formatAvailableSearchCategories(): string {
  return AVAILABLE_SEARCH_CATEGORIES.join(", ");
}

function formatAvailableSearchSorts(): string {
  return SEARCH_SORT_OPTIONS.join(", ");
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

function mergeEnrichedProduct(product: Product, enrichedProducts: Map<string, McpProduct>): Product {
  const mcpProduct = enrichedProducts.get(product.slug);
  if (mcpProduct) {
    return { ...product, mcpProduct };
  }
  // Fallback: create synthetic McpProduct from API data and run heuristic enrichment
  // This catches products not in the MCP feed (e.g., Broadway musicals)
  const synthetic: McpProduct = {
    niceId: 0,
    name: product.title,
    url: product.slug,
    minPrice: product.minPrice ?? 0,
    reviewRating: product.averageRating,
    reviewCount: null,
    indoorOutdoor: null,
    physicalLevel: null,
    audience: [],
    tags: [],
    wheelchairAccessible: null,
    strollerFriendly: null,
    languageOptions: [],
    variants: [],
  };
  return { ...product, mcpProduct: heuristicEnrich(synthetic) };
}

function mergeEnrichedProducts(products: Product[], enrichedProducts: Map<string, McpProduct>): Product[] {
  if (!enrichedProducts.size) {
    return products;
  }

  return products.map(product => mergeEnrichedProduct(product, enrichedProducts));
}

function mergeEnrichedDetails(
  details: StructuredDataResponse,
  slug: string | undefined,
  enrichedProducts: Map<string, McpProduct>,
): StructuredDataResponse {
  if (!slug) {
    return details;
  }

  const mcpProduct = enrichedProducts.get(slug);
  return mcpProduct ? { ...details, mcpProduct } : details;
}

function getComparisonPriceFrom(product: Product, details: StructuredDataResponse): number | null {
  const slotPrices = details.dates
    .map(item => item.minPrice)
    .filter((value): value is number => Number.isFinite(value));

  if (slotPrices.length) {
    return Math.min(...slotPrices);
  }

  return product.minPrice ?? details.mcpProduct?.minPrice ?? null;
}

function buildComparableExperience(
  resolved: ResolvedProduct,
  details: StructuredDataResponse,
  language: string,
): ComparableExperience {
  const primaryVariant = details.mcpProduct?.variants?.[0];
  return {
    slug: resolved.product.slug,
    title: resolved.product.title,
    priceFrom: getComparisonPriceFrom(resolved.product, details),
    currency: details.currencyCode ?? resolved.product.currency,
    duration: formatDuration(primaryVariant?.duration ?? null),
    rating: details.mcpProduct?.reviewRating ?? resolved.product.averageRating ?? null,
    reviewCount: details.mcpProduct?.reviewCount ?? null,
    tags: details.mcpProduct?.tags ?? [],
    audience: details.mcpProduct?.audience ?? [],
    wheelchairAccessible: details.mcpProduct?.wheelchairAccessible ?? null,
    strollerFriendly: details.mcpProduct?.strollerFriendly ?? null,
    cancellationPolicy: formatCancellation(primaryVariant?.cancellationPolicy, primaryVariant?.cancellationPeriod ?? null),
    bookingUrl: buildBookingUrl(resolved.bookingPath, language),
  };
}

function deriveFamilyDayCategory(product: Product, details?: StructuredDataResponse): string {
  const values = [
    ...(details?.mcpProduct?.tags ?? []),
    ...(details?.mcpProduct?.audience ?? []),
    ...(product.mcpProduct?.tags ?? []),
    ...(product.mcpProduct?.audience ?? []),
    product.title,
  ].join(" ").toLowerCase();

  if (/musical|show|concert|broadway|westend/.test(values)) return "theatre";
  if (/cruise|boat|river|harbour|harbor/.test(values)) return "cruise";
  if (/food|dining|afternoon tea|cocktail|wine/.test(values)) return "food";
  if (/workshop|class|masterclass/.test(values)) return "workshop";
  if (/tour|guided|walking/.test(values)) return "tour";
  if (/museum|zoo|aquarium|attraction|kidsattraction/.test(values)) return "attraction";
  return "experience";
}

function getFamilyDayPrice(product: Product, details: StructuredDataResponse | undefined, requestedDate?: string): number | null {
  const preferredDates = details?.dates.filter(item => !requestedDate || item.date === requestedDate) ?? [];
  const pricedDates = (preferredDates.length ? preferredDates : details?.dates ?? [])
    .map(item => item.minPrice)
    .filter((value): value is number => Number.isFinite(value));

  if (pricedDates.length) {
    return Math.min(...pricedDates);
  }

  return product.minPrice ?? details?.mcpProduct?.minPrice ?? null;
}

function buildFamilyDayCandidate(
  product: Product,
  citySlug: string,
  language: string,
  details?: StructuredDataResponse,
  requestedDate?: string,
): FamilyDayCandidate {
  const mcpProduct = details?.mcpProduct ?? product.mcpProduct;
  const primaryVariant = mcpProduct?.variants?.[0];
  const location = details?.locationWithAddress;

  return {
    slug: product.slug,
    title: product.title,
    category: deriveFamilyDayCategory(product, details),
    priceFrom: getFamilyDayPrice(product, details, requestedDate),
    currency: details?.currencyCode ?? product.currency,
    duration: formatDuration(primaryVariant?.duration ?? null),
    tags: mcpProduct?.tags ?? [],
    audience: mcpProduct?.audience ?? [],
    wheelchairAccessible: mcpProduct?.wheelchairAccessible ?? null,
    strollerFriendly: mcpProduct?.strollerFriendly ?? null,
    physicalLevel: mcpProduct?.physicalLevel ?? null,
    indoorOutdoor: mcpProduct?.indoorOutdoor ?? null,
    bookingUrl: buildBookingUrl(`${citySlug}/${product.slug}`, language),
    address: location?.address ?? product.address,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    rating: mcpProduct?.reviewRating ?? product.averageRating ?? null,
    reviewCount: mcpProduct?.reviewCount ?? null,
  };
}

function productHasImage(product: Product): boolean {
  return Boolean(product.desktopFeatureImageUrl || product.verticalImageUrl);
}

function productHasDescription(product: Product): boolean {
  return typeof product.description === "string" && product.description.trim().length > 0;
}

export function isPopularSearchProduct(product: Product): boolean {
  const rating = product.averageRating ?? 0;
  const reviewCount = product.mcpProduct?.reviewCount ?? 0;
  return (
    product.minPrice != null
    && productHasImage(product)
    && productHasDescription(product)
    && rating >= 4.5
    && reviewCount >= 100
  );
}

function compareProductsByRating(a: Product, b: Product): number {
  const ratingDelta = (b.averageRating ?? -1) - (a.averageRating ?? -1);
  if (ratingDelta !== 0) return ratingDelta;

  const pricedFirst = Number(a.minPrice == null) - Number(b.minPrice == null);
  if (pricedFirst !== 0) return pricedFirst;

  if (a.minPrice != null && b.minPrice != null) {
    const priceDelta = a.minPrice - b.minPrice;
    if (priceDelta !== 0) return priceDelta;
  }

  return a.title.localeCompare(b.title);
}

function compareProductsByPriceLow(a: Product, b: Product): number {
  const pricedFirst = Number(a.minPrice == null) - Number(b.minPrice == null);
  if (pricedFirst !== 0) return pricedFirst;

  if (a.minPrice != null && b.minPrice != null) {
    const priceDelta = a.minPrice - b.minPrice;
    if (priceDelta !== 0) return priceDelta;
  }

  const ratingDelta = (b.averageRating ?? -1) - (a.averageRating ?? -1);
  if (ratingDelta !== 0) return ratingDelta;

  return a.title.localeCompare(b.title);
}

function compareProductsByPriceHigh(a: Product, b: Product): number {
  const pricedFirst = Number(a.minPrice == null) - Number(b.minPrice == null);
  if (pricedFirst !== 0) return pricedFirst;

  if (a.minPrice != null && b.minPrice != null) {
    const priceDelta = b.minPrice - a.minPrice;
    if (priceDelta !== 0) return priceDelta;
  }

  const ratingDelta = (b.averageRating ?? -1) - (a.averageRating ?? -1);
  if (ratingDelta !== 0) return ratingDelta;

  return a.title.localeCompare(b.title);
}

function popularityScore(product: Product): number {
  const rating = product.averageRating ?? 0;
  const reviewCount = product.mcpProduct?.reviewCount ?? 0;
  const hasImage = productHasImage(product) ? 1 : 0;
  const hasPrice = product.minPrice != null ? 1 : 0;
  // Weighted score: rating * 10 + log2(reviewCount + 1) + image/price bonuses
  return (rating * 10) + Math.log2(reviewCount + 1) + (hasImage * 3) + (hasPrice * 2);
}

function compareProductsByPopularity(a: Product, b: Product): number {
  const popularDelta = Number(isPopularSearchProduct(b)) - Number(isPopularSearchProduct(a));
  if (popularDelta !== 0) return popularDelta;

  const ratingDelta = (b.averageRating ?? -1) - (a.averageRating ?? -1);
  if (ratingDelta !== 0) return ratingDelta;

  const scoreDelta = popularityScore(b) - popularityScore(a);
  if (Math.abs(scoreDelta) > 0.1) return scoreDelta > 0 ? 1 : -1;

  return a.title.localeCompare(b.title);
}

/** Sort by best value: highest rating/price ratio (great experiences at good prices). */
function compareProductsByBestValue(a: Product, b: Product): number {
  const aRating = a.averageRating ?? 0;
  const bRating = b.averageRating ?? 0;
  const aPrice = a.minPrice ?? 999;
  const bPrice = b.minPrice ?? 999;
  // Value score: rating / (price / 10) — higher is better
  const aValue = aPrice > 0 ? (aRating / (aPrice / 10)) : 0;
  const bValue = bPrice > 0 ? (bRating / (bPrice / 10)) : 0;
  if (bValue !== aValue) return bValue - aValue;
  // Tiebreak by rating
  return bRating - aRating;
}

export function sortProductsForSearch(products: Product[], sort: SearchSort = "relevance"): Product[] {
  const comparator = {
    relevance: compareProductsByPopularity,
    popular: compareProductsByPopularity,
    price_low: compareProductsByPriceLow,
    price_high: compareProductsByPriceHigh,
    rating: compareProductsByRating,
    best_value: compareProductsByBestValue,
  } satisfies Record<SearchSort, (left: Product, right: Product) => number>;

  return [...products].sort(comparator[sort]);
}

function tonightProductBoost(product: Product): number {
  const tags = (product.mcpProduct?.tags || []).join(" ").toLowerCase();
  let boost = 0;
  if (tags.includes("evening")) boost += 4;
  if (tags.includes("nightlife")) boost += 4;
  if (tags.includes("show") || tags.includes("musical") || tags.includes("theatre")) boost += 3;
  if (isPopularSearchProduct(product)) boost += 1;
  return boost;
}

function sortProductsForTonight(products: Product[]): Product[] {
  return [...products].sort((left, right) =>
    tonightProductBoost(right) - tonightProductBoost(left)
    || compareProductsByPopularity(left, right)
    || compareProductsByRating(left, right)
    || compareProductsByPriceLow(left, right)
    || left.title.localeCompare(right.title)
  );
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

function buildQueryTerms(query: string): { normalized: string[]; stemmed: string[] } {
  const normalized = normalizeCategoryText(query)
    .split(/\s+/)
    .filter(Boolean);
  const stemmed = stemCategoryText(query)
    .split(/\s+/)
    .filter(Boolean);

  return { normalized, stemmed };
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

export function productMatchesQuery(product: Product, query: string): boolean {
  const safeTitle = typeof product.title === "string" ? product.title : "";
  const safeDescription = typeof product.description === "string" ? product.description : "";
  const haystackSource = `${safeTitle} ${safeDescription}`;
  const normalizedHaystack = normalizeCategoryText(haystackSource);
  const stemmedHaystack = stemCategoryText(haystackSource);
  const normalizedQuery = normalizeCategoryText(query);
  const stemmedQuery = stemCategoryText(query);

  if (!normalizedQuery) {
    return true;
  }

  if (normalizedHaystack.includes(normalizedQuery) || stemmedHaystack.includes(stemmedQuery)) {
    return true;
  }

  const terms = buildQueryTerms(query);
  return (
    terms.normalized.length > 0
      && terms.normalized.every(term => normalizedHaystack.includes(term))
  ) || (
    terms.stemmed.length > 0
      && terms.stemmed.every(term => stemmedHaystack.includes(term))
  );
}

/** Filter products by enriched tag metadata. Matches if product has at least one of the requested tags. */
export function filterProductsByTags(products: Product[], tags?: string): Product[] {
  if (!tags) return products;
  const requestedTags = tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  if (!requestedTags.length) return products;
  return products.filter(product => {
    const productTags = (product.mcpProduct?.tags || []).map(t => t.toLowerCase());
    return requestedTags.some(rt => productTags.includes(rt));
  });
}

/** Filter products by audience suitability. Matches if product has at least one of the requested audiences. */
export function filterProductsByAudience(products: Product[], audience?: string): Product[] {
  if (!audience) return products;
  const requested = audience.split(",").map(a => a.trim().toLowerCase()).filter(Boolean);
  if (!requested.length) return products;
  return products.filter(product => {
    const productAudience = (product.mcpProduct?.audience || []).map(a => a.toLowerCase());
    return requested.some(a => productAudience.includes(a));
  });
}

/** Filter products by indoor/outdoor setting. */
export function filterProductsBySetting(products: Product[], setting?: string): Product[] {
  if (!setting) return products;
  const s = setting.trim().toLowerCase();
  if (!["indoor", "outdoor", "mixed"].includes(s)) return products;
  return products.filter(product => {
    const ps = (product.mcpProduct?.indoorOutdoor || "").toLowerCase();
    if (s === "indoor") return ps === "indoor" || ps === "mixed";
    if (s === "outdoor") return ps === "outdoor" || ps === "mixed";
    return ps === s;
  });
}

/** Filter products by wheelchair accessibility. */
export function filterProductsByAccessibility(products: Product[], wheelchair?: boolean): Product[] {
  if (wheelchair == null) return products;
  return products.filter(product => {
    return wheelchair ? product.mcpProduct?.wheelchairAccessible === true : product.mcpProduct?.wheelchairAccessible !== true;
  });
}

/** Filter products by physical difficulty level. */
export function filterProductsByPhysicalLevel(products: Product[], level?: string): Product[] {
  if (!level) return products;
  const l = level.trim().toLowerCase();
  if (!["easy", "moderate", "demanding"].includes(l)) return products;
  return products.filter(product => {
    const pl = (product.mcpProduct?.physicalLevel || "").toLowerCase();
    return pl === l;
  });
}

/** Parse ISO 8601 duration (PT2H30M) to minutes. */
/** Parse .NET TimeSpan format (DD.HH:MM:SS or HH:MM:SS) to minutes. */
function parseDurationToMinutes(dur: string | null): number | null {
  if (!dur) return null;
  const trimmed = dur.trim();
  // Match DD.HH:MM:SS or HH:MM:SS format
  const m = trimmed.match(/^(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const days = parseInt(m[1] || "0", 10);
  const hours = parseInt(m[2], 10);
  const minutes = parseInt(m[3], 10);
  return (days * 24 * 60) + (hours * 60) + minutes;
}

/** Filter products by duration range in minutes. */
export function filterProductsByDuration(products: Product[], minDur?: number, maxDur?: number): Product[] {
  if (minDur == null && maxDur == null) return products;
  return products.filter(product => {
    const mins = parseDurationToMinutes(product.mcpProduct?.variants?.[0]?.duration ?? null);
    if (mins == null) return minDur == null;
    if (minDur != null && mins < minDur) return false;
    if (maxDur != null && mins > maxDur) return false;
    return true;
  });
}

/** Filter products by available language (ISO 639-1 code). */
/** Filter products by minimum rating. */
export function filterProductsByRating(products: Product[], minRating?: number): Product[] {
  if (minRating == null) return products;
  return products.filter(product => {
    const rating = product.averageRating ?? product.mcpProduct?.reviewRating ?? null;
    if (rating == null) return false;
    return rating >= minRating;
  });
}

/** Filter products by free cancellation policy. */
export function filterProductsByFreeCancellation(products: Product[], freeCancellation?: boolean): Product[] {
  if (freeCancellation == null) return products;
  return products.filter(product => {
    const policy = product.mcpProduct?.variants?.[0]?.cancellationPolicy;
    const isFree = policy === "BeforeTimeslot" || policy === "BeforeDate";
    return freeCancellation ? isFree : !isFree;
  });
}

export function filterProductsByLanguage(products: Product[], lang?: string): Product[] {
  if (!lang) return products;
  const l = lang.trim().toLowerCase();
  if (!l) return products;
  return products.filter(product => {
    const langs = (product.mcpProduct?.languageOptions || []).map(x => x.toLowerCase());
    return langs.includes(l);
  });
}

export function filterProductsByQuery(products: Product[], query?: string): Product[] {
  if (!query) {
    return products;
  }

  return products.filter(product => productMatchesQuery(product, query));
}

function buildShownResultsLabel(shown: number, total: number, context: string): string {
  const prefix = total > shown ? `Showing top ${shown} of ${total}` : `Showing ${shown} of ${total}`;
  return `${prefix} experiences ${context}:`;
}

function buildSearchContext(cityName: string): string {
  return `in ${cityName}`;
}

function buildAppliedSearchFilters(
  language: string,
  options?: {
    category?: string;
    query?: string;
    minPrice?: number;
    maxPrice?: number;
    dateFrom?: string;
    dateTo?: string;
  },
): SearchAppliedFilters | undefined {
  const filters: SearchAppliedFilters = {
    ...(options?.category ? { category: options.category } : {}),
    ...(options?.query ? { query: options.query } : {}),
    ...(options?.minPrice != null ? { minPrice: options.minPrice } : {}),
    ...(options?.maxPrice != null ? { maxPrice: options.maxPrice } : {}),
    ...(options?.dateFrom ? { dateFrom: options.dateFrom } : {}),
    ...(options?.dateTo ? { dateTo: options.dateTo } : {}),
    ...(language !== DEFAULT_LANGUAGE ? { language } : {}),
  };

  return Object.keys(filters).length ? filters : undefined;
}

function buildPriceOmittedReason(minPrice?: number, maxPrice?: number): string {
  if (minPrice != null && maxPrice != null) {
    return "outside price range";
  }
  if (minPrice != null) {
    return "below minimum price";
  }
  return "above maximum price";
}

function buildOmittedResultsSummary(
  totalProducts: number,
  categoryFilteredProducts: Product[],
  queryFilteredProducts: Product[],
  matchingProducts: Product[],
  options?: {
    category?: string;
    query?: string;
    minPrice?: number;
    maxPrice?: number;
  },
): SearchOmittedResults | undefined {
  const totalOmitted = totalProducts - matchingProducts.length;
  if (totalProducts <= 0 || totalOmitted <= 0 || totalOmitted / totalProducts <= 0.2) {
    return undefined;
  }

  const reasons: SearchOmittedResults["reasons"] = [];

  if (options?.category) {
    const count = totalProducts - categoryFilteredProducts.length;
    if (count > 0) {
      reasons.push({
        filter: "category",
        count,
        reason: "didn't match category",
      });
    }
  }

  if (options?.query) {
    const count = categoryFilteredProducts.length - queryFilteredProducts.length;
    if (count > 0) {
      reasons.push({
        filter: "query",
        count,
        reason: "didn't match query",
      });
    }
  }

  if (options?.minPrice != null || options?.maxPrice != null) {
    const count = queryFilteredProducts.length - matchingProducts.length;
    if (count > 0) {
      reasons.push({
        filter: "price",
        count,
        reason: buildPriceOmittedReason(options?.minPrice, options?.maxPrice),
      });
    }
  }

  return reasons.length ? { total: totalOmitted, reasons } : undefined;
}

function buildNoResultsMessage(
  cityName: string,
  options?: {
    category?: string;
    query?: string;
    minPrice?: number;
    maxPrice?: number;
    dateFrom?: string;
    dateTo?: string;
  },
): string {
  const filters: string[] = [];
  if (options?.category) {
    filters.push(`category "${options.category}"`);
  }
  if (options?.query) {
    filters.push(`query "${options.query}"`);
  }

  const withFilters = filters.length ? ` matching ${filters.join(" and ")}` : "";
  const priceHint = options?.minPrice != null || options?.maxPrice != null
    ? " within the requested price range"
    : "";
  const dateHint = options?.dateFrom && options?.dateTo
    ? ` for ${options.dateFrom} to ${options.dateTo}`
    : "";

  return `No experiences found in "${cityName}"${withFilters}${priceHint}${dateHint}. Try a broader query, a different category, wider price filters, different dates, a different city, or location-based discovery with find_nearby_experiences(lat, lng).`;
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

function formatRelatedAsText(payload: { source_id: string; context: string; results: Array<{ title?: string | null; rating?: number | null; edge_type: string; edge_strength: number }> }): string {
  if (!payload.results.length) {
    return "No related experiences found for " + payload.source_id;
  }
  const lines = [
    "Related experiences (" + payload.context + ") for " + payload.source_id + ":",
    ...payload.results.map((r, i) =>
      (i + 1) + ". " + (r.title || "Untitled experience")
      + (r.rating ? " - " + r.rating + " stars" : "")
      + " (" + r.edge_type + ", strength " + Number(r.edge_strength).toFixed(2) + ")"
    ),
  ];
  return lines.join("\n");
}

function createErrorResponse(message: string) {
  return createTextResponse(`Error: ${message}`, { isError: true });
}

function createFormattedResponse(
  format: ResponseFormat,
  text: string,
  jsonPayload: Record<string, unknown>,
  options?: { isError?: boolean; structuredContent?: unknown },
) {
  return createTextResponse(
    format === "json" ? formatJsonText(jsonPayload) : text,
    {
      isError: options?.isError,
      structuredContent: format === "json"
        ? jsonPayload
        : options?.structuredContent,
    },
  );
}

function createFormattedErrorResponse(format: ResponseFormat, message: string) {
  return createFormattedResponse(
    format,
    `Error: ${message}`,
    genericJsonError(message),
    { isError: true },
  );
}

type ToolResponse = ReturnType<typeof createTextResponse>;
type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: ToolResponse };
type LoggedToolExecution = {
  response: ToolResponse;
  resultCount: number;
  summary?: ToolLogSummary;
};

type ToolRequestInfo = {
  headers: Record<string, string | string[] | undefined>;
  url?: URL;
};

type ToolExtra = {
  requestInfo?: ToolRequestInfo;
  sessionId?: string;
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
  handler: (args: TArgs, extra: ToolExtra) => Promise<LoggedToolExecution>,
): (args: TArgs, extra: ToolExtra) => Promise<ToolResponse> {
  return async (args: TArgs, extra: ToolExtra) => {
    const startedAt = Date.now();
    writeDebugLog(logWriter, toolName, "request", args);

    try {
      const execution = await handler(args, extra);
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

function extractResponseErrorMessage(response: ToolResponse): string | undefined {
  if (response.isError !== true) {
    return undefined;
  }

  const textPart = response.content.find((item): item is { type: "text"; text: string } =>
    item.type === "text",
  );
  const text = textPart?.text?.trim();
  if (!text) {
    return undefined;
  }

  return text.startsWith("Error: ") ? text.slice("Error: ".length) : text;
}

function getStructuredContentObject(response: ToolResponse): Record<string, unknown> {
  return response.structuredContent && typeof response.structuredContent === "object"
    ? response.structuredContent as Record<string, unknown>
    : {};
}

async function recordUiToolTelemetry(
  telemetrySql: SqlClient | null | undefined,
  toolName: string,
  args: unknown,
  extra: ToolExtra | undefined,
  execution: LoggedToolExecution,
  startedAt: number,
): Promise<void> {
  if (!telemetrySql || !extra?.requestInfo) {
    return;
  }

  const structuredContent = getStructuredContentObject(execution.response);
  const agentCallId = await recordAgentCall(
    {
      sql: telemetrySql,
      requestInfo: extra.requestInfo,
      startedAt,
      sessionId: extra.sessionId,
    },
    {
      toolName,
      inputArgs: args,
      resultCount: execution.resultCount,
      topProductIds: extractTopProductIds(structuredContent),
      isError: execution.response.isError === true,
      errorMessage: extractResponseErrorMessage(execution.response),
    },
  );

  if (agentCallId && execution.response.isError !== true) {
    stampAgentCallId(structuredContent, agentCallId);
  }
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

function normalizeResponseFormat(value: unknown): ResponseFormat | undefined {
  return value === "text" || value === "json" ? value : undefined;
}

function normalizeSearchSortInput(value: unknown): SearchSort | undefined {
  if (typeof value !== "string") {
    return value == null ? "relevance" : undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return SEARCH_SORT_OPTION_SET.has(normalized)
    ? normalized as SearchSort
    : undefined;
}

function normalizeLanguageInput(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return value == null ? DEFAULT_LANGUAGE : undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

function isValidIsoDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateOptionalDateRange(
  format: ResponseFormat,
  args: { dateFrom?: string; dateTo?: string },
): ValidationResult<{ dateFrom?: string; dateTo?: string }> {
  const dateFrom = args.dateFrom?.trim();
  const dateTo = args.dateTo?.trim();

  if (dateFrom == null && dateTo == null) {
    return { ok: true, data: {} };
  }

  if (!dateFrom || !dateTo) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        "Invalid date range. Provide both dateFrom and dateTo together using ISO date format YYYY-MM-DD.",
      ),
    };
  }

  if (!isValidIsoDateOnly(dateFrom)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid dateFrom. Use ISO date format YYYY-MM-DD (got: ${formatValue(args.dateFrom)}).`,
      ),
    };
  }

  if (!isValidIsoDateOnly(dateTo)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid dateTo. Use ISO date format YYYY-MM-DD (got: ${formatValue(args.dateTo)}).`,
      ),
    };
  }

  if (dateFrom > dateTo) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid date range. dateFrom must be on or before dateTo (got: dateFrom=${dateFrom}, dateTo=${dateTo}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      dateFrom,
      dateTo,
    },
  };
}

function validateLanguageArg(language: unknown, format: ResponseFormat): ValidationResult<string> {
  const normalized = normalizeLanguageInput(language);
  if (!normalized) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid language. Provide a non-empty supported language code such as "en", "de", "fr", "es", "ja", or "pt-br" (got: ${formatValue(language)}).`,
      ),
    };
  }

  if (!SUPPORTED_LANGUAGE_CODE_SET.has(normalized)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid language. Use a supported tickadoo language code such as "en", "de", "fr", "es", "ja", or "pt-br" (got: ${formatValue(language)}).`,
      ),
    };
  }

  return { ok: true, data: normalized };
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
  format: ResponseFormat,
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

    const mappedNearbyCities = nearbyCities.map(entry => ({
      name: entry.city.name,
      slug: entry.city.slug,
      distanceKm: entry.distanceKm,
      experienceCount: entry.experienceCount,
    }));

    return createFormattedResponse(
      format,
      formatDidYouMeanRecovery(
        city,
        { name: bestSuggestion.city.name, slug: bestSuggestion.city.slug },
        mappedNearbyCities,
      ),
      didYouMeanRecoveryJson(
        city,
        { name: bestSuggestion.city.name, slug: bestSuggestion.city.slug },
        mappedNearbyCities,
      ),
    );
  }

  const geocodedCity = await geocodeCityQuery(city);
  if (geocodedCity) {
    const nearbyCities = await getNearbyCitySuggestions(
      geocodedCity.latitude,
      geocodedCity.longitude,
      language,
    );

    const mappedNearbyCities = nearbyCities.map(entry => ({
      name: entry.city.name,
      slug: entry.city.slug,
      distanceKm: entry.distanceKm,
      experienceCount: entry.experienceCount,
    }));

    return createFormattedResponse(
      format,
      formatNoCoverageRecovery(geocodedCity.name, mappedNearbyCities),
      noCoverageRecoveryJson(geocodedCity.name, mappedNearbyCities),
    );
  }

  return createFormattedResponse(
    format,
    formatNoCoverageRecovery(city),
    noCoverageRecoveryJson(city),
  );
}

function validateSearchArgs(args: {
  city: string;
  language?: string;
  max_results?: number;
  offset?: number;
  min_price?: number;
  max_price?: number;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  query?: string;
  sort?: string;
  format?: string;
}): ValidationResult<{
  city: string;
  language: string;
  maxResults: number;
  offset?: number;
  minPrice?: number;
  maxPrice?: number;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  query?: string;
  sort: SearchSort;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  const dateRange = validateOptionalDateRange(format, args);
  if (!dateRange.ok) {
    return dateRange;
  }

  const city = args.city.trim();
  if (!city) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "City is required. Provide a city name or slug like \"london\" or \"new-york\"."),
    };
  }

  const maxResults = args.max_results ?? DEFAULT_SEARCH_RESULT_LIMIT;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > MAX_SEARCH_RESULT_LIMIT) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid max_results. It must be an integer between 1 and ${MAX_SEARCH_RESULT_LIMIT} (got: ${formatValue(args.max_results)}).`,
      ),
    };
  }

  if (args.category != null && !args.category.trim()) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid category. If provided, category must be a non-empty string such as ${formatAvailableSearchCategories()}.`,
      ),
    };
  }

  if (args.query != null && !args.query.trim()) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        "Invalid query. If provided, query must be a non-empty string such as \"ghost tour\", \"pizza\", or \"harry potter\".",
      ),
    };
  }

  if (args.min_price != null && (!Number.isFinite(args.min_price) || args.min_price < 0)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid min_price. It must be a non-negative number in the local currency (got: ${formatValue(args.min_price)}).`,
      ),
    };
  }

  if (args.max_price != null && (!Number.isFinite(args.max_price) || args.max_price < 0)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid max_price. It must be a non-negative number in the local currency (got: ${formatValue(args.max_price)}).`,
      ),
    };
  }

  if (args.min_price != null && args.max_price != null && args.min_price > args.max_price) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid price range. min_price cannot be greater than max_price (got: min_price=${args.min_price}, max_price=${args.max_price}).`,
      ),
    };
  }

  const sort = normalizeSearchSortInput(args.sort);
  if (!sort) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid sort. Use one of ${formatAvailableSearchSorts()} (got: ${formatValue(args.sort)}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      city,
      language: language.data,
      maxResults,
      offset: typeof args.offset === "number" && args.offset >= 0 ? args.offset : 0,
      minPrice: args.min_price,
      maxPrice: args.max_price,
      dateFrom: dateRange.data.dateFrom,
      dateTo: dateRange.data.dateTo,
      category: args.category?.trim(),
      query: args.query?.trim(),
      sort,
      format,
    },
  };
}

function validateNearbyArgs(args: {
  latitude: number;
  longitude: number;
  radius_km?: number;
  dateFrom?: string;
  dateTo?: string;
  language?: string;
  format?: string;
}): ValidationResult<{
  latitude: number;
  longitude: number;
  radiusKm: number;
  dateFrom?: string;
  dateTo?: string;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  const dateRange = validateOptionalDateRange(format, args);
  if (!dateRange.ok) {
    return dateRange;
  }

  if (!Number.isFinite(args.latitude) || args.latitude < -90 || args.latitude > 90) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid coordinates. Latitude must be between -90 and 90 (got: ${formatValue(args.latitude)}). Please check the coordinates and try again.`,
      ),
    };
  }

  if (!Number.isFinite(args.longitude) || args.longitude < -180 || args.longitude > 180) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid coordinates. Longitude must be between -180 and 180 (got: ${formatValue(args.longitude)}). Please check the coordinates and try again.`,
      ),
    };
  }

  const radiusKm = args.radius_km ?? DEFAULT_RADIUS_KM;
  if (!Number.isFinite(radiusKm) || radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
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
      dateFrom: dateRange.data.dateFrom,
      dateTo: dateRange.data.dateTo,
      language: language.data,
      format,
    },
  };
}

function validateListCitiesArgs(args: { language?: string; query?: string; limit?: number; format?: string }): ValidationResult<{
  language: string;
  query?: string;
  limit: number;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  if (args.query != null && !args.query.trim()) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "Invalid query. If provided, query must be a non-empty string such as \"paris\" or \"new\"."),
    };
  }

  const limit = args.limit ?? DEFAULT_CITY_DIRECTORY_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CITY_DIRECTORY_LIMIT) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid limit. It must be an integer between 1 and ${MAX_CITY_DIRECTORY_LIMIT} (got: ${formatValue(args.limit)}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      language: language.data,
      query: args.query?.trim(),
      limit,
      format,
    },
  };
}

function validateCityGuideArgs(args: { city?: string; language?: string; format?: string }): ValidationResult<{
  city: string;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format);
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  if (typeof args.city !== "string" || !args.city.trim()) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        "City is required. Provide a city name or slug like \"london\", \"prague\", or \"new-york\".",
      ),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  return {
    ok: true,
    data: {
      city: args.city.trim(),
      language: language.data,
      format,
    },
  };
}

function validateTravelTipsArgs(args: { city?: string; topic?: string; language?: string; format?: string }): ValidationResult<{
  city: string;
  topic: TravelTipTopic | null;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format);
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  if (typeof args.city !== "string" || !args.city.trim()) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        "City is required. Provide a city name or slug like \"tokyo\", \"paris\", or \"new-york\".",
      ),
    };
  }

  const topic = normalizeTravelTipTopic(args.topic);
  if (args.topic != null && args.topic.trim() && !topic) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid topic. Use one of: ${TRAVEL_TIP_TOPICS.join(", ")}.`,
      ),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  return {
    ok: true,
    data: {
      city: args.city.trim(),
      topic,
      language: language.data,
      format,
    },
  };
}

function validateCheckAvailabilityArgs(args: {
  slug?: string;
  date?: string;
  party_size?: number;
  language?: string;
  format?: string;
}): ValidationResult<{
  slug: string;
  date: string;
  partySize: number;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  const slug = args.slug?.trim();
  if (!slug) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        "Slug is required. Provide a non-empty tickadoo slug or path, like \"london-dungeon-tickets\" or \"/london/london-dungeon-tickets\".",
      ),
    };
  }

  const date = args.date?.trim();
  if (!date) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "Date is required. Use ISO format YYYY-MM-DD, for example \"2026-04-05\"."),
    };
  }

  try {
    calculateAvailabilityWindowDays(date);
  } catch (error) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, getErrorMessage(error)),
    };
  }

  const partySize = args.party_size ?? DEFAULT_PARTY_SIZE;
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_PARTY_SIZE) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid party_size. It must be an integer between 1 and ${MAX_PARTY_SIZE} (got: ${formatValue(args.party_size)}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      slug,
      date,
      partySize,
      language: language.data,
      format,
    },
  };
}

function validateExperienceDetailsArgs(args: {
  slug?: string;
  provider?: string;
  provider_id?: string;
  days?: number;
  language?: string;
  format?: string;
}): ValidationResult<{
  slug?: string;
  provider?: string;
  providerId?: string;
  days: number;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  if (args.slug != null && !args.slug.trim()) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        "Invalid slug. Provide a non-empty tickadoo slug or path, like \"london-dungeon-tickets\" or \"/london/london-dungeon-tickets\".",
      ),
    };
  }

  const provider = args.provider?.trim();
  const providerId = args.provider_id?.trim();
  if (!args.slug?.trim() && (!provider || !providerId)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
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
      language: language.data,
      format,
    },
  };
}

function validateCompareArgs(args: {
  slugs: string[];
  language?: string;
  format?: string;
}): ValidationResult<{
  slugs: string[];
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  if (!Array.isArray(args.slugs)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "Invalid slugs. Provide an array of 2 to 5 tickadoo slugs."),
    };
  }

  const normalizedSlugs = [...new Set(
    args.slugs
      .map(slug => typeof slug === "string" ? normalizeSlugOrPath(slug) : "")
      .filter(Boolean),
  )];

  if (normalizedSlugs.length < 2 || normalizedSlugs.length > 5) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "compare_experiences requires between 2 and 5 unique slugs."),
    };
  }

  return {
    ok: true,
    data: {
      slugs: normalizedSlugs,
      language: language.data,
      format,
    },
  };
}

function validateTransferArgs(args: {
  city?: string;
  from_type?: string;
  to_latitude?: number;
  to_longitude?: number;
  language?: string;
  format?: string;
}): ValidationResult<{
  city: string;
  fromType: TransferFromType;
  toLatitude: number;
  toLongitude: number;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  const city = args.city?.trim();
  if (!city) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        "City is required. Provide a supported city such as London, Paris, New York, Amsterdam, Barcelona, Rome, or Tokyo.",
      ),
    };
  }

  const supportedCity = resolveTransferCity(city);
  if (!supportedCity) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Unsupported city. Transfer guidance is currently available for ${getSupportedTransferCities().join(", ")}.`,
      ),
    };
  }

  if (!isTransferFromType(args.from_type)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid from_type. Use one of ${TRANSFER_FROM_TYPES.join(", ")} (got: ${formatValue(args.from_type)}).`,
      ),
    };
  }

  const toLat = typeof args.to_latitude === "number" ? args.to_latitude : NaN;
  if (!Number.isFinite(toLat) || toLat < -90 || toLat > 90) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid to_latitude. It must be between -90 and 90 (got: ${formatValue(args.to_latitude)}).`,
      ),
    };
  }

  const toLng = typeof args.to_longitude === "number" ? args.to_longitude : NaN;
  if (!Number.isFinite(toLng) || toLng < -180 || toLng > 180) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid to_longitude. It must be between -180 and 180 (got: ${formatValue(args.to_longitude)}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      city: supportedCity.name,
      fromType: args.from_type,
      toLatitude: toLat,
      toLongitude: toLng,
      language: language.data,
      format,
    },
  };
}

function validateSearchByMoodArgs(args: {
  city: string;
  mood?: string;
  language?: string;
  format?: string;
}): ValidationResult<{
  city: string;
  mood: SearchMood;
  language: string;
  format: ResponseFormat;
  filters: SearchMoodFilters;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  const city = args.city.trim();
  if (!city) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "City is required. Provide a city name or slug like \"london\" or \"new-york\"."),
    };
  }

  const mood = normalizeSearchMood(args.mood);
  if (!mood) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid mood. Use one of ${SEARCH_MOOD_OPTIONS.join(", ")} (got: ${formatValue(args.mood)}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      city,
      mood,
      language: language.data,
      format,
      filters: getSearchMoodFilters(mood),
    },
  };
}

function validateWhatsOnThisWeekArgs(args: {
  city?: string;
  language?: string;
  format?: string;
}): ValidationResult<{
  city: string;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  const city = args.city?.trim();
  if (!city) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "City is required. Provide a city name or slug like \"london\" or \"new-york\"."),
    };
  }

  return {
    ok: true,
    data: {
      city,
      language: language.data,
      format,
    },
  };
}

function validateLastMinuteArgs(args: {
  city?: string;
  hours?: number;
  latitude?: number;
  longitude?: number;
  language?: string;
  format?: string;
}): ValidationResult<{
  city: string;
  hours: number;
  latitude?: number;
  longitude?: number;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  const city = args.city?.trim();
  if (!city) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        "City is required. Provide a city name or slug like \"london\", \"paris\", or \"new-york\".",
      ),
    };
  }

  const hours = args.hours ?? DEFAULT_LAST_MINUTE_HOURS;
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_LAST_MINUTE_HOURS) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid hours. It must be a positive number up to ${MAX_LAST_MINUTE_HOURS} (got: ${formatValue(args.hours)}).`,
      ),
    };
  }

  const hasLatitude = typeof args.latitude === "number";
  const hasLongitude = typeof args.longitude === "number";
  if (hasLatitude !== hasLongitude) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        "Latitude and longitude must be provided together when using location-aware last-minute search.",
      ),
    };
  }

  if (hasLatitude && (!Number.isFinite(args.latitude) || args.latitude! < -90 || args.latitude! > 90)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid latitude. It must be between -90 and 90 (got: ${formatValue(args.latitude)}).`,
      ),
    };
  }

  if (hasLongitude && (!Number.isFinite(args.longitude) || args.longitude! < -180 || args.longitude! > 180)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid longitude. It must be between -180 and 180 (got: ${formatValue(args.longitude)}).`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      city,
      hours,
      latitude: hasLatitude ? args.latitude : undefined,
      longitude: hasLongitude ? args.longitude : undefined,
      language: language.data,
      format,
    },
  };
}

function validateWhatsOnTonightArgs(args: {
  city: string;
  category?: string;
  max_results?: number;
  language?: string;
  format?: string;
}): ValidationResult<{
  city: string;
  category?: string;
  maxResults: number;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  const city = args.city.trim();
  if (!city) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "City is required. Provide a city name or slug like \"london\" or \"new-york\"."),
    };
  }

  if (args.category != null && !String(args.category).trim()) {
    return {
      ok: false,
      error: createFormattedErrorResponse(
        format,
        `Invalid category. Use one of ${formatAvailableSearchCategories()} or omit the category filter.`,
      ),
    };
  }

  const maxResults = typeof args.max_results === "number"
    ? Math.min(Math.max(Math.trunc(args.max_results), 1), MAX_WHATS_ON_TONIGHT_LIMIT)
    : DEFAULT_WHATS_ON_TONIGHT_LIMIT;

  return {
    ok: true,
    data: {
      city,
      category: args.category?.trim(),
      maxResults,
      language: language.data,
      format,
    },
  };
}

function validateFamilyDayArgs(args: {
  city?: string;
  kids_ages?: number[];
  date?: string;
  budget?: number;
  language?: string;
  format?: string;
}): ValidationResult<{
  city: string;
  kidsAges: number[];
  date?: string;
  budget?: number;
  language: string;
  format: ResponseFormat;
}> {
  const format = normalizeResponseFormat(args.format ?? "text");
  if (!format) {
    return {
      ok: false,
      error: createFormattedErrorResponse("text", `Invalid format. Use "text" (default) or "json" (got: ${formatValue(args.format)}).`),
    };
  }

  const language = validateLanguageArg(args.language, format);
  if (!language.ok) {
    return language;
  }

  const city = args.city?.trim();
  if (!city) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "Invalid city. Provide a non-empty city name or slug such as \"london\" or \"new-york\"."),
    };
  }

  const date = args.date?.trim();
  if (date && !isValidIsoDateOnly(date)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, `Invalid date. Use ISO date format YYYY-MM-DD (got: ${formatValue(args.date)}).`),
    };
  }

  const kidsAgesInput = Array.isArray(args.kids_ages) ? args.kids_ages : [];
  const invalidAge = kidsAgesInput.find(age => !Number.isInteger(age) || age < 0 || age > 17);
  if (invalidAge != null) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "Invalid kids_ages. Use whole-number child ages between 0 and 17."),
    };
  }

  if (args.budget != null && (!Number.isFinite(args.budget) || args.budget < 0)) {
    return {
      ok: false,
      error: createFormattedErrorResponse(format, "Invalid budget. Use a positive number in the city's local currency."),
    };
  }

  return {
    ok: true,
    data: {
      city,
      kidsAges: kidsAgesInput,
      ...(date ? { date } : {}),
      ...(args.budget != null ? { budget: args.budget } : {}),
      language: language.data,
      format,
    },
  };
}

type SearchExecutionArgs = {
  city: string;
  language: string;
  maxResults: number;
  offset?: number;
  minPrice?: number;
  maxPrice?: number;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  query?: string;
  sort: SearchSort;
  format: ResponseFormat;
  tags?: string;
  audience?: string;
  setting?: string;
  wheelchairAccessible?: boolean;
  physicalLevel?: string;
  minDuration?: number;
  maxDuration?: number;
  availableLanguage?: string;
  minRating?: number;
  freeCancellation?: boolean;
  jsonPayloadExtras?: Record<string, unknown>;
  structuredContentExtras?: Record<string, unknown>;
  summaryBase: ToolLogSummary;
};

async function executeSearchTool(request: SearchExecutionArgs): Promise<LoggedToolExecution> {
  const {
    city,
    language,
    maxResults,
    offset,
    minPrice,
    maxPrice,
    dateFrom,
    dateTo,
    category,
    query,
    sort,
    format,
  } = request;

  try {
    let citySlug = normalizeCityInput(city);
    let products = await getProductsForCitySlug(citySlug, language, { dateFrom, dateTo });
    let cityName = city;
    let matchedKnownCity = Boolean(products.length);

    if (!products.length) {
      const cities = await getCities(language);
      const candidates = findCityCandidates(city, cities);
      const bestMatch = candidates[0];

      if (bestMatch?.score >= AUTO_MATCH_CONFIDENCE) {
        products = await getProductsForCitySlug(bestMatch.city.slug, language, { dateFrom, dateTo });
        cityName = bestMatch.city.name;
        citySlug = bestMatch.city.slug;
        matchedKnownCity = true;
      } else {
        return {
          response: await buildSearchMissResponse(format, city, language, candidates.slice(0, CITY_SUGGESTION_LIMIT)),
          resultCount: 0,
          summary: request.summaryBase,
        };
      }
    }

    if (!products.length) {
      if (!matchedKnownCity) {
        return {
          response: await buildSearchMissResponse(format, city, language, []),
          resultCount: 0,
          summary: request.summaryBase,
        };
      }

      return {
        response: createFormattedResponse(
          format,
          formatNoCoverageRecovery(cityName),
          noCoverageRecoveryJson(cityName),
        ),
        resultCount: 0,
        summary: request.summaryBase,
      };
    }

    const categoryFilteredProducts = filterProductsByCategory(products, category);
    if (category && !categoryFilteredProducts.length) {
      const availableCategories = getAvailableCategoriesForProducts(products);
      return {
        response: createFormattedResponse(
          format,
          formatEmptyCategoryRecovery(
            category,
            cityName,
            availableCategories,
          ),
          emptyCategoryRecoveryJson(
            citySlug,
            cityName,
            category,
            availableCategories,
          ),
        ),
        resultCount: 0,
        summary: request.summaryBase,
      };
    }

    const queryFilteredProducts = filterProductsByQuery(categoryFilteredProducts, query);
    const matchingProducts = filterProductsByPrice(queryFilteredProducts, minPrice, maxPrice);
    const appliedFilters = buildAppliedSearchFilters(language, {
      category: category ? canonicalizeSearchCategory(category) ?? category : undefined,
      query,
      minPrice,
      maxPrice,
      dateFrom,
      dateTo,
    });
    if (!matchingProducts.length) {
      let fallbackProducts: Product[] = [];
      let fallbackNote = "";

      if (query && categoryFilteredProducts.length > 0) {
        fallbackProducts = categoryFilteredProducts.slice(0, 5);
        fallbackNote = `No experiences matching "${query}" in ${cityName}. Here are the most popular alternatives:`;
      } else if ((minPrice != null || maxPrice != null) && products.length > 0) {
        fallbackProducts = products.slice(0, 5);
        fallbackNote = `No experiences in ${cityName} within that price range. Here are popular options at other price points:`;
      }

      if (fallbackProducts.length > 0) {
        const enrichedProducts = await getMcpEnrichedProducts();
        const enrichedFallback = mergeEnrichedProducts(fallbackProducts, enrichedProducts);
        const rankedFallback = sortProductsForSearch(enrichedFallback, "popular");
        const topFallback = rankedFallback.slice(0, 5).map(product => ({
          ...product,
          popular: isPopularSearchProduct(product),
        }));
        return {
          response: createFormattedResponse(
            format,
            fallbackNote,
            searchJsonPayload(citySlug, cityName, topFallback.length, [], {
              filters: appliedFilters,
              language,
              sort: "popular",
            }),
          ),
          resultCount: topFallback.length,
          summary: { ...request.summaryBase, fallback: true },
        };
      }

      const message = buildNoResultsMessage(cityName, {
        category,
        query,
        minPrice,
        maxPrice,
        dateFrom,
        dateTo,
      });
      return {
        response: createFormattedResponse(
          format,
          message,
          {
            ...searchJsonPayload(citySlug, cityName, 0, [], {
              filters: appliedFilters,
              language,
              sort,
            }),
            message,
            ...(request.jsonPayloadExtras ?? {}),
          },
        ),
        resultCount: 0,
        summary: request.summaryBase,
      };
    }

    const enrichedProducts = await getMcpEnrichedProducts();
    const enrichedMatchingProducts = mergeEnrichedProducts(matchingProducts, enrichedProducts);
    const tagFilteredProducts = filterProductsByTags(enrichedMatchingProducts, request.tags);
    const audienceFilteredProducts = filterProductsByAudience(tagFilteredProducts, request.audience);
    const settingFilteredProducts = filterProductsBySetting(audienceFilteredProducts, request.setting);
    const accessibilityFilteredProducts = filterProductsByAccessibility(settingFilteredProducts, request.wheelchairAccessible);
    const physicalFilteredProducts = filterProductsByPhysicalLevel(accessibilityFilteredProducts, request.physicalLevel);
    const durationFilteredProducts = filterProductsByDuration(physicalFilteredProducts, request.minDuration, request.maxDuration);
    const languageFilteredProducts = filterProductsByLanguage(durationFilteredProducts, request.availableLanguage);
    const ratingFilteredProducts = filterProductsByRating(languageFilteredProducts, request.minRating);
    const cancellationFilteredProducts = filterProductsByFreeCancellation(ratingFilteredProducts, request.freeCancellation);

    if (cancellationFilteredProducts.length === 0 && matchingProducts.length > 0) {
      const activeFilters: string[] = [];
      if (request.audience) activeFilters.push(`audience=${request.audience}`);
      if (request.setting) activeFilters.push(`setting=${request.setting}`);
      if (request.wheelchairAccessible != null) activeFilters.push(`wheelchair_accessible=${request.wheelchairAccessible}`);
      if (request.physicalLevel) activeFilters.push(`physical_level=${request.physicalLevel}`);
      if (request.minDuration != null || request.maxDuration != null) activeFilters.push(`duration=${request.minDuration || 0}-${request.maxDuration || "∞"}min`);
      if (request.availableLanguage) activeFilters.push(`language=${request.availableLanguage}`);
      if (request.minRating != null) activeFilters.push(`min_rating=${request.minRating}`);
      if (request.freeCancellation != null) activeFilters.push(`free_cancellation=${request.freeCancellation}`);
      const filterHint = activeFilters.length > 0
        ? `\n\n💡 Active filters: ${activeFilters.join(", ")}. Try removing one filter to broaden results.`
        : "";
      const recoveryMsg = `No experiences in ${cityName} match all your filters (${matchingProducts.length} results before filtering).${filterHint}`;
      return {
        response: createFormattedResponse(
          format,
          recoveryMsg,
          {
            city: citySlug,
            city_name: cityName,
            total: 0,
            showing: 0,
            filters_applied: activeFilters,
            pre_filter_count: matchingProducts.length,
            experiences: [],
            ...(request.jsonPayloadExtras ?? {}),
          },
        ),
        resultCount: 0,
        summary: { ...request.summaryBase, filters: activeFilters.join(",") },
      };
    }

    const rankedProducts = sortProductsForSearch(cancellationFilteredProducts, sort);
    const topProducts = rankedProducts.slice(offset || 0, (offset || 0) + maxResults).map(product => ({
      ...product,
      popular: isPopularSearchProduct(product),
    }));
    const searchContext = buildSearchContext(cityName);
    const omittedResults = buildOmittedResultsSummary(
      products.length,
      categoryFilteredProducts,
      queryFilteredProducts,
      matchingProducts,
      {
        category,
        query,
        minPrice,
        maxPrice,
      },
    );
    const resultIntro = [
      buildShownResultsLabel(topProducts.length, matchingProducts.length, searchContext),
      formatSearchSortLine(sort),
      formatSearchFiltersLine(appliedFilters),
      formatOmittedResultsHint(omittedResults),
      buildResultSummaryLine(topProducts), buildBestPicksText(topProducts),
    ].filter(Boolean).join("\n");
    const jsonPayload = {
      ...searchJsonPayload(
        citySlug,
        cityName,
        matchingProducts.length,
        topProducts,
        {
          filters: appliedFilters,
          language,
          omittedResults,
          sort,
        },
      ),
      ...(request.jsonPayloadExtras ?? {}),
      _available_filters: buildAvailableFilters(topProducts),
    };
    return {
      response: createFormattedResponse(
        format,
        appendNextStepHint(
          `${resultIntro}\n\n${topProducts.map(product => formatProduct(product, `${citySlug}/${product.slug}`, language)).join("\n\n")}\n\nView all: ${buildBookingUrl(citySlug, language)}${formatAvailableFiltersHint(topProducts)}`,
          SEARCH_NEXT_STEP_HINT,
        ),
        jsonPayload,
        {
          structuredContent: {
            city: cityName,
            citySlug,
            sort,
            totalExperiences: matchingProducts.length,
            ...(category ? { category: canonicalizeSearchCategory(category) ?? category } : {}),
            ...(query ? { query } : {}),
            ...(minPrice != null ? { minPrice } : {}),
            ...(maxPrice != null ? { maxPrice } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
            ...(language !== DEFAULT_LANGUAGE ? { language } : {}),
            ...(appliedFilters ? { filters: appliedFilters } : {}),
            ...(omittedResults ? { omittedResults } : {}),
            ...(request.structuredContentExtras ?? {}),
            experiences: topProducts.map(product => productStructuredData(product, `${citySlug}/${product.slug}`, language)),
          },
        },
      ),
      resultCount: topProducts.length,
      summary: request.summaryBase,
    };
  } catch (error) {
    return {
      response: createFormattedErrorResponse(format, getErrorMessage(error)),
      resultCount: 0,
      summary: request.summaryBase,
    };
  }
}
export function createTickadooServer(options: CreateTickadooServerOptions = {}): McpServer {
  const logWriter = options.logWriter ?? defaultLogWriter;
  const telemetrySql = options.telemetrySql ?? null;
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: SERVER_DESCRIPTION,
  });

  server.tool(
    "search_experiences",
    `Search for shows, theatre, events, tours and experiences in a specific city on tickadoo. Supports optional free-text query matching against titles and descriptions, optional category filtering (${formatAvailableSearchCategories()}), optional min/max price filtering in the local currency, optional date filtering with dateFrom/dateTo, and optional sorting (${formatAvailableSearchSorts()}). ${LANGUAGE_SUPPORT_NOTE} Use when a user asks what to do in a city, wants event/show recommendations, or is looking for tickets.`,
    {
      city: z.string().describe("City name or slug (e.g. 'london', 'new-york', 'paris', 'tokyo', 'dubai')"),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      max_results: z.number().optional().default(DEFAULT_SEARCH_RESULT_LIMIT).describe(`Maximum number of experiences to return (default ${DEFAULT_SEARCH_RESULT_LIMIT}, max ${MAX_SEARCH_RESULT_LIMIT})`),
      offset: z.number().optional().default(0).describe("Pagination offset. Skip this many results before returning. Use with max_results for cursor-based pagination."),
      query: z.string().optional().describe("Optional free-text filter matched against experience title and description (e.g. 'ghost tour', 'pizza', 'harry potter')"),
      category: z.enum(AVAILABLE_SEARCH_CATEGORIES).optional().describe(`Optional category filter. Valid values: ${formatAvailableSearchCategories()}. Matching is fuzzy, so singular forms like "tour" still map to "tours" internally.`),
      min_price: z.number().optional().describe("Optional minimum price in the experience's local currency"),
      max_price: z.number().optional().describe("Optional maximum price in the experience's local currency"),
      dateFrom: z.string().optional().describe("Optional start date filter in ISO date format YYYY-MM-DD (e.g. '2026-03-27'). Must be used together with dateTo."),
      dateTo: z.string().optional().describe("Optional end date filter in ISO date format YYYY-MM-DD (e.g. '2026-03-28'). Must be used together with dateFrom."),
      tags: z.string().optional().describe("Optional comma-separated tag filter. Results must match at least one tag. Valid tags: Musical, WestEnd, WalkingTour, FoodTour, Museum, Outdoor, HiddenGem, MustSee, Bestseller, Cruise, DayTrip, SkipTheLine, HopOnHopOff, WaterSport, Spa, BikeTour, Adventure, GuidedTour, Attraction, Transfer, SelfGuided, KidsAttraction, Show, Concert, Helicopter, WhaleWatching, Dining, Workshop, NightLife, Safari, Evening, Morning, Seasonal"),
      audience: z.string().optional().describe("Optional comma-separated audience filter. Valid values: Family, Couples, AdultsOnly, Kids, Seniors, Groups, Solo"),
      setting: z.enum(["Indoor", "Outdoor", "Mixed"]).optional().describe("Optional indoor/outdoor filter. Use Indoor for rainy days."),
      wheelchair_accessible: z.boolean().optional().describe("Filter for wheelchair-accessible experiences only"),
      physical_level: z.enum(["Easy", "Moderate", "Demanding"]).optional().describe("Filter by physical difficulty level"),
      min_duration: z.number().optional().describe("Minimum duration in minutes (e.g. 60 for at least 1 hour)"),
      max_duration: z.number().optional().describe("Maximum duration in minutes (e.g. 120 for under 2 hours)"),
      available_language: z.string().optional().describe("Filter by language availability. ISO 639-1 code: en, es, fr, de, ja, zh, pt, it, ko, etc."),
      min_rating: z.number().optional().describe("Minimum rating (e.g. 4.5 for top-rated experiences only)"),
      free_cancellation: z.boolean().optional().describe("Filter for experiences with free cancellation (true) or non-refundable (false)"),
      sort: z.enum(SEARCH_SORT_OPTIONS).optional().default("relevance").describe(`Optional result ordering. Valid values: ${formatAvailableSearchSorts()}. "popular" prioritises experiences with price, imagery, rating >= 4.0, and a description.`),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
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
            date_from: typeof args.dateFrom === "string" ? args.dateFrom.trim() || undefined : undefined,
            date_to: typeof args.dateTo === "string" ? args.dateTo.trim() || undefined : undefined,
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const { city, language, maxResults, offset, minPrice, maxPrice, dateFrom, dateTo, category, query, sort, format } = validated.data;

      return executeSearchTool({
        city,
        language,
        maxResults,
        offset,
        minPrice,
        maxPrice,
        dateFrom,
        dateTo,
        category,
        query,
        sort,
        format,
        tags: typeof args.tags === "string" ? args.tags : undefined,
        audience: typeof args.audience === "string" ? args.audience : undefined,
        setting: typeof args.setting === "string" ? args.setting : undefined,
        wheelchairAccessible: typeof args.wheelchair_accessible === "boolean" ? args.wheelchair_accessible : undefined,
        physicalLevel: typeof args.physical_level === "string" ? args.physical_level : undefined,
        minDuration: typeof args.min_duration === "number" ? args.min_duration : undefined,
        maxDuration: typeof args.max_duration === "number" ? args.max_duration : undefined,
        availableLanguage: typeof args.available_language === "string" ? args.available_language : undefined,
        minRating: typeof args.min_rating === "number" ? args.min_rating : undefined,
        freeCancellation: typeof args.free_cancellation === "boolean" ? args.free_cancellation : undefined,
        summaryBase: { city, query, sort, date_from: dateFrom, date_to: dateTo, format },
      });
    }),
  );

  server.tool(
    "search_by_mood",
    `Search tickadoo experiences by emotional intent instead of category. Maps moods (${SEARCH_MOOD_OPTIONS.join(", ")}) to the most relevant audience, tag, setting, rating, and price filters, then runs a city search. ${LANGUAGE_SUPPORT_NOTE} Use when a user says things like "something romantic", "we need to relax", "kids are bored", or "luxury options in Paris".`,
    {
      city: z.string().describe("City name or slug (e.g. 'london', 'new-york', 'paris', 'tokyo', 'dubai')"),
      mood: z.enum(SEARCH_MOOD_OPTIONS).describe(`Mood preset. Valid values: ${SEARCH_MOOD_OPTIONS.join(", ")}`),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("search_by_mood", logWriter, async args => {
      const validated = validateSearchByMoodArgs(args);
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            city: typeof args.city === "string" ? args.city.trim() || "(empty)" : "(unknown)",
            mood: typeof args.mood === "string" ? args.mood.trim() || "(empty)" : "(unknown)",
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const { city, mood, language, format, filters } = validated.data;
      const mappedFilters = {
        ...(filters.audience ? { audience: filters.audience } : {}),
        ...(filters.tags ? { tags: filters.tags } : {}),
        ...(filters.setting ? { setting: filters.setting } : {}),
        ...(filters.physicalLevel ? { physical_level: filters.physicalLevel } : {}),
        ...(filters.maxPrice != null ? { max_price: filters.maxPrice } : {}),
        ...(filters.minRating != null ? { min_rating: filters.minRating } : {}),
        sort: filters.sort,
      };

      return executeSearchTool({
        city,
        language,
        maxResults: DEFAULT_SEARCH_RESULT_LIMIT,
        maxPrice: filters.maxPrice,
        sort: filters.sort,
        format,
        tags: filters.tags,
        audience: filters.audience,
        setting: filters.setting,
        physicalLevel: filters.physicalLevel,
        minRating: filters.minRating,
        jsonPayloadExtras: {
          mood,
          mapped_filters: mappedFilters,
        },
        structuredContentExtras: {
          mood,
          mappedFilters,
        },
        summaryBase: { city, mood, sort: filters.sort, format },
      });
    }),
  );

  server.tool(
    "get_whats_on_this_week",
    `Return a day-by-day breakdown of the top experiences happening over the next 7 days in a city, grouped into morning, afternoon, and evening slots, with weekly highlights. ${LANGUAGE_SUPPORT_NOTE} Use when a user says things like "what's on this week in Paris?" or "I'm in London for the next few days, what should I do each day?"`,
    {
      city: z.string().describe("City name or slug (e.g. 'london', 'new-york', 'paris', 'tokyo', 'dubai')"),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("get_whats_on_this_week", logWriter, async args => {
      const validated = validateWhatsOnThisWeekArgs({
        city: typeof args.city === "string" ? args.city : undefined,
        language: typeof args.language === "string" ? args.language : undefined,
        format: typeof args.format === "string" ? args.format : undefined,
      });
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            city: typeof args.city === "string" ? args.city.trim() || "(empty)" : "(unknown)",
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const { city, language, format } = validated.data;
      const { startDate, endDate, dayCount } = createWhatsOnThisWeekWindow();

      try {
        let citySlug = normalizeCityInput(city);
        let cityName = city;
        let products = await getProductsForCitySlug(citySlug, language, { dateFrom: startDate, dateTo: endDate });

        if (!products.length) {
          const candidates = findCityCandidates(city, await getCities(language));
          const bestMatch = candidates[0];

          if (bestMatch?.score >= AUTO_MATCH_CONFIDENCE) {
            citySlug = bestMatch.city.slug;
            cityName = bestMatch.city.name;
            products = await getProductsForCitySlug(citySlug, language, { dateFrom: startDate, dateTo: endDate });
          } else {
            return {
              response: await buildSearchMissResponse(format, city, language, candidates.slice(0, CITY_SUGGESTION_LIMIT)),
              resultCount: 0,
              summary: { city, date_from: startDate, date_to: endDate, format },
            };
          }
        }

        if (!products.length) {
          const payload = buildWhatsOnThisWeek([], {
            city: cityName,
            citySlug,
            startDate,
            dayCount,
          });

          return {
            response: createFormattedResponse(
              format,
              formatWhatsOnThisWeekText(payload),
              payload,
              { structuredContent: payload },
            ),
            resultCount: 0,
            summary: { city: cityName, city_slug: citySlug, date_from: startDate, date_to: endDate, format },
          };
        }

        const rankedProducts = sortProductsForSearch(products, "popular").slice(0, WHATS_ON_THIS_WEEK_PRODUCT_LIMIT);
        const detailResults = await Promise.allSettled(
          rankedProducts.map(async product => ({
            product,
            details: await getExperienceDetails(product.provider, product.providerId, dayCount),
            bookingPath: `${citySlug}/${product.slug}`,
            language,
            popular: isPopularSearchProduct(product),
          })),
        );

        const successfulDetails = detailResults.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
        if (!successfulDetails.length) {
          const firstRejected = detailResults.find(result => result.status === "rejected");
          throw (firstRejected?.status === "rejected" ? firstRejected.reason : new Error("Unable to build this week's schedule."));
        }

        const payload = buildWhatsOnThisWeek(successfulDetails, {
          city: cityName,
          citySlug,
          startDate,
          dayCount,
        });
        const resultCount = payload.week.reduce(
          (sum, day) => sum + day.morning.length + day.afternoon.length + day.evening.length,
          0,
        );

        return {
          response: createFormattedResponse(
            format,
            formatWhatsOnThisWeekText(payload),
            payload,
            { structuredContent: payload },
          ),
          resultCount,
          summary: {
            city: cityName,
            city_slug: citySlug,
            date_from: startDate,
            date_to: endDate,
            format,
          },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: { city, date_from: startDate, date_to: endDate, format },
        };
      }
    }),
  );

  server.tool(
    "get_last_minute",
    `Find tickadoo experiences starting within the next few hours in a city. Sorts by soonest start time, adds countdown text like "starts in 47 minutes", and flags high urgency when a start is imminent or inventory is low. ${LANGUAGE_SUPPORT_NOTE}`,
    {
      city: z.string().describe("City name or slug, such as 'london', 'new-york', or 'paris'."),
      hours: z.number().optional().default(DEFAULT_LAST_MINUTE_HOURS).describe(`How many hours ahead to search for imminent starts (default ${DEFAULT_LAST_MINUTE_HOURS}, max ${MAX_LAST_MINUTE_HOURS}).`),
      latitude: z.number().optional().describe("Optional latitude to blend in nearby experiences close to the user's exact location."),
      longitude: z.number().optional().describe("Optional longitude to blend in nearby experiences close to the user's exact location."),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("get_last_minute", logWriter, async args => {
      const validated = validateLastMinuteArgs({
        city: typeof args.city === "string" ? args.city : undefined,
        hours: typeof args.hours === "number" ? args.hours : undefined,
        latitude: typeof args.latitude === "number" ? args.latitude : undefined,
        longitude: typeof args.longitude === "number" ? args.longitude : undefined,
        language: typeof args.language === "string" ? args.language : undefined,
        format: typeof args.format === "string" ? args.format : undefined,
      });
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            city: typeof args.city === "string" ? args.city.trim() || "(empty)" : "(missing)",
            hours: typeof args.hours === "number" ? args.hours : DEFAULT_LAST_MINUTE_HOURS,
            lat: typeof args.latitude === "number" ? args.latitude : undefined,
            lng: typeof args.longitude === "number" ? args.longitude : undefined,
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const {
        city,
        hours,
        latitude,
        longitude,
        language,
        format,
      } = validated.data;

      const now = new Date();
      const windowEnd = new Date(now.getTime() + (hours * 60 * 60_000));
      const startDate = now.toISOString().slice(0, 10);
      const endDate = windowEnd.toISOString().slice(0, 10);

      try {
        const cities = await getCities(language);
        const cityById = new Map(
          cities
            .filter((entry): entry is City & { slug: string } => Boolean(entry.slug))
            .map(entry => [entry.id, entry]),
        );
        const initialCityMatch = findCityCandidates(city, cities)[0];

        let citySlug = initialCityMatch?.score >= AUTO_MATCH_CONFIDENCE
          ? initialCityMatch.city.slug
          : normalizeCityInput(city);
        let cityName = initialCityMatch?.score >= AUTO_MATCH_CONFIDENCE
          ? initialCityMatch.city.name
          : city;
        let products = await getProductsForCitySlug(citySlug, language, { dateFrom: startDate, dateTo: endDate });

        if (!products.length) {
          const candidates = initialCityMatch
            ? [initialCityMatch, ...findCityCandidates(city, cities).slice(1)]
            : findCityCandidates(city, cities);
          const bestMatch = candidates[0];

          if (bestMatch?.score >= AUTO_MATCH_CONFIDENCE) {
            citySlug = bestMatch.city.slug;
            cityName = bestMatch.city.name;
            products = await getProductsForCitySlug(citySlug, language, { dateFrom: startDate, dateTo: endDate });
          } else {
            return {
              response: await buildSearchMissResponse(format, city, language, candidates.slice(0, CITY_SUGGESTION_LIMIT)),
              resultCount: 0,
              summary: { city, hours, lat: latitude, lng: longitude, format },
            };
          }
        }

        let combinedProducts = products;
        if (latitude != null && longitude != null) {
          const nearbyProducts = await getProductsByLocation(
            latitude,
            longitude,
            DEFAULT_RADIUS_KM,
            language,
            { dateFrom: startDate, dateTo: endDate },
          );
          const bySlug = new Map<string, Product>();
          for (const product of [...products, ...nearbyProducts]) {
            if (!bySlug.has(product.slug)) {
              bySlug.set(product.slug, product);
            }
          }
          combinedProducts = [...bySlug.values()];
        }

        const enrichedProducts = await getMcpEnrichedProducts();
        const enriched = mergeEnrichedProducts(combinedProducts, enrichedProducts);
        const shortlisted = sortProductsForSearch(enriched, "popular").slice(0, LAST_MINUTE_PRODUCT_LIMIT);
        const detailWindowDays = calculateAvailabilityWindowDays(endDate, now);
        const detailResults = await Promise.allSettled(
          shortlisted.map(async product => {
            const details = await getExperienceDetails(product.provider, product.providerId, detailWindowDays);
            const bookingCitySlug = cityById.get(product.cityId)?.slug ?? citySlug;
            return {
              product,
              details: mergeEnrichedDetails(details, product.slug, enrichedProducts),
              bookingPath: `${bookingCitySlug}/${product.slug}`,
              language,
              popular: isPopularSearchProduct(product),
            };
          }),
        );

        const successfulDetails = detailResults.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
        const payload = buildLastMinuteResult(successfulDetails, {
          city: cityName,
          citySlug,
          hours,
          now,
        });
        const nextStepHint = payload.results.length
          ? "💡 Tip: Use get_experience_details(slug) for venue context or widen the hours window if you want more options."
          : "💡 Tip: Widen the hours window, try nearby coordinates, or use get_whats_on_this_week for a broader plan.";

        return {
          response: createFormattedResponse(
            format,
            appendNextStepHint(formatLastMinuteText(payload), nextStepHint),
            payload,
            {
              structuredContent: payload,
            },
          ),
          resultCount: payload.results.length,
          summary: {
            city: citySlug,
            hours,
            lat: latitude,
            lng: longitude,
            date_from: startDate,
            date_to: endDate,
            format,
            language,
          },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: {
            city,
            hours,
            lat: latitude,
            lng: longitude,
            date_from: startDate,
            date_to: endDate,
            format,
            language,
          },
        };
      }
    }),
  );

  server.tool(
    "whats_on_tonight",
    `Find bookable experiences happening later today in a city. Automatically filters to today, removes already-started events, adds "starts in" countdowns, surfaces urgency signals from inventory data, and sorts by soonest start time with evening/show/nightlife boosts. ${LANGUAGE_SUPPORT_NOTE} Use for concierge-style requests like "what's on tonight in London?" or "any shows tonight in Paris?".`,
    {
      city: z.string().describe("City name or slug (e.g. 'london', 'new-york', 'paris', 'tokyo', 'dubai')"),
      category: z.enum(AVAILABLE_SEARCH_CATEGORIES).optional().describe(`Optional category filter. Valid values: ${formatAvailableSearchCategories()}.`),
      max_results: z.number().optional().default(DEFAULT_WHATS_ON_TONIGHT_LIMIT).describe(`Maximum number of experiences to return (default ${DEFAULT_WHATS_ON_TONIGHT_LIMIT}, max ${MAX_WHATS_ON_TONIGHT_LIMIT})`),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("whats_on_tonight", logWriter, async args => {
      const validated = validateWhatsOnTonightArgs(args);
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            city: typeof args.city === "string" ? args.city.trim() || "(empty)" : "(unknown)",
            category: typeof args.category === "string" ? args.category.trim() || undefined : undefined,
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const { city, category, maxResults, language, format } = validated.data;
      const tonightDate = formatLocalIsoDate();
      const currentTime = formatLocalClock();

      try {
        let citySlug = normalizeCityInput(city);
        let products = await getProductsForCitySlug(citySlug, language, {
          dateFrom: tonightDate,
          dateTo: tonightDate,
          cacheContext: {
            toolName: "search_experiences",
            args: { citySlug, language, dateFrom: tonightDate, dateTo: tonightDate, mode: "tonight" },
          },
        });
        let cityName = city;
        let matchedKnownCity = Boolean(products.length);

        if (!products.length) {
          const cities = await getCities(language);
          const candidates = findCityCandidates(city, cities);
          const bestMatch = candidates[0];

          if (bestMatch?.score >= AUTO_MATCH_CONFIDENCE) {
            products = await getProductsForCitySlug(bestMatch.city.slug, language, {
              dateFrom: tonightDate,
              dateTo: tonightDate,
              cacheContext: {
                toolName: "search_experiences",
                args: { citySlug: bestMatch.city.slug, language, dateFrom: tonightDate, dateTo: tonightDate, mode: "tonight" },
              },
            });
            cityName = bestMatch.city.name;
            citySlug = bestMatch.city.slug;
            matchedKnownCity = true;
          } else {
            return {
              response: await buildSearchMissResponse(format, city, language, candidates.slice(0, CITY_SUGGESTION_LIMIT)),
              resultCount: 0,
              summary: { city, category, date: tonightDate, format },
            };
          }
        }

        if (!products.length) {
          if (!matchedKnownCity) {
            return {
              response: await buildSearchMissResponse(format, city, language, []),
              resultCount: 0,
              summary: { city, category, date: tonightDate, format },
            };
          }

          const emptyResult = buildTonightResult({
            city: cityName,
            date: tonightDate,
            currentTime,
            experiences: [],
            maxResults,
          });
          const payload = toWhatsOnTonightPayload(emptyResult);

          return {
            response: createFormattedResponse(
              format,
              formatTonightText(emptyResult),
              payload,
              { structuredContent: payload },
            ),
            resultCount: 0,
            summary: { city: cityName, category, date: tonightDate, format },
          };
        }

        const enrichedProducts = await getMcpEnrichedProducts();
        const categoryFilteredProducts = filterProductsByCategory(mergeEnrichedProducts(products, enrichedProducts), category);

        if (category && !categoryFilteredProducts.length) {
          const payload = {
            tonight: [],
            _summary: `No ${category} experiences remain tonight in ${cityName}.`,
          };
          return {
            response: createFormattedResponse(
              format,
              `🌙 Tonight in ${cityName}\n\nNo ${category} experiences remain bookable for tonight right now.`,
              payload,
              { structuredContent: payload },
            ),
            resultCount: 0,
            summary: { city: cityName, category, date: tonightDate, format },
          };
        }

        const rankedCandidates = sortProductsForTonight(categoryFilteredProducts);
        const candidateLimit = Math.min(
          rankedCandidates.length,
          Math.max(maxResults * 4, TONIGHT_MIN_CANDIDATES),
          TONIGHT_MAX_CANDIDATES,
        );
        const candidates = rankedCandidates.slice(0, candidateLimit);
        const tonightSources: TonightSourceExperience[] = [];
        let tonightResult = buildTonightResult({
          city: cityName,
          date: tonightDate,
          currentTime,
          experiences: [],
          maxResults,
        });

        for (let index = 0; index < candidates.length; index += TONIGHT_DETAIL_BATCH_SIZE) {
          const batch = candidates.slice(index, index + TONIGHT_DETAIL_BATCH_SIZE);
          const batchSources = await Promise.all(batch.map(async product => {
            try {
              const details = mergeEnrichedDetails(
                await getExperienceDetails(product.provider, product.providerId, 1),
                product.slug,
                enrichedProducts,
              );

              return {
                slug: product.slug,
                title: product.title,
                category,
                priceFrom: product.minPrice ?? details.mcpProduct?.minPrice ?? null,
                currency: details.currencyCode ?? product.currency,
                venueAddress: details.address ?? details.locationWithAddress.address ?? product.address,
                tags: details.mcpProduct?.tags ?? product.mcpProduct?.tags ?? [],
                rating: details.mcpProduct?.reviewRating ?? product.averageRating ?? null,
                bookingUrl: buildBookingUrl(`${citySlug}/${product.slug}`, language),
                slots: details.dates,
              } as TonightSourceExperience;
            } catch {
              return undefined;
            }
          }));

          tonightSources.push(...batchSources.filter((value): value is TonightSourceExperience => Boolean(value)));
          tonightResult = buildTonightResult({
            city: cityName,
            date: tonightDate,
            currentTime,
            experiences: tonightSources,
            maxResults,
          });

          if (tonightResult.tonight.length >= maxResults) {
            break;
          }
        }

        const payload = toWhatsOnTonightPayload(tonightResult);
        return {
          response: createFormattedResponse(
            format,
            formatTonightText(tonightResult),
            payload,
            { structuredContent: payload },
          ),
          resultCount: tonightResult.tonight.length,
          summary: {
            city: cityName,
            category,
            date: tonightDate,
            max_results: maxResults,
            format,
          },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: { city, category, date: tonightDate, max_results: maxResults, format },
        };
      }
    }),
  );

  const nearbyTool = server.tool(
    "find_nearby_experiences",
    `Find shows, events and experiences near a geographic location on tickadoo. Supports optional date filtering with dateFrom/dateTo. ${LANGUAGE_SUPPORT_NOTE} Use when a user shares their location or asks for things to do near them.`,
    {
      latitude: z.number().describe("Latitude"),
      longitude: z.number().describe("Longitude"),
      radius_km: z.number().optional().default(DEFAULT_RADIUS_KM).describe(`Search radius in km (default ${DEFAULT_RADIUS_KM})`),
      dateFrom: z.string().optional().describe("Optional start date filter in ISO date format YYYY-MM-DD (e.g. '2026-03-27'). Must be used together with dateTo."),
      dateTo: z.string().optional().describe("Optional end date filter in ISO date format YYYY-MM-DD (e.g. '2026-03-28'). Must be used together with dateFrom."),
      tags: z.string().optional().describe("Optional comma-separated tag filter. Results must match at least one tag. Valid tags: Musical, WestEnd, WalkingTour, FoodTour, Museum, Outdoor, HiddenGem, MustSee, Bestseller, Cruise, DayTrip, SkipTheLine, HopOnHopOff, WaterSport, Spa, BikeTour, Adventure, GuidedTour, Attraction, Transfer, SelfGuided, KidsAttraction, Show, Concert, Helicopter, WhaleWatching, Dining, Workshop, NightLife, Safari, Evening, Morning, Seasonal"),
      audience: z.string().optional().describe("Audience filter: Family, Couples, AdultsOnly, Kids, Seniors, Groups, Solo"),
      setting: z.enum(["Indoor", "Outdoor", "Mixed"]).optional().describe("Indoor/outdoor filter"),
      wheelchair_accessible: z.boolean().optional().describe("Filter for wheelchair-accessible experiences"),
      physical_level: z.enum(["Easy", "Moderate", "Demanding"]).optional().describe("Physical difficulty filter"),
      min_duration: z.number().optional().describe("Min duration in minutes"),
      max_duration: z.number().optional().describe("Max duration in minutes"),
      available_language: z.string().optional().describe("Language filter (ISO 639-1 code)"),
      min_rating: z.number().optional().describe("Minimum rating (e.g. 4.5)"),
      free_cancellation: z.boolean().optional().describe("Filter for free cancellation"),
      sort: z.enum(["relevance", "popular", "price_low", "price_high", "rating", "best_value"]).optional().default("relevance").describe("Sort order"),
      max_results: z.number().optional().default(10).describe("Maximum number of experiences to return (default 10, max 50)"),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("find_nearby_experiences", logWriter, async (args, extra) => {
      const startedAt = Date.now();
      const execution = await (async (): Promise<LoggedToolExecution> => {
        const validated = validateNearbyArgs(args);
        if (!validated.ok) {
          return {
            response: validated.error,
            resultCount: 0,
            summary: {
              lat: typeof args.latitude === "number" ? args.latitude : undefined,
              lng: typeof args.longitude === "number" ? args.longitude : undefined,
              date_from: typeof args.dateFrom === "string" ? args.dateFrom.trim() || undefined : undefined,
              date_to: typeof args.dateTo === "string" ? args.dateTo.trim() || undefined : undefined,
              format: typeof args.format === "string" ? args.format : undefined,
            },
          };
        }

        const { latitude, longitude, radiusKm, dateFrom, dateTo, language, format } = validated.data;
        const tagsArg = typeof args.tags === "string" ? args.tags : undefined;

        try {
          let products = await getProductsByLocation(latitude, longitude, radiusKm, language, { dateFrom, dateTo });
          if (tagsArg) {
            products = filterProductsByTags(products, tagsArg);
          }
          if (!products.length) {
            const suggestedRadiusKm = Math.min(radiusKm * 2, MAX_RADIUS_KM);
            const [nearestCity] = await getNearbyCitySuggestions(latitude, longitude, language);
            return {
              response: createFormattedResponse(
                format,
                formatNearbyEmptyRecovery(
                  radiusKm,
                  suggestedRadiusKm,
                  nearestCity ? { name: nearestCity.city.name } : undefined,
                ),
                nearbyEmptyRecoveryJson(
                  latitude,
                  longitude,
                  radiusKm,
                  suggestedRadiusKm,
                  nearestCity ? { name: nearestCity.city.name } : undefined,
                ),
              ),
              resultCount: 0,
              summary: { lat: latitude, lng: longitude, radius_km: radiusKm, date_from: dateFrom, date_to: dateTo, format },
            };
          }

          const enrichedProducts = await getMcpEnrichedProducts();
          let filteredProducts = mergeEnrichedProducts(products, enrichedProducts);
          filteredProducts = filterProductsByAudience(filteredProducts, args.audience as string | undefined);
          filteredProducts = filterProductsBySetting(filteredProducts, args.setting as string | undefined);
          filteredProducts = filterProductsByAccessibility(filteredProducts, args.wheelchair_accessible as boolean | undefined);
          filteredProducts = filterProductsByPhysicalLevel(filteredProducts, args.physical_level as string | undefined);
          filteredProducts = filterProductsByDuration(filteredProducts, args.min_duration as number | undefined, args.max_duration as number | undefined);
          filteredProducts = filterProductsByLanguage(filteredProducts, args.available_language as string | undefined);
          filteredProducts = filterProductsByRating(filteredProducts, args.min_rating as number | undefined);
          filteredProducts = filterProductsByFreeCancellation(filteredProducts, args.free_cancellation as boolean | undefined);
          const nearbySort = (typeof args.sort === "string" ? args.sort : "relevance") as SearchSort;
          const nearbyMax = Math.min(Math.max(typeof args.max_results === "number" ? args.max_results : DEFAULT_SEARCH_RESULT_LIMIT, 1), 50);
          const rankedProducts = sortProductsForSearch(filteredProducts, nearbySort);
          const topProducts = rankedProducts.slice(0, nearbyMax);
          let nearbyCitySlug = "nearby";
          if (topProducts.length > 0) {
            const cities = await getCities(language);
            const firstCityId = topProducts[0].cityId;
            const matchedCity = cities.find(ct => ct.id === firstCityId);
            if (matchedCity?.slug) {
              nearbyCitySlug = matchedCity.slug;
            }
          }

          return {
            response: createFormattedResponse(
              format,
              appendNextStepHint(
                `${buildShownResultsLabel(topProducts.length, products.length, "nearby")}\n\n${topProducts.map(product => formatProduct(product, product.slug, language)).join("\n\n")}${formatAvailableFiltersHint(topProducts as any)}`,
                NEARBY_NEXT_STEP_HINT,
              ),
              { ...nearbyJsonPayload(latitude, longitude, radiusKm, products.length, topProducts, language, { dateFrom, dateTo }), _available_filters: buildAvailableFilters(topProducts as any), _related_searches: buildRelatedSearches(nearbyCitySlug, topProducts as any), _conversation_starters: buildConversationStarters(topProducts as any, "nearby"), _best_picks: buildBestPicks(topProducts as any), _price_tiers: buildPriceTiers(topProducts as any), _group_summary: buildGroupSummary(topProducts as any) },
              {
                structuredContent: {
                  latitude,
                  longitude,
                  radiusKm,
                  ...(dateFrom ? { dateFrom } : {}),
                  ...(dateTo ? { dateTo } : {}),
                  totalExperiences: products.length,
                  experiences: topProducts.map(product => productStructuredData(product, product.slug, language)),
                },
              },
            ),
            resultCount: topProducts.length,
            summary: { lat: latitude, lng: longitude, radius_km: radiusKm, date_from: dateFrom, date_to: dateTo, format },
          };
        } catch (error) {
          return {
            response: createFormattedErrorResponse(format, getErrorMessage(error)),
            resultCount: 0,
            summary: { lat: latitude, lng: longitude, radius_km: radiusKm, date_from: dateFrom, date_to: dateTo, format },
          };
        }
      })();

      await recordUiToolTelemetry(telemetrySql, "find_nearby_experiences", args, extra, execution, startedAt);
      return execution;
    }),
  );

  nearbyTool.update({
    _meta: uiMeta(EXPERIENCE_MAP_URI, {
      invoking: "Searching tickadoo nearby…",
      invoked: "Map ready",
    }),
  });

  server.tool(
    "list_cities",
    "List all cities where tickadoo has bookable experiences. Use to help users discover available destinations.",
    {
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      query: z.string().optional().describe("Optional city name or slug filter (e.g. 'new', 'paris', 'tokyo')"),
      limit: z.number().optional().default(DEFAULT_CITY_DIRECTORY_LIMIT).describe(`Maximum number of cities to return (default ${DEFAULT_CITY_DIRECTORY_LIMIT})`),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
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
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const { language, query, limit, format } = validated.data;

      try {
        const filter = query?.toLowerCase();
        const withSlug = (await getCities(language))
          .filter((city): city is City & { slug: string } => Boolean(city.slug))
          .filter(city => !filter || city.name.toLowerCase().includes(filter) || city.slug.toLowerCase().includes(filter))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!withSlug.length) {
          return {
            response: createFormattedErrorResponse(format, `No cities found matching "${query}". Try a broader filter like "new", "paris", or "tokyo".`),
            resultCount: 0,
            summary: { query: query ?? "all", format },
          };
        }

        const cities = withSlug.slice(0, limit);
        const list = cities.map(city => `📍 ${city.name} → ${buildBookingUrl(city.slug, language)}`).join("\n");
        const header = filter
          ? `Found ${withSlug.length} matching cities${withSlug.length > cities.length ? ` (showing ${cities.length})` : ""}:`
          : `Showing ${cities.length} of ${withSlug.length} cities, sorted alphabetically. Use the optional query parameter to filter further:`;

        return {
          response: createFormattedResponse(
            format,
            appendNextStepHint(
              `tickadoo® city directory\n\n${header}\n\n${list}`,
              filter ? FILTERED_CITIES_NEXT_STEP_HINT : undefined,
            ),
            cityDirectoryJsonPayload(query, withSlug.length, cities, language),
          ),
          resultCount: cities.length,
          summary: { query: query ?? "all", format },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: { query: query ?? "all", format },
        };
      }
    }),
  );

  server.tool(
    "get_city_guide",
    `Return a curated city overview for trip planning. Summarises a destination with top highlights, category breakdown, price range, best_for suggestions, seasonal guidance, insider tips, and audience/tag signals. ${LANGUAGE_SUPPORT_NOTE} Use when a user asks "tell me about things to do in Prague" or wants a pre-arrival city briefing instead of a raw search.`,
    {
      city: z.string().describe("City name or slug (e.g. 'london', 'prague', 'new-york', 'rome')"),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("get_city_guide", logWriter, async args => {
      const validated = validateCityGuideArgs({
        city: typeof args.city === "string" ? args.city : undefined,
        language: typeof args.language === "string" ? args.language : undefined,
        format: typeof args.format === "string" ? args.format : undefined,
      });
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            city: typeof args.city === "string" ? args.city.trim() || "(empty)" : "(missing)",
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const { city, language, format } = validated.data;

      try {
        const cities = await getCities(language);
        const candidates = findCityCandidates(city, cities);
        const bestMatch = candidates[0];

        if (!bestMatch || bestMatch.score < AUTO_MATCH_CONFIDENCE) {
          return {
            response: await buildSearchMissResponse(format, city, language, candidates.slice(0, CITY_SUGGESTION_LIMIT)),
            resultCount: 0,
            summary: { city, format },
          };
        }

        const matchedCity = bestMatch.city;
        const [products, enrichedProducts, country] = await Promise.all([
          getProductsForCitySlug(matchedCity.slug, language),
          getMcpEnrichedProducts(),
          lookupCityCountry(matchedCity),
        ]);

        if (!products.length) {
          return {
            response: createFormattedResponse(
              format,
              formatNoCoverageRecovery(matchedCity.name),
              noCoverageRecoveryJson(matchedCity.name),
            ),
            resultCount: 0,
            summary: { city: matchedCity.slug, format },
          };
        }

        const guideProducts = products.map(product => {
          const mcpProduct = enrichedProducts.get(product.slug);
          return mcpProduct ? { ...product, mcpProduct } : product;
        });
        const payload = buildCityGuide(
          {
            name: matchedCity.name,
            slug: matchedCity.slug,
            country,
          },
          guideProducts,
          language,
        );

        return {
          response: createFormattedResponse(
            format,
            formatCityGuide(payload),
            payload,
            {
              structuredContent: payload,
            },
          ),
          resultCount: payload.highlights.length,
          summary: {
            city: matchedCity.slug,
            format,
            experiences: payload.city.experience_count,
          },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: { city, format },
        };
      }
    }),
  );

  server.tool(
    "get_travel_tips",
    `Return hardcoded local insider advice for 20 launch cities. Covers transport, money, safety, culture, food, weather, language, and connectivity, plus emergency numbers and quick local phrases. ${LANGUAGE_SUPPORT_NOTE} Use when a user asks "what should I know before visiting Tokyo?" or wants a hotel pre-arrival briefing beyond generic guidebook tips.`,
    {
      city: z.string().describe("City name or slug (e.g. 'tokyo', 'paris', 'new-york', 'london')"),
      topic: z.enum(TRAVEL_TIP_TOPICS).optional().describe("Optional topic filter: transport, money, safety, culture, food, weather, language, or connectivity"),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("get_travel_tips", logWriter, async args => {
      const validated = validateTravelTipsArgs({
        city: typeof args.city === "string" ? args.city : undefined,
        topic: typeof args.topic === "string" ? args.topic : undefined,
        language: typeof args.language === "string" ? args.language : undefined,
        format: typeof args.format === "string" ? args.format : undefined,
      });
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            city: typeof args.city === "string" ? args.city.trim() || "(empty)" : "(missing)",
            topic: typeof args.topic === "string" ? args.topic : undefined,
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const { city, topic, language, format } = validated.data;

      try {
        const directPayload = buildTravelTipsPayload(city, topic);
        if (directPayload) {
          return {
            response: createFormattedResponse(
              format,
              formatTravelTips(directPayload),
              directPayload,
              {
                structuredContent: directPayload,
              },
            ),
            resultCount: directPayload.tips.length,
            summary: {
              city: directPayload.city,
              topic: topic ?? "all",
              format,
            },
          };
        }

        const cities = await getCities(language);
        const candidates = findCityCandidates(city, cities);
        const supportedSuggestions = candidates
          .filter(candidate => SUPPORTED_TRAVEL_TIP_CITIES.some(entry => entry.slug === candidate.city.slug))
          .slice(0, CITY_SUGGESTION_LIMIT);
        const bestSupportedMatch = supportedSuggestions[0];

        if (bestSupportedMatch && bestSupportedMatch.score >= SPELLING_CORRECTION_CONFIDENCE) {
          const correctedPayload = buildTravelTipsPayload(bestSupportedMatch.city.slug, topic);
          if (correctedPayload) {
            return {
              response: createFormattedResponse(
                format,
                formatTravelTips(correctedPayload),
                correctedPayload,
                {
                  structuredContent: correctedPayload,
                },
              ),
              resultCount: correctedPayload.tips.length,
              summary: {
                city: correctedPayload.city,
                corrected_from: city,
                topic: topic ?? "all",
                format,
              },
            };
          }
        }

        const suggestedCities = supportedSuggestions.map(candidate => ({
          name: candidate.city.name,
          slug: candidate.city.slug,
        }));
        const supportedLaunchCities = SUPPORTED_TRAVEL_TIP_CITIES.map(entry => entry.name);
        const message = suggestedCities.length
          ? `Travel tips are currently hardcoded for 20 launch cities. I could not confidently match "${city}", but you might mean ${suggestedCities.map(entry => entry.name).join(", ")}.`
          : `Travel tips are currently hardcoded for 20 launch cities only. Try one of: ${supportedLaunchCities.join(", ")}.`;
        const unavailablePayload = {
          city,
          topic: topic ?? null,
          message,
          supported_cities: SUPPORTED_TRAVEL_TIP_CITIES,
          suggested_cities: suggestedCities,
        };

        return {
          response: createFormattedResponse(
            format,
            message,
            unavailablePayload,
            {
              structuredContent: unavailablePayload,
            },
          ),
          resultCount: 0,
          summary: {
            city,
            topic: topic ?? "all",
            format,
            supported: false,
          },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: {
            city,
            topic: topic ?? "all",
            format,
          },
        };
      }
    }),
  );

  server.tool(
    "check_availability",
    `Quick date-specific availability check for a specific tickadoo experience. Returns availability for one date only, plus party total, booking URL, and Ghost Checkout intent-token payload metadata. ${LANGUAGE_SUPPORT_NOTE} Use when the user asks "is this available on Saturday?" or wants a fast price check without the full experience detail payload.`,
    {
      slug: z.string().describe("Tickadoo slug or booking path, e.g. 'london-dungeon-tickets' or '/london/london-dungeon-tickets'"),
      date: z.string().describe("Date to check in ISO format YYYY-MM-DD (e.g. '2026-04-05')"),
      party_size: z.number().int().optional().default(DEFAULT_PARTY_SIZE).describe(`Number of guests or tickets to price (default ${DEFAULT_PARTY_SIZE}, max ${MAX_PARTY_SIZE})`),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("check_availability", logWriter, async args => {
      const validated = validateCheckAvailabilityArgs(args);
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            slug: typeof args.slug === "string" ? args.slug.trim() || "(empty)" : "(missing)",
            date: typeof args.date === "string" ? args.date.trim() || "(empty)" : "(missing)",
            party_size: typeof args.party_size === "number" ? args.party_size : DEFAULT_PARTY_SIZE,
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const {
        slug,
        date,
        partySize,
        language,
        format,
      } = validated.data;

      try {
        const resolved = await resolveProductBySlug(slug, language);
        const days = calculateAvailabilityWindowDays(date);
        const details = await getExperienceDetails(resolved.product.provider, resolved.product.providerId, days);
        const payload = buildAvailabilityCheckPayload(date, partySize, details, {
          title: resolved.product.title,
          slug: resolved.product.slug,
          bookingPath: resolved.bookingPath,
          language,
        });

        return {
          response: createFormattedResponse(
            format,
            appendNextStepHint(
              formatAvailabilityCheck(payload),
              CHECK_AVAILABILITY_NEXT_STEP_HINT,
            ),
            payload,
            {
              structuredContent: {
                source: "tickadoo",
                tickadooProductId: resolved.product.id,
                ...payload,
              },
            },
          ),
          resultCount: payload.slots.length,
          summary: {
            slug: resolved.product.slug,
            date,
            party_size: partySize,
            available: payload.available,
            format,
          },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: { slug, date, party_size: partySize, format },
        };
      }
    }),
  );

  const detailsTool = server.tool(
    "get_experience_details",
    `Get detailed availability, venue details, and images for a specific tickadoo experience. Prefer passing the tickadoo slug or booking URL path; provider and provider_id are legacy fallback inputs. ${LANGUAGE_SUPPORT_NOTE}`,
    {
      slug: z.string().optional().describe("Preferred: tickadoo slug or path, e.g. 'london-dungeon-tickets' or '/london/london-dungeon-tickets'"),
      provider: z.string().optional().describe("Legacy fallback only: hidden provider name used internally"),
      provider_id: z.string().optional().describe("Legacy fallback only: hidden provider-specific product ID"),
      days: z.number().int().min(1).max(180).optional().default(30).describe("Number of days of availability to fetch (default 30, max 180)"),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("get_experience_details", logWriter, async (args, extra) => {
      const startedAt = Date.now();
      const execution = await (async (): Promise<LoggedToolExecution> => {
        const validated = validateExperienceDetailsArgs(args);
        if (!validated.ok) {
          return {
            response: validated.error,
            resultCount: 0,
            summary: {
              slug: typeof args.slug === "string" ? args.slug.trim() || "(empty)" : undefined,
              format: typeof args.format === "string" ? args.format : undefined,
            },
          };
        }

        const {
          slug,
          provider,
          providerId,
          days,
          language,
          format,
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

          const [details, enrichedProducts] = await Promise.all([
            getExperienceDetails(providerName!, detailsProviderId!, days),
            resolved?.product.slug ? getMcpEnrichedProducts() : Promise.resolve(new Map<string, McpProduct>()),
          ]);
          const enrichedDetails = mergeEnrichedDetails(details, resolved?.product.slug, enrichedProducts);
          const bookingPath = resolved?.bookingPath;
          const bookingUrl = resolved ? buildBookingUrl(resolved.bookingPath, language) : undefined;
          const detailJson = experienceDetailsJsonPayload(days, enrichedDetails, {
            title: resolved?.product.title,
            slug: resolved?.product.slug,
            bookingPath,
            language,
          });
          const primaryVariant = enrichedDetails.mcpProduct?.variants?.[0];

          return {
            response: createFormattedResponse(
              format,
              appendNextStepHint([
                resolved ? `🎭 ${resolved.product.title}` : "",
                formatExperienceDetails(days, enrichedDetails),
                resolved ? `   🔗 ${bookingUrl}` : "",
              ].filter(Boolean).join("\n"), resolved ? DETAILS_NEXT_STEP_HINT : undefined),
              detailJson,
              {
                structuredContent: {
                  source: "tickadoo",
                  title: resolved?.product.title,
                  slug: resolved?.product.slug,
                  tickadooProductId: resolved?.product.id,
                  bookingUrl,
                  booking_url: bookingUrl,
                  imageUrl: enrichedDetails.desktopFeatureImageUrl ?? undefined,
                  image_url: enrichedDetails.desktopFeatureImageUrl ?? undefined,
                  duration_text: formatDuration(primaryVariant?.duration ?? null) ?? undefined,
                  review_rating: enrichedDetails.mcpProduct?.reviewRating ?? null,
                  review_count: enrichedDetails.mcpProduct?.reviewCount ?? null,
                  tags: enrichedDetails.mcpProduct?.tags ?? [],
                  days,
                  details: enrichedDetails,
                },
              },
            ),
            resultCount: 1,
            summary: { slug: slug ?? `${providerName}:${detailsProviderId}`, format },
          };
        } catch (error) {
          return {
            response: createFormattedErrorResponse(format, getErrorMessage(error)),
            resultCount: 0,
            summary: { slug: slug ?? `${provider ?? ""}:${providerId ?? ""}`, format },
          };
        }
      })();

      await recordUiToolTelemetry(telemetrySql, "get_experience_details", args, extra, execution, startedAt);
      return execution;
    }),
  );

  detailsTool.update({
    _meta: uiMeta(EXPERIENCE_CARD_URI, {
      invoking: "Loading experience…",
      invoked: "Details ready",
    }),
  });

  server.tool(
    "compare_experiences",
    `Compare 2 to 5 tickadoo experiences side-by-side. Returns winner callouts for best_value, highest_rated, most_popular, and best_for_families, plus key differences across price, duration, reviews, accessibility, and cancellation policy. ${LANGUAGE_SUPPORT_NOTE}`,
    {
      slugs: z.array(z.string().min(1)).min(2).max(5).describe("Array of 2-5 tickadoo slugs or booking paths to compare side-by-side."),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("compare_experiences", logWriter, async args => {
      const validated = validateCompareArgs({
        slugs: Array.isArray(args.slugs) ? args.slugs : [],
        language: typeof args.language === "string" ? args.language : undefined,
        format: typeof args.format === "string" ? args.format : undefined,
      });
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            slug_count: Array.isArray(args.slugs) ? args.slugs.length : 0,
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const { slugs, language, format } = validated.data;

      try {
        const [resolvedProducts, enrichedProducts] = await Promise.all([
          Promise.all(slugs.map(slug => resolveProductBySlug(slug, language))),
          getMcpEnrichedProducts(),
        ]);

        const compared = await Promise.all(
          resolvedProducts.map(async resolved => {
            const details = await getExperienceDetails(resolved.product.provider, resolved.product.providerId, 30);
            return buildComparableExperience(
              resolved,
              mergeEnrichedDetails(details, resolved.product.slug, enrichedProducts),
              language,
            );
          }),
        );

        const payload = buildComparisonPayload(compared);
        return {
          response: createFormattedResponse(
            format,
            formatComparisonText(payload),
            payload as unknown as Record<string, unknown>,
            {
              structuredContent: payload,
            },
          ),
          resultCount: compared.length,
          summary: {
            slug_count: compared.length,
            format,
            language,
          },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: {
            slug_count: slugs.length,
            format,
            language,
          },
        };
      }
    }),
  );

  const relatedTool = server.tool(
    "get_related_experiences",
    "Find experiences related to a given experience. Use for cross-sell, pairs with, or also nearby recommendations. Returns up to 10 related products with edge metadata.",
    {
      product_id: z.string().describe("Product slug of the source experience"),
      context: z.enum(["pair", "after", "nearby", "similar"]).default("pair")
        .describe("Relationship type: pair (co-booked or thematically linked), after (something to do after), nearby (spatial proximity), similar (same category)"),
      max_results: z.number().int().min(1).max(10).default(6),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("get_related_experiences", logWriter, async (args, extra) => {
      const startedAt = Date.now();
      const execution = await (async (): Promise<LoggedToolExecution> => {
        const edgeTypePreference: Record<"pair" | "after" | "nearby" | "similar", string[]> = {
          pair: ["co_booked", "tag_overlap", "spatial"],
          after: ["co_booked", "spatial"],
          nearby: ["spatial"],
          similar: ["similar", "tag_overlap"],
        };
        const productId = typeof args.product_id === "string" ? args.product_id.trim() : "";
        const context = (args.context ?? "pair") as "pair" | "after" | "nearby" | "similar";
        const maxResults = typeof args.max_results === "number" ? args.max_results : 6;

        if (!productId) {
          return {
            response: createErrorResponse("product_id is required."),
            resultCount: 0,
            summary: {
              context,
              max_results: maxResults,
            },
          };
        }

        try {
          const edgeTypes = edgeTypePreference[context];

          // Fetch heuristic edges (product_edges graph, ~2M rows) and semantic
          // edges (product_embeddings via pgvector cosine similarity) in
          // parallel. Semantic returns empty until embeddings are computed,
          // which degrades gracefully to heuristic-only behaviour.
          const [edges, semanticEdges] = await Promise.all([
            neonQuery<Array<{ target_id: string; edge_type: string; strength: number; metadata: unknown }>[number]>(
              `SELECT target_id, edge_type, strength, metadata
               FROM product_edges
               WHERE source_id = $1
                 AND edge_type = ANY($2::text[])
               ORDER BY strength DESC
               LIMIT $3`,
              [productId, edgeTypes, maxResults * 3],
            ),
            // Semantic similarity via HNSW cosine index on product_embeddings.
            // Returns 0 rows if the source product has no embedding or the
            // table is empty; wrapped in try/catch so a missing pgvector
            // extension or schema drift never breaks the tool.
            (async () => {
              try {
                return await neonQuery<Array<{ target_id: string; cosine_similarity: number }>[number]>(
                  `WITH source AS (SELECT embedding FROM product_embeddings WHERE product_id = $1)
                   SELECT pe.product_id AS target_id,
                          1 - (pe.embedding <=> source.embedding) AS cosine_similarity
                   FROM product_embeddings pe CROSS JOIN source
                   WHERE pe.product_id <> $1
                   ORDER BY pe.embedding <=> source.embedding
                   LIMIT $2`,
                  [productId, maxResults * 2],
                );
              } catch {
                return [];
              }
            })(),
          ]);

          const byTarget = new Map<string, { edge_type: string; strength: number; metadata: unknown }>();
          for (const edge of edges) {
            const prev = byTarget.get(edge.target_id);
            if (!prev || Number(edge.strength) > prev.strength) {
              byTarget.set(edge.target_id, {
                edge_type: edge.edge_type,
                strength: Number(edge.strength),
                metadata: edge.metadata,
              });
            }
          }
          // Fold semantic matches in. If a slug already exists (from the
          // heuristic graph), boost its strength by the semantic signal
          // rather than overwriting — both signals matter. Otherwise, add
          // the slug with edge_type "semantic" and a strength proportional
          // to cosine similarity (scaled to be comparable with heuristic
          // strength values, which roughly live in [0, 1]).
          for (const sim of semanticEdges) {
            const cosine = Number(sim.cosine_similarity);
            if (!Number.isFinite(cosine) || cosine <= 0.5) continue; // ignore weak matches
            const prev = byTarget.get(sim.target_id);
            if (prev) {
              byTarget.set(sim.target_id, {
                edge_type: prev.edge_type,
                strength: prev.strength + cosine * 0.25, // small boost
                metadata: { ...(prev.metadata && typeof prev.metadata === "object" ? prev.metadata as object : {}), cosine_similarity: cosine },
              });
            } else {
              byTarget.set(sim.target_id, {
                edge_type: "semantic",
                strength: cosine,
                metadata: { cosine_similarity: cosine },
              });
            }
          }

          const topTargets = Array.from(byTarget.entries())
            .sort((a, b) => b[1].strength - a[1].strength)
            .slice(0, maxResults);

          const targetSlugs = topTargets.map(([slug]) => slug);
          const products = targetSlugs.length > 0
            ? await neonQuery<Array<{
              slug: string;
              title: string;
              description: string | null;
              image_url: string | null;
              booking_url: string | null;
              price: number | null;
              currency: string | null;
              rating: number | null;
              review_count: number | null;
              city_slug: string;
              latitude: number | null;
              longitude: number | null;
            }>[number]>(
              `SELECT DISTINCT ON (slug)
                 slug,
                 name AS title,
                 description,
                 COALESCE(image_url, desktop_image_url, vertical_image_url) AS image_url,
                 checkout_url AS booking_url,
                 price_from AS price,
                 currency_code AS currency,
                 rating,
                 review_count,
                 city_slug,
                 latitude,
                 longitude
               FROM products
               WHERE slug = ANY($1::text[])
               ORDER BY slug, rating DESC NULLS LAST, review_count DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
              [targetSlugs],
            )
            : [];

          const bySlug = new Map(products.map(product => [product.slug, product]));
          const results = topTargets
            .map(([slug, edge]) => {
              const product = bySlug.get(slug);
              if (!product) {
                return null;
              }

              return {
                ...product,
                booking_url: product.booking_url || buildBookingUrl(`${product.city_slug}/${product.slug}`),
                price: product.price == null ? null : Number(product.price),
                rating: product.rating == null ? null : Number(product.rating),
                review_count: product.review_count == null ? null : Number(product.review_count),
                location: product.latitude != null && product.longitude != null
                  ? { latitude: Number(product.latitude), longitude: Number(product.longitude) }
                  : null,
                edge_type: edge.edge_type,
                edge_strength: edge.strength,
                edge_metadata: edge.metadata,
              };
            })
            .filter((value): value is NonNullable<typeof value> => value !== null);

          const payload = {
            source_id: productId,
            context,
            results,
            total: results.length,
          };

          return {
            response: createTextResponse(formatRelatedAsText(payload), { structuredContent: payload }),
            resultCount: results.length,
            summary: {
              product_id: productId,
              context,
              max_results: maxResults,
              returned: results.length,
            },
          };
        } catch (error) {
          return {
            response: createErrorResponse(getErrorMessage(error)),
            resultCount: 0,
            summary: {
              product_id: productId,
              context,
              max_results: maxResults,
            },
          };
        }
      })();

      await recordUiToolTelemetry(telemetrySql, "get_related_experiences", args, extra, execution, startedAt);
      return execution;
    }),
  );

  relatedTool.update({
    _meta: uiMeta(EXPERIENCE_TRIO_URI, {
      invoking: "Finding related experiences...",
      invoked: "Related experiences ready",
    }),
  });

  server.tool(
    "get_transfer_info",
    `Get airport, station, or port transfer options from a city's primary arrival hub to hotel coordinates. Returns taxi, tube/metro, bus, and train estimates with durations, estimated costs, and practical directions. ${LANGUAGE_SUPPORT_NOTE} Uses known default hubs per city, for example Heathrow for London airports or Gare du Nord for Paris stations.`,
    {
      city: z.string().describe("Supported city, such as London, Paris, New York, Amsterdam, Barcelona, Rome, or Tokyo."),
      from_type: z.enum(TRANSFER_FROM_TYPES).describe("Arrival hub type: airport, station, or port."),
      to_latitude: z.number().describe("Hotel latitude."),
      to_longitude: z.number().describe("Hotel longitude."),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("get_transfer_info", logWriter, async args => {
      const validated = validateTransferArgs(args);
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            city: typeof args.city === "string" ? args.city.trim() || "(empty)" : "(missing)",
            from_type: typeof args.from_type === "string" ? args.from_type : undefined,
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const {
        city,
        fromType,
        toLatitude,
        toLongitude,
        language,
        format,
      } = validated.data;

      try {
        const payload = buildTransferPayload({
          city,
          fromType,
          toLatitude,
          toLongitude,
        });

        return {
          response: createFormattedResponse(
            format,
            formatTransferInfo(payload, language),
            payload,
            {
              structuredContent: payload,
            },
          ),
          resultCount: payload.options.length,
          summary: {
            city: payload.city,
            from_type: payload.from_type,
            origin: payload.origin_name,
            format,
          },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: {
            city,
            from_type: fromType,
            format,
          },
        };
      }
    }),
  );

  server.tool(
    "get_family_day",
    `Build a full family day in one city with a morning activity, lunch tip, afternoon attraction, and optional evening stop. Uses kids_ages for age-aware filtering, prefers wheelchair-friendly options when toddlers make stroller access likely, and clusters the day geographically to reduce travel. ${LANGUAGE_SUPPORT_NOTE}`,
    {
      city: z.string().describe("City name or slug, such as 'london', 'new-york', or 'paris'."),
      kids_ages: z.array(z.number().int().min(0).max(17)).optional().describe("Optional array of child ages. Under 6 prefers easy and shorter stops, ages 6-12 prefer interactive or outdoor options, teens can handle more adventurous picks, and any age under 3 requires wheelchair-accessible options for stroller-friendly planning."),
      date: z.string().optional().describe("Optional ISO date YYYY-MM-DD for building the day around one travel date."),
      budget: z.number().optional().describe("Optional total day budget in the local currency for all selected activities."),
      language: z.string().optional().default(DEFAULT_LANGUAGE).describe(LANGUAGE_PARAM_DESCRIPTION),
      format: z.enum(RESPONSE_FORMATS).optional().default("text").describe("Response format: text (default) or json"),
    },
    READ_ONLY_TOOL_ANNOTATIONS,
    withToolLogging("get_family_day", logWriter, async args => {
      const validated = validateFamilyDayArgs({
        city: typeof args.city === "string" ? args.city : undefined,
        kids_ages: Array.isArray(args.kids_ages) ? args.kids_ages as number[] : undefined,
        date: typeof args.date === "string" ? args.date : undefined,
        budget: typeof args.budget === "number" ? args.budget : undefined,
        language: typeof args.language === "string" ? args.language : undefined,
        format: typeof args.format === "string" ? args.format : undefined,
      });
      if (!validated.ok) {
        return {
          response: validated.error,
          resultCount: 0,
          summary: {
            city: typeof args.city === "string" ? args.city.trim() || "(empty)" : "(missing)",
            date: typeof args.date === "string" ? args.date.trim() || undefined : undefined,
            kids_count: Array.isArray(args.kids_ages) ? args.kids_ages.length : 0,
            budget: typeof args.budget === "number" ? args.budget : undefined,
            format: typeof args.format === "string" ? args.format : undefined,
          },
        };
      }

      const {
        city,
        kidsAges,
        date,
        budget,
        language,
        format,
      } = validated.data;

      try {
        const searchDates = date ? { dateFrom: date, dateTo: date } : undefined;
        let citySlug = normalizeCityInput(city);
        let cityName = city;
        let products = await getProductsForCitySlug(citySlug, language, searchDates);

        if (!products.length) {
          const cities = await getCities(language);
          const candidates = findCityCandidates(city, cities);
          const bestMatch = candidates[0];

          if (bestMatch?.score >= AUTO_MATCH_CONFIDENCE) {
            citySlug = bestMatch.city.slug;
            cityName = bestMatch.city.name;
            products = await getProductsForCitySlug(citySlug, language, searchDates);
          } else {
            return {
              response: await buildSearchMissResponse(format, city, language, candidates.slice(0, CITY_SUGGESTION_LIMIT)),
              resultCount: 0,
              summary: { city, date, budget, kids_count: kidsAges.length, format },
            };
          }
        }

        if (!products.length) {
          const message = date
            ? `No bookable experiences were found in ${cityName} on ${date}. Try another date or omit the date to widen the search.`
            : `tickadoo does not have enough bookable inventory in ${cityName} yet to build a family day.`;
          const unavailablePayload = {
            city: cityName,
            plan: null,
            total_cost: null,
            currency: null,
            all_wheelchair_accessible: false,
            booking_urls: {},
            message,
          };

          return {
            response: createFormattedResponse(format, message, unavailablePayload, { structuredContent: unavailablePayload }),
            resultCount: 0,
            summary: { city: citySlug, date, budget, kids_count: kidsAges.length, format },
          };
        }

        const profile = deriveFamilyDayProfile(kidsAges);
        const enrichedProducts = await getMcpEnrichedProducts();
        const enriched = mergeEnrichedProducts(products, enrichedProducts);
        const shortlisted = enriched
          .map(product => {
            const candidate = buildFamilyDayCandidate(product, citySlug, language, undefined, date);
            const morningScore = scoreFamilyDayCandidate(candidate, profile, "morning");
            const afternoonScore = scoreFamilyDayCandidate(candidate, profile, "afternoon");
            const eveningScore = profile.allowsEvening ? scoreFamilyDayCandidate(candidate, profile, "evening") : Number.NEGATIVE_INFINITY;
            const shortlistScore = Math.max(morningScore, afternoonScore, eveningScore)
              + ((candidate.rating ?? 0) * 2)
              + Math.min(8, Math.log10((candidate.reviewCount ?? 0) + 1) * 4);

            return {
              product,
              candidate,
              shortlistScore,
            };
          })
          .filter(entry => entry.shortlistScore > 0)
          .sort((left, right) => right.shortlistScore - left.shortlistScore || left.product.title.localeCompare(right.product.title))
          .slice(0, 12);

        if (shortlisted.length < 2) {
          const message = `Not enough family-friendly experiences were found in ${cityName}${date ? ` on ${date}` : ""} to build a full day. Try a nearby city, another date, or omit kids_ages to broaden the planner.`;
          const unavailablePayload = {
            city: cityName,
            plan: null,
            total_cost: null,
            currency: null,
            all_wheelchair_accessible: false,
            booking_urls: {},
            message,
          };

          return {
            response: createFormattedResponse(format, message, unavailablePayload, { structuredContent: unavailablePayload }),
            resultCount: 0,
            summary: {
              city: citySlug,
              date,
              budget,
              kids_count: kidsAges.length,
              wheelchair_filter: profile.requiresWheelchairAccess,
              format,
            },
          };
        }

        const detailWindowDays = date ? calculateAvailabilityWindowDays(date) : 30;
        const detailedCandidates: FamilyDayCandidate[] = await Promise.all(
          shortlisted.map(async ({ product, candidate }) => {
            try {
              const details = await getExperienceDetails(product.provider, product.providerId, detailWindowDays);
              return buildFamilyDayCandidate(
                product,
                citySlug,
                language,
                mergeEnrichedDetails(details, product.slug, enrichedProducts),
                date,
              );
            } catch {
              return candidate;
            }
          }),
        );

        const payload = buildFamilyDayPayload({
          city: cityName,
          kidsAges,
          budget,
          candidates: detailedCandidates,
        });

        return {
          response: createFormattedResponse(
            format,
            formatFamilyDayText(payload),
            payload as unknown as Record<string, unknown>,
            {
              structuredContent: payload as unknown as Record<string, unknown>,
            },
          ),
          resultCount: Object.keys(payload.booking_urls).length,
          summary: {
            city: citySlug,
            date,
            budget,
            kids_count: kidsAges.length,
            wheelchair_filter: profile.requiresWheelchairAccess,
            format,
            language,
          },
        };
      } catch (error) {
        return {
          response: createFormattedErrorResponse(format, getErrorMessage(error)),
          resultCount: 0,
          summary: {
            city,
            date,
            budget,
            kids_count: kidsAges.length,
            format,
            language,
          },
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
        text: `tickadoo® Product Feed\n\nEndpoint: ${PRODUCT_FEED_URL}\nFormat: gzip JSONL (OpenAI Commerce Product Feed spec)\nContents: ~13,000 enriched products across 680+ cities with title, description, pricing, daily availability, images, and booking URLs.\n\nTo consume: curl -sL "${PRODUCT_FEED_URL}" | gunzip | head -5`,
        mimeType: "text/plain",
      }],
    }),
  );

  registerTickadooUiResources(server);
  return server;
}
