import {
  DEFAULT_LANGUAGE,
  DETAIL_DATE_PREVIEW_LIMIT,
  GHOST_CHECKOUT_INTENT_ENDPOINT,
} from "./config.js";
import { buildBookingUrl } from "./api.js";
import type { McpProduct, McpProductVariant, Product, StructuredDataDatePrice, StructuredDataResponse } from "./types.js";
// GRO-407: cross-surface seasonal-variant review-count suppression. Vendored
// from howard/src/quality/. Same predicate used by the OpenAI Commerce feed.
// See src/shared/quality/SYNC.md for the vendoring contract.
import { shouldSuppressReviews } from "./quality/index.js";

/** Strip supplier-specific promotional prefixes from product titles to protect supply chain details. */
function sanitizeProductTitle(title: string): string {
  return title
    .replace(/\[Headout[^\]]*\]\s*/gi, "")
    .replace(/\[Tiqets[^\]]*\]\s*/gi, "")
    .replace(/\[Musement[^\]]*\]\s*/gi, "")
    .replace(/\[GetYourGuide[^\]]*\]\s*/gi, "")
    .replace(/\[Viator[^\]]*\]\s*/gi, "")
    .replace(/\[Klook[^\]]*\]\s*/gi, "")
    .replace(/\[Civitatis[^\]]*\]\s*/gi, "")
    .trim();
}

const MAX_RESULT_DESCRIPTION_LENGTH = 150;
export const RESPONSE_FORMATS = ["text", "json"] as const;
export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];

export const SEARCH_NEXT_STEP_HINT = "💡 Tip: Use get_experience_details(slug) for availability & pricing. Use find_nearby_experiences(lat, lng) for location-based discovery.";
export const NEARBY_NEXT_STEP_HINT = "💡 Tip: Use get_experience_details(slug) for full details. Results sorted by distance from your coordinates.";
export const FILTERED_CITIES_NEXT_STEP_HINT = "💡 Tip: Use search_experiences(city) to see what's available in any of these cities.";
export const DETAILS_NEXT_STEP_HINT = "💡 Tip: Share the booking URL with the user. For similar experiences, use search_experiences(city).";

export function appendNextStepHint(text: string, hint?: string): string {
  if (!hint) {
    return text;
  }

  return `${text}\n\n${hint}`;
}

type NearbyCitySuggestion = {
  name: string;
  slug: string;
  distanceKm: number;
  experienceCount: number;
};

type SearchDisplayProduct = Product & {
  popular?: boolean;
};

export type SearchAppliedFilters = {
  category?: string;
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  dateFrom?: string;
  dateTo?: string;
  language?: string;
};

export type SearchOmittedReason = {
  filter: "category" | "query" | "price";
  reason: string;
  count: number;
};

export type SearchOmittedResults = {
  total: number;
  reasons: SearchOmittedReason[];
};

function normalizeDistanceKm(distanceKm: number): number {
  return Math.round(distanceKm * 10) / 10;
}

function mapNearbyCitySuggestion(city: NearbyCitySuggestion) {
  return {
    name: city.name,
    slug: city.slug,
    distance_km: normalizeDistanceKm(city.distanceKm),
    experience_count: city.experienceCount,
  };
}

