export type CacheToolName =
  | "search_experiences"
  | "find_nearby_experiences"
  | "list_cities"
  | "get_experience_details";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
};

type CacheLoadOptions<T> = {
  ttlMs: number;
  staleWhileRevalidateMs?: number;
  shouldCache?: (value: T) => boolean;
};

function defaultShouldCache(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value != null;
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => stableSortValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, stableSortValue(entryValue)]),
    );
  }

  return value;
}

export function createCacheKey(toolName: CacheToolName, args: Record<string, unknown>): string {
  return `${toolName}:${JSON.stringify(stableSortValue(args))}`;
}

export class InMemoryLruCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly maxEntries: number) {}

  async getOrLoad<T>(
    key: string,
    options: CacheLoadOptions<T>,
    load: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const cached = this.entries.get(key) as CacheEntry<T> | undefined;

    if (cached) {
      this.touch(key, cached);

      if (cached.expiresAt > now) {
        console.info(`[cache hit] ${key}`);
        return cached.value;
      }

      if (cached.staleUntil > now) {
        console.info(`[cache stale hit] ${key}`);
        this.refreshInBackground(key, options, load);
        return cached.value;
      }

      this.entries.delete(key);
    }

    return this.loadAndMaybeCache(key, options, load);
  }

  private touch<T>(key: string, entry: CacheEntry<T>) {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private refreshInBackground<T>(
    key: string,
    options: CacheLoadOptions<T>,
    load: () => Promise<T>,
  ) {
    if (this.inFlight.has(key)) {
      return;
    }

    void this.loadAndMaybeCache(key, options, load).catch(error => {
      console.warn(`[cache refresh failed] ${key}`, error);
    });
  }

  private loadAndMaybeCache<T>(
    key: string,
    options: CacheLoadOptions<T>,
    load: () => Promise<T>,
  ): Promise<T> {
    const existingLoad = this.inFlight.get(key) as Promise<T> | undefined;
    if (existingLoad) {
      return existingLoad;
    }

    const promise = load()
      .then(value => {
        const shouldCache = options.shouldCache ?? defaultShouldCache;
        if (shouldCache(value)) {
          this.set(key, value, options.ttlMs, options.staleWhileRevalidateMs ?? options.ttlMs);
        } else {
          this.entries.delete(key);
        }

        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise as Promise<unknown>);
    return promise;
  }

  private set<T>(key: string, value: T, ttlMs: number, staleWhileRevalidateMs: number) {
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      staleUntil: Date.now() + ttlMs + staleWhileRevalidateMs,
    });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }
}

export const apiResponseCache = new InMemoryLruCache(500);
