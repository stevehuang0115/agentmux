/**
 * Date formatting utilities
 *
 * @module utils/format-date
 */

/**
 * Format the current timestamp as a human-readable string for message entries.
 *
 * Produces a "YYYY-MM-DD HH:MM" format suitable for chat thread logs.
 *
 * @returns Formatted timestamp string (e.g. "2026-03-12 14:30")
 *
 * @example
 * ```typescript
 * const ts = formatMessageTimestamp(); // "2026-03-12 14:30"
 * ```
 */
export function formatMessageTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 16);
}
