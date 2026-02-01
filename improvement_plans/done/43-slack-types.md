# Task: Create Slack Integration Types

## Overview

Define TypeScript types for Slack integration, including message structures, event types, and bot configuration. These types form the foundation for bidirectional communication between Slack and the AgentMux orchestrator.

## Priority

**High** - Foundation for Slack integration

## Dependencies

- None (foundation task)

## Files to Create

### 1. Create `backend/src/types/slack.types.ts`

```typescript
/**
 * Slack Integration Types
 *
 * Types for Slack bot integration enabling mobile communication
 * with the AgentMux orchestrator.
 *
 * @module types/slack
 */

/**
 * Slack bot configuration
 */
export interface SlackConfig {
  /** Bot OAuth token (xoxb-...) */
  botToken: string;
  /** App-level token for Socket Mode (xapp-...) */
  appToken: string;
  /** Signing secret for request verification */
  signingSecret: string;
  /** Channel ID for orchestrator notifications */
  defaultChannelId?: string;
  /** Allowed user IDs (empty = all users) */
  allowedUserIds?: string[];
  /** Enable Socket Mode for real-time events */
  socketMode: boolean;
}

/**
 * Slack user information
 */
export interface SlackUser {
  id: string;
  name: string;
  realName?: string;
  email?: string;
  isAdmin?: boolean;
  isOwner?: boolean;
  teamId: string;
}

/**
 * Slack channel information
 */
export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isIm: boolean;  // Direct message
  isMpim: boolean; // Multi-party IM
}

/**
 * Incoming Slack message
 */
export interface SlackIncomingMessage {
  id: string;
  type: 'message' | 'app_mention' | 'command';
  text: string;
  userId: string;
  channelId: string;
  threadTs?: string;  // Thread timestamp for replies
  ts: string;         // Message timestamp
  teamId: string;
  eventTs: string;
  user?: SlackUser;
  channel?: SlackChannel;
}

/**
 * Outgoing Slack message
 */
export interface SlackOutgoingMessage {
  channelId: string;
  text: string;
  threadTs?: string;  // Reply in thread
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
}

/**
 * Slack Block Kit block types
 */
export type SlackBlockType =
  | 'section'
  | 'divider'
  | 'header'
  | 'context'
  | 'actions'
  | 'image';

/**
 * Slack Block Kit block
 */
export interface SlackBlock {
  type: SlackBlockType;
  text?: SlackTextObject;
  fields?: SlackTextObject[];
  accessory?: SlackAccessory;
  elements?: SlackElement[];
  block_id?: string;
}

/**
 * Slack text object (mrkdwn or plain_text)
 */
export interface SlackTextObject {
  type: 'mrkdwn' | 'plain_text';
  text: string;
  emoji?: boolean;
  verbatim?: boolean;
}

/**
 * Slack accessory element
 */
export interface SlackAccessory {
  type: 'button' | 'image' | 'overflow' | 'datepicker' | 'static_select';
  action_id?: string;
  text?: SlackTextObject;
  value?: string;
  url?: string;
  image_url?: string;
  alt_text?: string;
}

/**
 * Slack interactive element
 */
export interface SlackElement {
  type: string;
  action_id?: string;
  text?: SlackTextObject;
  value?: string;
  [key: string]: unknown;
}

/**
 * Slack attachment (legacy but still useful)
 */
export interface SlackAttachment {
  color?: string;
  fallback?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: SlackAttachmentField[];
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

/**
 * Slack attachment field
 */
export interface SlackAttachmentField {
  title: string;
  value: string;
  short?: boolean;
}

/**
 * Slack slash command payload
 */
export interface SlackSlashCommand {
  command: string;
  text: string;
  responseUrl: string;
  triggerId: string;
  userId: string;
  userName: string;
  channelId: string;
  channelName: string;
  teamId: string;
  teamDomain: string;
}

/**
 * Slack event types we handle
 */
export type SlackEventType =
  | 'message'
  | 'app_mention'
  | 'app_home_opened'
  | 'member_joined_channel'
  | 'reaction_added';

/**
 * Slack event wrapper
 */
export interface SlackEvent<T = unknown> {
  type: SlackEventType;
  eventTs: string;
  user?: string;
  channel?: string;
  ts?: string;
  payload: T;
}

/**
 * Message routing destination
 */
export type MessageDestination =
  | { type: 'orchestrator' }
  | { type: 'agent'; agentId: string }
  | { type: 'team'; teamId: string }
  | { type: 'project'; projectId: string };

/**
 * Parsed command from Slack message
 */
export interface ParsedSlackCommand {
  intent: SlackCommandIntent;
  target?: MessageDestination;
  parameters: Record<string, string>;
  rawText: string;
}

/**
 * Recognized command intents
 */
export type SlackCommandIntent =
  | 'status'           // Get status of projects/teams/agents
  | 'assign'           // Assign task to agent/team
  | 'create_task'      // Create a new task
  | 'create_project'   // Create a new project
  | 'list_projects'    // List all projects
  | 'list_teams'       // List all teams
  | 'list_agents'      // List all agents
  | 'pause'            // Pause agent/team
  | 'resume'           // Resume agent/team
  | 'help'             // Show help
  | 'conversation'     // General conversation with orchestrator
  | 'unknown';         // Unrecognized command

/**
 * Slack notification types
 */
export type SlackNotificationType =
  | 'task_completed'
  | 'task_failed'
  | 'task_blocked'
  | 'agent_error'
  | 'agent_question'   // Agent needs clarification
  | 'project_update'
  | 'daily_summary'
  | 'alert';

/**
 * Slack notification payload
 */
export interface SlackNotification {
  type: SlackNotificationType;
  title: string;
  message: string;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  metadata?: {
    projectId?: string;
    teamId?: string;
    agentId?: string;
    taskId?: string;
    errorDetails?: string;
  };
  timestamp: string;
}

/**
 * Conversation thread context
 */
export interface SlackConversationContext {
  threadTs: string;
  channelId: string;
  userId: string;
  conversationId: string;  // Maps to chat conversation
  startedAt: string;
  lastActivityAt: string;
  messageCount: number;
}

/**
 * Slack service status
 */
export interface SlackServiceStatus {
  connected: boolean;
  socketMode: boolean;
  lastEventAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  messagesSent: number;
  messagesReceived: number;
}

/**
 * Valid notification urgency levels
 */
export const NOTIFICATION_URGENCIES = ['low', 'normal', 'high', 'critical'] as const;

/**
 * Command intent patterns for parsing
 */
export const COMMAND_PATTERNS: Record<SlackCommandIntent, RegExp[]> = {
  status: [
    /^(what('s| is) the )?status/i,
    /^how('s| is| are)/i,
    /^(show|get|check) (me )?(the )?(status|progress)/i,
  ],
  assign: [
    /^assign/i,
    /^give .+ to/i,
    /^have .+ (work on|do)/i,
  ],
  create_task: [
    /^create (a )?task/i,
    /^add (a )?task/i,
    /^new task/i,
  ],
  create_project: [
    /^create (a )?project/i,
    /^new project/i,
    /^start (a )?project/i,
  ],
  list_projects: [
    /^(list|show|get) (all )?(the )?projects/i,
    /^what projects/i,
  ],
  list_teams: [
    /^(list|show|get) (all )?(the )?teams/i,
    /^what teams/i,
  ],
  list_agents: [
    /^(list|show|get) (all )?(the )?agents/i,
    /^who('s| is) (working|available)/i,
  ],
  pause: [
    /^pause/i,
    /^stop/i,
    /^hold/i,
  ],
  resume: [
    /^resume/i,
    /^continue/i,
    /^start/i,
    /^unpause/i,
  ],
  help: [
    /^help/i,
    /^what can you do/i,
    /^commands/i,
  ],
  conversation: [/.*/],  // Catch-all for general conversation
  unknown: [],
};

/**
 * Check if user is allowed to interact with the bot
 */
export function isUserAllowed(userId: string, config: SlackConfig): boolean {
  if (!config.allowedUserIds || config.allowedUserIds.length === 0) {
    return true;  // No restrictions
  }
  return config.allowedUserIds.includes(userId);
}

/**
 * Parse command intent from message text
 */
export function parseCommandIntent(text: string): SlackCommandIntent {
  const normalizedText = text.trim().toLowerCase();

  for (const [intent, patterns] of Object.entries(COMMAND_PATTERNS)) {
    if (intent === 'conversation' || intent === 'unknown') continue;

    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) {
        return intent as SlackCommandIntent;
      }
    }
  }

  return 'conversation';  // Default to conversation
}
```

