import { DETAIL_DATE_PREVIEW_LIMIT } from "./config.js";
import { buildBookingUrl } from "./api.js";
import type { Product, StructuredDataDatePrice, StructuredDataResponse } from "./types.js";

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

export function productStructuredData(product: Product, bookingPath = product.slug) {
  const description = summarizeProductDescription(product.description);
  const priceAmount = product.minPrice ?? undefined;
  const priceCurrency = priceAmount != null ? product.currency : undefined;

  return {
    tickadooProductId: product.id,
    slug: product.slug,
    title: product.title,
    description,
    priceAmount,
    priceCurrency,
    bookingUrl: buildBookingUrl(bookingPath),
    imageUrl: product.desktopFeatureImageUrl ?? product.verticalImageUrl ?? undefined,
  };
}

export function productJsonData(product: Product, bookingPath = product.slug) {
  const description = summarizeProductDescription(product.description);
  const imageUrl = product.desktopFeatureImageUrl ?? product.verticalImageUrl ?? null;

  return {
    title: product.title,
    slug: product.slug,
    description: description ?? null,
    price: product.minPrice != null
      ? {
          amount: product.minPrice,
          currency: product.currency,
        }
      : null,
    rating: product.averageRating ?? null,
    image_url: imageUrl,
    booking_url: buildBookingUrl(bookingPath),
    location: {
      address: product.address ?? null,
    },
  };
}

export function searchJsonPayload(
  citySlug: string,
  cityName: string,
  total: number,
  products: Product[],
  options?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
  },
) {
  const filters = {
    ...(options?.category ? { category: options.category } : {}),
    ...(options?.minPrice != null ? { min_price: options.minPrice } : {}),
    ...(options?.maxPrice != null ? { max_price: options.maxPrice } : {}),
  };

  return {
    city: citySlug,
    city_name: cityName,
    total,
    showing: products.length,
    ...(Object.keys(filters).length ? { filters } : {}),
    results: products.map(product => productJsonData(product, `${citySlug}/${product.slug}`)),
    view_all_url: buildBookingUrl(citySlug),
  };
}

export function nearbyJsonPayload(
  latitude: number,
  longitude: number,
  radiusKm: number,
  total: number,
  products: Product[],
) {
  return {
    latitude,
    longitude,
    radius_km: radiusKm,
    total,
    showing: products.length,
    results: products.map(product => productJsonData(product)),
  };
}

export function cityDirectoryJsonPayload(
  query: string | undefined,
  total: number,
  cities: Array<{ name: string; slug: string }>,
) {
  return {
    query: query ?? null,
    total,
    showing: cities.length,
    results: cities.map(city => ({
      name: city.name,
      slug: city.slug,
      booking_url: buildBookingUrl(city.slug),
    })),
  };
}

export function formatProduct(product: Product, bookingPath = product.slug): string {
  const description = summarizeProductDescription(product.description);
  const lines = [`🎭 ${product.title}`];
  if (description) lines.push(`   ${description}`);
  if (product.minPrice != null) lines.push(`   💰 From ${product.currency} ${product.minPrice.toFixed(2)}`);
  if (product.averageRating != null && product.averageRating > 0) lines.push(`   ⭐ ${product.averageRating.toFixed(1)}/5`);
  if (product.address) lines.push(`   📍 ${product.address}`);
  if (product.desktopFeatureImageUrl || product.verticalImageUrl) {
    lines.push(`   🖼️ ${product.desktopFeatureImageUrl || product.verticalImageUrl}`);
  }
  lines.push(`   🔗 ${buildBookingUrl(bookingPath)}`);
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
  const lines = [
    "🎟️ Experience details",
    "   🧾 Source: tickadoo",
    `   💱 Currency: ${details.currencyCode}`,
  ];

  if (details.address) lines.push(`   📍 ${details.address}`);
  if (details.locationWithAddress.latitude != null && details.locationWithAddress.longitude != null) {
    lines.push(`   🧭 ${details.locationWithAddress.latitude.toFixed(6)}, ${details.locationWithAddress.longitude.toFixed(6)}`);
  }
  lines.push(`   🖼️ Desktop image: ${details.desktopFeatureImageUrl}`);
  lines.push(`   📱 Mobile image: ${details.mobileFeatureImageUrl}`);

  if (!details.dates.length) {
    lines.push("", `No availability returned for the next ${days} days.`);
  } else {
    lines.push(
      "",
      `Availability: ${details.dates.length} price points across ${uniqueDates} dates in the next ${days} days.`,
      ...formatAvailabilitySummary(details.dates, details.currencyCode),
    );
  }

  return lines.join("\n");
}

export function experienceDetailsJsonPayload(
  days: number,
  details: StructuredDataResponse,
  options?: {
    title?: string;
    slug?: string;
    bookingPath?: string;
  },
) {
  const uniqueDates = new Set(details.dates.map(item => item.date)).size;

  return {
    title: options?.title ?? null,
    slug: options?.slug ?? null,
    booking_url: options?.bookingPath ? buildBookingUrl(options.bookingPath) : null,
    days,
    currency: details.currencyCode,
    location: {
      address: details.address ?? details.locationWithAddress.address ?? null,
      latitude: details.locationWithAddress.latitude ?? null,
      longitude: details.locationWithAddress.longitude ?? null,
    },
    images: {
      desktop_url: details.desktopFeatureImageUrl,
      mobile_url: details.mobileFeatureImageUrl,
    },
    availability: {
      total_price_points: details.dates.length,
      total_dates: uniqueDates,
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
  };
}
