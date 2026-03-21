import {
  API_BASE,
  MAX_API_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  RETRYABLE_STATUS_CODES,
  SERVER_VERSION,
  SITE,
  TICKADOO_UTM_PARAMS,
} from "./config.js";
import { apiResponseCache, createCacheKey, type CacheToolName } from "./cache.js";
import type { City, Product, ResolvedProduct, SearchPage, StructuredDataResponse } from "./types.js";

const TOOL_CACHE_TTL_MS: Record<CacheToolName, number> = {
  search_experiences: 5 * 60_000,
  find_nearby_experiences: 5 * 60_000,
  list_cities: 15 * 60_000,
  get_experience_details: 10 * 60_000,
};

type CacheContext = {
  toolName: CacheToolName;
  args: Record<string, unknown>;
};

type CityWithSlug = City & { slug: string };
type CityWithLocation = CityWithSlug & { location: { latitude: number; longitude: number } };

type GeocodedCityResponse = Array<{
  lat?: string;
  lon?: string;
  type?: string;
  importance?: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
  };
  display_name?: string;
}>;

export type NearbyCoveredCity = {
  city: CityWithLocation;
  distanceKm: number;
  experienceCount: number;
};

export type GeocodedCity = {
  name: string;
  latitude: number;
  longitude: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number): number {
  return 150 * attempt + Math.floor(Math.random() * 200);
}

export class TickadooApiError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(`tickadoo API ${status}: ${body}`);
    this.name = "TickadooApiError";
  }
}

function isRetryableFetchError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
}

function normalizeApiError(error: unknown): Error {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error(`tickadoo API request timed out after ${REQUEST_TIMEOUT_MS}ms. Please try again in a moment.`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof TickadooApiError && error.status === 404;
}

function withToolCache<T>(
  context: CacheContext,
  load: () => Promise<T>,
  shouldCache?: (value: T) => boolean,
): Promise<T> {
  return apiResponseCache.getOrLoad(
    createCacheKey(context.toolName, context.args),
    {
      ttlMs: TOOL_CACHE_TTL_MS[context.toolName],
      staleWhileRevalidateMs: TOOL_CACHE_TTL_MS[context.toolName],
      shouldCache,
    },
    load,
  );
}

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  return fetchJsonFromUrl<T>(url);
}

async function fetchJsonFromUrl<T>(url: URL, headers?: Record<string, string>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_API_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": `tickadoo-mcp/${SERVER_VERSION}`,
          ...headers,
        },
        signal: controller.signal,
      });

      if (response.ok) {
        return await response.json() as T;
      }

      if (attempt < MAX_API_ATTEMPTS && RETRYABLE_STATUS_CODES.has(response.status)) {
        void response.body?.cancel().catch(() => undefined);
        await sleep(retryDelayMs(attempt));
        continue;
      }

      throw new TickadooApiError(response.status, await response.text());
    } catch (error) {
      if (attempt < MAX_API_ATTEMPTS && isRetryableFetchError(error)) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      throw normalizeApiError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("tickadoo API request failed");
}

export function normalizeSlugOrPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).pathname.replace(/^\/+|\/+$/g, "");
    }
  } catch {
    // Fall through to plain path normalization.
  }

  return trimmed.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "");
}

function createCanonicalBookingUrl(pathOrSlug: string): URL {
  const siteUrl = new URL(SITE);
  const trimmed = pathOrSlug.trim();

  if (!trimmed) {
    return siteUrl;
  }

  try {
    const inputUrl = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, siteUrl);
    siteUrl.pathname = inputUrl.pathname;
    siteUrl.search = inputUrl.search;
    siteUrl.hash = inputUrl.hash;
    return siteUrl;
  } catch {
    siteUrl.pathname = `/${normalizeSlugOrPath(trimmed)}`;
    return siteUrl;
  }
}

