import { buildBookingUrl, heuristicEnrich } from "./api.js";
import { SERVER_VERSION } from "./config.js";
import type { City, McpProduct, Product } from "./types.js";

type GuideProduct = Product & { mcpProduct: McpProduct };

type CategoryKey =
  | "theatre"
  | "musicals"
  | "tours"
  | "food"
  | "family"
  | "nightlife"
  | "sightseeing"
  | "concerts"
  | "comedy"
  | "shows"
  | "outdoor"
  | "workshops"
  | "cruises"
  | "sports";

type CategoryDefinition = {
  key: CategoryKey;
  label: string;
  keywords: string[];
  tags?: string[];
  audience?: string[];
};

type RankedCount = [label: string, count: number];

export type CityGuidePayload = {
  city: {
    name: string;
    slug: string;
    country: string | null;
    experience_count: number;
  };
  highlights: Array<{
    title: string;
    slug: string;
    rating: number | null;
    review_count: number | null;
    price_from: number | null;
    currency: string | null;
    booking_url: string;
  }>;
  categories: Record<string, number>;
  price_range: {
    min: number | null;
    max: number | null;
    median: number | null;
    currency: string | null;
  };
  best_for: string[];
  seasonal: string;
  insider_tips: string[];
  _top_tags: Record<string, number>;
  _audience_breakdown: Record<string, number>;
};

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    key: "theatre",
    label: "theatre",
    keywords: ["theatre", "theater", "play", "stage", "west end", "broadway", "drama"],
    tags: ["WestEnd", "Broadway"],
  },
  {
    key: "musicals",
    label: "musicals",
    keywords: ["musical", "show tunes"],
    tags: ["Musical"],
  },
  {
    key: "tours",
    label: "tours",
    keywords: ["tour", "guided", "walking tour", "day trip", "excursion", "hop on hop off", "hop-on hop-off"],
    tags: ["WalkingTour", "GuidedTour", "BikeTour", "SelfGuided", "DayTrip", "HopOnHopOff"],
  },
  {
    key: "food",
    label: "food",
    keywords: ["food", "culinary", "dining", "afternoon tea", "cocktail", "wine", "brunch", "tasting", "restaurant"],
    tags: ["FoodTour", "Dining", "Cooking"],
  },
  {
    key: "family",
    label: "family",
    keywords: ["family", "kids", "children", "child", "all ages", "interactive"],
    tags: ["KidsAttraction", "ThemePark", "Aquarium"],
    audience: ["Family", "Kids"],
  },
  {
    key: "nightlife",
    label: "nightlife",
    keywords: ["nightlife", "late night", "bar", "club", "cabaret", "after dark", "rooftop"],
    tags: ["NightLife", "Evening", "Rooftop"],
  },
  {
    key: "sightseeing",
    label: "sightseeing",
    keywords: ["sightseeing", "landmark", "observation", "viewpoint", "museum", "city pass"],
    tags: ["Attraction", "Museum", "MustSee", "HiddenGem", "Observatory", "SkipTheLine", "CityPass"],
  },
  {
    key: "concerts",
    label: "concerts",
    keywords: ["concert", "live music", "orchestra", "recital", "gig"],
    tags: ["Concert"],
  },
  {
    key: "comedy",
    label: "comedy",
    keywords: ["comedy", "comedian", "comic", "improv", "stand up", "stand-up"],
  },
  {
    key: "shows",
    label: "shows",
    keywords: ["show", "performance", "magic", "circus", "cabaret", "spectacular"],
    tags: ["Show"],
  },
  {
    key: "outdoor",
    label: "outdoor",
    keywords: ["outdoor", "garden", "park", "nature", "hiking", "cycling", "kayak", "adventure"],
    tags: ["Outdoor", "Adventure", "WaterSport", "Safari", "WhaleWatching"],
  },
  {
    key: "workshops",
    label: "workshops",
    keywords: ["workshop", "class", "masterclass", "lesson", "learn", "maker", "studio"],
    tags: ["Workshop", "Cooking"],
  },
  {
    key: "cruises",
    label: "cruises",
    keywords: ["cruise", "boat", "river", "harbor", "harbour", "sailing", "catamaran", "yacht"],
    tags: ["Cruise", "Sunset"],
  },
  {
    key: "sports",
    label: "sports",
    keywords: ["sport", "stadium", "match", "race", "football", "baseball", "basketball", "tennis"],
    tags: ["Sports"],
  },
];

