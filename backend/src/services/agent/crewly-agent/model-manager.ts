/**
 * Crewly Agent Model Manager
 *
 * Multi-provider model factory that creates AI SDK model instances
 * from configuration. Supports Anthropic, OpenAI, and Google providers.
 *
 * API keys are read from environment variables by the provider SDKs:
 * - ANTHROPIC_API_KEY
 * - OPENAI_API_KEY
 * - GOOGLE_GENERATIVE_AI_API_KEY
 *
 * @module services/agent/crewly-agent/model-manager
 */

import type { LanguageModel } from 'ai';
import { type ModelConfig, type ModelProvider, CREWLY_AGENT_DEFAULTS } from './types.js';

/**
 * Factory for creating AI SDK language model instances from configuration.
 *
 * Uses dynamic imports to avoid loading provider SDKs that aren't needed,
 * keeping the startup cost minimal when only one provider is used.
 *
 * @example
 * ```typescript
 * const manager = new ModelManager();
 * const model = await manager.getModel({ provider: 'anthropic', modelId: 'claude-sonnet-4-20250514' });
 * ```
 */
export class ModelManager {
  /** Cached provider module references to avoid re-importing */
  private providerCache = new Map<ModelProvider, (modelId: string) => LanguageModel>();

  /**
   * Get an AI SDK language model instance for the given configuration.
   *
   * @param config - Model configuration specifying provider and model ID
   * @returns AI SDK LanguageModel instance ready for use with generateText
   * @throws Error if the provider is unknown or the SDK is not installed
   */
  async getModel(config: ModelConfig = CREWLY_AGENT_DEFAULTS.DEFAULT_MODEL): Promise<LanguageModel> {
    const providerFn = await this.getProviderFunction(config.provider);
    return providerFn(config.modelId);
  }

  /**
   * Get provider function, using cache for repeated calls.
   *
   * @param provider - Provider name
   * @returns Function that creates a model from a model ID string
   */
  private async getProviderFunction(provider: ModelProvider): Promise<(modelId: string) => LanguageModel> {
    const cached = this.providerCache.get(provider);
    if (cached) return cached;

    let providerFn: (modelId: string) => LanguageModel;

    switch (provider) {
      case 'anthropic': {
        const { anthropic } = await import('@ai-sdk/anthropic');
        providerFn = (modelId: string) => anthropic(modelId);
        break;
      }
      case 'openai': {
        const { openai } = await import('@ai-sdk/openai');
        providerFn = (modelId: string) => openai(modelId);
        break;
      }
      case 'google': {
        const { google } = await import('@ai-sdk/google');
        providerFn = (modelId: string) => google(modelId);
        break;
      }
      default:
        throw new Error(`Unknown model provider: ${provider}`);
    }

    this.providerCache.set(provider, providerFn);
    return providerFn;
  }

  /**
   * Check which providers have API keys configured in the environment.
   *
   * @returns Object indicating which providers are available
   */
  getAvailableProviders(): Record<ModelProvider, boolean> {
    return {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      google: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !!process.env.GEMINI_API_KEY,
    };
  }

  /**
   * Clear the provider cache (useful for testing or reconfiguration).
   */
  clearCache(): void {
    this.providerCache.clear();
  }
}