export function buildBookingUrl(pathOrSlug: string): string {
  const bookingUrl = createCanonicalBookingUrl(pathOrSlug);
  if (TICKADOO_UTM_PARAMS) {
    const trackingParams = new URLSearchParams(TICKADOO_UTM_PARAMS);
    for (const [key, value] of trackingParams.entries()) {
      bookingUrl.searchParams.set(key, value);
    }
  }
  return bookingUrl.toString();
}

function normalizeProviderName(provider: string): string {
  const normalized = provider.replace(/[\s_-]+/g, "").toLowerCase();
  const providerNames: Record<string, string> = {
    headout: "Headout",
    tiqets: "Tiqets",
    broadwayinbound: "BroadwayInbound",
    ingresso: "Ingresso",
  };
  return providerNames[normalized] ?? provider.trim();
}

function parseSlugReference(value: string): { normalizedPath: string; slug: string; citySlug?: string } {
  const normalizedPath = normalizeSlugOrPath(value);
  const segments = normalizedPath.split("/").filter(Boolean);
  if (!segments.length) {
    throw new Error("A tickadoo experience slug or path is required.");
  }

  return {
    normalizedPath,
    slug: segments[segments.length - 1],
    citySlug: segments.length > 1 ? segments[segments.length - 2] : undefined,
  };
}

async function getSearchPages(language: string): Promise<SearchPage[]> {
  return withToolCache(
    {
      toolName: "get_experience_details",
      args: { language, resource: "search_pages" },
    },
    async () => (await fetchJson<{ pages: SearchPage[] }>("/api/search/pages", { language })).pages,
  );
}

export async function getCities(language: string): Promise<City[]> {
  return withToolCache(
    {
      toolName: "list_cities",
      args: { language },
    },
    async () => (await fetchJson<{ cities: City[] }>("/api/maps/cities", { languageCode: language })).cities,
  );
}

export async function getProductsForCitySlug(
  citySlug: string,
  language: string,
  cacheContext: CacheContext = {
    toolName: "search_experiences",
    args: { citySlug, language },
  },
): Promise<Product[]> {
  try {
    return await withToolCache(
      cacheContext,
      async () => (await fetchJson<{ products: Product[] }>("/api/maps/products", { citySlug, languageCode: language })).products,
    );
  } catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
  }
}

export async function getProductsByLocation(
  latitude: number,
  longitude: number,
  radiusKm: number,
  language: string,
): Promise<Product[]> {
  return withToolCache(
    {
      toolName: "find_nearby_experiences",
      args: { latitude, longitude, radiusKm, language },
    },
    async () => (await fetchJson<{ products: Product[] }>("/api/maps/products-by-location", {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      distanceInKilometers: radiusKm.toString(),
      languageCode: language,
    })).products,
  );
}

function isCityWithLocation(city: City): city is CityWithLocation {
  return Boolean(city.slug && city.location?.latitude != null && city.location?.longitude != null);
}

function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => value * (Math.PI / 180);
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA))
    * Math.cos(toRadians(latitudeB))
    * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export async function geocodeCityQuery(query: string): Promise<GeocodedCity | null> {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  return withToolCache(
    {
      toolName: "list_cities",
      args: { geocodeQuery: trimmed.toLowerCase() },
    },
    async () => {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", trimmed);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("featuretype", "city");
      url.searchParams.set("addressdetails", "1");

      const result = (await fetchJsonFromUrl<GeocodedCityResponse>(url))[0];
      const latitude = Number(result?.lat);
      const longitude = Number(result?.lon);
      const geocodeType = result?.type?.toLowerCase();
      const importance = result?.importance ?? 0;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      if (!geocodeType || !["administrative", "city", "town"].includes(geocodeType)) {
        return null;
      }

      if (importance < 0.2) {
        return null;
      }

      const name = result?.address?.city
        ?? result?.address?.town
        ?? result?.address?.village
        ?? result?.address?.municipality
        ?? result?.address?.county
        ?? result?.display_name?.split(",", 1)[0]
        ?? trimmed;

      return {
        name,
        latitude,
        longitude,
      };
    },
  );
}