const BEST_FOR_DEFINITIONS: Array<{ label: string; score: (categories: Record<string, number>, audiences: Record<string, number>) => number }> = [
  {
    label: "Theatre and musical nights",
    score: categories => (categories.theatre ?? 0) + (categories.musicals ?? 0) + (categories.shows ?? 0),
  },
  {
    label: "Walking tours and city orientation",
    score: categories => (categories.tours ?? 0) + (categories.sightseeing ?? 0),
  },
  {
    label: "Food tours and dining experiences",
    score: categories => (categories.food ?? 0),
  },
  {
    label: "Family attractions",
    score: (categories, audiences) => (categories.family ?? 0) + ((audiences.Family ?? 0) * 0.5),
  },
  {
    label: "Evening plans and nightlife",
    score: categories => (categories.nightlife ?? 0) + (categories.comedy ?? 0) + (categories.concerts ?? 0),
  },
  {
    label: "Scenic cruises and outdoor views",
    score: categories => (categories.cruises ?? 0) + (categories.outdoor ?? 0),
  },
  {
    label: "Hands-on classes and workshops",
    score: categories => (categories.workshops ?? 0),
  },
  {
    label: "Live sports",
    score: categories => (categories.sports ?? 0),
  },
];

const cityCountryCache = new Map<string, string | null>();

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function humanizeToken(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function getMedian(values: number[]): number | null {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return roundPrice(sorted[middle]!);
  }

  return roundPrice((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function asGuideProduct(product: Product): GuideProduct {
  if (product.mcpProduct) {
    return product as GuideProduct;
  }

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

  return {
    ...product,
    mcpProduct: heuristicEnrich(synthetic),
  };
}

function getRating(product: GuideProduct): number | null {
  const rating = product.mcpProduct.reviewRating ?? product.averageRating ?? null;
  return rating != null && rating > 0 ? rating : null;
}

function getReviewCount(product: GuideProduct): number | null {
  const count = product.mcpProduct.reviewCount ?? null;
  return count != null && count > 0 ? count : null;
}

function countValues(values: string[]): RankedCount[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function asSortedObject(entries: RankedCount[], limit?: number): Record<string, number> {
  const output: Record<string, number> = {};

  for (const [label, count] of entries.slice(0, limit)) {
    output[label] = count;
  }

  return output;
}

function buildCategoryHaystack(product: GuideProduct): string {
  return normalizeText([
    product.title,
    product.description ?? "",
    product.slug.replace(/-/g, " "),
    product.mcpProduct.tags.join(" "),
    product.mcpProduct.audience.join(" "),
  ].join(" "));
}

function matchesCategory(product: GuideProduct, definition: CategoryDefinition): boolean {
  const haystack = buildCategoryHaystack(product);
  const productTags = new Set(product.mcpProduct.tags.map(tag => tag.toLowerCase()));
  const productAudience = new Set(product.mcpProduct.audience.map(audience => audience.toLowerCase()));

  if (definition.tags?.some(tag => productTags.has(tag.toLowerCase()))) {
    return true;
  }

  if (definition.audience?.some(audience => productAudience.has(audience.toLowerCase()))) {
    return true;
  }

  return definition.keywords.some(keyword => haystack.includes(normalizeText(keyword)));
}

function highlightScore(product: GuideProduct): number {
  const rating = getRating(product) ?? 0;
  const reviewCount = getReviewCount(product) ?? 0;
  const featuredBoost = product.featured ? 0.25 : 0;
  const priceSignal = product.minPrice != null ? 0.1 : 0;

  return (rating * 100) + (Math.log10(reviewCount + 1) * 10) + featuredBoost + priceSignal;
}

function buildHighlights(products: GuideProduct[], language: string) {
  return [...products]
    .sort((left, right) => {
      const scoreDelta = highlightScore(right) - highlightScore(left);
      if (Math.abs(scoreDelta) > 0.001) {
        return scoreDelta;
      }

      const priceDelta = (left.minPrice ?? Number.POSITIVE_INFINITY) - (right.minPrice ?? Number.POSITIVE_INFINITY);
      if (priceDelta !== 0) {
        return priceDelta;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, 5)
    .map(product => ({
      title: product.title,
      slug: product.slug,
      rating: getRating(product),
      review_count: getReviewCount(product),
      price_from: product.minPrice ?? product.mcpProduct.minPrice ?? null,
      currency: product.currency ?? null,
      booking_url: buildBookingUrl(product.slug, language),
    }));
}

function buildCategoryBreakdown(products: GuideProduct[]): Record<string, number> {
  const entries = CATEGORY_DEFINITIONS
    .map(definition => ({
      key: definition.key,
      count: products.filter(product => matchesCategory(product, definition)).length,
    }))
    .filter(entry => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));

  return Object.fromEntries(entries.map(entry => [entry.key, entry.count]));
}

function buildPriceRange(products: GuideProduct[]): CityGuidePayload["price_range"] {
  const pricedProducts = products.filter(product => product.minPrice != null && product.minPrice >= 0);
  if (!pricedProducts.length) {
    return {
      min: null,
      max: null,
      median: null,
      currency: null,
    };
  }

  const currencyCounts = countValues(pricedProducts.map(product => product.currency).filter(Boolean));
  const dominantCurrency = currencyCounts[0]?.[0] ?? null;
  const prices = pricedProducts
    .filter(product => !dominantCurrency || product.currency === dominantCurrency)
    .map(product => product.minPrice)
    .filter((price): price is number => price != null)
    .sort((left, right) => left - right);

  return {
    min: prices.length ? roundPrice(prices[0]!) : null,
    max: prices.length ? roundPrice(prices[prices.length - 1]!) : null,
    median: getMedian(prices),
    currency: dominantCurrency,
  };
}

function buildBestFor(categories: Record<string, number>, audiences: Record<string, number>): string[] {
  return BEST_FOR_DEFINITIONS
    .map(definition => ({
      label: definition.label,
      score: definition.score(categories, audiences),
    }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 4)
    .map(entry => entry.label);
}

function buildSeasonal(categories: Record<string, number>, audiences: Record<string, number>): string {
  const outdoorWeight = (categories.outdoor ?? 0) + (categories.cruises ?? 0) + (categories.tours ?? 0);
  const showWeight = (categories.theatre ?? 0) + (categories.musicals ?? 0) + (categories.shows ?? 0) + (categories.concerts ?? 0);
  const familyWeight = (categories.family ?? 0) + (audiences.Family ?? 0);

  const sentences = [
    outdoorWeight >= 3
      ? "Spring to autumn is strongest for walking tours, cruises, and outdoor viewpoints."
      : "Spring and autumn are usually the easiest seasons for full-day sightseeing.",
    showWeight >= 4
      ? "Theatre, comedy, and headline evening experiences run year-round, but festive weeks and weekends sell out fastest."
      : "Peak holiday weeks bring the heaviest demand for must-see experiences, so reserve early when dates are fixed.",
  ];

  if (familyWeight >= 5) {
    sentences.push("School-holiday periods widen the family offering, while first-entry morning slots are usually calmer.");
  }

  return sentences.join(" ");
}

function buildInsiderTips(categories: Record<string, number>): string[] {
  const tips: string[] = [];

  if ((categories.theatre ?? 0) + (categories.musicals ?? 0) + (categories.shows ?? 0) > 0) {
    tips.push("Book headline shows at least one to two weeks ahead for the best seat choice and pricing.");
  }

  if ((categories.tours ?? 0) + (categories.sightseeing ?? 0) > 0) {
    tips.push("Schedule a walking or orientation tour early in the trip so the rest of the stay is easier to plan.");
  }

  if ((categories.food ?? 0) + (categories.nightlife ?? 0) + (categories.cruises ?? 0) > 0) {
    tips.push("Evening dining, cabaret, and cruise-style experiences are busiest on Fridays and Saturdays after 6pm.");
  }

  if ((categories.family ?? 0) > 0) {
    tips.push("For family attractions, the earliest bookable slot is usually the least crowded and easiest with children.");
  }

  if ((categories.outdoor ?? 0) + (categories.cruises ?? 0) > 0) {
    tips.push("Keep one indoor backup option in mind in case weather changes on the day.");
  }

  if (!tips.length) {
    tips.push("Reserve the must-see experience first, then use location and price filters to fill the rest of the itinerary around it.");
  }

  return tips.slice(0, 4);
}

function formatPriceRange(priceRange: CityGuidePayload["price_range"]): string {
  if (priceRange.min == null || priceRange.max == null || !priceRange.currency) {
    return "Price range varies by experience.";
  }

  const medianText = priceRange.median != null ? ` (median ${priceRange.currency} ${priceRange.median.toFixed(2)})` : "";
  return `${priceRange.currency} ${priceRange.min.toFixed(2)} to ${priceRange.currency} ${priceRange.max.toFixed(2)}${medianText}`;
}

function formatCategorySummary(categories: Record<string, number>): string {
  const summary = Object.entries(categories)
    .slice(0, 5)
    .map(([key, count]) => `${key} (${count})`);

  return summary.length ? summary.join(", ") : "No category signals yet.";
}

function formatAudienceSummary(audiences: Record<string, number>): string | null {
  const summary = Object.entries(audiences)
    .slice(0, 4)
    .map(([label, count]) => `${label} (${count})`);

  return summary.length ? summary.join(", ") : null;
}

export function buildCityGuide(
  city: { name: string; slug: string; country?: string | null },
  products: Product[],
  language = "en",
): CityGuidePayload {
  const guideProducts = products.map(asGuideProduct);
  const tagCounts = countValues(guideProducts.flatMap(product => product.mcpProduct.tags));
  const audienceCounts = countValues(guideProducts.flatMap(product => product.mcpProduct.audience));
  const categoryBreakdown = buildCategoryBreakdown(guideProducts);
  const audienceBreakdown = asSortedObject(audienceCounts);

  return {
    city: {
      name: city.name,
      slug: city.slug,
      country: city.country ?? null,
      experience_count: guideProducts.length,
    },
    highlights: buildHighlights(guideProducts, language),
    categories: categoryBreakdown,
    price_range: buildPriceRange(guideProducts),
    best_for: buildBestFor(categoryBreakdown, audienceBreakdown),
    seasonal: buildSeasonal(categoryBreakdown, audienceBreakdown),
    insider_tips: buildInsiderTips(categoryBreakdown),
    _top_tags: asSortedObject(tagCounts, 10),
    _audience_breakdown: audienceBreakdown,
  };
}

export function formatCityGuide(payload: CityGuidePayload): string {
  const heading = payload.city.country
    ? `${payload.city.name}, ${payload.city.country}`
    : payload.city.name;

  const lines = [
    `${heading} city guide`,
    `${payload.city.experience_count} bookable experiences on tickadoo.`,
    "",
    "Top highlights:",
    ...payload.highlights.map((highlight, index) => {
      const rating = highlight.rating != null ? `${highlight.rating.toFixed(1)}/5` : "unrated";
      const reviews = highlight.review_count != null ? `, ${highlight.review_count} reviews` : "";
      const price = highlight.price_from != null && highlight.currency
        ? `, from ${highlight.currency} ${highlight.price_from.toFixed(2)}`
        : "";

      return `${index + 1}. ${highlight.title} (${rating}${reviews}${price})\n   ${highlight.booking_url}`;
    }),
    "",
    `Categories: ${formatCategorySummary(payload.categories)}`,
    `Price range: ${formatPriceRange(payload.price_range)}`,
    `Best for: ${payload.best_for.join("; ") || "General city exploring"}`,
    `Seasonal tip: ${payload.seasonal}`,
  ];

  const audienceSummary = formatAudienceSummary(payload._audience_breakdown);
  if (audienceSummary) {
    lines.push(`Audience mix: ${audienceSummary}`);
  }

  lines.push("", "Insider tips:");
  lines.push(...payload.insider_tips.map(tip => `- ${tip}`));

  return lines.join("\n");
}

export async function lookupCityCountry(city: Pick<City, "name" | "slug" | "location">): Promise<string | null> {
  const cacheKey = city.slug ?? normalizeText(city.name);
  if (cityCountryCache.has(cacheKey)) {
    return cityCountryCache.get(cacheKey) ?? null;
  }

  if (!city.location || !Number.isFinite(city.location.latitude) || !Number.isFinite(city.location.longitude)) {
    cityCountryCache.set(cacheKey, null);
    return null;
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(city.location.latitude));
    url.searchParams.set("lon", String(city.location.longitude));
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": `tickadoo-mcp/${SERVER_VERSION}`,
      },
    });

    if (!response.ok) {
      cityCountryCache.set(cacheKey, null);
      return null;
    }

    const payload = await response.json() as { address?: { country?: string } };
    const country = payload.address?.country?.trim() || null;
    cityCountryCache.set(cacheKey, country);
    return country;
  } catch {
    cityCountryCache.set(cacheKey, null);
    return null;
  }
}

export const CITY_GUIDE_CATEGORY_LABELS = Object.fromEntries(
  CATEGORY_DEFINITIONS.map(definition => [definition.key, definition.label]),
);

export function humanizeCityGuideTag(tag: string): string {
  return humanizeToken(tag);
}
