import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { 
  useOptimizedData, 
  useDebouncedState, 
  useVirtualList,
  useBatchedUpdates 
} from '../../frontend/src/hooks/useOptimizedData';

// Mock fetch function
const createMockFetcher = (data: any, delay = 100) => {
  return jest.fn(() => 
    new Promise((resolve) => 
      setTimeout(() => resolve(data), delay)
    )
  );
};

const createFailingFetcher = (error = new Error('Fetch failed')) => {
  return jest.fn(() => Promise.reject(error));
};

describe('Phase 6 Performance Hooks', () => {
  beforeEach(() => {
    // Clear any existing cache
    jest.clearAllMocks();
  });

  describe('useOptimizedData', () => {
    test('should fetch data on initial call', async () => {
      const mockData = { id: 1, name: 'Test' };
      const fetcher = createMockFetcher(mockData);
      
      const { result } = renderHook(() => 
        useOptimizedData('test-key', fetcher)
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Wait for data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(mockData);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('should handle fetch errors', async () => {
      const error = new Error('Network error');
      const fetcher = createFailingFetcher(error);
      
      const { result } = renderHook(() => 
        useOptimizedData('test-key-error', fetcher)
      );

      expect(result.current.loading).toBe(true);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toEqual(error);
      expect(result.current.data).toBeUndefined();
    });

    test('should call onSuccess and onError callbacks', async () => {
      const mockData = { id: 1 };
      const onSuccess = jest.fn();
      const onError = jest.fn();
      
      // Test success callback
      const successFetcher = createMockFetcher(mockData);
      const { result: successResult } = renderHook(() => 
        useOptimizedData('success-key', successFetcher, { onSuccess, onError })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(onSuccess).toHaveBeenCalledWith(mockData);
      expect(onError).not.toHaveBeenCalled();

      // Test error callback
      const error = new Error('Test error');
      const errorFetcher = createFailingFetcher(error);
      const { result: errorResult } = renderHook(() => 
        useOptimizedData('error-key', errorFetcher, { onSuccess, onError })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    test('should not fetch when enabled is false', async () => {
      const fetcher = createMockFetcher({ id: 1 });
      
      const { result } = renderHook(() => 
        useOptimizedData('disabled-key', fetcher, { enabled: false })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('should refetch when refetch is called', async () => {
      const mockData = { id: 1 };
      const fetcher = createMockFetcher(mockData);
      
      const { result } = renderHook(() => 
        useOptimizedData('refetch-key', fetcher)
      );

      // Wait for initial fetch
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(fetcher).toHaveBeenCalledTimes(1);

      // Refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    test('should invalidate cache', async () => {
      const mockData = { id: 1 };
      const fetcher = createMockFetcher(mockData);
      
      const { result } = renderHook(() => 
        useOptimizedData('invalidate-key', fetcher)
      );

      // Wait for initial fetch
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.data).toEqual(mockData);

      // Invalidate cache
      act(() => {
        result.current.invalidate();
      });

      expect(result.current.data).toBeUndefined();
    });

    test('should distinguish between loading states', async () => {
      const mockData = { id: 1 };
      const fetcher = createMockFetcher(mockData);
      
      const { result } = renderHook(() => 
        useOptimizedData('loading-states-key', fetcher)
      );

      // Initial loading
      expect(result.current.isInitialLoading).toBe(true);
      expect(result.current.isValidating).toBe(false);

      // Wait for data
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.isInitialLoading).toBe(false);
      expect(result.current.isValidating).toBe(false);

      // Refetch (validating)
      act(() => {
        result.current.refetch();
      });

      expect(result.current.isInitialLoading).toBe(false);
      expect(result.current.isValidating).toBe(true);
    });
  });

  describe('useDebouncedState', () => {
    jest.useFakeTimers();

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
      jest.useFakeTimers();
    });

    test('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebouncedState('initial', 300));
      
      const [value, debouncedValue] = result.current;
      expect(value).toBe('initial');
      expect(debouncedValue).toBe('initial');
    });

    test('should debounce state updates', () => {
      const { result } = renderHook(() => useDebouncedState('initial', 300));
      
      // Update value
      act(() => {
        const [, , setValue] = result.current;
        setValue('updated');
      });

      const [value, debouncedValue] = result.current;
      expect(value).toBe('updated');
      expect(debouncedValue).toBe('initial'); // Still old value

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(300);
      });

      const [, newDebouncedValue] = result.current;
      expect(newDebouncedValue).toBe('updated');
    });

    test('should cancel previous debounce when value changes quickly', () => {
      const { result } = renderHook(() => useDebouncedState('initial', 300));
      
      // Multiple rapid updates
      act(() => {
        const [, , setValue] = result.current;
        setValue('first');
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      act(() => {
        const [, , setValue] = result.current;
        setValue('second');
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      act(() => {
        const [, , setValue] = result.current;
        setValue('final');
      });

      // Only the final value should be debounced
      act(() => {
        jest.advanceTimersByTime(300);
      });

      const [, debouncedValue] = result.current;
      expect(debouncedValue).toBe('final');
    });
  });

  describe('useVirtualList', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const itemHeight = 50;
    const containerHeight = 500;

    test('should calculate visible range correctly', () => {
      const { result } = renderHook(() => 
        useVirtualList(items, itemHeight, containerHeight)
      );

      const { visibleItems, totalHeight, offsetY } = result.current;
      
      expect(totalHeight).toBe(items.length * itemHeight); // 50000
      expect(visibleItems.length).toBeGreaterThan(0);
      expect(offsetY).toBe(0); // No scroll offset initially
    });

    test('should update visible items when scrolling', () => {
      const { result } = renderHook(() => 
        useVirtualList(items, itemHeight, containerHeight)
      );

      const scrollEvent = {
        currentTarget: { scrollTop: 1000 }
      } as React.UIEvent<HTMLDivElement>;

      act(() => {
        result.current.handleScroll(scrollEvent);
      });

      const { visibleItems, offsetY } = result.current;
      
      expect(result.current.scrollTop).toBe(1000);
      expect(offsetY).toBeGreaterThan(0);
      expect(visibleItems[0].index).toBeGreaterThan(0);
    });

    test('should include overscan items', () => {
      const overscan = 3;
      const { result } = renderHook(() => 
        useVirtualList(items, itemHeight, containerHeight, overscan)
      );

      const expectedVisibleCount = Math.ceil(containerHeight / itemHeight) + (overscan * 2);
      const { visibleItems } = result.current;
      
      expect(visibleItems.length).toBeLessThanOrEqual(expectedVisibleCount + 1);
    });

    test('should handle empty items array', () => {
      const { result } = renderHook(() => 
        useVirtualList([], itemHeight, containerHeight)
      );

      const { visibleItems, totalHeight, offsetY } = result.current;
      
      expect(visibleItems).toHaveLength(0);
      expect(totalHeight).toBe(0);
      expect(offsetY).toBe(0);
    });

    test('should not exceed array bounds', () => {
      const smallItems = Array.from({ length: 5 }, (_, i) => ({ id: i }));
      
      const { result } = renderHook(() => 
        useVirtualList(smallItems, itemHeight, containerHeight)
      );

      const { visibleItems } = result.current;
      
      expect(visibleItems.length).toBeLessThanOrEqual(smallItems.length);
      expect(visibleItems.every(item => item.index < smallItems.length)).toBe(true);
    });
  });

  describe('useBatchedUpdates', () => {
    jest.useFakeTimers();

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
      jest.useFakeTimers();
    });

    test('should batch updates together', () => {
      const { result } = renderHook(() => useBatchedUpdates<string>());
      
      expect(result.current.hasUpdates).toBe(false);
      expect(result.current.updates).toHaveLength(0);

      // Add multiple updates
      act(() => {
        result.current.addUpdate('update1');
        result.current.addUpdate('update2');
        result.current.addUpdate('update3');
      });

      expect(result.current.hasUpdates).toBe(true);
      expect(result.current.updates).toHaveLength(3);

      // Updates should be flushed automatically after delay
      act(() => {
        jest.advanceTimersByTime(16);
      });

      expect(result.current.hasUpdates).toBe(false);
      expect(result.current.updates).toHaveLength(0);
    });

    test('should manually flush updates', () => {
      const { result } = renderHook(() => useBatchedUpdates<number>());
      
      act(() => {
        result.current.addUpdate(1);
        result.current.addUpdate(2);
      });

      expect(result.current.updates).toHaveLength(2);

      const flushedUpdates = act(() => {
        return result.current.flushUpdates();
      });

      expect(flushedUpdates).toEqual([1, 2]);
      expect(result.current.updates).toHaveLength(0);
    });

    test('should reset timeout when new updates are added', () => {
      const { result } = renderHook(() => useBatchedUpdates<string>());
      
      act(() => {
        result.current.addUpdate('first');
      });

      // Advance time partially
      act(() => {
        jest.advanceTimersByTime(10);
      });

      // Add another update (should reset timeout)
      act(() => {
        result.current.addUpdate('second');
      });

      // Advance time by original delay
      act(() => {
        jest.advanceTimersByTime(16);
      });

      // Updates should be cleared now
      expect(result.current.updates).toHaveLength(0);
    });
  });

  describe('Hook Integration', () => {
    test('should work together in complex scenarios', async () => {
      const fetcher = createMockFetcher({ items: [1, 2, 3] });
      
      // Test combining optimized data with debounced search
      const { result: dataResult } = renderHook(() => 
        useOptimizedData('integration-key', fetcher)
      );

      const { result: debouncedResult } = renderHook(() => 
        useDebouncedState('', 100)
      );

      // Wait for data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(dataResult.current.data).toEqual({ items: [1, 2, 3] });

      // Test debounced search
      act(() => {
        const [, , setValue] = debouncedResult.current;
        setValue('search term');
      });

      const [value, debouncedValue] = debouncedResult.current;
      expect(value).toBe('search term');
      expect(debouncedValue).toBe(''); // Not debounced yet
    });
  });

  describe('Performance Characteristics', () => {
    test('should not cause unnecessary re-renders', () => {
      const renderCount = jest.fn();
      
      const TestComponent = () => {
        renderCount();
        const { data } = useOptimizedData('perf-key', createMockFetcher({ test: true }));
        return <div>{data?.test ? 'loaded' : 'loading'}</div>;
      };

      const { rerender } = renderHook(() => <TestComponent />);
      
      // Initial render
      expect(renderCount).toHaveBeenCalledTimes(1);
      
      // Rerender with same props should not cause additional fetches
      rerender();
      expect(renderCount).toHaveBeenCalledTimes(2); // Component re-rendered but no additional fetch
    });

    test('should handle rapid state changes efficiently', () => {
      jest.useFakeTimers();
      
      const { result } = renderHook(() => useDebouncedState('initial', 100));
      
      // Rapid state changes
      const updates = ['a', 'b', 'c', 'd', 'e'];
      updates.forEach(update => {
        act(() => {
          const [, , setValue] = result.current;
          setValue(update);
        });
      });

      // Should still have initial debounced value
      const [, debouncedValue] = result.current;
      expect(debouncedValue).toBe('initial');

      // Fast-forward and check only final value was debounced
      act(() => {
        jest.advanceTimersByTime(100);
      });

      const [, finalDebouncedValue] = result.current;
      expect(finalDebouncedValue).toBe('e');
      
      jest.useRealTimers();
    });
  });
});