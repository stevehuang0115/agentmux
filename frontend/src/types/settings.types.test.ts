/**
 * Tests for Settings Types
 *
 * @module types/settings.types.test
 */

import { describe, it, expect } from 'vitest';
import {
  AI_RUNTIMES,
  AI_RUNTIME_DISPLAY_NAMES,
  getAIRuntimeDisplayName,
  isValidAIRuntime,
} from './settings.types';

describe('Settings Types', () => {
  describe('AI_RUNTIMES', () => {
    it('should contain all supported runtimes', () => {
      expect(AI_RUNTIMES).toContain('claude-code');
      expect(AI_RUNTIMES).toContain('gemini-cli');
      expect(AI_RUNTIMES).toContain('codex-cli');
    });

    it('should have exactly 3 runtimes', () => {
      expect(AI_RUNTIMES).toHaveLength(3);
    });
  });

  describe('AI_RUNTIME_DISPLAY_NAMES', () => {
    it('should have display names for all runtimes', () => {
      expect(AI_RUNTIME_DISPLAY_NAMES['claude-code']).toBe('Claude Code');
      expect(AI_RUNTIME_DISPLAY_NAMES['gemini-cli']).toBe('Gemini CLI');
      expect(AI_RUNTIME_DISPLAY_NAMES['codex-cli']).toBe('Codex CLI');
    });
  });

  describe('getAIRuntimeDisplayName', () => {
    it('should return display name for claude-code', () => {
      expect(getAIRuntimeDisplayName('claude-code')).toBe('Claude Code');
    });

    it('should return display name for gemini-cli', () => {
      expect(getAIRuntimeDisplayName('gemini-cli')).toBe('Gemini CLI');
    });

    it('should return display name for codex-cli', () => {
      expect(getAIRuntimeDisplayName('codex-cli')).toBe('Codex CLI');
    });
  });

  describe('isValidAIRuntime', () => {
    it('should return true for valid runtimes', () => {
      expect(isValidAIRuntime('claude-code')).toBe(true);
      expect(isValidAIRuntime('gemini-cli')).toBe(true);
      expect(isValidAIRuntime('codex-cli')).toBe(true);
    });

    it('should return false for invalid runtimes', () => {
      expect(isValidAIRuntime('invalid')).toBe(false);
      expect(isValidAIRuntime('')).toBe(false);
      expect(isValidAIRuntime('claude')).toBe(false);
      expect(isValidAIRuntime('CLAUDE-CODE')).toBe(false);
    });
  });
});