export async function getNearestCoveredCities(
  latitude: number,
  longitude: number,
  language: string,
  limit = 3,
  excludeCitySlugs: string[] = [],
): Promise<NearbyCoveredCity[]> {
  const excluded = new Set(excludeCitySlugs);
  const candidateCities = (await getCities(language))
    .filter(isCityWithLocation)
    .filter(city => !excluded.has(city.slug))
    .map(city => ({
      city,
      distanceKm: haversineDistanceKm(latitude, longitude, city.location.latitude, city.location.longitude),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, limit);

  const citiesWithCounts = await Promise.all(candidateCities.map(async candidate => ({
    ...candidate,
    experienceCount: (await getProductsForCitySlug(candidate.city.slug, language, {
      toolName: "list_cities",
      args: { nearestCitySlug: candidate.city.slug, language },
    })).length,
  })));

  return citiesWithCounts;
}

export async function resolveProductBySlug(slugOrPath: string, language: string): Promise<ResolvedProduct> {
  const { normalizedPath, slug, citySlug } = parseSlugReference(slugOrPath);

  if (citySlug) {
    const directMatch = (await getProductsForCitySlug(citySlug, language, {
      toolName: "get_experience_details",
      args: { citySlug, language, resource: "city_products" },
    })).find(product => product.slug === slug);
    if (directMatch) {
      return {
        bookingPath: normalizedPath,
        product: directMatch,
      };
    }
  }

  const pages = await getSearchPages(language);
  const exactPathMatches = pages.filter(page => normalizeSlugOrPath(page.path) === normalizedPath);
  const slugMatches = exactPathMatches.length
    ? exactPathMatches
    : pages.filter(page => {
      const normalizedPagePath = normalizeSlugOrPath(page.path);
      const pageSegments = normalizedPagePath.split("/").filter(Boolean);
      return pageSegments[pageSegments.length - 1] === slug;
    });

  if (!slugMatches.length) {
    throw new Error(`Could not resolve tickadoo slug "${slug}" to an experience. Try searching by city first to find the canonical tickadoo slug.`);
  }

  const citySlugs = [...new Set(
    slugMatches
      .map(page => {
        const segments = normalizeSlugOrPath(page.path).split("/").filter(Boolean);
        return segments.length > 1 ? segments[segments.length - 2] : undefined;
      })
      .filter((value): value is string => Boolean(value)),
  )];

  if (!citySlugs.length) {
    throw new Error(`Could not infer a city for slug "${slug}". Try a full path like "/london/${slug}", or search by city first.`);
  }

  if (!exactPathMatches.length && citySlugs.length > 1) {
    throw new Error(`Slug "${slug}" matched multiple experiences. Pass a full tickadoo path like "/city/${slug}", or search by city first.`);
  }

  for (const page of slugMatches) {
    const bookingPath = normalizeSlugOrPath(page.path);
    const segments = bookingPath.split("/").filter(Boolean);
    const candidateCitySlug = segments.length > 1 ? segments[segments.length - 2] : undefined;
    if (!candidateCitySlug) continue;

    const product = (await getProductsForCitySlug(candidateCitySlug, language, {
      toolName: "get_experience_details",
      args: { citySlug: candidateCitySlug, language, resource: "city_products" },
    })).find(item => item.slug === slug);
    if (product) {
      return {
        bookingPath,
        product,
      };
    }
  }

  throw new Error(`Could not resolve tickadoo slug "${slug}" to a bookable experience. Try searching by city first to find a current tickadoo slug.`);
}

export async function getExperienceDetails(
  provider: string,
  providerId: string,
  days: number,
): Promise<StructuredDataResponse> {
  const normalizedProvider = normalizeProviderName(provider);
  return withToolCache(
    {
      toolName: "get_experience_details",
      args: { provider: normalizedProvider, providerId, days },
    },
    () => fetchJson<StructuredDataResponse>("/api/products/structured-data", {
      Provider: normalizedProvider,
      Id: providerId,
      Days: days.toString(),
    }),
  );
}