### 2. Create `backend/src/types/slack.types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  SlackConfig,
  SlackIncomingMessage,
  ParsedSlackCommand,
  NOTIFICATION_URGENCIES,
  COMMAND_PATTERNS,
  isUserAllowed,
  parseCommandIntent,
} from './slack.types.js';

describe('Slack Types', () => {
  describe('isUserAllowed', () => {
    it('should allow all users when allowedUserIds is empty', () => {
      const config: SlackConfig = {
        botToken: 'xoxb-test',
        appToken: 'xapp-test',
        signingSecret: 'secret',
        socketMode: true,
        allowedUserIds: [],
      };

      expect(isUserAllowed('U123', config)).toBe(true);
      expect(isUserAllowed('U456', config)).toBe(true);
    });

    it('should allow all users when allowedUserIds is undefined', () => {
      const config: SlackConfig = {
        botToken: 'xoxb-test',
        appToken: 'xapp-test',
        signingSecret: 'secret',
        socketMode: true,
      };

      expect(isUserAllowed('U123', config)).toBe(true);
    });

    it('should only allow specified users', () => {
      const config: SlackConfig = {
        botToken: 'xoxb-test',
        appToken: 'xapp-test',
        signingSecret: 'secret',
        socketMode: true,
        allowedUserIds: ['U123', 'U456'],
      };

      expect(isUserAllowed('U123', config)).toBe(true);
      expect(isUserAllowed('U456', config)).toBe(true);
      expect(isUserAllowed('U789', config)).toBe(false);
    });
  });

  describe('parseCommandIntent', () => {
    it('should parse status commands', () => {
      expect(parseCommandIntent('status')).toBe('status');
      expect(parseCommandIntent("what's the status")).toBe('status');
      expect(parseCommandIntent('how is the project going')).toBe('status');
      expect(parseCommandIntent('show me the progress')).toBe('status');
    });

    it('should parse assign commands', () => {
      expect(parseCommandIntent('assign this to developer')).toBe('assign');
      expect(parseCommandIntent('give the task to Alice')).toBe('assign');
      expect(parseCommandIntent('have the team work on this')).toBe('assign');
    });

    it('should parse create task commands', () => {
      expect(parseCommandIntent('create a task')).toBe('create_task');
      expect(parseCommandIntent('add task for feature X')).toBe('create_task');
      expect(parseCommandIntent('new task: fix bug')).toBe('create_task');
    });

    it('should parse list commands', () => {
      expect(parseCommandIntent('list projects')).toBe('list_projects');
      expect(parseCommandIntent('show all teams')).toBe('list_teams');
      expect(parseCommandIntent("who's working")).toBe('list_agents');
    });

    it('should parse help commands', () => {
      expect(parseCommandIntent('help')).toBe('help');
      expect(parseCommandIntent('what can you do')).toBe('help');
    });

    it('should default to conversation for unrecognized text', () => {
      expect(parseCommandIntent('hello there')).toBe('conversation');
      expect(parseCommandIntent('I was thinking about...')).toBe('conversation');
    });
  });

  describe('NOTIFICATION_URGENCIES', () => {
    it('should contain all urgency levels', () => {
      expect(NOTIFICATION_URGENCIES).toContain('low');
      expect(NOTIFICATION_URGENCIES).toContain('normal');
      expect(NOTIFICATION_URGENCIES).toContain('high');
      expect(NOTIFICATION_URGENCIES).toContain('critical');
      expect(NOTIFICATION_URGENCIES.length).toBe(4);
    });
  });

  describe('COMMAND_PATTERNS', () => {
    it('should have patterns for all intents', () => {
      expect(COMMAND_PATTERNS.status.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.assign.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.help.length).toBeGreaterThan(0);
    });
  });
});
```

## Acceptance Criteria

- [ ] `backend/src/types/slack.types.ts` created with all interfaces
- [ ] `backend/src/types/slack.types.test.ts` created with tests
- [ ] Types cover incoming messages, outgoing messages, blocks, attachments
- [ ] Command parsing types and utilities included
- [ ] Notification types for proactive updates defined
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Unit tests for `isUserAllowed` function
- Unit tests for `parseCommandIntent` function
- Type guard tests if added

## Estimated Effort

15 minutes

## Notes

- Types based on Slack Bolt SDK patterns
- Block Kit types simplified for common use cases
- Command patterns can be extended as needed
- Consider adding more specific block types for rich messages
