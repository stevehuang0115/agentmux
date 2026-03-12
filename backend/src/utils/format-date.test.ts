/**
 * Tests for date formatting utilities
 *
 * @module utils/format-date.test
 */

import { formatMessageTimestamp } from './format-date.js';

describe('formatMessageTimestamp', () => {
  it('should return a string in "YYYY-MM-DD HH:MM" format', () => {
    const result = formatMessageTimestamp();

    // Pattern: 4-digit year, dash, 2-digit month, dash, 2-digit day, space, HH:MM
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('should return a 16-character string', () => {
    const result = formatMessageTimestamp();
    expect(result).toHaveLength(16);
  });

  it('should not contain the ISO "T" separator', () => {
    const result = formatMessageTimestamp();
    expect(result).not.toContain('T');
  });

  it('should reflect the current date', () => {
    const now = new Date();
    const result = formatMessageTimestamp();

    // The year portion should match the current year
    const year = now.getUTCFullYear().toString();
    expect(result.startsWith(year)).toBe(true);
  });
});