export function formatJsonText(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

function normalizeGooglePlaceId(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function searchAppliedFiltersJson(filters?: SearchAppliedFilters) {
  const payload = {
    ...(filters?.category ? { category: filters.category } : {}),
    ...(filters?.query ? { query: filters.query } : {}),
    ...(filters?.minPrice != null ? { min_price: filters.minPrice } : {}),
    ...(filters?.maxPrice != null ? { max_price: filters.maxPrice } : {}),
    ...(filters?.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters?.dateTo ? { date_to: filters.dateTo } : {}),
    ...(filters?.language && filters.language !== DEFAULT_LANGUAGE ? { language: filters.language } : {}),
  };

  return Object.keys(payload).length ? payload : undefined;
}

function searchOmittedResultsJson(omittedResults?: SearchOmittedResults) {
  if (!omittedResults || omittedResults.total <= 0 || omittedResults.reasons.length === 0) {
    return undefined;
  }

  return {
    total: omittedResults.total,
    reasons: omittedResults.reasons.map(reason => ({
      filter: reason.filter,
      count: reason.count,
      reason: reason.reason,
    })),
  };
}

export function formatSearchFiltersLine(filters?: SearchAppliedFilters): string | undefined {
  const payload = searchAppliedFiltersJson(filters);
  if (!payload) {
    return undefined;
  }

  return `🔎 Filters: ${Object.entries(payload).map(([key, value]) => `${key}=${value}`).join(", ")}`;
}

export function formatSearchSortLine(sort = "relevance"): string | undefined {
  if (sort === "relevance") {
    return undefined;
  }

  return `🔀 Sort: ${sort}`;
}

export function formatOmittedResultsHint(omittedResults?: SearchOmittedResults): string | undefined {
  if (!omittedResults || omittedResults.total <= 0 || omittedResults.reasons.length === 0) {
    return undefined;
  }

  const noun = omittedResults.total === 1 ? "experience was" : "experiences were";
  const reasonSummary = omittedResults.reasons
    .filter(reason => reason.count > 0)
    .map(reason => `${reason.count} ${reason.reason}`)
    .join(", ");

  if (!reasonSummary) {
    return undefined;
  }

  return `💡 ${omittedResults.total} ${noun} filtered out (${reasonSummary})`;
}

function formatNearbyCitySuggestionList(cities: NearbyCitySuggestion[]): string[] {
  return cities.map(city => `  • ${city.name} (${Math.round(city.distanceKm)}km) — ${city.experienceCount} experiences`);
}

export function formatDidYouMeanRecovery(
  city: string,
  suggestion: { name: string; slug: string },
  nearbyCities: NearbyCitySuggestion[] = [],
): string {
  const lines = [
    `No experiences found in "${city}".`,
    "",
    `💡 Did you mean ${suggestion.name}? Try: search_experiences(city: '${suggestion.name}')`,
  ];

  if (nearbyCities.length) {
    lines.push("", "Alternatively, nearby cities with experiences:", ...formatNearbyCitySuggestionList(nearbyCities));
  }

  return lines.join("\n");
}

export function didYouMeanRecoveryJson(
  city: string,
  suggestion: { name: string; slug: string },
  nearbyCities: NearbyCitySuggestion[] = [],
) {
  return {
    city,
    total: 0,
    showing: 0,
    results: [],
    message: `No experiences found in "${city}".`,
    suggestion: {
      city: suggestion.name,
      slug: suggestion.slug,
      search_hint: `search_experiences(city: '${suggestion.name}')`,
    },
    ...(nearbyCities.length
      ? { nearby_cities: nearbyCities.map(mapNearbyCitySuggestion) }
      : {}),
  };
}

export function formatNoCoverageRecovery(city: string, nearbyCities: NearbyCitySuggestion[] = []): string {
  const lines = [`tickadoo doesn't have experiences in "${city}" yet.`];

  if (nearbyCities.length) {
    lines.push("", "Nearby cities with experiences:", ...formatNearbyCitySuggestionList(nearbyCities));
  } else {
    lines.push("", "Try a nearby major city like London, New York, Paris, Dubai, or Tokyo.");
  }

  return lines.join("\n");
}

export function noCoverageRecoveryJson(city: string, nearbyCities: NearbyCitySuggestion[] = []) {
  return {
    city,
    total: 0,
    showing: 0,
    results: [],
    message: `tickadoo doesn't have experiences in "${city}" yet.`,
    ...(nearbyCities.length
      ? { nearby_cities: nearbyCities.map(mapNearbyCitySuggestion) }
      : {}),
  };
}

export function formatNearbyEmptyRecovery(
  radiusKm: number,
  suggestedRadiusKm: number,
  nearestCity?: { name: string },
): string {
  const lines = [
    `No experiences found within ${radiusKm}km.`,
    "",
    `💡 Try increasing the radius to ${suggestedRadiusKm}km${nearestCity ? `, or search in ${nearestCity.name}.` : "."}`,
  ];

  if (nearestCity) {
    lines.push(`Try: search_experiences(city: '${nearestCity.name}')`);
  }

  return lines.join("\n");
}

export function nearbyEmptyRecoveryJson(
  latitude: number,
  longitude: number,
  radiusKm: number,
  suggestedRadiusKm: number,
  nearestCity?: { name: string },
) {
  return {
    latitude,
    longitude,
    radius_km: radiusKm,
    total: 0,
    showing: 0,
    results: [],
    message: `No experiences found within ${radiusKm}km.`,
    suggested_radius_km: suggestedRadiusKm,
    ...(nearestCity
      ? {
          nearest_city: {
            name: nearestCity.name,
            search_hint: `search_experiences(city: '${nearestCity.name}')`,
          },
        }
      : {}),
  };
}

export function formatEmptyCategoryRecovery(
  category: string,
  city: string,
  availableCategories: string[],
): string {
  const lines = [`No ${category} experiences in ${city}.`];

  if (availableCategories.length) {
    lines.push("", `Available categories: ${availableCategories.join(", ")}.`);
  } else {
    lines.push("", "Try another category or remove the category filter.");
  }

  return lines.join("\n");
}

export function emptyCategoryRecoveryJson(
  citySlug: string,
  cityName: string,
  category: string,
  availableCategories: string[],
) {
  return {
    city: citySlug,
    city_name: cityName,
    category,
    total: 0,
    showing: 0,
    results: [],
    message: `No ${category} experiences in ${cityName}.`,
    available_categories: availableCategories,
  };
}

export function genericJsonError(message: string) {
  return { error: message };
}

export function summarizeProductDescription(description: string | null | undefined): string | undefined {
  if (typeof description !== "string") {
    return undefined;
  }

  const normalized = description.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= MAX_RESULT_DESCRIPTION_LENGTH) {
    return normalized;
  }

  const truncated = normalized.slice(0, MAX_RESULT_DESCRIPTION_LENGTH - 3).trimEnd();
  const lastWordBoundary = truncated.lastIndexOf(" ");
  const safeBoundary = lastWordBoundary >= 100 ? lastWordBoundary : truncated.length;
  return `${truncated.slice(0, safeBoundary).trimEnd()}...`;
}

function parseTimespan(timespan: string | null | undefined) {
  if (typeof timespan !== "string") {
    return null;
  }

  const trimmed = timespan.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    days: Number(match[1] ?? 0),
    hours: Number(match[2]),
    minutes: Number(match[3]),
    seconds: Number(match[4]),
  };
}

function formatJoinedValues(values: string[] | null | undefined, options?: { uppercase?: boolean; humanize?: boolean }): string | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const normalized = values
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      if (options?.humanize) {
        return value
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/[_-]+/g, " ")
          .trim();
      }

      return options?.uppercase ? value.toUpperCase() : value;
    });

  return normalized.length ? normalized.join(" · ") : null;
}

function getPrimaryVariant(mcpProduct?: McpProduct | null): McpProductVariant | undefined {
  return mcpProduct?.variants?.[0];
}

function formatReviewCount(reviewCount: number | null | undefined): string | null {
  if (typeof reviewCount !== "number" || reviewCount <= 0) {
    return null;
  }

  return `${reviewCount} review${reviewCount === 1 ? "" : "s"}`;
}

function formatGroupSize(variant?: McpProductVariant): string | null {
  if (!variant) {
    return null;
  }

  const min = variant.groupSizeMin;
  const max = variant.groupSizeMax;

  if (min != null && max != null) {
    return min === max ? `${min}` : `${min}-${max}`;
  }

  if (min != null) {
    return `${min}+`;
  }

  if (max != null) {
    return `Up to ${max}`;
  }

  return null;
}

function groupSizeJson(variant?: McpProductVariant) {
  if (!variant || (variant.groupSizeMin == null && variant.groupSizeMax == null)) {
    return null;
  }

  return {
    min: variant.groupSizeMin ?? null,
    max: variant.groupSizeMax ?? null,
  };
}

export function formatDuration(timespan: string | null): string | null {
  const parsed = parseTimespan(timespan);
  if (!parsed) {
    return null;
  }

  const parts: string[] = [];
  if (parsed.days > 0) {
    parts.push(`${parsed.days} day${parsed.days === 1 ? "" : "s"}`);
  }
  if (parsed.hours > 0) {
    parts.push(`${parsed.hours}h`);
  }
  if (parsed.minutes > 0) {
    parts.push(`${parsed.minutes}m`);
  }
  if (!parts.length && parsed.seconds > 0) {
    parts.push(`${parsed.seconds}s`);
  }

  return parts.length ? parts.join(" ") : null;
}

