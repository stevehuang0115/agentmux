/**
 * Crewly Agent Runtime Type Definitions
 *
 * Types for the in-process Crewly Agent runtime powered by Vercel AI SDK.
 * Covers model configuration, conversation state, and agent lifecycle.
 *
 * @module services/agent/crewly-agent/types
 */

import type { ModelMessage } from 'ai';
import type { z } from 'zod';

/**
 * Supported model providers for Crewly Agent
 */
export type ModelProvider = 'anthropic' | 'openai' | 'google';

/**
 * All valid model providers
 */
export const MODEL_PROVIDERS: readonly ModelProvider[] = [
  'anthropic',
  'openai',
  'google',
] as const;

/**
 * Configuration for a specific model instance
 */
export interface ModelConfig {
  /** Model provider (e.g., 'anthropic', 'openai', 'google') */
  provider: ModelProvider;
  /** Model identifier (e.g., 'claude-sonnet-4-20250514', 'gpt-4o', 'gemini-2.5-flash') */
  modelId: string;
  /** Optional temperature override (0-1) */
  temperature?: number;
  /** Optional max tokens per response */
  maxTokens?: number;
}

/**
 * Conversation state maintained by the AgentRunner
 */
export interface ConversationState {
  /** AI SDK ModelMessage array — the full conversation history */
  messages: ModelMessage[];
  /** System prompt loaded from prompt.md */
  systemPrompt: string;
  /** Cumulative token usage across all generateText calls */
  totalTokens: { input: number; output: number };
  /** Conversation creation time */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

/**
 * Configuration for the Crewly Agent runtime
 */
export interface CrewlyAgentConfig {
  /** Model configuration for the agent */
  model: ModelConfig;
  /** Maximum reasoning steps per generateText call */
  maxSteps: number;
  /** Session name for this agent instance */
  sessionName: string;
  /** Base URL for the Crewly REST API */
  apiBaseUrl: string;
  /** System prompt content (loaded from prompt.md) */
  systemPrompt: string;
  /** Maximum conversation history messages before compaction triggers */
  maxHistoryMessages: number;
  /** Token budget threshold (percentage of context window) for compaction */
  compactionThreshold: number;
}

/**
 * Result of a single agent run (one generateText invocation)
 */
export interface AgentRunResult {
  /** Final text response from the model */
  text: string;
  /** Number of steps taken in this run */
  steps: number;
  /** Token usage for this run */
  usage: { input: number; output: number };
  /** Tool calls made during this run */
  toolCalls: ToolCallRecord[];
  /** Reason the generation finished */
  finishReason: string;
}

/**
 * Record of a single tool call during agent execution
 */
export interface ToolCallRecord {
  /** Tool name */
  toolName: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** Result returned by the tool */
  result: unknown;
}

/**
 * Result of an API call to the Crewly backend
 */
export interface ApiCallResult<T = unknown> {
  /** Whether the call succeeded (HTTP 2xx) */
  success: boolean;
  /** Response data on success */
  data?: T;
  /** Error message on failure */
  error?: string;
  /** HTTP status code */
  status: number;
}

/**
 * Tool definition shape matching AI SDK Tool interface.
 * Shared by both the main tool registry and the auditor tool registry.
 */
export interface ToolDefinition {
  /** Human-readable description of what the tool does */
  description: string;
  /** Zod schema for validating tool input */
  inputSchema: z.ZodType;
  /** Execute the tool with the given validated arguments */
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Default configuration values for Crewly Agent
 */
export const CREWLY_AGENT_DEFAULTS = {
  /** Default max reasoning steps per generateText call */
  MAX_STEPS: 30,
  /** Default API base URL */
  API_BASE_URL: 'http://localhost:8787',
  /** Default max history messages before compaction */
  MAX_HISTORY_MESSAGES: 100,
  /** Default compaction threshold (80% of context window) */
  COMPACTION_THRESHOLD: 0.8,
  /** Default model configuration */
  DEFAULT_MODEL: {
    provider: 'google' as ModelProvider,
    modelId: 'gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 8192,
  } satisfies ModelConfig,
  /** HTTP request timeout in milliseconds */
  API_TIMEOUT_MS: 30_000,
} as const;

/**
 * Type guard to check if a string is a valid ModelProvider
 *
 * @param value - String to check
 * @returns True if the value is a valid ModelProvider
 */
export function isModelProvider(value: string): value is ModelProvider {
  return MODEL_PROVIDERS.includes(value as ModelProvider);
}

/**
 * Type guard to check if an object is a valid ModelConfig
 *
 * @param obj - Object to validate
 * @returns True if the object has all required ModelConfig fields
 */
export function isModelConfig(obj: unknown): obj is ModelConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.provider === 'string' &&
    isModelProvider(candidate.provider) &&
    typeof candidate.modelId === 'string' &&
    candidate.modelId.length > 0
  );
}
