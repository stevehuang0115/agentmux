/**
 * Tests for Supabase Client
 *
 * @module services/supabase.test
 */

import { describe, it, expect, vi } from 'vitest';

// Mock createClient before importing the module
const mockCreateClient = vi.fn().mockReturnValue({ auth: {} });

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

describe('Supabase Client', () => {
  it('should export getSupabaseUrl that returns a URL string', async () => {
    const { getSupabaseUrl } = await import('./supabase');
    const url = getSupabaseUrl();
    expect(typeof url).toBe('string');
    expect(url).toContain('supabase.co');
  });

  it('should export getSupabaseAnonKey that returns a non-empty string', async () => {
    const { getSupabaseAnonKey } = await import('./supabase');
    const key = getSupabaseAnonKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('should export a supabase client instance', async () => {
    const { supabase } = await import('./supabase');
    expect(supabase).toBeDefined();
    expect(mockCreateClient).toHaveBeenCalled();
  });

  it('should call createClient with URL and anon key', async () => {
    const { getSupabaseUrl, getSupabaseAnonKey } = await import('./supabase');
    expect(mockCreateClient).toHaveBeenCalledWith(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
    );
  });
});
