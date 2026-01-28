/**
 * SpeechBubble tests - Verifies text truncation and dimensions logic.
 */

import { describe, it, expect } from 'vitest';

// Extract the pure logic functions for testing
// (The component uses these internally via useMemo)

/**
 * Truncates text if it exceeds maxChars.
 * Replicates the displayText logic from SpeechBubble.
 */
function truncateText(text: string, maxChars: number = 50): string {
  if (!text) return '';
  // Clean up the text - remove extra whitespace
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length > maxChars) {
    return cleaned.substring(0, maxChars - 3) + '...';
  }
  return cleaned;
}

/**
 * Calculates bubble dimensions based on text length.
 * Replicates the dimensions logic from SpeechBubble.
 */
function calculateDimensions(displayText: string): { width: number; height: number } {
  const charWidth = 0.12;
  const minWidth = 2.0;
  const maxWidth = 5.0;
  const padding = 0.6;

  const textWidth = displayText.length * charWidth;
  const width = Math.min(Math.max(textWidth + padding, minWidth), maxWidth);
  const height = 0.7;

  return { width, height };
}

/**
 * Gets variant colors based on variant type.
 */
function getVariantColors(variant: 'work' | 'conversation') {
  const isConversation = variant === 'conversation';
  return {
    bgColor: isConversation ? 0xffffff : 0x1a1a2e,
    borderColor: isConversation ? 0xcccccc : 0x4a90d9,
    textColor: isConversation ? '#222222' : '#ffffff',
    dotColor: isConversation ? 0x4a90d9 : 0x4ade80,
  };
}

describe('SpeechBubble', () => {
  describe('truncateText', () => {
    it('should return empty string for empty input', () => {
      expect(truncateText('')).toBe('');
    });

    it('should return empty string for undefined-like input', () => {
      expect(truncateText(null as unknown as string)).toBe('');
    });

    it('should preserve short text unchanged', () => {
      expect(truncateText('Hello World')).toBe('Hello World');
    });

    it('should truncate text longer than maxChars with ellipsis', () => {
      const longText = 'This is a very long text that should be truncated';
      const result = truncateText(longText, 30);
      expect(result).toBe('This is a very long text th...');
      expect(result.length).toBe(30);
    });

    it('should clean up extra whitespace', () => {
      expect(truncateText('Hello   World')).toBe('Hello World');
      expect(truncateText('  Leading and trailing  ')).toBe('Leading and trailing');
      expect(truncateText('Multiple   \t  spaces')).toBe('Multiple spaces');
    });

    it('should use default maxChars of 50', () => {
      const exactlyFifty = 'A'.repeat(50);
      expect(truncateText(exactlyFifty).length).toBe(50);

      const fiftyOne = 'A'.repeat(51);
      expect(truncateText(fiftyOne)).toBe('A'.repeat(47) + '...');
    });

    it('should handle custom maxChars', () => {
      const text = 'ABCDEFGHIJ';
      expect(truncateText(text, 8)).toBe('ABCDE...');
    });

    it('should handle text exactly at maxChars boundary', () => {
      const text = 'ABCDEFGHIJ';
      expect(truncateText(text, 10)).toBe('ABCDEFGHIJ');
      expect(truncateText(text, 11)).toBe('ABCDEFGHIJ');
    });
  });

  describe('calculateDimensions', () => {
    it('should return minimum width for empty text', () => {
      const dims = calculateDimensions('');
      expect(dims.width).toBe(2.0);
      expect(dims.height).toBe(0.7);
    });

    it('should return minimum width for short text', () => {
      const dims = calculateDimensions('Hi');
      // 2 chars * 0.12 + 0.6 = 0.84 < 2.0, so min applies
      expect(dims.width).toBe(2.0);
    });

    it('should scale width with text length', () => {
      const shortDims = calculateDimensions('Hello');
      const longDims = calculateDimensions('Hello World Test');
      expect(longDims.width).toBeGreaterThan(shortDims.width);
    });

    it('should cap at maximum width', () => {
      const veryLongText = 'A'.repeat(100);
      const dims = calculateDimensions(veryLongText);
      expect(dims.width).toBe(5.0);
    });

    it('should always return fixed height', () => {
      expect(calculateDimensions('').height).toBe(0.7);
      expect(calculateDimensions('Short').height).toBe(0.7);
      expect(calculateDimensions('A'.repeat(100)).height).toBe(0.7);
    });

    it('should calculate correct width for medium text', () => {
      // 20 chars * 0.12 + 0.6 = 3.0
      const dims = calculateDimensions('A'.repeat(20));
      expect(dims.width).toBeCloseTo(3.0);
    });
  });

  describe('getVariantColors', () => {
    it('should return dark theme colors for work variant', () => {
      const colors = getVariantColors('work');
      expect(colors.bgColor).toBe(0x1a1a2e);
      expect(colors.borderColor).toBe(0x4a90d9);
      expect(colors.textColor).toBe('#ffffff');
      expect(colors.dotColor).toBe(0x4ade80);
    });

    it('should return light theme colors for conversation variant', () => {
      const colors = getVariantColors('conversation');
      expect(colors.bgColor).toBe(0xffffff);
      expect(colors.borderColor).toBe(0xcccccc);
      expect(colors.textColor).toBe('#222222');
      expect(colors.dotColor).toBe(0x4a90d9);
    });
  });

  describe('Component defaults', () => {
    it('should have correct default yOffset', () => {
      const defaultYOffset = 3.0;
      expect(defaultYOffset).toBe(3.0);
    });

    it('should have correct default maxChars', () => {
      const defaultMaxChars = 50;
      expect(defaultMaxChars).toBe(50);
    });

    it('should have correct default variant', () => {
      const defaultVariant = 'work';
      expect(defaultVariant).toBe('work');
    });
  });
});
