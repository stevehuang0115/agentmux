# Task: Create Slack-Orchestrator Bridge

## Overview

Create a bridge service that connects Slack messages to the Crewly orchestrator. This service routes incoming Slack commands to the orchestrator, formats responses for Slack, and sends proactive notifications about project/team status.

## Priority

**High** - Enables core Slack-to-Orchestrator communication

## Dependencies

- `43-slack-types.md` - Slack types
- `44-slack-service.md` - Slack service for messaging
- Chat service must exist (from previous tasks)

## Files to Create

### 1. Create `backend/src/services/slack/slack-orchestrator-bridge.ts`

```typescript
/**
 * Slack-Orchestrator Bridge
 *
 * Routes messages between Slack and the Crewly orchestrator,
 * enabling mobile control of AI teams.
 *
 * @module services/slack/bridge
 */

import { EventEmitter } from 'events';
import { getSlackService, SlackService } from './slack.service.js';
import { getChatService } from '../chat/chat.service.js';
import { getTerminalService } from '../terminal.service.js';
import {
  SlackIncomingMessage,
  SlackOutgoingMessage,
  SlackNotification,
  SlackConversationContext,
  ParsedSlackCommand,
  parseCommandIntent,
  SlackCommandIntent,
  SlackBlock,
} from '../../types/slack.types.js';
import { ChatMessage } from '../../types/chat.types.js';
import { CREWLY_CONSTANTS } from '../../../config/index.js';

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
}

const DEFAULT_CONFIG: SlackBridgeConfig = {
  orchestratorSession: CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
  showTypingIndicator: true,
  maxResponseLength: 3000,
  enableNotifications: true,
};

/**
 * Slack-Orchestrator Bridge singleton
 */
let bridgeInstance: SlackOrchestratorBridge | null = null;

/**
 * SlackOrchestratorBridge class
 */
export class SlackOrchestratorBridge extends EventEmitter {
  private slackService: SlackService;
  private config: SlackBridgeConfig;
  private pendingResponses: Map<string, {
    channelId: string;
    threadTs: string;
    messageTs: string;
    startTime: number;
  }> = new Map();

  constructor(config: Partial<SlackBridgeConfig> = {}) {
    super();
    this.slackService = getSlackService();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the bridge
   */
  async initialize(): Promise<void> {
    // Listen for Slack messages
    this.slackService.on('message', this.handleSlackMessage.bind(this));

    // Listen for orchestrator responses via terminal output
    this.subscribeToOrchestratorResponses();

    console.log('[SlackBridge] Initialized');
  }

  /**
   * Handle incoming Slack message
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

      // Parse command intent
      const command = this.parseCommand(message.text);

      // Add typing indicator
      if (this.config.showTypingIndicator) {
        await this.slackService.addReaction(message.channelId, message.ts, 'eyes');
      }

      // Handle based on intent
      let response: string;
      switch (command.intent) {
        case 'help':
          response = this.getHelpMessage();
          break;
        case 'status':
          response = await this.handleStatusCommand(command);
          break;
        case 'list_projects':
        case 'list_teams':
        case 'list_agents':
          response = await this.handleListCommand(command);
          break;
        default:
          // Send to orchestrator for processing
          response = await this.sendToOrchestrator(message.text, context);
      }

      // Send response back to Slack
      await this.sendSlackResponse(message, response, context);

      // Remove typing indicator
      if (this.config.showTypingIndicator) {
        await this.slackService.addReaction(message.channelId, message.ts, 'white_check_mark');
      }

    } catch (error) {
      console.error('[SlackBridge] Error handling message:', error);
      await this.sendErrorResponse(message, error as Error);
    }
  }

  /**
   * Parse command from message text
   */
  private parseCommand(text: string): ParsedSlackCommand {
    // Remove bot mention if present
    const cleanedText = text.replace(/<@[A-Z0-9]+>/g, '').trim();

    return {
      intent: parseCommandIntent(cleanedText),
      rawText: cleanedText,
      parameters: {},
    };
  }

  /**
   * Get help message
   */
  private getHelpMessage(): string {
    return `*Crewly Commands:*

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
   */
  private async handleStatusCommand(command: ParsedSlackCommand): Promise<string> {
    // Send to orchestrator with status-focused prompt
    return await this.sendToOrchestrator(
      `Give me a brief status update. ${command.rawText}`,
      undefined
    );
  }

  /**
   * Handle list commands
   */
  private async handleListCommand(command: ParsedSlackCommand): Promise<string> {
    const prompts: Record<string, string> = {
      list_projects: 'List all active projects with their status.',
      list_teams: 'List all teams and their current assignments.',
      list_agents: 'List all agents, their status, and what they are working on.',
    };

    return await this.sendToOrchestrator(
      prompts[command.intent] || command.rawText,
      undefined
    );
  }

  /**
   * Send message to orchestrator and get response
   */
  private async sendToOrchestrator(
    message: string,
    context?: SlackConversationContext
  ): Promise<string> {
    const terminalService = getTerminalService();
    const chatService = getChatService();

    // Create chat message
    const chatMessage: Partial<ChatMessage> = {
      from: {
        type: 'user',
        id: context?.userId || 'slack-user',
        name: 'Slack User',
      },
      content: message,
      contentType: 'text',
    };

    // Send to orchestrator via chat service
    const conversation = await chatService.sendMessage(
      context?.conversationId || 'slack-default',
      chatMessage as ChatMessage
    );

    // Wait for orchestrator response (with timeout)
    const response = await this.waitForOrchestratorResponse(
      conversation.id,
      30000 // 30 second timeout
    );

    return response;
  }

  /**
   * Wait for orchestrator response
   */
  private async waitForOrchestratorResponse(
    conversationId: string,
    timeoutMs: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const chatService = getChatService();
      const startTime = Date.now();

      const checkResponse = async () => {
        // Check if we have a response
        const messages = await chatService.getMessages(conversationId);
        const orchestratorMessages = messages.filter(
          m => m.from.type === 'orchestrator' &&
          new Date(m.timestamp).getTime() > startTime
        );

        if (orchestratorMessages.length > 0) {
          const latestResponse = orchestratorMessages[orchestratorMessages.length - 1];
          resolve(latestResponse.content);
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          resolve('The orchestrator is taking longer than expected. Please try again.');
          return;
        }

        // Check again in 500ms
        setTimeout(checkResponse, 500);
      };

      checkResponse();
    });
  }

  /**
   * Send response back to Slack
   */
  private async sendSlackResponse(
    originalMessage: SlackIncomingMessage,
    response: string,
    context: SlackConversationContext
  ): Promise<void> {
    // Truncate if needed
    let truncatedResponse = response;
    if (response.length > this.config.maxResponseLength) {
      truncatedResponse = response.substring(0, this.config.maxResponseLength) +
        '\n\n_...response truncated. Ask for more details if needed._';
    }

    // Format for Slack (convert markdown)
    const formattedResponse = this.formatForSlack(truncatedResponse);

    await this.slackService.sendMessage({
      channelId: originalMessage.channelId,
      text: formattedResponse,
      threadTs: originalMessage.threadTs || originalMessage.ts,
    });
  }

  /**
   * Send error response
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
   */
  private formatForSlack(text: string): string {
    // Convert markdown headers to bold
    let formatted = text.replace(/^### (.+)$/gm, '*$1*');
    formatted = formatted.replace(/^## (.+)$/gm, '*$1*');
    formatted = formatted.replace(/^# (.+)$/gm, '*$1*');

    // Convert inline code
    formatted = formatted.replace(/`([^`]+)`/g, '`$1`');

    // Convert code blocks (simplified)
    formatted = formatted.replace(/```[\w]*\n([\s\S]*?)```/g, '```$1```');

    return formatted;
  }

  /**
   * Subscribe to orchestrator terminal responses
   */
  private subscribeToOrchestratorResponses(): void {
    // This could subscribe to terminal output events
    // to capture orchestrator responses in real-time
    // Implementation depends on existing terminal service
  }

  /**
   * Send proactive notification to Slack
   */
  async sendNotification(notification: SlackNotification): Promise<void> {
    if (!this.config.enableNotifications) return;
    await this.slackService.sendNotification(notification);
  }

  /**
   * Notify about task completion
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
}

/**
 * Get bridge singleton
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
```

### 2. Update `backend/src/services/slack/index.ts`

```typescript
export { SlackService, getSlackService, resetSlackService } from './slack.service.js';
export {
  SlackOrchestratorBridge,
  getSlackOrchestratorBridge,
  resetSlackOrchestratorBridge,
} from './slack-orchestrator-bridge.js';
```

### 3. Create `backend/src/services/slack/slack-orchestrator-bridge.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SlackOrchestratorBridge,
  getSlackOrchestratorBridge,
  resetSlackOrchestratorBridge,
} from './slack-orchestrator-bridge.js';
import { resetSlackService } from './slack.service.js';

// Mock dependencies
vi.mock('./slack.service.js', () => ({
  getSlackService: vi.fn(() => ({
    on: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue('1234567890.123456'),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    getConversationContext: vi.fn(() => ({
      threadTs: 'thread-1',
      channelId: 'C123',
      userId: 'U456',
      conversationId: 'conv-1',
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      messageCount: 1,
    })),
  })),
  resetSlackService: vi.fn(),
}));

vi.mock('../chat/chat.service.js', () => ({
  getChatService: vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue({ id: 'conv-1' }),
    getMessages: vi.fn().mockResolvedValue([
      {
        from: { type: 'orchestrator' },
        content: 'Test response',
        timestamp: new Date().toISOString(),
      },
    ]),
  })),
}));

