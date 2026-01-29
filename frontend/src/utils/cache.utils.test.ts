/**
 * Tests for Cache Utilities.
 *
 * Covers Cache class functionality including TTL-based caching,
 * request deduplication, cache invalidation, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache, createCache } from './cache.utils';

describe('Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a cache with the specified TTL', () => {
      const cache = new Cache<string>(5000);
      expect(cache).toBeDefined();
    });
  });

  describe('getOrFetch', () => {
    it('should fetch and cache data on first call', async () => {
      const cache = new Cache<string>(5000);
      const fetcher = vi.fn().mockResolvedValue('test-data');

      const result = await cache.getOrFetch(fetcher);

      expect(result).toBe('test-data');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should return cached data on subsequent calls within TTL', async () => {
      const cache = new Cache<string>(5000);
      const fetcher = vi.fn().mockResolvedValue('test-data');

      await cache.getOrFetch(fetcher);
      vi.advanceTimersByTime(1000); // 1 second, still within TTL
      const result = await cache.getOrFetch(fetcher);

      expect(result).toBe('test-data');
      expect(fetcher).toHaveBeenCalledTimes(1); // Should not call fetcher again
    });

    it('should refetch after TTL expires', async () => {
      const cache = new Cache<string>(5000);
      const fetcher = vi.fn()
        .mockResolvedValueOnce('first-data')
        .mockResolvedValueOnce('second-data');

      await cache.getOrFetch(fetcher);
      vi.advanceTimersByTime(6000); // Past TTL
      const result = await cache.getOrFetch(fetcher);

      expect(result).toBe('second-data');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate concurrent requests', async () => {
      const cache = new Cache<string>(5000);
      let resolvePromise: (value: string) => void;
      const slowFetcher = vi.fn().mockReturnValue(
        new Promise<string>(resolve => {
          resolvePromise = resolve;
        })
      );

      // Start two concurrent requests
      const promise1 = cache.getOrFetch(slowFetcher);
      const promise2 = cache.getOrFetch(slowFetcher);

      // Resolve the fetch
      resolvePromise!('test-data');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('test-data');
      expect(result2).toBe('test-data');
      expect(slowFetcher).toHaveBeenCalledTimes(1); // Only one fetch despite two requests
    });

    it('should respect forceRefresh option', async () => {
      const cache = new Cache<string>(5000);
      const fetcher = vi.fn()
        .mockResolvedValueOnce('first-data')
        .mockResolvedValueOnce('refreshed-data');

      await cache.getOrFetch(fetcher);
      const result = await cache.getOrFetch(fetcher, { forceRefresh: true });

      expect(result).toBe('refreshed-data');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should allow overriding TTL per request', async () => {
      const cache = new Cache<string>(10000); // 10 second default
      const fetcher = vi.fn()
        .mockResolvedValueOnce('first-data')
        .mockResolvedValueOnce('second-data');

      await cache.getOrFetch(fetcher);
      vi.advanceTimersByTime(3000); // 3 seconds
      const result = await cache.getOrFetch(fetcher, { ttl: 2000 }); // 2 second override

      expect(result).toBe('second-data'); // Should refetch due to shorter TTL
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should handle fetcher errors gracefully', async () => {
      const cache = new Cache<string>(5000);
      const error = new Error('Fetch failed');
      const fetcher = vi.fn().mockRejectedValue(error);

      await expect(cache.getOrFetch(fetcher)).rejects.toThrow('Fetch failed');
    });

    it('should allow retry after fetcher error', async () => {
      const cache = new Cache<string>(5000);
      const fetcher = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('success');

      await expect(cache.getOrFetch(fetcher)).rejects.toThrow();

      const result = await cache.getOrFetch(fetcher);
      expect(result).toBe('success');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidate', () => {
    it('should force refetch on next getOrFetch call', async () => {
      const cache = new Cache<string>(5000);
      const fetcher = vi.fn()
        .mockResolvedValueOnce('first-data')
        .mockResolvedValueOnce('second-data');

      await cache.getOrFetch(fetcher);
      cache.invalidate();
      const result = await cache.getOrFetch(fetcher);

      expect(result).toBe('second-data');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('get', () => {
    it('should return null when cache is empty', () => {
      const cache = new Cache<string>(5000);
      expect(cache.get()).toBeNull();
    });

    it('should return cached data when valid', async () => {
      const cache = new Cache<string>(5000);
      await cache.getOrFetch(async () => 'test-data');

      expect(cache.get()).toBe('test-data');
    });

    it('should return null when cache is stale', async () => {
      const cache = new Cache<string>(5000);
      await cache.getOrFetch(async () => 'test-data');

      vi.advanceTimersByTime(6000);
      expect(cache.get()).toBeNull();
    });

    it('should respect custom TTL in get()', async () => {
      const cache = new Cache<string>(10000);
      await cache.getOrFetch(async () => 'test-data');

      vi.advanceTimersByTime(3000);
      expect(cache.get(2000)).toBeNull(); // Stale with 2s TTL
      expect(cache.get(5000)).toBe('test-data'); // Valid with 5s TTL
    });
  });

  describe('hasValidCache', () => {
    it('should return false when cache is empty', () => {
      const cache = new Cache<string>(5000);
      expect(cache.hasValidCache()).toBe(false);
    });

    it('should return true when cache contains valid data', async () => {
      const cache = new Cache<string>(5000);
      await cache.getOrFetch(async () => 'test-data');

      expect(cache.hasValidCache()).toBe(true);
    });

    it('should return false when cache is stale', async () => {
      const cache = new Cache<string>(5000);
      await cache.getOrFetch(async () => 'test-data');

      vi.advanceTimersByTime(6000);
      expect(cache.hasValidCache()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear cache data', async () => {
      const cache = new Cache<string>(5000);
      await cache.getOrFetch(async () => 'test-data');

      cache.clear();
      expect(cache.get()).toBeNull();
      expect(cache.hasValidCache()).toBe(false);
    });
  });
});

describe('createCache', () => {
  it('should create a Cache instance with the specified TTL', () => {
    const cache = createCache<number>(3000);
    expect(cache).toBeInstanceOf(Cache);
  });

  it('should work correctly for different types', async () => {
    const stringCache = createCache<string>(5000);
    const numberCache = createCache<number>(5000);
    const objectCache = createCache<{ id: number }>(5000);

    await stringCache.getOrFetch(async () => 'hello');
    await numberCache.getOrFetch(async () => 42);
    await objectCache.getOrFetch(async () => ({ id: 1 }));

    expect(stringCache.get()).toBe('hello');
    expect(numberCache.get()).toBe(42);
    expect(objectCache.get()).toEqual({ id: 1 });
  });
});
