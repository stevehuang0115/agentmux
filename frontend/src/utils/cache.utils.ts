/**
 * Cache Utilities - Generic caching with TTL and request deduplication.
 *
 * Provides reusable caching functionality that can be used across services
 * to reduce redundant API calls and improve performance.
 */

/**
 * Simple cache entry with TTL tracking
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Configuration options for cache operations
 */
export interface CacheOptions {
  /** Cache Time-To-Live in milliseconds */
  ttl: number;
  /** Force refresh, bypassing cache */
  forceRefresh?: boolean;
}

/**
 * Generic cache class with TTL support and request deduplication.
 *
 * Features:
 * - TTL-based cache invalidation
 * - Request deduplication (prevents multiple concurrent fetches)
 * - Type-safe generic interface
 * - Optional force refresh
 *
 * @example
 * ```typescript
 * const teamsCache = new Cache<Team[]>(2 * 60 * 1000); // 2 minutes TTL
 *
 * const teams = await teamsCache.getOrFetch(
 *   async () => {
 *     const response = await axios.get('/api/teams');
 *     return response.data.data || [];
 *   },
 *   { forceRefresh: false }
 * );
 * ```
 */
export class Cache<T> {
  private cache: CacheEntry<T> | null = null;
  private pendingPromise: Promise<T> | null = null;
  private readonly defaultTtl: number;

  /**
   * Creates a new Cache instance.
   *
   * @param defaultTtl - Default TTL in milliseconds (can be overridden per request)
   */
  constructor(defaultTtl: number) {
    this.defaultTtl = defaultTtl;
  }

  /**
   * Gets cached data or fetches fresh data if cache is stale/empty.
   *
   * Implements request deduplication - if a fetch is already in progress,
   * returns the same promise instead of starting a new fetch.
   *
   * @param fetcher - Async function to fetch fresh data
   * @param options - Cache options (TTL, forceRefresh)
   * @returns Cached or freshly fetched data
   */
  async getOrFetch(
    fetcher: () => Promise<T>,
    options?: Partial<CacheOptions>
  ): Promise<T> {
    const ttl = options?.ttl ?? this.defaultTtl;
    const forceRefresh = options?.forceRefresh ?? false;

    // Check if cache is valid
    if (!forceRefresh && this.cache) {
      const age = Date.now() - this.cache.timestamp;
      if (age < ttl) {
        return this.cache.data;
      }
    }

    // If a request is already in flight, return the same promise (deduplication)
    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    // Create new fetch promise
    this.pendingPromise = (async () => {
      try {
        const data = await fetcher();

        // Update cache
        this.cache = {
          data,
          timestamp: Date.now(),
        };

        return data;
      } finally {
        // Clear in-flight promise
        this.pendingPromise = null;
      }
    })();

    return this.pendingPromise;
  }

  /**
   * Invalidates the cache, forcing the next getOrFetch to fetch fresh data.
   */
  invalidate(): void {
    this.cache = null;
  }

  /**
   * Gets the current cached data without fetching.
   *
   * @returns Cached data or null if cache is empty/stale
   */
  get(ttl?: number): T | null {
    if (!this.cache) return null;
    const effectiveTtl = ttl ?? this.defaultTtl;
    const age = Date.now() - this.cache.timestamp;
    return age < effectiveTtl ? this.cache.data : null;
  }

  /**
   * Checks if there's a valid cache entry.
   *
   * @returns true if cache contains valid (non-stale) data
   */
  hasValidCache(ttl?: number): boolean {
    return this.get(ttl) !== null;
  }

  /**
   * Clears the cache completely.
   */
  clear(): void {
    this.cache = null;
    this.pendingPromise = null;
  }
}

/**
 * Creates a simple cache with the specified TTL.
 *
 * @param ttl - Time-To-Live in milliseconds
 * @returns A new Cache instance
 */
export function createCache<T>(ttl: number): Cache<T> {
  return new Cache<T>(ttl);
}