vi.mock('../terminal.service.js', () => ({
  getTerminalService: vi.fn(() => ({})),
}));

describe('SlackOrchestratorBridge', () => {
  beforeEach(() => {
    resetSlackOrchestratorBridge();
  });

  afterEach(() => {
    resetSlackOrchestratorBridge();
    vi.clearAllMocks();
  });

  describe('getSlackOrchestratorBridge', () => {
    it('should return singleton instance', () => {
      const bridge1 = getSlackOrchestratorBridge();
      const bridge2 = getSlackOrchestratorBridge();
      expect(bridge1).toBe(bridge2);
    });
  });

  describe('initialize', () => {
    it('should subscribe to slack messages', async () => {
      const bridge = getSlackOrchestratorBridge();
      await bridge.initialize();
      // Should not throw
    });
  });

  describe('notifications', () => {
    it('should send task completed notification', async () => {
      const bridge = getSlackOrchestratorBridge();
      await bridge.initialize();

      await bridge.notifyTaskCompleted(
        'Fix login bug',
        'Developer Agent',
        'MyApp'
      );
      // Should not throw
    });

    it('should send agent question notification', async () => {
      const bridge = getSlackOrchestratorBridge();
      await bridge.initialize();

      await bridge.notifyAgentQuestion(
        'Developer',
        'Should I use REST or GraphQL?',
        'MyApp'
      );
      // Should not throw
    });

    it('should send error notification', async () => {
      const bridge = getSlackOrchestratorBridge();
      await bridge.initialize();

      await bridge.notifyError('Build failed', 'CI Agent', 'MyApp');
      // Should not throw
    });
  });
});
```

## Acceptance Criteria

- [ ] Bridge service connects Slack messages to orchestrator
- [ ] Command parsing routes to appropriate handlers
- [ ] Help command returns formatted help message
- [ ] Status commands query orchestrator
- [ ] General messages passed to orchestrator as conversation
- [ ] Responses formatted for Slack markdown
- [ ] Typing indicators work
- [ ] Proactive notifications send to Slack
- [ ] Error handling with user-friendly messages
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Unit tests with mocked services
- Command parsing tests
- Response formatting tests
- Notification tests

## Estimated Effort

45 minutes

## Notes

- Bridge pattern decouples Slack from orchestrator
- Conversation context maintains thread continuity
- Consider adding message queue for high volume
- Response timeout prevents hanging requests
