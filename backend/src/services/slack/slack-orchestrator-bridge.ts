/**
 * Slack-Orchestrator Bridge
 *
 * Routes messages between Slack and the AgentMux orchestrator,
 * enabling mobile control of AI teams.
 *
 * @module services/slack/bridge
 */

import { EventEmitter } from 'events';
import { getSlackService, SlackService } from './slack.service.js';
import { getChatService, ChatService } from '../chat/chat.service.js';
import {
  isOrchestratorActive,
  getOrchestratorOfflineMessage,
} from '../orchestrator/index.js';
import {
  SlackIncomingMessage,
  SlackNotification,
  SlackConversationContext,
  ParsedSlackCommand,
  parseCommandIntent,
} from '../../types/slack.types.js';
import type { MessageQueueService } from '../messaging/message-queue.service.js';
import type { SlackThreadStoreService } from './slack-thread-store.service.js';
import { ORCHESTRATOR_SESSION_NAME, MESSAGE_QUEUE_CONSTANTS } from '../../constants.js';

/**
 * Bridge configuration
 */
export interface SlackBridgeConfig {
  /** Orchestrator session name */
  orchestratorSession: string;
  /** Enable typing indicators */
  showTypingIndicator: boolean;
  /** Maximum response length before truncation */
  maxResponseLength: number;
  /** Enable proactive notifications */
  enableNotifications: boolean;
  /** Response timeout in ms */
  responseTimeoutMs: number;
}

/**
 * Default bridge configuration
 */
const DEFAULT_CONFIG: SlackBridgeConfig = {
  orchestratorSession: ORCHESTRATOR_SESSION_NAME,
  showTypingIndicator: true,
  maxResponseLength: 3000,
  enableNotifications: true,
  responseTimeoutMs: MESSAGE_QUEUE_CONSTANTS.DEFAULT_MESSAGE_TIMEOUT + 5000,
};

/**
 * Slack-Orchestrator Bridge singleton
 */
let bridgeInstance: SlackOrchestratorBridge | null = null;

/**
 * SlackOrchestratorBridge class
 *
 * Routes messages between Slack and the AgentMux orchestrator.
 * Handles command parsing, response formatting, and proactive notifications.
 *
 * @example
 * ```typescript
 * const bridge = getSlackOrchestratorBridge();
 * await bridge.initialize();
 *
 * // Send notification when task completes
 * await bridge.notifyTaskCompleted('Fix bug', 'Developer', 'MyProject');
 * ```
 */
export class SlackOrchestratorBridge extends EventEmitter {
  private slackService: SlackService;
  private chatService: ChatService;
  private messageQueueService: MessageQueueService | null = null;
  private threadStore: SlackThreadStoreService | null = null;
  private config: SlackBridgeConfig;
  private initialized = false;
  /** Track if we've already logged the missing scope warning */
  private loggedMissingScope = false;

  /**
   * Create a new SlackOrchestratorBridge
   *
   * @param config - Partial configuration to override defaults
   */
  constructor(config: Partial<SlackBridgeConfig> = {}) {
    super();
    this.slackService = getSlackService();
    this.chatService = getChatService();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the bridge
   *
   * Sets up message listeners and orchestrator subscriptions.
   *
   * @returns Promise that resolves when initialized
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Listen for Slack messages
    this.slackService.on('message', this.handleSlackMessage.bind(this));

    this.initialized = true;
    console.log('[SlackBridge] Initialized');
  }

  /**
   * Check if bridge is initialized
   *
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Set the message queue service for enqueuing messages to the orchestrator.
   * Called during server initialization.
   *
   * @param service - The MessageQueueService instance
   */
  setMessageQueueService(service: MessageQueueService): void {
    this.messageQueueService = service;
  }

  /**
   * Set the Slack thread store service for persisting thread conversations.
   * Called during server initialization.
   *
   * @param store - The SlackThreadStoreService instance
   */
  setSlackThreadStore(store: SlackThreadStoreService): void {
    this.threadStore = store;
  }

  /**
   * Get current configuration
   *
   * @returns A copy of the current configuration
   */
  getConfig(): SlackBridgeConfig {
    return { ...this.config };
  }

