/**
 * Supabase Client
 *
 * Singleton Supabase client for frontend authentication.
 * Reads URL and anon key from Vite env vars with dev-project defaults.
 *
 * @module services/supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Defaults (dev project — safe to embed; RLS enforces security)
// ---------------------------------------------------------------------------

/** Default Supabase URL matching backend env.config.ts. */
const DEFAULT_SUPABASE_URL = 'https://npveywncozhjzcxrhkuc.supabase.co';

/** Default Supabase anon key matching backend env.config.ts. */
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdmV5d25jb3poanpjeHJoa3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MzUwNzIsImV4cCI6MjA4ODUxMTA3Mn0.xinT1XB9RaZ13CWQjbo95i_dJN7i463l9gAWQce32Yg';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Resolve the Supabase URL from Vite env or default.
 *
 * @returns Supabase project URL
 */
export function getSupabaseUrl(): string {
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
}

/**
 * Resolve the Supabase anon key from Vite env or default.
 *
 * @returns Supabase anonymous key
 */
export function getSupabaseAnonKey(): string {
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;
}

/**
 * Singleton Supabase client instance.
 *
 * Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY when available,
 * falling back to the dev-project defaults.
 */
export const supabase: SupabaseClient = createClient(getSupabaseUrl(), getSupabaseAnonKey());
