import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePinnedChats } from './usePinnedChats';

describe('usePinnedChats identity', () => {
  it('returns the same object across re-renders (consumers list it in memo/effect deps)', () => {
    const { result, rerender } = renderHook(() => usePinnedChats());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('returns a new object after the pinned set changes', () => {
    const { result } = renderHook(() => usePinnedChats());
    const first = result.current;
    act(() => result.current.toggle('some-channel'));
    expect(result.current).not.toBe(first);
    expect(result.current.isPinned('some-channel')).toBe(true);
  });
});
