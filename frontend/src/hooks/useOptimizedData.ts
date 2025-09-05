import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface UseOptimizedDataOptions {
  cacheTime?: number; // Cache duration in milliseconds
  staleTime?: number; // Time before data is considered stale
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
  enabled?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

// Simple in-memory cache
const dataCache = new Map<string, CacheEntry<any>>();

export const useOptimizedData = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseOptimizedDataOptions = {}
) => {
  const {
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 1 * 60 * 1000,  // 1 minute
    refetchOnWindowFocus = true,
    refetchInterval,
    enabled = true,
    onSuccess,
    onError
  } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Update fetcher ref
  fetcherRef.current = fetcher;

  const getCachedData = useCallback((): T | null => {
    const cached = dataCache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.expiry) {
      dataCache.delete(key);
      return null;
    }
    
    return cached.data;
  }, [key]);

  const isDataStale = useCallback((): boolean => {
    const cached = dataCache.get(key);
    if (!cached) return true;
    
    const now = Date.now();
    return now - cached.timestamp > staleTime;
  }, [key, staleTime]);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    // Check cache first
    const cachedData = getCachedData();
    if (!force && cachedData && !isDataStale()) {
      setData(cachedData);
      return cachedData;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      
      // Cache the result
      dataCache.set(key, {
        data: result,
        timestamp: Date.now(),
        expiry: Date.now() + cacheTime
      });

      setData(result);
      setError(null);
      onSuccess?.(result);
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [enabled, getCachedData, isDataStale, key, cacheTime, onSuccess, onError]);

  const invalidate = useCallback(() => {
    dataCache.delete(key);
    setData(undefined);
    setError(null);
  }, [key]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    const cachedData = getCachedData();
    if (cachedData) {
      setData(cachedData);
    }
    
    if (!cachedData || isDataStale()) {
      fetchData();
    }
  }, [getCachedData, isDataStale, fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    intervalRef.current = setInterval(() => {
      fetchData();
    }, refetchInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refetchInterval, enabled, fetchData]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      if (isDataStale()) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, enabled, isDataStale, fetchData]);

  const isValidating = loading && data !== undefined;
  const isInitialLoading = loading && data === undefined;

  return {
    data,
    loading,
    error,
    isValidating,
    isInitialLoading,
    refetch,
    invalidate,
    mutate: setData
  };
};

// Hook for optimized list rendering with virtual scrolling
export const useVirtualList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    return {
      startIndex: Math.max(0, startIndex - overscan),
      endIndex: Math.min(items.length - 1, endIndex + overscan)
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
      .map((item, index) => ({
        item,
        index: visibleRange.startIndex + index
      }));
  }, [items, visibleRange]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    scrollTop
  };
};

// Debounced state hook for performance
export const useDebouncedState = <T>(
  initialValue: T,
  delay: number = 300
): [T, T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return [value, debouncedValue, setValue];
};

// Hook for memoized expensive calculations
export const useExpensiveCalculation = <T, U>(
  calculate: (input: T) => U,
  input: T,
  deps: React.DependencyList = []
): U => {
  return useMemo(() => {
    console.log('Performing expensive calculation...');
    return calculate(input);
  }, [input, ...deps]);
};

// Hook for batch updates to prevent excessive re-renders
export const useBatchedUpdates = <T>() => {
  const [updates, setUpdates] = useState<T[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const addUpdate = useCallback((update: T) => {
    setUpdates(prev => [...prev, update]);

    // Batch updates together
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setUpdates([]);
    }, 16); // Next animation frame
  }, []);

  const flushUpdates = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    const currentUpdates = [...updates];
    setUpdates([]);
    return currentUpdates;
  }, [updates]);

  return {
    updates,
    addUpdate,
    flushUpdates,
    hasUpdates: updates.length > 0
  };
};