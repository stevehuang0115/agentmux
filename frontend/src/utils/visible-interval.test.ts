import { describe, it, expect, vi, afterEach } from 'vitest';
import { setVisibleInterval } from './visible-interval';

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
}

describe('setVisibleInterval', () => {
  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  it('ticks while the tab is visible', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const id = setVisibleInterval(fn, 1000);
    vi.advanceTimersByTime(3000);
    expect(fn).toHaveBeenCalledTimes(3);
    clearInterval(id);
  });

  it('skips ticks while hidden and resumes when visible', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const id = setVisibleInterval(fn, 1000);
    setHidden(true);
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    setHidden(false);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    clearInterval(id);
  });

  it('is cancelled by clearInterval', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    clearInterval(setVisibleInterval(fn, 1000));
    vi.advanceTimersByTime(3000);
    expect(fn).not.toHaveBeenCalled();
  });
});
