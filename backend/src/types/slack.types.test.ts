/**
 * Tests for Slack Type Definitions
 *
 * @module types/slack.types.test
 */

// Jest globals are available automatically
import {
  SlackConfig,
  SlackIncomingMessage,
  SlackOutgoingMessage,
  SlackBlock,
  SlackNotification,
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

    it('should parse create project commands', () => {
      expect(parseCommandIntent('create a project')).toBe('create_project');
      expect(parseCommandIntent('new project')).toBe('create_project');
      expect(parseCommandIntent('start a project')).toBe('create_project');
    });

    it('should parse list commands', () => {
      expect(parseCommandIntent('list projects')).toBe('list_projects');
      expect(parseCommandIntent('show all teams')).toBe('list_teams');
      expect(parseCommandIntent("who's working")).toBe('list_agents');
    });

    it('should parse pause and resume commands', () => {
      expect(parseCommandIntent('pause')).toBe('pause');
      expect(parseCommandIntent('stop')).toBe('pause');
      expect(parseCommandIntent('resume')).toBe('resume');
      expect(parseCommandIntent('continue')).toBe('resume');
    });

    it('should parse help commands', () => {
      expect(parseCommandIntent('help')).toBe('help');
      expect(parseCommandIntent('what can you do')).toBe('help');
      expect(parseCommandIntent('commands')).toBe('help');
    });

    it('should default to conversation for unrecognized text', () => {
      expect(parseCommandIntent('hello there')).toBe('conversation');
      expect(parseCommandIntent('I was thinking about...')).toBe('conversation');
      expect(parseCommandIntent('random text here')).toBe('conversation');
    });

    it('should handle case insensitivity', () => {
      expect(parseCommandIntent('STATUS')).toBe('status');
      expect(parseCommandIntent('HELP')).toBe('help');
      expect(parseCommandIntent('Create A Task')).toBe('create_task');
    });

    it('should handle whitespace', () => {
      expect(parseCommandIntent('  status  ')).toBe('status');
      expect(parseCommandIntent('\thelp\n')).toBe('help');
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

    it('should be readonly', () => {
      // TypeScript const assertion makes it readonly
      const urgencies: readonly string[] = NOTIFICATION_URGENCIES;
      expect(urgencies).toBeDefined();
    });
  });

  describe('COMMAND_PATTERNS', () => {
    it('should have patterns for all intents', () => {
      expect(COMMAND_PATTERNS.status.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.assign.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.create_task.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.create_project.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.list_projects.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.list_teams.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.list_agents.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.pause.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.resume.length).toBeGreaterThan(0);
      expect(COMMAND_PATTERNS.help.length).toBeGreaterThan(0);
    });

    it('should have catch-all for conversation', () => {
      expect(COMMAND_PATTERNS.conversation.length).toBe(1);
      expect(COMMAND_PATTERNS.conversation[0].test('anything')).toBe(true);
    });

    it('should have empty array for unknown', () => {
      expect(COMMAND_PATTERNS.unknown.length).toBe(0);
    });
  });

  describe('Type Interfaces', () => {
    it('should allow creating a valid SlackConfig', () => {
      const config: SlackConfig = {
        botToken: 'xoxb-12345',
        appToken: 'xapp-12345',
        signingSecret: 'secret123',
        socketMode: true,
        defaultChannelId: 'C12345',
        allowedUserIds: ['U12345'],
      };

      expect(config.botToken).toBe('xoxb-12345');
      expect(config.socketMode).toBe(true);
    });

    it('should allow creating a valid SlackIncomingMessage', () => {
      const message: SlackIncomingMessage = {
        id: 'msg-123',
        type: 'message',
        text: 'Hello world',
        userId: 'U12345',
        channelId: 'C12345',
        ts: '1234567890.123456',
        teamId: 'T12345',
        eventTs: '1234567890.123456',
      };

      expect(message.type).toBe('message');
      expect(message.text).toBe('Hello world');
    });

    it('should allow creating a valid SlackOutgoingMessage', () => {
      const message: SlackOutgoingMessage = {
        channelId: 'C12345',
        text: 'Hello from bot',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Bold text*',
            },
          },
        ],
      };

      expect(message.channelId).toBe('C12345');
      expect(message.blocks?.length).toBe(1);
    });

    it('should allow creating a valid SlackNotification', () => {
      const notification: SlackNotification = {
        type: 'task_completed',
        title: 'Task Done',
        message: 'The task has been completed successfully',
        urgency: 'normal',
        metadata: {
          taskId: 'task-123',
          projectId: 'proj-123',
        },
        timestamp: new Date().toISOString(),
      };

      expect(notification.type).toBe('task_completed');
      expect(notification.urgency).toBe('normal');
    });

    it('should allow creating a valid ParsedSlackCommand', () => {
      const command: ParsedSlackCommand = {
        intent: 'status',
        target: { type: 'project', projectId: 'proj-123' },
        parameters: { verbose: 'true' },
        rawText: 'status project proj-123',
      };

      expect(command.intent).toBe('status');
      expect(command.target?.type).toBe('project');
    });
  });
});
