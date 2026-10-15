import { describe, expect, it } from 'vitest';
import { createMemoryLimitStore, DEFAULT_WRITES_PER_DAY, writeLimitKey } from './limits.js';

describe('createMemoryLimitStore', () => {
  it('counts per key and forgets after the ttl', () => {
    let t = 0;
    const store = createMemoryLimitStore(() => t);
    expect(store.increment('a', 100)).toBe(1);
    expect(store.increment('a', 100)).toBe(2);
    expect(store.increment('b', 100)).toBe(1);
    t = 150;
    expect(store.increment('a', 100)).toBe(1);
  });
});

describe('writeLimitKey', () => {
  it('buckets by UTC day and sub', () => {
    const k1 = writeLimitKey('u1', Date.UTC(2026, 9, 15, 0, 1));
    const k2 = writeLimitKey('u1', Date.UTC(2026, 9, 15, 23, 59));
    const k3 = writeLimitKey('u1', Date.UTC(2026, 9, 16, 0, 0));
    expect(k1).toBe('writes:2026-10-15:u1');
    expect(k1).toBe(k2);
    expect(k3).not.toBe(k1);
    expect(writeLimitKey('u2', Date.UTC(2026, 9, 15))).not.toBe(k1);
  });

  it('defaults to 5 writes a day', () => {
    expect(DEFAULT_WRITES_PER_DAY).toBe(5);
  });
});