export function formatCancellation(policy: string | null | undefined, period: string | null): string | null {
  if (!policy || policy === "Unknown") {
    return null;
  }

  if (policy === "Never") {
    return "Non-refundable";
  }

  if (policy === "BeforeTimeslot" || policy === "BeforeDate") {
    const formattedPeriod = formatDuration(period);
    return formattedPeriod ? `Free cancellation up to ${formattedPeriod} before` : "Free cancellation available";
  }

  return null;
}

function formatBooleanLabel(value: boolean | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return value ? "Yes" : "No";
}

export function productStructuredData(product: SearchDisplayProduct, bookingPath = product.slug, language = "en") {
  const description = summarizeProductDescription(product.description);
  const priceAmount = product.minPrice ?? undefined;
  const priceCurrency = priceAmount != null ? product.currency : undefined;
  const primaryVariant = getPrimaryVariant(product.mcpProduct);
  const duration = formatDuration(primaryVariant?.duration ?? null);
  const cancellation = formatCancellation(primaryVariant?.cancellationPolicy, primaryVariant?.cancellationPeriod ?? null);

  return {
    tickadooProductId: product.id,
    slug: product.slug,
    title: sanitizeProductTitle(product.title),
    description,
    priceAmount,
    priceCurrency,
    ...(product.popular != null ? { popular: product.popular } : {}),
    ...(product.mcpProduct
      ? {
          duration: duration ?? null,
          reviewCount: product.mcpProduct.reviewCount ?? null,
          tags: product.mcpProduct.tags,
          audience: product.mcpProduct.audience,
          indoorOutdoor: product.mcpProduct.indoorOutdoor ?? null,
          physicalLevel: product.mcpProduct.physicalLevel ?? null,
          cancellation: cancellation ?? null,
        }
      : {}),
    bookingUrl: buildBookingUrl(bookingPath, language),
    bookingAvailable: true,
    bookingScope: "external_checkout_redirect",
    imageUrl: product.desktopFeatureImageUrl ?? product.verticalImageUrl ?? undefined,
  };
}

export function productJsonData(product: SearchDisplayProduct, bookingPath = product.slug, language = "en") {
  const description = summarizeProductDescription(product.description);
  const imageUrl = product.desktopFeatureImageUrl ?? product.verticalImageUrl ?? null;
  const primaryVariant = getPrimaryVariant(product.mcpProduct);
  const duration = formatDuration(primaryVariant?.duration ?? null);
  const cancellation = formatCancellation(primaryVariant?.cancellationPolicy, primaryVariant?.cancellationPeriod ?? null);

  return {
    title: sanitizeProductTitle(product.title),
    slug: product.slug,
    description: description ?? null,
    ...(product.popular != null ? { popular: product.popular } : {}),
    price: product.minPrice != null
      ? {
          amount: product.minPrice,
          currency: product.currency,
        }
      : null,
    rating: product.averageRating ?? null,
    ...(product.mcpProduct?.reviewRating != null && product.mcpProduct.reviewRating > 0
      ? {
          social_proof: product.mcpProduct.reviewCount
            ? `${product.mcpProduct.reviewRating.toFixed(1)}/5 (${product.mcpProduct.reviewCount.toLocaleString()} reviews)`
            : `${product.mcpProduct.reviewRating.toFixed(1)}/5`,
        }
      : {}),
    image_url: imageUrl,
    ...(product.mcpProduct
      ? {
          duration,
          review_rating: product.mcpProduct.reviewRating ?? null,
          review_count: product.mcpProduct.reviewCount ?? null,
          tags: product.mcpProduct.tags,
          audience: product.mcpProduct.audience,
          indoor_outdoor: product.mcpProduct.indoorOutdoor ?? null,
          physical_level: product.mcpProduct.physicalLevel ?? null,
          cancellation,
          wheelchair_accessible: product.mcpProduct.wheelchairAccessible ?? null,
          stroller_friendly: product.mcpProduct.strollerFriendly ?? null,
          language_options: product.mcpProduct.languageOptions?.length ? product.mcpProduct.languageOptions : null,
          age_minimum: primaryVariant?.ageMinimum ?? null,
        }
      : {}),
    booking_url: buildBookingUrl(bookingPath, language),
    booking_available: true,
    booking_scope: "external_checkout_redirect",
    reserve_action: {
      type: "ReserveAction",
      url_template: buildBookingUrl(bookingPath, language) + "&date={date}&time={time}&adults={adults}&lang={language}",
    },
    location: {
      address: product.address ?? null,
    },
  };
}

/** Build available filter values from a set of products — helps agents narrow results. */
export function buildAvailableFilters(products: SearchDisplayProduct[]) {
  const audiences = new Set<string>();
  const settings = new Set<string>();
  const physicalLevels = new Set<string>();
  const languages = new Set<string>();
  let hasWheelchair = false;
  let hasFreeCancellation = false;

  const tagSet = new Set<string>();

  for (const p of products) {
    for (const t of p.mcpProduct?.tags || []) tagSet.add(t);
    for (const a of p.mcpProduct?.audience || []) audiences.add(a);
    const s = p.mcpProduct?.indoorOutdoor;
    if (s) settings.add(s);
    const pl = p.mcpProduct?.physicalLevel;
    if (pl) physicalLevels.add(pl);
    for (const l of p.mcpProduct?.languageOptions || []) languages.add(l);
    if (p.mcpProduct?.wheelchairAccessible) hasWheelchair = true;
    const policy = p.mcpProduct?.variants?.[0]?.cancellationPolicy;
    if (policy === "BeforeTimeslot" || policy === "BeforeDate") hasFreeCancellation = true;
  }

  // Collect duration range (from variants)
  const durations: number[] = [];
  for (const p of products) {
    const variant = p.mcpProduct?.variants?.[0];
    if (variant?.duration) {
      // Parse .NET TimeSpan format HH:MM:SS
      const parts = variant.duration.split(":");
      if (parts.length >= 2) {
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        const totalMinutes = hours * 60 + minutes;
        if (totalMinutes > 0) durations.push(totalMinutes);
      }
    }
  }
  const durationRange = durations.length > 0
    ? { min_minutes: Math.min(...durations), max_minutes: Math.max(...durations) }
    : null;

  // Collect price range
  const prices = products
    .map(p => p.minPrice)
    .filter((p): p is number => p != null && p > 0);
  const priceRange = prices.length > 0
    ? { min: Math.min(...prices), max: Math.max(...prices), currency: products[0]?.currency || "GBP" }
    : null;

  return {
    audience: [...audiences].sort(),
    setting: [...settings].sort(),
    physical_level: [...physicalLevels].sort(),
    languages: [...languages].sort().slice(0, 10),
    wheelchair_accessible: hasWheelchair,
    free_cancellation_available: hasFreeCancellation,
    free_cancellation_count: products.filter(p => { const v = p.mcpProduct?.variants?.[0]; return v?.cancellationPolicy === "BeforeTimeslot" || v?.cancellationPolicy === "BeforeDate"; }).length,
    bookable_count: products.filter(p => p.minPrice != null).length,
    ...(priceRange ? { price_range: priceRange } : {}),
    ...(durationRange ? { duration_range: durationRange } : {}),
    tags: [...tagSet].sort().slice(0, 15),
    tag_counts: Object.fromEntries([...tagSet].map(t => [t, products.filter(p => (p.mcpProduct?.tags || []).includes(t)).length]).sort((a, b) => (b as any)[1] - (a as any)[1]).slice(0, 10)),
  };
}

