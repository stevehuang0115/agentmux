import { describe, it, expect, beforeEach } from '@jest/globals';
import { InProcessLogBuffer } from './in-process-log-buffer.js';

describe('InProcessLogBuffer', () => {
  let buffer: InProcessLogBuffer;

  beforeEach(() => {
    InProcessLogBuffer.resetInstance();
    buffer = InProcessLogBuffer.getInstance();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = InProcessLogBuffer.getInstance();
      const b = InProcessLogBuffer.getInstance();
      expect(a).toBe(b);
    });

    it('should return new instance after reset', () => {
      const a = InProcessLogBuffer.getInstance();
      InProcessLogBuffer.resetInstance();
      const b = InProcessLogBuffer.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('append', () => {
    it('should create session on first append', () => {
      expect(buffer.hasSession('test')).toBe(false);
      buffer.append('test', 'info', 'hello');
      expect(buffer.hasSession('test')).toBe(true);
    });

    it('should enforce ring buffer limit', () => {
      for (let i = 0; i < 600; i++) {
        buffer.append('test', 'info', `line ${i}`);
      }
      const output = buffer.capture('test', 600);
      const lines = output.split('\n');
      expect(lines.length).toBe(500);
      expect(lines[lines.length - 1]).toContain('line 599');
    });
  });

  describe('capture', () => {
    it('should return placeholder for empty session', () => {
      buffer.registerSession('empty');
      const output = buffer.capture('empty');
      expect(output).toContain('No output yet');
    });

    it('should return placeholder for unknown session', () => {
      const output = buffer.capture('nonexistent');
      expect(output).toContain('No output yet');
    });

    it('should format entries with timestamps', () => {
      buffer.append('test', 'info', 'hello world');
      const output = buffer.capture('test');
      expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] hello world/);
    });

    it('should prefix error and warn levels', () => {
      buffer.append('test', 'error', 'something broke');
      buffer.append('test', 'warn', 'be careful');
      buffer.append('test', 'debug', 'details');
      const output = buffer.capture('test');
      expect(output).toContain('ERROR: something broke');
      expect(output).toContain('WARN: be careful');
      expect(output).toContain('DEBUG: details');
    });

    it('should respect lines parameter', () => {
      buffer.append('test', 'info', 'line 1');
      buffer.append('test', 'info', 'line 2');
      buffer.append('test', 'info', 'line 3');
      const output = buffer.capture('test', 2);
      const lines = output.split('\n');
      expect(lines.length).toBe(2);
      expect(lines[1]).toContain('line 3');
    });
  });

  describe('session management', () => {
    it('should register empty session', () => {
      buffer.registerSession('new');
      expect(buffer.hasSession('new')).toBe(true);
      expect(buffer.capture('new')).toContain('No output yet');
    });

    it('should remove session', () => {
      buffer.append('test', 'info', 'data');
      buffer.removeSession('test');
      expect(buffer.hasSession('test')).toBe(false);
    });

    it('should list session names', () => {
      buffer.registerSession('a');
      buffer.registerSession('b');
      buffer.append('c', 'info', 'test');
      expect(buffer.getSessionNames().sort()).toEqual(['a', 'b', 'c']);
    });

    it('should clear all sessions', () => {
      buffer.registerSession('a');
      buffer.registerSession('b');
      buffer.clear();
      expect(buffer.getSessionNames()).toEqual([]);
    });
  });
});
