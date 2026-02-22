/**
 * useToast Hook Tests
 *
 * Tests for the toast notification hook including add, dismiss,
 * and auto-dismiss behavior.
 *
 * @module hooks/useToast.test
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useToast } from './useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with an empty toasts array', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('should add a toast with addToast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Hello', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('should default to info type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Info message');
    });

    expect(result.current.toasts[0].type).toBe('info');
  });

  it('should add multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('First', 'success');
      result.current.addToast('Second', 'error');
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts[0].message).toBe('First');
    expect(result.current.toasts[1].message).toBe('Second');
  });

  it('should auto-dismiss toasts after 4 seconds', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Temporary', 'info');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should dismiss a toast by ID', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Dismissable', 'success');
    });

    const id = result.current.toasts[0].id;

    act(() => {
      result.current.dismissToast(id);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should not remove other toasts when dismissing one', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Keep', 'success');
      result.current.addToast('Remove', 'error');
    });

    const removeId = result.current.toasts[1].id;

    act(() => {
      result.current.dismissToast(removeId);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Keep');
  });

  it('should assign unique IDs to each toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('A', 'info');
      result.current.addToast('B', 'info');
    });

    expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
  });

  it('should handle dismissing a non-existent ID gracefully', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Exists', 'success');
    });

    act(() => {
      result.current.dismissToast('non-existent-id');
    });

    expect(result.current.toasts).toHaveLength(1);
  });
});