  /**
   * Handle incoming Slack message
   *
   * Parses the command, routes to appropriate handler, and sends response.
   *
   * @param message - Incoming Slack message
   */
  private async handleSlackMessage(message: SlackIncomingMessage): Promise<void> {
    console.log(`[SlackBridge] Received message: ${message.text.substring(0, 50)}...`);

    try {
      // Get or create conversation context
      const context = this.slackService.getConversationContext(
        message.threadTs || message.ts,
        message.channelId,
        message.userId
      );

      // Store inbound message in thread file
      if (this.threadStore) {
        const threadTs = message.threadTs || message.ts;
        try {
          const userName = message.user?.realName || message.user?.name || message.userId;
          await this.threadStore.appendUserMessage(message.channelId, threadTs, userName, message.text);
        } catch (err) {
          console.warn('[SlackBridge] Failed to store thread message:', err instanceof Error ? err.message : String(err));
        }
      }

      // Parse command intent
      const command = this.parseCommand(message.text);

      // Add typing indicator
      if (this.config.showTypingIndicator) {
        await this.addTypingIndicator(message);
      }

      // Handle based on intent
      let response: string;
      switch (command.intent) {
        case 'help':
          response = this.getHelpMessage();
          break;
        case 'status':
          response = await this.handleStatusCommand(command, context);
          break;
        case 'list_projects':
        case 'list_teams':
        case 'list_agents':
          response = await this.handleListCommand(command, context);
          break;
        case 'pause':
        case 'resume':
          response = await this.handleControlCommand(command, context);
          break;
        default:
          // Send to orchestrator for processing
          response = await this.sendToOrchestrator(message.text, context);
      }

      // Send response back to Slack
      await this.sendSlackResponse(message, response);

      // Replace typing indicator with checkmark
      if (this.config.showTypingIndicator) {
        await this.markComplete(message);
      }

      this.emit('message_handled', { message, response });
    } catch (error) {
      console.error('[SlackBridge] Error handling message:', error);
      await this.sendErrorResponse(message, error as Error);
      this.emit('error', error);
    }
  }

  /**
   * Parse command from message text
   *
   * Cleans the message and extracts the command intent.
   *
   * @param text - Raw message text
   * @returns Parsed command with intent and parameters
   */
  parseCommand(text: string): ParsedSlackCommand {
    // Remove bot mention if present
    const cleanedText = text.replace(/<@[A-Z0-9]+>/g, '').trim();

    return {
      intent: parseCommandIntent(cleanedText),
      rawText: cleanedText,
      parameters: this.extractParameters(cleanedText),
    };
  }

  /**
   * Extract parameters from command text
   *
   * @param text - Command text
   * @returns Extracted parameters
   */
  private extractParameters(text: string): Record<string, string> {
    const params: Record<string, string> = {};

    // Extract quoted strings
    const quotedMatch = text.match(/"([^"]+)"/);
    if (quotedMatch) {
      params.quoted = quotedMatch[1];
    }

    // Extract @mentions
    const mentionMatch = text.match(/@(\w+)/);
    if (mentionMatch) {
      params.mention = mentionMatch[1];
    }

    // Extract project/team names after keywords
    const forMatch = text.match(/(?:for|on|in)\s+(\w+)/i);
    if (forMatch) {
      params.target = forMatch[1];
    }

