/**
 * Crewly Agent Runner Service
 *
 * Core reasoning loop for the Crewly Agent runtime. Wraps Vercel AI SDK's
 * generateText with conversation history management, context compaction,
 * and structured result tracking.
 *
 * @module services/agent/crewly-agent/agent-runner.service
 */

import { generateText, stepCountIs, type ModelMessage, type LanguageModel } from 'ai';
import { ModelManager } from './model-manager.js';
import { CrewlyApiClient } from './api-client.js';
import { createTools } from './tool-registry.js';
import {
  type CrewlyAgentConfig,
  type ConversationState,
  type AgentRunResult,
  type ToolCallRecord,
  CREWLY_AGENT_DEFAULTS,
} from './types.js';

/**
 * Core agent runner that manages the AI SDK generateText loop.
 *
 * Responsibilities:
 * - Maintains conversation history (messages array)
 * - Calls generateText with tools and maxSteps for agentic behavior
 * - Tracks token usage across invocations
 * - Triggers context compaction when history grows too large
 * - Serializes concurrent message handling
 *
 * @example
 * ```typescript
 * const runner = new AgentRunnerService(config);
 * await runner.initialize();
 * const result = await runner.run('Check all team statuses');
 * ```
 */
/** Function type for generateText — used for dependency injection in tests */
type GenerateTextFn = (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;

export class AgentRunnerService {
  private config: CrewlyAgentConfig;
  private modelManager: ModelManager;
  private apiClient: CrewlyApiClient;
  private model: LanguageModel | null = null;
  private state: ConversationState;
  private processing = false;
  private messageQueue: Array<{ message: string; resolve: (result: AgentRunResult) => void; reject: (error: Error) => void }> = [];
  /** @internal Override for testing — replaces the AI SDK generateText call */
  _generateTextFn: GenerateTextFn | null = null;

  /**
   * Create a new AgentRunnerService.
   *
   * @param config - Agent configuration
   * @param modelManager - Optional model manager instance (for testing)
   * @param apiClient - Optional API client instance (for testing)
   */
  constructor(
    config: CrewlyAgentConfig,
    modelManager?: ModelManager,
    apiClient?: CrewlyApiClient,
  ) {
    this.config = config;
    this.modelManager = modelManager || new ModelManager();
    this.apiClient = apiClient || new CrewlyApiClient(
      config.apiBaseUrl,
      config.sessionName,
    );
    this.state = {
      messages: [],
      systemPrompt: config.systemPrompt,
      totalTokens: { input: 0, output: 0 },
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
  }

  /**
   * Initialize the agent runner by loading the model.
   * Must be called before run().
   *
   * @throws Error if the model cannot be loaded
   */
  async initialize(): Promise<void> {
    this.model = await this.modelManager.getModel(this.config.model);
  }

  /**
   * Run the agent with a new user message.
   *
   * Messages are queued and processed serially to prevent concurrent
   * generateText calls which would corrupt conversation state.
   *
   * @param message - User/system message to process
   * @returns Result of the agent run including text, tool calls, and usage
   */
  async run(message: string): Promise<AgentRunResult> {
    return new Promise<AgentRunResult>((resolve, reject) => {
      this.messageQueue.push({ message, resolve, reject });
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Get current conversation state (for inspection/debugging).
   *
   * @returns Current conversation state
   */
  getState(): ConversationState {
    return { ...this.state };
  }

  /**
   * Get the number of messages in the conversation history.
   *
   * @returns Message count
   */
  getHistoryLength(): number {
    return this.state.messages.length;
  }

  /**
   * Check if the agent runner has been initialized.
   *
   * @returns True if initialize() has been called successfully
   */
  isInitialized(): boolean {
    return this.model !== null;
  }

  /**
   * Process queued messages serially.
   */
  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.messageQueue.length > 0) {
      const item = this.messageQueue.shift()!;
      try {
        const result = await this.executeRun(item.message);
        item.resolve(result);
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
    this.processing = false;
  }

  /**
   * Execute a single generateText run with the current conversation context.
   *
   * @param message - New message to add to the conversation
   * @returns Agent run result
   */
  private async executeRun(message: string): Promise<AgentRunResult> {
    if (!this.model) {
      throw new Error('AgentRunner not initialized. Call initialize() first.');
    }

    // Check if compaction is needed before adding new message
    if (this.state.messages.length >= this.config.maxHistoryMessages) {
      await this.compactHistory();
    }

    // Add user message to history
    this.state.messages.push({ role: 'user', content: message });
    this.state.lastActivityAt = new Date();

    // Build tools
    const tools = createTools(this.apiClient, this.config.sessionName);

    // Execute generateText with agentic loop
    const generateFn = this._generateTextFn || (generateText as Function);
    const result = await generateFn({
      model: this.model,
      system: this.state.systemPrompt,
      messages: this.state.messages,
      tools,
      stopWhen: stepCountIs(this.config.maxSteps),
      temperature: this.config.model.temperature,
      maxOutputTokens: this.config.model.maxTokens,
    });

    // Track tool calls across all steps
    const toolCalls: ToolCallRecord[] = [];
    for (const step of result.steps) {
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          toolCalls.push({
            toolName: tc.toolName,
            args: (tc as Record<string, unknown>).input as Record<string, unknown> ?? {},
            result: step.toolResults?.find(
              (tr: { toolCallId: string }) => tr.toolCallId === tc.toolCallId,
            )?.output,
          });
        }
      }
    }

    // Add assistant response to history
    if (result.text) {
      this.state.messages.push({ role: 'assistant', content: result.text });
    }

    // Update token tracking
    const usage = {
      input: result.usage?.inputTokens ?? 0,
      output: result.usage?.outputTokens ?? 0,
    };
    this.state.totalTokens.input += usage.input;
    this.state.totalTokens.output += usage.output;

    return {
      text: result.text,
      steps: result.steps.length,
      usage,
      toolCalls,
      finishReason: result.finishReason,
    };
  }

  /**
   * Compact conversation history by summarizing older messages.
   *
   * Keeps the most recent messages and replaces older ones with a summary.
   * Uses the same model with a summarization prompt.
   */
  private async compactHistory(): Promise<void> {
    if (!this.model || this.state.messages.length < 10) return;

    const keepRecent = 10;
    const oldMessages = this.state.messages.slice(0, -keepRecent);
    const recentMessages = this.state.messages.slice(-keepRecent);

    // Build a simple summary of old messages
    const summaryParts: string[] = [];
    for (const msg of oldMessages) {
      const content = typeof msg.content === 'string'
        ? msg.content.substring(0, 200)
        : JSON.stringify(msg.content).substring(0, 200);
      summaryParts.push(`[${msg.role}]: ${content}`);
    }

    const summaryText = `Previous conversation summary (${oldMessages.length} messages compressed):\n${summaryParts.join('\n')}`;

    this.state.messages = [
      { role: 'assistant', content: summaryText },
      ...recentMessages,
    ];
  }
}
