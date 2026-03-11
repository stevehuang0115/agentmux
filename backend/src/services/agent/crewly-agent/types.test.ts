import { describe, it, expect } from '@jest/globals';
import {
  isModelProvider,
  isModelConfig,
  MODEL_PROVIDERS,
  CREWLY_AGENT_DEFAULTS,
} from './types.js';

describe('Crewly Agent Types', () => {
  describe('MODEL_PROVIDERS', () => {
    it('should contain all supported providers', () => {
      expect(MODEL_PROVIDERS).toContain('anthropic');
      expect(MODEL_PROVIDERS).toContain('openai');
      expect(MODEL_PROVIDERS).toContain('google');
      expect(MODEL_PROVIDERS).toHaveLength(3);
    });
  });

  describe('CREWLY_AGENT_DEFAULTS', () => {
    it('should have sensible default values', () => {
      expect(CREWLY_AGENT_DEFAULTS.MAX_STEPS).toBe(30);
      expect(CREWLY_AGENT_DEFAULTS.API_BASE_URL).toBe('http://localhost:8787');
      expect(CREWLY_AGENT_DEFAULTS.MAX_HISTORY_MESSAGES).toBe(100);
      expect(CREWLY_AGENT_DEFAULTS.COMPACTION_THRESHOLD).toBe(0.8);
      expect(CREWLY_AGENT_DEFAULTS.API_TIMEOUT_MS).toBe(30000);
    });

    it('should have a valid default model config', () => {
      expect(CREWLY_AGENT_DEFAULTS.DEFAULT_MODEL.provider).toBe('google');
      expect(CREWLY_AGENT_DEFAULTS.DEFAULT_MODEL.modelId).toBeTruthy();
      expect(typeof CREWLY_AGENT_DEFAULTS.DEFAULT_MODEL.temperature).toBe('number');
      expect(typeof CREWLY_AGENT_DEFAULTS.DEFAULT_MODEL.maxTokens).toBe('number');
    });
  });

  describe('isModelProvider', () => {
    it('should return true for valid providers', () => {
      expect(isModelProvider('anthropic')).toBe(true);
      expect(isModelProvider('openai')).toBe(true);
      expect(isModelProvider('google')).toBe(true);
    });

    it('should return false for invalid providers', () => {
      expect(isModelProvider('azure')).toBe(false);
      expect(isModelProvider('')).toBe(false);
      expect(isModelProvider('ANTHROPIC')).toBe(false);
    });
  });

  describe('isModelConfig', () => {
    it('should return true for valid configs', () => {
      expect(isModelConfig({ provider: 'anthropic', modelId: 'claude-sonnet-4-20250514' })).toBe(true);
      expect(isModelConfig({ provider: 'openai', modelId: 'gpt-4o', temperature: 0.5 })).toBe(true);
      expect(isModelConfig({ provider: 'google', modelId: 'gemini-2.5-flash', maxTokens: 4096 })).toBe(true);
    });

    it('should return false for invalid configs', () => {
      expect(isModelConfig(null)).toBe(false);
      expect(isModelConfig(undefined)).toBe(false);
      expect(isModelConfig(42)).toBe(false);
      expect(isModelConfig('string')).toBe(false);
      expect(isModelConfig({})).toBe(false);
      expect(isModelConfig({ provider: 'anthropic' })).toBe(false);
      expect(isModelConfig({ modelId: 'gpt-4o' })).toBe(false);
      expect(isModelConfig({ provider: 'invalid', modelId: 'test' })).toBe(false);
      expect(isModelConfig({ provider: 'anthropic', modelId: '' })).toBe(false);
    });
  });
});