    return params;
  }

  /**
   * Get help message
   *
   * @returns Formatted help message for Slack
   */
  getHelpMessage(): string {
    return `*AgentMux Commands:*

:clipboard: *Status*
• \`status\` - Get overall status
• \`status [project name]\` - Get project status
• \`how is [team] doing\` - Get team progress

:page_facing_up: *Lists*
• \`list projects\` - Show all projects
• \`list teams\` - Show all teams
• \`list agents\` or \`who's working\` - Show active agents

:gear: *Actions*
• \`assign [task] to [agent/team]\` - Assign work
• \`create task: [description]\` - Create a new task
• \`pause [agent/team]\` - Pause work
• \`resume [agent/team]\` - Resume work

:speech_balloon: *Chat*
Just type naturally to chat with the orchestrator!`;
  }

  /**
   * Handle status command
   *
   * @param command - Parsed command
   * @param context - Conversation context
   * @returns Status response
   */
  private async handleStatusCommand(
    command: ParsedSlackCommand,
    context: SlackConversationContext
  ): Promise<string> {
    return await this.sendToOrchestrator(
      `Give me a brief status update. ${command.rawText}`,
      context
    );
  }

  /**
   * Handle list commands (projects, teams, agents)
   *
   * @param command - Parsed command
   * @param context - Conversation context
   * @returns List response
   */
  private async handleListCommand(
    command: ParsedSlackCommand,
    context: SlackConversationContext
  ): Promise<string> {
    const prompts: Record<string, string> = {
      list_projects: 'List all active projects with their status.',
      list_teams: 'List all teams and their current assignments.',
      list_agents: 'List all agents, their status, and what they are working on.',
    };

    return await this.sendToOrchestrator(
      prompts[command.intent] || command.rawText,
      context
    );
  }

  /**
   * Handle control commands (pause, resume)
   *
   * @param command - Parsed command
   * @param context - Conversation context
   * @returns Control response
   */
  private async handleControlCommand(
    command: ParsedSlackCommand,
    context: SlackConversationContext
  ): Promise<string> {
    const action = command.intent === 'pause' ? 'Pause' : 'Resume';
    const target = command.parameters.target || command.parameters.mention || 'all agents';

    return await this.sendToOrchestrator(`${action} ${target}.`, context);
  }

  /**
   * Send message to orchestrator via the message queue and wait for response.
   *
   * Checks if the orchestrator is active before sending. Enqueues the message
   * and waits for the response via a resolve callback injected into sourceMetadata.
   *
   * @param message - Message to send
   * @param context - Optional conversation context
   * @returns Orchestrator response or offline/error message
   */
  private async sendToOrchestrator(
    message: string,
    context?: SlackConversationContext
  ): Promise<string> {
    try {
      // Check if orchestrator is active before attempting to send
      const isActive = await isOrchestratorActive();
      if (!isActive) {
        console.log('[SlackBridge] Orchestrator is not active, returning offline message');
        return getOrchestratorOfflineMessage(true);
      }

      // Check if message queue service is available
      if (!this.messageQueueService) {
        console.error('[SlackBridge] Message queue service not configured');
        return 'The Slack bridge is not properly configured. Please restart the server.';
      }

      // Enrich message with thread file path hint for orchestrator context
      let enrichedMessage = message;
      if (this.threadStore && context) {
        const threadFilePath = this.threadStore.getThreadFilePath(context.channelId, context.threadTs);
        enrichedMessage = `${message}\n\n[Thread context file: ${threadFilePath}]`;
      }

      // Send message via chat service to store it
      const result = await this.chatService.sendMessage({
        content: enrichedMessage,
        conversationId: context?.conversationId,
        metadata: {
          source: 'slack',
          userId: context?.userId,
          channelId: context?.channelId,
        },
      });

      // Enqueue the message with a resolve callback for response routing.
      // The QueueProcessorService will call slackResolve() when the
      // orchestrator responds, unblocking this promise.
      const response = await new Promise<string>((resolve) => {
        const timeoutId = setTimeout(() => {
          resolve('The orchestrator is taking longer than expected. Please try again.');
        }, this.config.responseTimeoutMs);

        try {
          this.messageQueueService!.enqueue({
            content: enrichedMessage,
            conversationId: result.conversation.id,
            source: 'slack',
            sourceMetadata: {
              slackResolve: (resp: string) => {
                clearTimeout(timeoutId);
                resolve(resp);
              },
              userId: context?.userId,
              channelId: context?.channelId,
            },
          });
        } catch (enqueueErr) {
          clearTimeout(timeoutId);
          resolve(`Failed to enqueue message: ${enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr)}`);
        }
      });

      return response;
    } catch (error) {
      console.error('[SlackBridge] Error sending to orchestrator:', error);
      throw error;
    }
  }

  /**
   * Add typing indicator to message
   *
   * @param message - Message to add indicator to
   */
  private async addTypingIndicator(message: SlackIncomingMessage): Promise<void> {
    try {
      await this.slackService.addReaction(message.channelId, message.ts, 'eyes');
    } catch (error) {
      // Non-critical - reactions require 'reactions:write' scope which is optional
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('missing_scope')) {
        // Only log once about missing scope, not on every message
        if (!this.loggedMissingScope) {
          console.warn('[SlackBridge] Reactions disabled - add reactions:write scope to Slack app for typing indicators');
          this.loggedMissingScope = true;
        }
      } else {
        console.warn('[SlackBridge] Could not add typing indicator:', errorMessage);
      }
    }
  }

  /**
   * Mark message as complete
   *
   * @param message - Message to mark complete
   */
  private async markComplete(message: SlackIncomingMessage): Promise<void> {
    try {
      await this.slackService.addReaction(message.channelId, message.ts, 'white_check_mark');
    } catch (error) {
      // Non-critical - reactions require 'reactions:write' scope which is optional
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('missing_scope')) {
        console.warn('[SlackBridge] Could not add completion indicator:', errorMessage);
      }
      // Silent fail for missing_scope since we already logged about it
    }
  }

  /**
   * Send response back to Slack
   *
   * @param originalMessage - Original incoming message
   * @param response - Response content
   */
  private async sendSlackResponse(
    originalMessage: SlackIncomingMessage,
    response: string
  ): Promise<void> {
    // Truncate if needed
    let truncatedResponse = response;
    if (response.length > this.config.maxResponseLength) {
      truncatedResponse =
        response.substring(0, this.config.maxResponseLength) +
        '\n\n_...response truncated. Ask for more details if needed._';
    }

    // Format for Slack
    const formattedResponse = this.formatForSlack(truncatedResponse);

    await this.slackService.sendMessage({
      channelId: originalMessage.channelId,
      text: formattedResponse,
      threadTs: originalMessage.threadTs || originalMessage.ts,
    });

    // Store outbound reply in thread file
    if (this.threadStore) {
      const threadTs = originalMessage.threadTs || originalMessage.ts;
      try {
        await this.threadStore.appendOrchestratorReply(originalMessage.channelId, threadTs, response);
      } catch (err) {
        console.warn('[SlackBridge] Failed to store thread reply:', err instanceof Error ? err.message : String(err));
      }
    }
  }

  /**
   * Send error response
   *
   * @param message - Original message
   * @param error - Error that occurred
   */
  private async sendErrorResponse(
    message: SlackIncomingMessage,
    error: Error
  ): Promise<void> {
    await this.slackService.sendMessage({
      channelId: message.channelId,
      text: `:warning: Sorry, I encountered an error: ${error.message}`,
      threadTs: message.threadTs || message.ts,
    });
  }

  /**
   * Format response for Slack
   *
   * Converts markdown to Slack-compatible formatting.
   *
   * @param text - Text to format
   * @returns Formatted text
   */
  formatForSlack(text: string): string {
    // Convert markdown headers to bold
    let formatted = text.replace(/^### (.+)$/gm, '*$1*');
    formatted = formatted.replace(/^## (.+)$/gm, '*$1*');
    formatted = formatted.replace(/^# (.+)$/gm, '*$1*');

    // Slack already supports backtick code formatting
    // Convert code blocks (simplified)
    formatted = formatted.replace(/```[\w]*\n([\s\S]*?)```/g, '```$1```');

    return formatted;
  }

  /**
   * Send proactive notification to Slack
   *
   * @param notification - Notification to send
   */
  async sendNotification(notification: SlackNotification): Promise<void> {
    if (!this.config.enableNotifications) return;
    await this.slackService.sendNotification(notification);
  }

  /**
   * Notify about task completion
   *
   * @param taskTitle - Title of completed task
   * @param agentName - Name of agent that completed the task
   * @param projectName - Name of the project
   */
  async notifyTaskCompleted(
    taskTitle: string,
    agentName: string,
    projectName: string
  ): Promise<void> {
    await this.sendNotification({
      type: 'task_completed',
      title: 'Task Completed',
      message: `*${taskTitle}*\n\nCompleted by ${agentName} on project ${projectName}`,
      urgency: 'normal',
      timestamp: new Date().toISOString(),
      metadata: { projectId: projectName },
    });
  }

  /**
   * Notify about agent needing assistance
   *
   * @param agentName - Name of agent with question
   * @param question - The question from the agent
   * @param projectName - Name of the project
   */
  async notifyAgentQuestion(
    agentName: string,
    question: string,
    projectName: string
  ): Promise<void> {
    await this.sendNotification({
      type: 'agent_question',
      title: 'Agent Needs Input',
      message: `*${agentName}* has a question:\n\n_${question}_`,
      urgency: 'high',
      timestamp: new Date().toISOString(),
      metadata: { agentId: agentName, projectId: projectName },
    });
  }

  /**
   * Notify about errors
   *
   * @param errorMessage - Error message
   * @param agentName - Optional agent name
   * @param projectName - Optional project name
   */
  async notifyError(
    errorMessage: string,
    agentName?: string,
    projectName?: string
  ): Promise<void> {
    await this.sendNotification({
      type: 'agent_error',
      title: 'Error Occurred',
      message: errorMessage,
      urgency: 'critical',
      timestamp: new Date().toISOString(),
      metadata: { agentId: agentName, projectId: projectName },
    });
  }

  /**
   * Notify about daily summary
   *
   * @param summary - Summary content
   */
  async notifyDailySummary(summary: string): Promise<void> {
    await this.sendNotification({
      type: 'daily_summary',
      title: 'Daily Summary',
      message: summary,
      urgency: 'low',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Get bridge singleton
 *
 * @returns SlackOrchestratorBridge instance
 */
export function getSlackOrchestratorBridge(): SlackOrchestratorBridge {
  if (!bridgeInstance) {
    bridgeInstance = new SlackOrchestratorBridge();
  }
  return bridgeInstance;
}

/**
 * Reset bridge (for testing)
 */
export function resetSlackOrchestratorBridge(): void {
  bridgeInstance = null;
}
