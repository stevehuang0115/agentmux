import { describe, it, expect } from '@jest/globals';
import { formatError } from './format-error.js';

describe('formatError', () => {
  it('should extract message from Error instances', () => {
    expect(formatError(new Error('test error'))).toBe('test error');
  });

  it('should convert strings directly', () => {
    expect(formatError('plain string')).toBe('plain string');
  });

  it('should convert numbers to string', () => {
    expect(formatError(42)).toBe('42');
  });

  it('should handle null', () => {
    expect(formatError(null)).toBe('null');
  });

  it('should handle undefined', () => {
    expect(formatError(undefined)).toBe('undefined');
  });
});