/** Format available filters as a text hint for agents. */
export function formatAvailableFiltersHint(products: SearchDisplayProduct[]): string {
  const f = buildAvailableFilters(products);
  const parts: string[] = [];
  if (f.audience.length > 0) parts.push(`audience: ${f.audience.join(", ")}`);
  if (f.setting.length > 0) parts.push(`setting: ${f.setting.join(", ")}`);
  if (f.physical_level.length > 0) parts.push(`physical: ${f.physical_level.join(", ")}`);
  if (f.languages.length > 1) parts.push(`languages: ${f.languages.join(", ")}`);
  if (f.wheelchair_accessible) parts.push("wheelchair_accessible");
  if (f.free_cancellation_available) parts.push("free_cancellation");
  if (f.tags && f.tags.length > 0) parts.push(`tags: ${f.tags.slice(0, 6).join(", ")}`);
  if (!parts.length) return "";
  return `\n🔍 Narrow with: ${parts.join(" · ")}`;
}

/** Build related search suggestions based on current result tags. */
export function buildRelatedSearches(citySlug: string, products: SearchDisplayProduct[]): string[] {
  const tagCounts = new Map<string, number>();
  for (const p of products) {
    for (const t of p.mcpProduct?.tags || []) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  const skipTags = new Set(["Bestseller", "MustSee", "CityPass"]);
  const tagMap: Record<string, string> = {
    Musical: "musicals and theatre shows", GuidedTour: "guided tours", WalkingTour: "walking tours",
    FoodTour: "food and culinary tours", Museum: "museums and galleries", Cruise: "boat cruises",
    Adventure: "adventure activities", NightLife: "nightlife and entertainment",
    Dining: "dining experiences", Outdoor: "outdoor activities", SkipTheLine: "skip-the-line tickets",
    Concert: "concerts and live music", Spa: "spa and wellness", Workshop: "workshops and classes",
    Show: "shows and performances", DayTrip: "day trips", KidsAttraction: "kids attractions",
    Seasonal: "seasonal events", WestEnd: "West End theatre", Evening: "evening activities",
    Morning: "morning activities", Attraction: "top attractions", Transfer: "airport transfers",
    BikeTour: "bike tours", HiddenGem: "hidden gems", WaterSport: "water sports",
    HopOnHopOff: "hop-on hop-off tours", Helicopter: "helicopter tours", SelfGuided: "self-guided tours",
    Cooking: "cooking classes", Sunset: "sunset experiences", VIP: "VIP and private tours",
    Rooftop: "rooftop experiences", Safari: "safari experiences", WhaleWatching: "whale watching",
    ThemePark: "theme parks", Aquarium: "aquariums", Observatory: "observation decks and towers",
  };
  const suggestions: string[] = [];
  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted) {
    if (count >= 2 && suggestions.length < 5 && !skipTags.has(tag)) {
      const label = tagMap[tag] || tag.toLowerCase();
      suggestions.push(`search_experiences(city: '${citySlug}', tags: '${tag}') — ${label}`);
    }
  }
  return suggestions;
}

/** Auto-curated best picks with reasoning. */
export function buildBestPicks(products: SearchDisplayProduct[]): Record<string, unknown>[] {
  if (products.length < 2) return [];
  const picks: Record<string, unknown>[] = [];
  const withPrice = products.filter(p => p.minPrice != null && p.minPrice > 0);
  if (withPrice.length > 0) {
    const bestValue = withPrice.reduce((best, p) => {
      const ratio = (p.averageRating ?? 0) / (p.minPrice ?? 999);
      const bestRatio = (best.averageRating ?? 0) / (best.minPrice ?? 999);
      return ratio > bestRatio ? p : best;
    });
    picks.push({ slug: bestValue.slug, title: bestValue.title, reason: "best_value", detail: `${bestValue.averageRating ?? "?"}★ at ${bestValue.currency ?? ""} ${bestValue.minPrice}` });
  }
  const rated = products.filter(p => (p.averageRating ?? 0) > 0 && (p.mcpProduct?.reviewCount ?? 0) >= 10);
  if (rated.length > 0) {
    const topRated = rated.reduce((best, p) => ((p.averageRating ?? 0) > (best.averageRating ?? 0) ? p : best));
    if (!picks.some(pk => pk.slug === topRated.slug)) {
      picks.push({ slug: topRated.slug, title: topRated.title, reason: "highest_rated", detail: `${topRated.averageRating}★ from ${topRated.mcpProduct?.reviewCount ?? "?"} reviews` });
    }
  }
  const reviewed = products.filter(p => (p.mcpProduct?.reviewCount ?? 0) > 0);
  if (reviewed.length > 0) {
    const mostReviewed = reviewed.reduce((best, p) => ((p.mcpProduct?.reviewCount ?? 0) > (best.mcpProduct?.reviewCount ?? 0) ? p : best));
    if (!picks.some(pk => pk.slug === mostReviewed.slug)) {
      picks.push({ slug: mostReviewed.slug, title: mostReviewed.title, reason: "most_popular", detail: `${mostReviewed.mcpProduct?.reviewCount?.toLocaleString()} reviews` });
    }
  }
  return picks.slice(0, 3);
}

