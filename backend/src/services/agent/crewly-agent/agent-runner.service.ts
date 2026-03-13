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
  type CompactionResult,
  type AuditEntry,
  type SecurityPolicy,
  type ToolCallbacks,
  type ApprovalCheckResult,
  type ToolSensitivity,
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
  private messageQueue: Array<{ message: string; conversationId?: string; resolve: (result: AgentRunResult) => void; reject: (error: Error) => void }> = [];
  private auditLog: AuditEntry[] = [];
  private securityPolicy: SecurityPolicy;
  /** Current conversationId extracted from [CHAT:xxx] prefix */
  private currentConversationId?: string;
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
    this.securityPolicy = { ...CREWLY_AGENT_DEFAULTS.SECURITY_POLICY };
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
  async run(message: string, conversationId?: string): Promise<AgentRunResult> {
    return new Promise<AgentRunResult>((resolve, reject) => {
      this.messageQueue.push({ message, conversationId, resolve, reject });
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
        // Update current conversationId for tool context.
        // Always update (including to undefined) so stale conversationId from
        // a previous message doesn't leak into tools for the current message.
        this.currentConversationId = item.conversationId;
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

    // Build tools with callbacks for compaction, audit, and security enforcement
    const callbacks: ToolCallbacks = {
      onCompactMemory: () => this.requestCompaction(),
      onAuditLog: (entry: AuditEntry) => this.recordAudit(entry),
      onCheckApproval: (toolName: string, sensitivity: ToolSensitivity) => this.checkApproval(toolName, sensitivity),
    };
    const tools = createTools(this.apiClient, this.config.sessionName, this.config.projectPath, callbacks, this.currentConversationId);

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
   * Public method for agent-initiated context compaction.
   * Called by the compact_memory tool to intelligently summarize conversation state.
   *
   * Uses the model to generate a structured summary preserving:
   * - Active tasks and their status
   * - Key decisions made
   * - Important findings and blockers
   * - Current working context
   *
   * @returns CompactionResult with before/after stats
   */
  async requestCompaction(): Promise<CompactionResult> {
    if (!this.model || this.state.messages.length < 10) {
      return {
        compacted: false,
        messagesBefore: this.state.messages.length,
        messagesAfter: this.state.messages.length,
        reason: this.state.messages.length < 10
          ? 'Too few messages to compact'
          : 'Model not initialized',
      };
    }
    return this.compactHistory();
  }

  /**
   * Get the security audit log.
   *
   * @param limit - Maximum number of entries to return (most recent first)
   * @returns Array of audit entries
   */
  getAuditLog(limit?: number): AuditEntry[] {
    const entries = [...this.auditLog].reverse();
    return limit ? entries.slice(0, limit) : entries;
  }

  /**
   * Get the current security policy.
   *
   * @returns Current security policy configuration
   */
  getSecurityPolicy(): SecurityPolicy {
    return { ...this.securityPolicy };
  }

  /**
   * Update the security policy.
   *
   * @param updates - Partial security policy to merge
   */
  updateSecurityPolicy(updates: Partial<SecurityPolicy>): void {
    this.securityPolicy = { ...this.securityPolicy, ...updates };
  }

  /**
   * Record an audit entry for a tool invocation.
   *
   * @param entry - Audit entry to record
   */
  private recordAudit(entry: AuditEntry): void {
    if (!this.securityPolicy.auditEnabled) return;

    this.auditLog.push(entry);

    // Enforce max entries limit
    if (this.auditLog.length > this.securityPolicy.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.securityPolicy.maxAuditEntries);
    }
  }

  /**
   * Check if a tool is allowed to execute under the current security policy.
   *
   * Evaluates the tool against two checks:
   * 1. blockedTools — tools explicitly blocked by name (returns blocked=true)
   * 2. requireApproval — tools whose sensitivity requires approval (returns requiresApproval=true)
   *
   * @param toolName - Name of the tool being invoked
   * @param sensitivity - Sensitivity classification of the tool
   * @returns ApprovalCheckResult indicating if execution is allowed
   */
  private checkApproval(toolName: string, sensitivity: ToolSensitivity): ApprovalCheckResult {
    // Check blocked tools
    if (this.securityPolicy.blockedTools.includes(toolName)) {
      return {
        allowed: false,
        blocked: true,
        reason: `Tool '${toolName}' is blocked by security policy`,
      };
    }

    // Check approval requirements
    if (this.securityPolicy.requireApproval.includes(sensitivity)) {
      return {
        allowed: false,
        blocked: false,
        reason: `Tool '${toolName}' (${sensitivity}) requires approval — approval mode is active for '${sensitivity}' tools`,
      };
    }

    return { allowed: true };
  }

  /**
   * Compact conversation history using AI-generated structured summary.
   *
   * Keeps the most recent messages and uses the model to generate an
   * intelligent summary of older messages that preserves critical state:
   * decisions, active tasks, findings, and working context.
   *
   * Falls back to truncation-based summary if AI summarization fails.
   *
   * @returns CompactionResult with before/after statistics
   */
  private async compactHistory(): Promise<CompactionResult> {
    if (!this.model || this.state.messages.length < 10) {
      return {
        compacted: false,
        messagesBefore: this.state.messages.length,
        messagesAfter: this.state.messages.length,
        reason: 'History too small to compact',
      };
    }

    const messagesBefore = this.state.messages.length;
    const keepRecent = 10;
    const oldMessages = this.state.messages.slice(0, -keepRecent);
    const recentMessages = this.state.messages.slice(-keepRecent);

    // Attempt AI-powered summarization
    let summaryText: string;
    try {
      summaryText = await this.generateAISummary(oldMessages);
    } catch {
      // Fallback to truncation-based summary
      summaryText = this.generateFallbackSummary(oldMessages);
    }

    this.state.messages = [
      { role: 'assistant', content: summaryText },
      ...recentMessages,
    ];

    return {
      compacted: true,
      messagesBefore,
      messagesAfter: this.state.messages.length,
    };
  }

  /**
   * Generate an AI-powered structured summary of conversation messages.
   *
   * Asks the model to extract and preserve critical state from the
   * conversation history in a structured format.
   *
   * @param messages - Messages to summarize
   * @returns Structured summary string
   */
  private async generateAISummary(messages: ModelMessage[]): Promise<string> {
    const conversationText = messages.map(msg => {
      const content = typeof msg.content === 'string'
        ? msg.content.substring(0, 2000)
        : JSON.stringify(msg.content).substring(0, 2000);
      return `[${msg.role}]: ${content}`;
    }).join('\n');

    const summarizationPrompt = `Summarize this conversation history into a structured state snapshot. Preserve ALL of the following if present:

1. **Active Tasks**: What tasks are in progress, assigned to whom, their status
2. **Decisions Made**: Key decisions and their rationale
3. **Key Findings**: Important discoveries, patterns, or blockers found
4. **Current Context**: What the agent is currently working on
5. **Pending Items**: Anything awaiting response or follow-up

Be concise but complete. This summary replaces the original messages.

Conversation (${messages.length} messages):
${conversationText}`;

    const generateFn = this._generateTextFn || (generateText as Function);
    const result = await generateFn({
      model: this.model,
      messages: [{ role: 'user', content: summarizationPrompt }],
      maxOutputTokens: 2048,
      temperature: 0.1,
    });

    const summary = result.text || '';
    if (!summary || summary.length < 20) {
      throw new Error('AI summary too short, falling back');
    }

    return `[Compacted State — ${messages.length} messages summarized]\n\n${summary}`;
  }

  /**
   * Generate a truncation-based fallback summary when AI summarization fails.
   *
   * @param messages - Messages to summarize
   * @returns Simple concatenated summary string
   */
  private generateFallbackSummary(messages: ModelMessage[]): string {
    const summaryParts: string[] = [];
    for (const msg of messages) {
      const content = typeof msg.content === 'string'
        ? msg.content.substring(0, 1000)
        : JSON.stringify(msg.content).substring(0, 1000);
      summaryParts.push(`[${msg.role}]: ${content}`);
    }
    return `Previous conversation summary (${messages.length} messages compressed):\n${summaryParts.join('\n')}`;
  }
}