/** Group products into budget/mid/premium tiers. */
export function buildPriceTiers(products: SearchDisplayProduct[]): Record<string, unknown> | null {
  const priced = products.filter(p => p.minPrice != null && p.minPrice > 0);
  if (priced.length < 3) return null;
  const prices = priced.map(p => p.minPrice!).sort((a, b) => a - b);
  const p33 = prices[Math.floor(prices.length / 3)];
  const p66 = prices[Math.floor(prices.length * 2 / 3)];
  const cur = priced[0].currency ?? "";
  return {
    budget: { count: priced.filter(p => p.minPrice! <= p33).length, max_price: p33, label: `Under ${cur} ${p33}` },
    mid_range: { count: priced.filter(p => p.minPrice! > p33 && p.minPrice! <= p66).length, label: `${cur} ${p33}–${p66}` },
    premium: { count: priced.filter(p => p.minPrice! > p66).length, min_price: p66, label: `Over ${cur} ${p66}` },
  };
}

/** Format best picks as a text hint for text responses. */
export function buildBestPicksText(products: SearchDisplayProduct[]): string {
  const picks = buildBestPicks(products);
  if (!picks.length) return "";
  const lines = picks.map(p => {
    const labels: Record<string, string> = { best_value: "💎 Best value", highest_rated: "⭐ Top rated", most_popular: "🔥 Most popular" };
    return `${labels[p.reason as string] ?? p.reason}: ${p.title} (${p.detail})`;
  });
  return "\n" + lines.join("\n");
}

/** Tag-based breakdown of search results for agents. */
export function buildGroupSummary(products: SearchDisplayProduct[]): Record<string, number> | null {
  if (products.length < 2) return null;
  const tags: Record<string, number> = {};
  for (const p of products) {
    const pTags = p.mcpProduct?.tags ?? [];
    if (pTags.length === 0) {
      tags["other"] = (tags["other"] ?? 0) + 1;
    } else {
      for (const t of pTags) tags[t] = (tags[t] ?? 0) + 1;
    }
  }
  if (Object.keys(tags).length < 2) return null;
  return Object.fromEntries(
    Object.entries(tags).sort(([, a], [, b]) => b - a).slice(0, 8)
  );
}

/** Context-aware conversation starters referencing best picks. */
export function buildConversationStarters(products: SearchDisplayProduct[], cityName: string): string[] {
  const starters: string[] = [];
  const af = buildAvailableFilters(products);
  const picks = buildBestPicks(products);
  const bestValue = picks.find(p => p.reason === "best_value");
  const topRated = picks.find(p => p.reason === "highest_rated");

  // Lead with best value if available
  if (bestValue && af.price_range) {
    const pr = af.price_range as { min: number; max: number; currency: string };
    starters.push(`Prices start from ${pr.currency} ${pr.min}. ${(bestValue.title as string).split(":")[0]} is our best value pick. Want budget-friendly options?`);
  } else if (af.price_range) {
    const pr = af.price_range as { min: number; max: number; currency: string };
    starters.push(`Prices range from ${pr.currency} ${pr.min} to ${pr.currency} ${pr.max}. Do you have a budget in mind?`);
  }

  // Duration with time hint
  if (af.duration_range) {
    const dr = af.duration_range as { min_minutes: number; max_minutes: number };
    const minH = dr.min_minutes >= 60 ? `${Math.floor(dr.min_minutes / 60)}h` : `${dr.min_minutes}min`;
    const maxH = dr.max_minutes >= 60 ? `${Math.floor(dr.max_minutes / 60)}h` : `${dr.max_minutes}min`;
    starters.push(`Experiences range from ${minH} to ${maxH}. How much time do you have?`);
  }

  // Cancellation with count
  const fcCount = af.free_cancellation_count as number | undefined;
  if (fcCount && fcCount > 0) {
    starters.push(`${fcCount} of these offer free cancellation — great for flexible plans.`);
  } else if (af.wheelchair_accessible) {
    starters.push("Several options have wheelchair access. Need accessible choices?");
  }

  // Add group summary hint
  const groups = buildGroupSummary(products);
  if (groups && Object.keys(groups).length >= 3) {
    const top3 = Object.entries(groups).slice(0, 3).map(([tag, count]) => `${count} ${tag}`).join(", ");
    starters.push(`Mix of ${top3} and more. Want to narrow by type?`);
  }

  return starters.slice(0, 3);
}

/** Build a compact one-line summary of result set for text responses. */
export function buildResultSummaryLine(products: SearchDisplayProduct[]): string {
  const af = buildAvailableFilters(products);
  const parts: string[] = [];
  
  // Price range
  if (af.price_range) {
    const pr = af.price_range as { min: number; max: number; currency: string };
    parts.push(`${pr.currency} ${pr.min}–${pr.max}`);
  }
  
  // Duration
  if (af.duration_range) {
    const dr = af.duration_range as { min_minutes: number; max_minutes: number };
    const fmt = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? m % 60 + "m" : ""}` : `${m}m`;
    parts.push(`${fmt(dr.min_minutes)}–${fmt(dr.max_minutes)}`);
  }
  
  // Top 3 tags with counts (skip generic)
  const skip = new Set(["Bestseller", "MustSee", "CityPass"]);
  const tc = af.tag_counts as Record<string, number> | undefined;
  if (tc) {
    const top = Object.entries(tc).filter(([t]) => !skip.has(t)).slice(0, 3).map(([t, c]) => {
      const labels: Record<string, string> = { Musical: "musicals", GuidedTour: "guided tours", Museum: "museums", Cruise: "cruises", FoodTour: "food tours", Adventure: "adventure", NightLife: "nightlife", Dining: "dining", Show: "shows", Outdoor: "outdoor", SkipTheLine: "skip-line", Concert: "concerts", Attraction: "attractions", Cooking: "cooking", Sunset: "sunset", VIP: "VIP", Rooftop: "rooftop", Safari: "safari", WhaleWatching: "whale watching", HopOnHopOff: "hop-on hop-off", Helicopter: "helicopter", SelfGuided: "self-guided" };
      return `${c} ${labels[t] || t.toLowerCase()}`;
    });
    if (top.length) parts.push(top.join(", "));
  }
  
  // Languages (if >1)
  if (af.languages.length > 1) parts.push(af.languages.join("+"));
  
  if (!parts.length) return "";
  return `📊 ${parts.join(" · ")}`;
}

export function searchJsonPayload(
  citySlug: string,
  cityName: string,
  total: number,
  products: SearchDisplayProduct[],
  options?: {
    filters?: SearchAppliedFilters;
    language?: string;
    omittedResults?: SearchOmittedResults;
    sort?: string;
  },
) {
  const filters = searchAppliedFiltersJson(options?.filters);
  const omittedResults = searchOmittedResultsJson(options?.omittedResults);

  return {
    city: citySlug,
    city_name: cityName,
    sort: options?.sort ?? "relevance",
    total,
    showing: products.length,
    ...(filters ? { filters } : {}),
    ...(omittedResults ? { omitted_results: omittedResults } : {}),
    results: products.map(product => productJsonData(product, `${citySlug}/${product.slug}`, options?.language)),
    view_all_url: buildBookingUrl(citySlug, options?.language),
    _next_step: "Use get_experience_details with a product slug to get availability.slots with specific dates, prices, and booking URLs for that experience.",
    _related_searches: buildRelatedSearches(citySlug, products),
    _conversation_starters: buildConversationStarters(products, cityName),
    _best_picks: buildBestPicks(products),
    _price_tiers: buildPriceTiers(products),
    _group_summary: buildGroupSummary(products),
  };
}

export function nearbyJsonPayload(
  latitude: number,
  longitude: number,
  radiusKm: number,
  total: number,
  products: Product[],
  language = "en",
  options?: {
    dateFrom?: string;
    dateTo?: string;
  },
) {
  return {
    latitude,
    longitude,
    radius_km: radiusKm,
    ...(options?.dateFrom ? { date_from: options.dateFrom } : {}),
    ...(options?.dateTo ? { date_to: options.dateTo } : {}),
    total,
    showing: products.length,
    results: products.map(product => productJsonData(product, product.slug, language)),
    _next_step: "Use get_experience_details with a product slug to get availability.slots with specific dates, prices, and booking URLs for that experience.",
  };
}

export function cityDirectoryJsonPayload(
  query: string | undefined,
  total: number,
  cities: Array<{ name: string; slug: string }>,
  language = "en",
) {
  return {
    query: query ?? null,
    total,
    showing: cities.length,
    results: cities.map(city => ({
      name: city.name,
      slug: city.slug,
      booking_url: buildBookingUrl(city.slug, language),
    })),
  };
}

export function formatProduct(product: Product, bookingPath = product.slug, language = "en"): string {
  // GRO-407: skip review prose for venue-inherited seasonal-variant counts.
  const suppressReviewsText = shouldSuppressReviews(product.title, product.mcpProduct?.reviewCount);
  const description = summarizeProductDescription(product.description);
  const primaryVariant = getPrimaryVariant(product.mcpProduct);
  const duration = formatDuration(primaryVariant?.duration ?? null);
  const reviewCount = suppressReviewsText ? null : formatReviewCount(product.mcpProduct?.reviewCount);
  const tags = formatJoinedValues(product.mcpProduct?.tags, { humanize: true });
  const audience = formatJoinedValues(product.mcpProduct?.audience);
  const cancellation = formatCancellation(primaryVariant?.cancellationPolicy, primaryVariant?.cancellationPeriod ?? null);
  const lines = [`🎭 ${sanitizeProductTitle(product.title)}`];
  if ((product as any).popular === true) lines.push(`   🔥 Popular`);
  if (description) lines.push(`   ${description}`);
  if (product.slug) lines.push(`   🔖 Slug: ${product.slug}`);
  if (product.minPrice != null) lines.push(`   💰 From ${product.currency} ${product.minPrice.toFixed(2)}`);
  if (!suppressReviewsText && product.averageRating != null && product.averageRating > 0) lines.push(`   ⭐ ${product.averageRating.toFixed(1)}/5`);
  if (duration) lines.push(`   ⏱️ Duration: ${duration}`);
  if (reviewCount) lines.push(`   🗳️ ${reviewCount}`);
  if (tags) lines.push(`   🏷️ Tags: ${tags}`);
  if (audience) lines.push(`   👥 Audience: ${audience}`);
  if (product.mcpProduct?.indoorOutdoor) lines.push(`   🏛️ Setting: ${product.mcpProduct.indoorOutdoor}`);
  if (product.mcpProduct?.physicalLevel) lines.push(`   💪 Physical level: ${product.mcpProduct.physicalLevel}`);
  if (cancellation) lines.push(`   ↩️ Cancellation: ${cancellation}`);
  if (product.mcpProduct?.wheelchairAccessible === true) lines.push(`   ♿ Wheelchair accessible`);
  if (product.mcpProduct?.strollerFriendly === true) lines.push(`   👶 Stroller friendly`);
  if (product.mcpProduct?.languageOptions?.length && product.mcpProduct.languageOptions.length > 1) {
    lines.push(`   🌐 Languages: ${product.mcpProduct.languageOptions.slice(0, 6).join(", ")}${product.mcpProduct.languageOptions.length > 6 ? ` +${product.mcpProduct.languageOptions.length - 6} more` : ""}`);
  }
  if (product.address) lines.push(`   📍 ${product.address}`);
  if (product.desktopFeatureImageUrl || product.verticalImageUrl) {
    lines.push(`   🖼️ ${product.desktopFeatureImageUrl || product.verticalImageUrl}`);
  }
  lines.push(`   🔗 ${buildBookingUrl(bookingPath, language)}`);
  return lines.join("\n");
}

export function formatAvailabilitySummary(
  dates: StructuredDataDatePrice[],
  currencyCode: string,
): string[] {
  const groupedByDate = new Map<string, StructuredDataDatePrice[]>();
  for (const item of dates) {
    const existing = groupedByDate.get(item.date) ?? [];
    existing.push(item);
    groupedByDate.set(item.date, existing);
  }

  const groupedDates = [...groupedByDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const shownDates = groupedDates.slice(0, DETAIL_DATE_PREVIEW_LIMIT);
  const lines: string[] = [];

  for (const [date, items] of shownDates) {
    lines.push(`📅 ${date}`);
    for (const item of [...items].sort((a, b) => a.minPrice - b.minPrice || a.variantName.localeCompare(b.variantName))) {
      const endDate = item.endDate !== item.date ? ` (ends ${item.endDate})` : "";
      lines.push(`   - ${item.variantName}${endDate}: ${currencyCode} ${item.minPrice.toFixed(2)}`);
    }
  }

  if (groupedDates.length > shownDates.length) {
    lines.push(`... ${groupedDates.length - shownDates.length} more dates not shown.`);
  }

  return lines;
}

export function formatExperienceDetails(days: number, details: StructuredDataResponse): string {
  const uniqueDates = new Set(details.dates.map(item => item.date)).size;
  const primaryVariant = getPrimaryVariant(details.mcpProduct);
  const duration = formatDuration(primaryVariant?.duration ?? null);
  // GRO-407: skip review prose for venue-inherited seasonal-variant counts.
  const suppressReviewsDetails = shouldSuppressReviews(details.mcpProduct?.name, details.mcpProduct?.reviewCount);
  const reviewCount = suppressReviewsDetails ? null : formatReviewCount(details.mcpProduct?.reviewCount);
  const tags = formatJoinedValues(details.mcpProduct?.tags, { humanize: true });
  const audience = formatJoinedValues(details.mcpProduct?.audience);
  const cancellation = formatCancellation(primaryVariant?.cancellationPolicy, primaryVariant?.cancellationPeriod ?? null);
  const wheelchairAccessible = formatBooleanLabel(details.mcpProduct?.wheelchairAccessible);
  const strollerFriendly = formatBooleanLabel(details.mcpProduct?.strollerFriendly);
  const languageOptions = formatJoinedValues(details.mcpProduct?.languageOptions, { uppercase: true });
  const googlePlaceId = normalizeGooglePlaceId(details.mcpProduct?.googlePlaceId);
  const groupSize = formatGroupSize(primaryVariant);
  const lines = [
    "🎟️ Experience details",
    "   🧾 Source: tickadoo",
    `   💱 Currency: ${details.currencyCode}`,
  ];

  if (duration) lines.push(`   ⏱️ Duration: ${duration}`);
  if (!suppressReviewsDetails && details.mcpProduct?.reviewRating != null && details.mcpProduct.reviewRating > 0) {
    const ratingLine = reviewCount
      ? `   ⭐ ${details.mcpProduct.reviewRating.toFixed(1)}/5 (${reviewCount})`
      : `   ⭐ ${details.mcpProduct.reviewRating.toFixed(1)}/5`;
    lines.push(ratingLine);
  } else if (reviewCount) {
    lines.push(`   🗳️ ${reviewCount}`);
  }
  if (tags) lines.push(`   🏷️ Tags: ${tags}`);
  if (audience) lines.push(`   👥 Audience: ${audience}`);
  if (details.mcpProduct?.indoorOutdoor) lines.push(`   🏛️ Setting: ${details.mcpProduct.indoorOutdoor}`);
  if (details.mcpProduct?.physicalLevel) lines.push(`   💪 Physical level: ${details.mcpProduct.physicalLevel}`);
  if (cancellation) lines.push(`   ↩️ Cancellation: ${cancellation}`);
  if (wheelchairAccessible) lines.push(`   ♿ Wheelchair accessible: ${wheelchairAccessible}`);
  if (strollerFriendly) lines.push(`   🍼 Stroller friendly: ${strollerFriendly}`);
  if (languageOptions) lines.push(`   🗣️ Languages: ${languageOptions}`);
  if (googlePlaceId) lines.push(`   🗺️ Google Place ID: ${googlePlaceId}`);
  if (primaryVariant?.ageMinimum != null) lines.push(`   🔞 Minimum age: ${primaryVariant.ageMinimum}+`);
  if (groupSize) lines.push(`   👥 Group size: ${groupSize}`);
  if (details.address) lines.push(`   📍 ${details.address}`);
  if (details.locationWithAddress.latitude != null && details.locationWithAddress.longitude != null) {
    lines.push(`   🧭 ${details.locationWithAddress.latitude.toFixed(6)}, ${details.locationWithAddress.longitude.toFixed(6)}`);
  }
  lines.push(`   🖼️ Desktop image: ${details.desktopFeatureImageUrl}`);
  lines.push(`   📱 Mobile image: ${details.mobileFeatureImageUrl}`);
  lines.push(`   ✅ Booking available: yes (external checkout redirect)`);

  // Booking urgency signals for text format
  const urgencySignals: string[] = [];
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const todayAvail = details.dates.find(s => s.date === todayStr);
  if (todayAvail) urgencySignals.push(`🔥 Available TODAY from ${details.currencyCode} ${todayAvail.minPrice}`);
  else {
    const tmrwAvail = details.dates.find(s => s.date === tomorrowStr);
    if (tmrwAvail) urgencySignals.push(`🔥 Available tomorrow from ${details.currencyCode} ${tmrwAvail.minPrice}`);
  }
  const pv = details.mcpProduct?.variants?.[0];
  if (pv?.cancellationPolicy === "BeforeTimeslot" || pv?.cancellationPolicy === "BeforeDate") urgencySignals.push("🔥 Free cancellation — book risk-free");
  const ur = details.mcpProduct?.reviewRating;
  const urc = details.mcpProduct?.reviewCount;
  if (ur && ur >= 4.5 && urc && urc >= 10) urgencySignals.push(`🔥 Highly rated: ${ur}★ from ${urc.toLocaleString()} reviews`);
  if (details.mcpProduct?.wheelchairAccessible) urgencySignals.push("🔥 Wheelchair accessible");
  if (urgencySignals.length > 0) lines.push("", ...urgencySignals);

  if (!details.dates.length) {
    lines.push("", `No availability returned for the next ${days} days.`);
  } else {
    // Next available date + price summary (Gemini's request)
    const nextDate = details.dates[0];
    const nextDateFormatted = new Date(nextDate.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    lines.push(
      "",
      `📅 Next available: ${nextDateFormatted} from ${details.currencyCode} ${nextDate.minPrice.toFixed(2)} (${nextDate.variantName})`,
      `Availability: ${details.dates.length} price points across ${uniqueDates} dates in the next ${days} days.`,
      ...formatAvailabilitySummary(details.dates, details.currencyCode),
    );
  }

  if (details.mcpProduct?.variants?.length) {
    lines.push("", "Variant details:");
    for (const variant of details.mcpProduct.variants) {
      const variantDuration = formatDuration(variant.duration);
      const variantCancellation = formatCancellation(variant.cancellationPolicy, variant.cancellationPeriod ?? null);
      const variantGroupSize = formatGroupSize(variant);

      lines.push(`   • ${variant.name}`);
      if (variantDuration) lines.push(`     ⏱️ Duration: ${variantDuration}`);
      if (variantCancellation) lines.push(`     ↩️ Cancellation: ${variantCancellation}`);
      if (variant.ageMinimum != null) lines.push(`     🔞 Minimum age: ${variant.ageMinimum}+`);
      if (variantGroupSize) lines.push(`     👥 Group size: ${variantGroupSize}`);
    }
  }

  lines.push(
    "",
    "💡 To book: Use the booking URL with this experience. For JSON format, use availability.slots for specific date/price pairs and reserve_action.url_template to construct checkout links.",
  );

  return lines.join("\n");
}

export function experienceDetailsJsonPayload(
  days: number,
  details: StructuredDataResponse,
  options?: {
    title?: string;
    slug?: string;
    bookingPath?: string;
    language?: string;
  },
) {
  const uniqueDates = new Set(details.dates.map(item => item.date)).size;
  const primaryVariant = getPrimaryVariant(details.mcpProduct);
  const duration = formatDuration(primaryVariant?.duration ?? null);
  const cancellation = formatCancellation(primaryVariant?.cancellationPolicy, primaryVariant?.cancellationPeriod ?? null);
  const googlePlaceId = normalizeGooglePlaceId(details.mcpProduct?.googlePlaceId);
  // GRO-407: gate venue-inherited seasonal-variant review counts (mirrors
  // formatExperienceDetails for the JSON shape).
  const suppressReviewsDetailsJson = shouldSuppressReviews(options?.title ?? details.mcpProduct?.name, details.mcpProduct?.reviewCount);

  return {
    title: options?.title ?? null,
    slug: options?.slug ?? null,
    booking_url: options?.bookingPath ? buildBookingUrl(options.bookingPath, options.language) : null,
    days,
    currency: details.currencyCode,
    ...(googlePlaceId ? { google_place_id: googlePlaceId } : {}),
    location: {
      address: details.address ?? details.locationWithAddress.address ?? null,
      latitude: details.locationWithAddress.latitude ?? null,
      longitude: details.locationWithAddress.longitude ?? null,
    },
    images: {
      desktop_url: details.desktopFeatureImageUrl,
      mobile_url: details.mobileFeatureImageUrl,
    },
    ...(details.mcpProduct
      ? {
          duration,
          review_rating: suppressReviewsDetailsJson ? null : (details.mcpProduct.reviewRating ?? null),
          review_count: suppressReviewsDetailsJson ? null : (details.mcpProduct.reviewCount ?? null),
          ...(!suppressReviewsDetailsJson && details.mcpProduct.reviewRating != null && details.mcpProduct.reviewRating > 0
            ? {
                social_proof: details.mcpProduct.reviewCount
                  ? `${details.mcpProduct.reviewRating.toFixed(1)}/5 (${details.mcpProduct.reviewCount.toLocaleString()} reviews)`
                  : `${details.mcpProduct.reviewRating.toFixed(1)}/5`,
              }
            : {}),
          tags: details.mcpProduct.tags,
          audience: details.mcpProduct.audience,
          indoor_outdoor: details.mcpProduct.indoorOutdoor ?? null,
          physical_level: details.mcpProduct.physicalLevel ?? null,
          cancellation,
          wheelchair_accessible: details.mcpProduct.wheelchairAccessible,
          stroller_friendly: details.mcpProduct.strollerFriendly,
          language_options: details.mcpProduct.languageOptions,
          age_minimum: primaryVariant?.ageMinimum ?? null,
          group_size: groupSizeJson(primaryVariant),
          variants: details.mcpProduct.variants.map(variant => ({
            name: variant.name,
            duration: formatDuration(variant.duration),
            cancellation: formatCancellation(variant.cancellationPolicy, variant.cancellationPeriod ?? null),
            age_minimum: variant.ageMinimum,
            group_size: groupSizeJson(variant),
          })),
        }
      : {}),
    booking_available: true,
    booking_scope: "external_checkout_redirect",
    reserve_action: options?.bookingPath ? {
      type: "ReserveAction",
      url_template: buildBookingUrl(options.bookingPath, options.language) + "&date={date}&time={time}&adults={adults}&lang={language}",
    } : null,
    availability: {
      total_price_points: details.dates.length,
      total_dates: uniqueDates,
      slots: details.dates.slice(0, 30).map(item => ({
        date: item.date,
        end_date: item.endDate,
        variant_name: item.variantName,
        price: item.minPrice,
        currency: details.currencyCode,
        availability_status: "InStock",
      })),
      results: details.dates.map(item => ({
        date: item.date,
        end_date: item.endDate,
        variant_name: item.variantName,
        price: {
          amount: item.minPrice,
          currency: details.currencyCode,
        },
      })),
    },
    ...(details.mcpProduct?.wheelchairAccessible != null || details.mcpProduct?.strollerFriendly != null ? {
      _accessibility: {
        wheelchair_accessible: details.mcpProduct.wheelchairAccessible ?? null,
        stroller_friendly: details.mcpProduct.strollerFriendly ?? null,
        ...(googlePlaceId ? { google_place_id: googlePlaceId } : {}),
        hint: "For full venue accessibility data (hearing loop, captioned performances, companion seats, step-free access), query the accessibility API.",
        api: "https://concierge.tickadoo.com/api/accessibility/{venue-slug}",
      },
    } : {}),
    ...(details.mcpProduct?.tags?.length ? {
      _cross_sell: {
        hint: "To find similar experiences, search with these tags or the same city.",
        related_tags: details.mcpProduct.tags.slice(0, 5),
        suggested_query: `Use search_experiences with city and tags="${details.mcpProduct.tags.slice(0, 3).join(",")}" to find related experiences.`,
      },
    } : {}),
    _intent_token: {
      hint: "For 1-click AI checkout, POST to /api/intent-token with productSlug, date, partySize to get a pre-filled checkout URL.",
      endpoint: GHOST_CHECKOUT_INTENT_ENDPOINT,
    },
    _booking_urgency: (() => {
      const signals: string[] = [];
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const slots = details.dates || [];
      const todaySlot = slots.find(s => s.date === today);
      if (todaySlot) signals.push(`Available TODAY from ${details.currencyCode} ${todaySlot.minPrice}`);
      else {
        const tmrw = slots.find(s => s.date === tomorrow);
        if (tmrw) signals.push(`Available tomorrow from ${details.currencyCode} ${tmrw.minPrice}`);
      }
      const v = details.mcpProduct?.variants?.[0];
      if (v?.cancellationPolicy === "BeforeTimeslot" || v?.cancellationPolicy === "BeforeDate") signals.push("Free cancellation — book risk-free");
      const r = details.mcpProduct?.reviewRating;
      const rc = details.mcpProduct?.reviewCount;
      if (r && r >= 4.5 && rc && rc >= 10) signals.push(`Highly rated: ${r}★ from ${rc} reviews`);
      if (details.mcpProduct?.wheelchairAccessible) signals.push("Wheelchair accessible");
      return signals;
    })(),
  };
}
