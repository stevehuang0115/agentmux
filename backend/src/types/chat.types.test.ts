/**
 * Chat Types Tests
 *
 * Comprehensive tests for chat type definitions, type guards,
 * and utility functions.
 *
 * @module types/chat.test
 */

import {
  // Constants
  CHAT_SENDER_TYPES,
  CHAT_CONTENT_TYPES,
  CHAT_MESSAGE_STATUSES,
  CHAT_CONSTANTS,
  DEFAULT_RESPONSE_PATTERNS,
  NOTIFY_URGENCY_LEVELS,
  SLACK_DELIVERY_STATUSES,
  // Types
  ChatSenderType,
  ChatContentType,
  ChatMessageStatus,
  ChatSender,
  ChatMessage,
  ChatConversation,
  ChatMessageMetadata,
  SendMessageInput,
  SendMessageResult,
  ChatMessageFilter,
  ConversationFilter,
  ResponsePattern,
  ChatWebSocketEvent,
  CreateChatMessageInput,
  ChatStorageFormat,
  LastMessagePreview,
  NotifyPayload,
  NotifyUrgency,
  SlackDeliveryStatus,
  // Type guards
  isValidSenderType,
  isValidContentType,
  isValidMessageStatus,
  isValidChatSender,
  isValidChatMessage,
  isValidChatConversation,
  isValidNotifyPayload,
  // Utility functions
  generateChatId,
  createChatMessage,
  createConversation,
  formatMessageContent,
  extractResponseFromOutput,
  detectContentType,
  createLastMessagePreview,
  validateSendMessageInput,
  validateChatMessageFilter,
  validateConversationFilter,
  parseNotifyContent,
} from './chat.types.js';

// =============================================================================
// Constants Tests
// =============================================================================

describe('Chat Constants', () => {
  describe('CHAT_SENDER_TYPES', () => {
    it('should contain all expected sender types', () => {
      expect(CHAT_SENDER_TYPES).toContain('user');
      expect(CHAT_SENDER_TYPES).toContain('orchestrator');
      expect(CHAT_SENDER_TYPES).toContain('agent');
      expect(CHAT_SENDER_TYPES).toContain('system');
      expect(CHAT_SENDER_TYPES).toHaveLength(4);
    });

    it('should be a readonly tuple at compile time', () => {
      // Note: `as const` is a TypeScript feature that makes the array readonly at compile time
      // At runtime, the array is not frozen, but TypeScript prevents modifications
      expect(Array.isArray(CHAT_SENDER_TYPES)).toBe(true);
      // Verify the exact length to ensure no items are added/removed
      expect(CHAT_SENDER_TYPES).toHaveLength(4);
    });
  });

  describe('CHAT_CONTENT_TYPES', () => {
    it('should contain all expected content types', () => {
      expect(CHAT_CONTENT_TYPES).toContain('text');
      expect(CHAT_CONTENT_TYPES).toContain('status');
      expect(CHAT_CONTENT_TYPES).toContain('task');
      expect(CHAT_CONTENT_TYPES).toContain('error');
      expect(CHAT_CONTENT_TYPES).toContain('system');
      expect(CHAT_CONTENT_TYPES).toContain('code');
      expect(CHAT_CONTENT_TYPES).toContain('markdown');
      expect(CHAT_CONTENT_TYPES).toHaveLength(7);
    });
  });

  describe('CHAT_MESSAGE_STATUSES', () => {
    it('should contain all expected message statuses', () => {
      expect(CHAT_MESSAGE_STATUSES).toContain('sending');
      expect(CHAT_MESSAGE_STATUSES).toContain('sent');
      expect(CHAT_MESSAGE_STATUSES).toContain('delivered');
      expect(CHAT_MESSAGE_STATUSES).toContain('error');
      expect(CHAT_MESSAGE_STATUSES).toHaveLength(4);
    });
  });

  describe('CHAT_CONSTANTS', () => {
    it('should have default limits', () => {
      expect(CHAT_CONSTANTS.DEFAULTS.MESSAGE_LIMIT).toBe(100);
      expect(CHAT_CONSTANTS.DEFAULTS.CONVERSATION_LIMIT).toBe(50);
      expect(CHAT_CONSTANTS.DEFAULTS.PREVIEW_LENGTH).toBe(100);
    });

    it('should have pattern names', () => {
      expect(CHAT_CONSTANTS.PATTERNS.EXPLICIT).toBe('explicit');
      expect(CHAT_CONSTANTS.PATTERNS.CHAT).toBe('chat');
      expect(CHAT_CONSTANTS.PATTERNS.CODEBLOCK).toBe('codeblock');
    });
  });

  describe('DEFAULT_RESPONSE_PATTERNS', () => {
    it('should have three patterns', () => {
      expect(DEFAULT_RESPONSE_PATTERNS).toHaveLength(3);
    });

    it('should have explicit pattern', () => {
      const explicit = DEFAULT_RESPONSE_PATTERNS.find((p) => p.name === 'explicit');
      expect(explicit).toBeDefined();
      expect(explicit?.pattern).toBeInstanceOf(RegExp);
    });

    it('should have chat pattern', () => {
      const chat = DEFAULT_RESPONSE_PATTERNS.find((p) => p.name === 'chat');
      expect(chat).toBeDefined();
      expect(chat?.pattern).toBeInstanceOf(RegExp);
    });

    it('should have codeblock pattern', () => {
      const codeblock = DEFAULT_RESPONSE_PATTERNS.find((p) => p.name === 'codeblock');
      expect(codeblock).toBeDefined();
      expect(codeblock?.pattern).toBeInstanceOf(RegExp);
    });
  });

  describe('SLACK_DELIVERY_STATUSES', () => {
    it('should contain all expected Slack delivery statuses', () => {
      expect(SLACK_DELIVERY_STATUSES).toContain('pending');
      expect(SLACK_DELIVERY_STATUSES).toContain('delivered');
      expect(SLACK_DELIVERY_STATUSES).toContain('failed');
      expect(SLACK_DELIVERY_STATUSES).toHaveLength(3);
    });

    it('should be a readonly tuple at compile time', () => {
      expect(Array.isArray(SLACK_DELIVERY_STATUSES)).toBe(true);
      expect(SLACK_DELIVERY_STATUSES).toHaveLength(3);
    });

    it('should derive SlackDeliveryStatus type from the constant', () => {
      // Verify each value satisfies the SlackDeliveryStatus type
      const pending: SlackDeliveryStatus = 'pending';
      const delivered: SlackDeliveryStatus = 'delivered';
      const failed: SlackDeliveryStatus = 'failed';

      expect(pending).toBe('pending');
      expect(delivered).toBe('delivered');
      expect(failed).toBe('failed');
    });
  });
});

// =============================================================================
// Type Guard Tests
// =============================================================================

describe('Type Guards', () => {
  describe('isValidSenderType', () => {
    it('should return true for valid sender types', () => {
      expect(isValidSenderType('user')).toBe(true);
      expect(isValidSenderType('orchestrator')).toBe(true);
      expect(isValidSenderType('agent')).toBe(true);
      expect(isValidSenderType('system')).toBe(true);
    });

    it('should return false for invalid sender types', () => {
      expect(isValidSenderType('invalid')).toBe(false);
      expect(isValidSenderType('')).toBe(false);
      expect(isValidSenderType('USER')).toBe(false);
      expect(isValidSenderType('admin')).toBe(false);
    });
  });

  describe('isValidContentType', () => {
    it('should return true for valid content types', () => {
      expect(isValidContentType('text')).toBe(true);
      expect(isValidContentType('status')).toBe(true);
      expect(isValidContentType('task')).toBe(true);
      expect(isValidContentType('error')).toBe(true);
      expect(isValidContentType('system')).toBe(true);
      expect(isValidContentType('code')).toBe(true);
      expect(isValidContentType('markdown')).toBe(true);
    });

    it('should return false for invalid content types', () => {
      expect(isValidContentType('invalid')).toBe(false);
      expect(isValidContentType('')).toBe(false);
      expect(isValidContentType('html')).toBe(false);
      expect(isValidContentType('json')).toBe(false);
    });
  });

  describe('isValidMessageStatus', () => {
    it('should return true for valid message statuses', () => {
      expect(isValidMessageStatus('sending')).toBe(true);
      expect(isValidMessageStatus('sent')).toBe(true);
      expect(isValidMessageStatus('delivered')).toBe(true);
      expect(isValidMessageStatus('error')).toBe(true);
    });

    it('should return false for invalid message statuses', () => {
      expect(isValidMessageStatus('invalid')).toBe(false);
      expect(isValidMessageStatus('')).toBe(false);
      expect(isValidMessageStatus('pending')).toBe(false);
      expect(isValidMessageStatus('failed')).toBe(false);
    });
  });

  describe('isValidChatSender', () => {
    it('should return true for valid chat senders', () => {
      expect(isValidChatSender({ type: 'user' })).toBe(true);
      expect(isValidChatSender({ type: 'orchestrator', name: 'Test' })).toBe(true);
      expect(isValidChatSender({ type: 'agent', id: 'agent-1', name: 'Agent', role: 'developer' })).toBe(true);
      expect(isValidChatSender({ type: 'system' })).toBe(true);
    });

    it('should return false for invalid chat senders', () => {
      expect(isValidChatSender(null)).toBe(false);
      expect(isValidChatSender(undefined)).toBe(false);
      expect(isValidChatSender({})).toBe(false);
      expect(isValidChatSender({ type: 'invalid' })).toBe(false);
      expect(isValidChatSender({ type: 'user', id: 123 })).toBe(false);
      expect(isValidChatSender({ type: 'user', name: 123 })).toBe(false);
      expect(isValidChatSender({ type: 'agent', role: 123 })).toBe(false);
      expect(isValidChatSender('user')).toBe(false);
    });
  });

  describe('isValidChatMessage', () => {
    const validMessage: ChatMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      from: { type: 'user' },
      content: 'Hello',
      contentType: 'text',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    it('should return true for valid chat messages', () => {
      expect(isValidChatMessage(validMessage)).toBe(true);
      expect(isValidChatMessage({ ...validMessage, metadata: { key: 'value' } })).toBe(true);
      expect(isValidChatMessage({ ...validMessage, parentId: 'parent-1' })).toBe(true);
    });

    it('should return false for missing required fields', () => {
      expect(isValidChatMessage(null)).toBe(false);
      expect(isValidChatMessage(undefined)).toBe(false);
      expect(isValidChatMessage({})).toBe(false);
      expect(isValidChatMessage({ ...validMessage, id: '' })).toBe(false);
      expect(isValidChatMessage({ ...validMessage, conversationId: '' })).toBe(false);
    });

    it('should return false for invalid field types', () => {
      expect(isValidChatMessage({ ...validMessage, id: 123 })).toBe(false);
      expect(isValidChatMessage({ ...validMessage, from: null })).toBe(false);
      expect(isValidChatMessage({ ...validMessage, contentType: 'invalid' })).toBe(false);
      expect(isValidChatMessage({ ...validMessage, status: 'invalid' })).toBe(false);
    });
  });

  describe('isValidChatConversation', () => {
    const validConversation: ChatConversation = {
      id: 'conv-1',
      participantIds: ['user'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      messageCount: 0,
    };

    it('should return true for valid conversations', () => {
      expect(isValidChatConversation(validConversation)).toBe(true);
      expect(isValidChatConversation({ ...validConversation, title: 'Test' })).toBe(true);
      expect(
        isValidChatConversation({
          ...validConversation,
          lastMessage: {
            content: 'Test',
            timestamp: new Date().toISOString(),
            from: { type: 'user' },
          },
        })
      ).toBe(true);
    });

    it('should return false for missing required fields', () => {
      expect(isValidChatConversation(null)).toBe(false);
      expect(isValidChatConversation(undefined)).toBe(false);
      expect(isValidChatConversation({})).toBe(false);
      expect(isValidChatConversation({ ...validConversation, id: '' })).toBe(false);
    });

    it('should return false for invalid field types', () => {
      expect(isValidChatConversation({ ...validConversation, participantIds: 'invalid' })).toBe(false);
      expect(isValidChatConversation({ ...validConversation, isArchived: 'false' })).toBe(false);
      expect(isValidChatConversation({ ...validConversation, messageCount: '0' })).toBe(false);
    });
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('generateChatId', () => {
    it('should generate a unique ID', () => {
      const id1 = generateChatId();
      const id2 = generateChatId();

      expect(id1).toBeDefined();
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
      expect(id1).not.toBe(id2);
    });

    it('should generate valid UUID format', () => {
      const id = generateChatId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });
  });

  describe('createChatMessage', () => {
    it('should create a message with required fields', () => {
      const message = createChatMessage({
        conversationId: 'conv-1',
        content: 'Hello!',
        from: { type: 'user' },
      });

      expect(message.id).toBeDefined();
      expect(message.conversationId).toBe('conv-1');
      expect(message.content).toBe('Hello!');
      expect(message.from.type).toBe('user');
      expect(message.contentType).toBe('text');
      expect(message.status).toBe('sent');
      expect(message.timestamp).toBeDefined();
    });

    it('should use provided optional fields', () => {
      const timestamp = '2024-01-01T00:00:00.000Z';
      const message = createChatMessage({
        conversationId: 'conv-1',
        content: 'Hello!',
        from: { type: 'agent', name: 'Test Agent' },
        contentType: 'markdown',
        status: 'delivered',
        timestamp,
        metadata: { key: 'value' },
        parentId: 'parent-1',
      });

      expect(message.contentType).toBe('markdown');
      expect(message.status).toBe('delivered');
      expect(message.timestamp).toBe(timestamp);
      expect(message.metadata).toEqual({ key: 'value' });
      expect(message.parentId).toBe('parent-1');
    });

    it('should generate unique IDs for each message', () => {
      const message1 = createChatMessage({
        conversationId: 'conv-1',
        content: 'Hello!',
        from: { type: 'user' },
      });

      const message2 = createChatMessage({
        conversationId: 'conv-1',
        content: 'Hello!',
        from: { type: 'user' },
      });

      expect(message1.id).not.toBe(message2.id);
    });
  });

  describe('createConversation', () => {
    it('should create a conversation with defaults', () => {
      const conversation = createConversation();

      expect(conversation.id).toBeDefined();
      expect(conversation.participantIds).toEqual([]);
      expect(conversation.isArchived).toBe(false);
      expect(conversation.messageCount).toBe(0);
      expect(conversation.createdAt).toBeDefined();
      expect(conversation.updatedAt).toBeDefined();
      expect(conversation.title).toBeUndefined();
      expect(conversation.lastMessage).toBeUndefined();
    });

    it('should create a conversation with title', () => {
      const conversation = createConversation('My Conversation');

      expect(conversation.title).toBe('My Conversation');
    });

    it('should generate unique IDs', () => {
      const conv1 = createConversation();
      const conv2 = createConversation();

      expect(conv1.id).not.toBe(conv2.id);
    });

    it('should set timestamps to current time', () => {
      const before = new Date().toISOString();
      const conversation = createConversation();
      const after = new Date().toISOString();

      expect(conversation.createdAt >= before).toBe(true);
      expect(conversation.createdAt <= after).toBe(true);
      expect(conversation.createdAt).toBe(conversation.updatedAt);
    });
  });

  describe('formatMessageContent', () => {
    it('should remove ANSI color codes', () => {
      expect(formatMessageContent('\x1b[32mGreen text\x1b[0m')).toBe('Green text');
      expect(formatMessageContent('\x1b[31;1mBold red\x1b[0m')).toBe('Bold red');
      expect(formatMessageContent('\x1b[38;5;196mRed 256\x1b[0m')).toBe('Red 256');
    });

    it('should remove ANSI cursor movement codes', () => {
      expect(formatMessageContent('\x1b[2JScreen cleared')).toBe('Screen cleared');
      expect(formatMessageContent('Text\x1b[A\x1b[B')).toBe('Text');
    });

    it('should remove control characters', () => {
      expect(formatMessageContent('Hello\x00World')).toBe('HelloWorld');
      expect(formatMessageContent('Test\x07Bell')).toBe('TestBell');
    });

    it('should preserve newlines and tabs', () => {
      expect(formatMessageContent('Line 1\nLine 2')).toBe('Line 1\nLine 2');
      expect(formatMessageContent('Col1\tCol2')).toBe('Col1\tCol2');
    });

    it('should trim whitespace', () => {
      expect(formatMessageContent('  Hello  ')).toBe('Hello');
      expect(formatMessageContent('\n\nText\n\n')).toBe('Text');
      expect(formatMessageContent('  \n  Hello  \n  ')).toBe('Hello');
    });

    it('should handle complex terminal output', () => {
      const complexOutput = '\x1b[32m✓\x1b[0m Test passed\x1b[K\n\x1b[31m✗\x1b[0m Test failed';
      const result = formatMessageContent(complexOutput);
      expect(result).toBe('✓ Test passed\n✗ Test failed');
    });

    it('should handle empty strings', () => {
      expect(formatMessageContent('')).toBe('');
      expect(formatMessageContent('   ')).toBe('');
    });

    // Smart paste detection tests - ANSI cursor movement conversion
    it('should convert cursor forward sequences to spaces', () => {
      // \x1b[nC moves cursor forward n positions - should become n spaces
      expect(formatMessageContent('Hello\x1b[5CWorld')).toBe('Hello World');
      expect(formatMessageContent('A\x1b[1CB')).toBe('A B');
      expect(formatMessageContent('Start\x1b[10CEnd')).toBe('Start End');
    });

    it('should convert cursor down sequences to newlines', () => {
      // \x1b[nB moves cursor down n lines - should become n newlines
      expect(formatMessageContent('Line1\x1b[1BLine2')).toBe('Line1\nLine2');
      expect(formatMessageContent('Top\x1b[2BBottom')).toBe('Top\n\nBottom');
    });

    it('should handle carriage returns by keeping last segment', () => {
      // Carriage return (\r) returns cursor to start of line
      // Content after \r overwrites content before it
      expect(formatMessageContent('old text\rnew text')).toBe('new text');
      expect(formatMessageContent('first\rsecond\rthird')).toBe('third');
      expect(formatMessageContent('Line1\nold\rnew\nLine3')).toBe('Line1\nnew\nLine3');
    });

    it('should handle carriage returns with empty segments', () => {
      expect(formatMessageContent('text\r')).toBe('text');
      expect(formatMessageContent('\rtext')).toBe('text');
    });

    it('should normalize multiple consecutive spaces to single space', () => {
      expect(formatMessageContent('Hello    World')).toBe('Hello World');
      expect(formatMessageContent('A  B   C    D')).toBe('A B C D');
    });

    it('should remove OSC sequences (terminal title changes)', () => {
      // OSC sequences: \x1b]....\x07
      expect(formatMessageContent('\x1b]0;Terminal Title\x07Actual content')).toBe('Actual content');
      // OSC removal concatenates surrounding text (no space added)
      expect(formatMessageContent('Before\x1b]2;Window Title\x07After')).toBe('BeforeAfter');
    });

    it('should handle complex smart paste output', () => {
      // Simulates real terminal output with cursor movements creating visual spacing
      const complexOutput = 'Status:\x1b[5COK\x1b[1BDetails:\x1b[3CRunning';
      const result = formatMessageContent(complexOutput);
      expect(result).toBe('Status: OK\nDetails: Running');
    });

    it('should clean up multiple blank lines to maximum of two', () => {
      expect(formatMessageContent('A\n\n\n\n\nB')).toBe('A\n\nB');
      expect(formatMessageContent('Line1\n\n\nLine2\n\n\n\nLine3')).toBe('Line1\n\nLine2\n\nLine3');
    });

    it('should combine cursor movement conversion with color stripping', () => {
      // Real terminal often combines colors with cursor movements
      const output = '\x1b[32mGreen\x1b[0m\x1b[5C\x1b[31mRed\x1b[0m';
      expect(formatMessageContent(output)).toBe('Green Red');
    });

    it('should clean orphaned CSI fragments from PTY buffer splits', () => {
      // When ESC byte lands in a previous PTY chunk, artifacts like [1C remain
      expect(formatMessageContent('What would[1Cyou like to do?')).toBe('What would you like to do?');
      // [22m is an orphaned SGR reset
      expect(formatMessageContent('Hello[22m World')).toBe('Hello World');
      // Should NOT match [C with zero digits (would break [CHAT_RESPONSE])
      expect(formatMessageContent('[CHAT_RESPONSE]test[/CHAT_RESPONSE]')).toContain('CHAT_RESPONSE');
      // Multiple orphaned fragments: [3C] → space, [1K] and [22m] → removed
      expect(formatMessageContent('A[3CB[1KC[22mD')).toBe('A BCD');
    });
  });

  describe('extractResponseFromOutput', () => {
    it('should extract response from [RESPONSE] markers', () => {
      const output = 'some text [RESPONSE]Hello World[/RESPONSE] more text';
      expect(extractResponseFromOutput(output)).toBe('Hello World');
    });

    it('should extract response from [CHAT_RESPONSE] markers', () => {
      const output = '[CHAT_RESPONSE]\n## Project Created\n\nDetails here\n[/CHAT_RESPONSE]';
      const extracted = extractResponseFromOutput(output);
      expect(extracted).toContain('Project Created');
      expect(extracted).toContain('Details here');
    });

    it('should extract from code block format', () => {
      const output = '```response\nFormatted response here\n```';
      expect(extractResponseFromOutput(output)).toBe('Formatted response here');
    });

    it('should handle multiline content', () => {
      const output = '[RESPONSE]\nLine 1\nLine 2\nLine 3\n[/RESPONSE]';
      const extracted = extractResponseFromOutput(output);
      expect(extracted).toContain('Line 1');
      expect(extracted).toContain('Line 2');
      expect(extracted).toContain('Line 3');
    });

    it('should return original if no pattern matches', () => {
      const output = 'Just plain text output';
      expect(extractResponseFromOutput(output)).toBe('Just plain text output');
    });

    it('should be case insensitive', () => {
      const output1 = '[response]Lower case[/response]';
      const output2 = '[RESPONSE]Upper case[/RESPONSE]';
      const output3 = '[Response]Mixed case[/Response]';

      expect(extractResponseFromOutput(output1)).toBe('Lower case');
      expect(extractResponseFromOutput(output2)).toBe('Upper case');
      expect(extractResponseFromOutput(output3)).toBe('Mixed case');
    });

    it('should use custom patterns when provided', () => {
      const customPatterns: ResponsePattern[] = [
        { name: 'custom', pattern: /\[CUSTOM\]([\s\S]*?)\[\/CUSTOM\]/i, groupIndex: 1 },
      ];
      const output = '[CUSTOM]Custom content[/CUSTOM]';

      expect(extractResponseFromOutput(output, customPatterns)).toBe('Custom content');
    });

    it('should return original when custom patterns do not match', () => {
      const customPatterns: ResponsePattern[] = [
        { name: 'custom', pattern: /\[CUSTOM\]([\s\S]*?)\[\/CUSTOM\]/i, groupIndex: 1 },
      ];
      const output = '[RESPONSE]Standard content[/RESPONSE]';

      expect(extractResponseFromOutput(output, customPatterns)).toBe(output);
    });

    it('should trim extracted content', () => {
      const output = '[RESPONSE]   Trimmed content   [/RESPONSE]';
      expect(extractResponseFromOutput(output)).toBe('Trimmed content');
    });

    it('should extract content from [CHAT_RESPONSE:conversationId] markers', () => {
      const output = '[CHAT_RESPONSE:conv-abc123]Hello from conversation[/CHAT_RESPONSE]';
      expect(extractResponseFromOutput(output)).toBe('Hello from conversation');
    });

    it('should extract content without including conversation ID suffix', () => {
      const output = '[CHAT_RESPONSE:my-conv-id]\n## Status\n\nAll good!\n[/CHAT_RESPONSE]';
      const extracted = extractResponseFromOutput(output);
      expect(extracted).toContain('Status');
      expect(extracted).toContain('All good!');
      expect(extracted).not.toContain('my-conv-id');
    });

    it('should handle both old and new CHAT_RESPONSE formats', () => {
      const oldFormat = '[CHAT_RESPONSE]Old format content[/CHAT_RESPONSE]';
      const newFormat = '[CHAT_RESPONSE:conv-123]New format content[/CHAT_RESPONSE]';

      expect(extractResponseFromOutput(oldFormat)).toBe('Old format content');
      expect(extractResponseFromOutput(newFormat)).toBe('New format content');
    });
  });

  describe('detectContentType', () => {
    it('should detect markdown with code blocks', () => {
      expect(detectContentType('Here is some code:\n```javascript\nconst x = 1;\n```')).toBe('markdown');
    });

    it('should detect markdown with headers', () => {
      expect(detectContentType('## Section Header')).toBe('markdown');
      expect(detectContentType('### Subsection')).toBe('markdown');
    });

    it('should detect markdown with bold text', () => {
      expect(detectContentType('This is **bold** text')).toBe('markdown');
    });

    it('should detect markdown with bullet lists', () => {
      expect(detectContentType('- Item 1\n- Item 2')).toBe('markdown');
      expect(detectContentType('* Item 1\n* Item 2')).toBe('markdown');
    });

    it('should detect markdown with numbered lists', () => {
      expect(detectContentType('1. First\n2. Second')).toBe('markdown');
    });

    it('should detect code patterns', () => {
      expect(detectContentType('function test() { return true; }')).toBe('code');
      expect(detectContentType('const value = 42;')).toBe('code');
      expect(detectContentType("import { something } from 'module';")).toBe('code');
      expect(detectContentType('export default MyComponent;')).toBe('code');
      expect(detectContentType('class MyClass { }')).toBe('code');
      expect(detectContentType('let x = 1;')).toBe('code');
      expect(detectContentType('var y = 2;')).toBe('code');
    });

    it('should detect error content', () => {
      expect(detectContentType('Error: Something went wrong')).toBe('error');
      expect(detectContentType('error: connection failed')).toBe('error');
      expect(detectContentType('Exception: Invalid input')).toBe('error');
      expect(detectContentType('Failed: Task could not complete')).toBe('error');
    });

    it('should default to text for plain content', () => {
      expect(detectContentType('Hello, this is plain text.')).toBe('text');
      expect(detectContentType('Just some regular message content')).toBe('text');
    });
  });

  describe('createLastMessagePreview', () => {
    const sampleMessage: ChatMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      from: { type: 'user', name: 'John' },
      content: 'This is a test message with some content.',
      contentType: 'text',
      status: 'sent',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    it('should create preview with all fields', () => {
      const preview = createLastMessagePreview(sampleMessage);

      expect(preview.content).toBe(sampleMessage.content);
      expect(preview.timestamp).toBe(sampleMessage.timestamp);
      expect(preview.from).toBe(sampleMessage.from);
    });

    it('should truncate long content', () => {
      const longContent = 'A'.repeat(200);
      const message = { ...sampleMessage, content: longContent };
      const preview = createLastMessagePreview(message);

      expect(preview.content.length).toBe(100);
      expect(preview.content.endsWith('...')).toBe(true);
    });

    it('should respect custom max length', () => {
      const message = { ...sampleMessage, content: 'A'.repeat(100) };
      const preview = createLastMessagePreview(message, 50);

      expect(preview.content.length).toBe(50);
      expect(preview.content.endsWith('...')).toBe(true);
    });

    it('should not truncate content within limit', () => {
      const preview = createLastMessagePreview(sampleMessage);
      expect(preview.content).toBe(sampleMessage.content);
      expect(preview.content.endsWith('...')).toBe(false);
    });
  });
});

// =============================================================================
// Validation Function Tests
// =============================================================================

describe('Validation Functions', () => {
  describe('validateSendMessageInput', () => {
    it('should validate valid input', () => {
      const result = validateSendMessageInput({ content: 'Hello' });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate input with all fields', () => {
      const result = validateSendMessageInput({
        content: 'Hello',
        conversationId: 'conv-1',
        metadata: { key: 'value' },
      });
      expect(result.valid).toBe(true);
    });

    it('should reject null input', () => {
      const result = validateSendMessageInput(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input must be an object');
    });

    it('should reject non-object input', () => {
      const result = validateSendMessageInput('string');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input must be an object');
    });

    it('should reject missing content', () => {
      const result = validateSendMessageInput({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Content must be a string');
    });

    it('should reject empty content', () => {
      const result = validateSendMessageInput({ content: '   ' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Content cannot be empty');
    });

    it('should reject non-string conversationId', () => {
      const result = validateSendMessageInput({ content: 'Hello', conversationId: 123 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('ConversationId must be a string');
    });

    it('should reject invalid metadata', () => {
      const result = validateSendMessageInput({ content: 'Hello', metadata: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Metadata must be an object');
    });

    it('should reject null metadata', () => {
      const result = validateSendMessageInput({ content: 'Hello', metadata: null });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Metadata must be an object');
    });
  });

  describe('validateChatMessageFilter', () => {
    it('should validate empty filter', () => {
      const result = validateChatMessageFilter({});
      expect(result.valid).toBe(true);
    });

    it('should validate filter with all valid fields', () => {
      const result = validateChatMessageFilter({
        conversationId: 'conv-1',
        senderType: 'user',
        contentType: 'text',
        after: '2024-01-01',
        before: '2024-12-31',
        limit: 50,
        offset: 10,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject null filter', () => {
      const result = validateChatMessageFilter(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Filter must be an object');
    });

    it('should reject invalid conversationId type', () => {
      const result = validateChatMessageFilter({ conversationId: 123 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('ConversationId must be a string');
    });

    it('should reject invalid sender type', () => {
      const result = validateChatMessageFilter({ senderType: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid sender type');
    });

    it('should reject invalid content type', () => {
      const result = validateChatMessageFilter({ contentType: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid content type');
    });

    it('should reject non-positive limit', () => {
      const result = validateChatMessageFilter({ limit: 0 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Limit must be a positive number');
    });

    it('should reject negative offset', () => {
      const result = validateChatMessageFilter({ offset: -1 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Offset must be a non-negative number');
    });
  });

  describe('validateConversationFilter', () => {
    it('should validate empty filter', () => {
      const result = validateConversationFilter({});
      expect(result.valid).toBe(true);
    });

    it('should validate filter with all valid fields', () => {
      const result = validateConversationFilter({
        includeArchived: true,
        search: 'test',
        limit: 50,
        offset: 10,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject null filter', () => {
      const result = validateConversationFilter(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Filter must be an object');
    });

    it('should reject non-boolean includeArchived', () => {
      const result = validateConversationFilter({ includeArchived: 'true' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('IncludeArchived must be a boolean');
    });

    it('should reject non-string search', () => {
      const result = validateConversationFilter({ search: 123 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Search must be a string');
    });

    it('should reject non-positive limit', () => {
      const result = validateConversationFilter({ limit: -5 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Limit must be a positive number');
    });

    it('should reject negative offset', () => {
      const result = validateConversationFilter({ offset: -10 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Offset must be a non-negative number');
    });
  });
});

// =============================================================================
// Type Compilation Tests
// =============================================================================

describe('Type Definitions', () => {
  it('should compile ChatMessage type correctly', () => {
    const message: ChatMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      from: { type: 'user' },
      content: 'Test',
      contentType: 'text',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
    expect(message).toBeDefined();
  });

  it('should compile ChatConversation type correctly', () => {
    const conversation: ChatConversation = {
      id: 'conv-1',
      participantIds: ['user-1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      messageCount: 0,
    };
    expect(conversation).toBeDefined();
  });

  it('should compile ChatMessageMetadata type correctly', () => {
    const metadata: ChatMessageMetadata = {
      skillUsed: 'skill-1',
      taskCreated: 'task-1',
      projectCreated: 'project-1',
      rawOutput: 'raw output',
      sessionId: 'session-1',
      responseTimeMs: 100,
      customKey: 'custom value',
    };
    expect(metadata).toBeDefined();
  });

  it('should compile ChatMessageMetadata with Slack delivery tracking fields', () => {
    const metadata: ChatMessageMetadata = {
      slackDeliveryStatus: 'pending',
      slackDeliveryAttemptedAt: '2026-02-09T12:00:00.000Z',
      slackDeliveryAttempts: 1,
      slackDeliveryError: 'timeout',
      slackChannelId: 'C0123ABC',
      slackThreadTs: '1770611081.834419',
      notifyType: 'task_completed',
      notifyTitle: 'Task Done',
      notifyUrgency: 'high',
    };
    expect(metadata).toBeDefined();
    expect(metadata.slackDeliveryStatus).toBe('pending');
    expect(metadata.slackDeliveryAttemptedAt).toBe('2026-02-09T12:00:00.000Z');
    expect(metadata.slackDeliveryAttempts).toBe(1);
    expect(metadata.slackDeliveryError).toBe('timeout');
    expect(metadata.slackChannelId).toBe('C0123ABC');
    expect(metadata.slackThreadTs).toBe('1770611081.834419');
    expect(metadata.notifyType).toBe('task_completed');
    expect(metadata.notifyTitle).toBe('Task Done');
    expect(metadata.notifyUrgency).toBe('high');
  });

  it('should compile ChatMessageMetadata with all SlackDeliveryStatus values', () => {
    const pending: ChatMessageMetadata = { slackDeliveryStatus: 'pending' };
    const delivered: ChatMessageMetadata = { slackDeliveryStatus: 'delivered' };
    const failed: ChatMessageMetadata = { slackDeliveryStatus: 'failed' };

    expect(pending.slackDeliveryStatus).toBe('pending');
    expect(delivered.slackDeliveryStatus).toBe('delivered');
    expect(failed.slackDeliveryStatus).toBe('failed');
  });

  it('should compile ChatMessageMetadata without optional Slack fields', () => {
    const metadata: ChatMessageMetadata = {
      skillUsed: 'skill-1',
    };
    expect(metadata.slackDeliveryStatus).toBeUndefined();
    expect(metadata.slackDeliveryAttemptedAt).toBeUndefined();
    expect(metadata.slackDeliveryAttempts).toBeUndefined();
    expect(metadata.slackDeliveryError).toBeUndefined();
    expect(metadata.slackChannelId).toBeUndefined();
    expect(metadata.slackThreadTs).toBeUndefined();
    expect(metadata.notifyType).toBeUndefined();
    expect(metadata.notifyTitle).toBeUndefined();
    expect(metadata.notifyUrgency).toBeUndefined();
  });

  it('should compile SendMessageInput type correctly', () => {
    const input: SendMessageInput = {
      content: 'Hello',
      conversationId: 'conv-1',
      metadata: { key: 'value' },
    };
    expect(input).toBeDefined();
  });

  it('should compile SendMessageResult type correctly', () => {
    const result: SendMessageResult = {
      message: {
        id: 'msg-1',
        conversationId: 'conv-1',
        from: { type: 'user' },
        content: 'Test',
        contentType: 'text',
        status: 'sent',
        timestamp: new Date().toISOString(),
      },
      conversation: {
        id: 'conv-1',
        participantIds: ['user-1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        messageCount: 1,
      },
    };
    expect(result).toBeDefined();
  });

  it('should compile ChatWebSocketEvent union type correctly', () => {
    const messageEvent: ChatWebSocketEvent = {
      type: 'chat_message',
      data: {
        id: 'msg-1',
        conversationId: 'conv-1',
        from: { type: 'user' },
        content: 'Test',
        contentType: 'text',
        status: 'sent',
        timestamp: new Date().toISOString(),
      },
    };

    const typingEvent: ChatWebSocketEvent = {
      type: 'chat_typing',
      data: {
        conversationId: 'conv-1',
        sender: { type: 'orchestrator' },
        isTyping: true,
      },
    };

    const statusEvent: ChatWebSocketEvent = {
      type: 'chat_status',
      data: {
        messageId: 'msg-1',
        status: 'delivered',
      },
    };

    const conversationEvent: ChatWebSocketEvent = {
      type: 'conversation_updated',
      data: {
        id: 'conv-1',
        participantIds: ['user-1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        messageCount: 1,
      },
    };

    expect(messageEvent).toBeDefined();
    expect(typingEvent).toBeDefined();
    expect(statusEvent).toBeDefined();
    expect(conversationEvent).toBeDefined();
  });

  it('should compile ResponsePattern type correctly', () => {
    const pattern: ResponsePattern = {
      name: 'test',
      pattern: /test/i,
      groupIndex: 1,
    };
    expect(pattern).toBeDefined();
  });

  it('should compile ChatStorageFormat type correctly', () => {
    const storage: ChatStorageFormat = {
      conversation: {
        id: 'conv-1',
        participantIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        messageCount: 0,
      },
      messages: [],
    };
    expect(storage).toBeDefined();
  });
});

// =============================================================================
// NotifyPayload Tests
// =============================================================================

describe('NotifyPayload', () => {
  describe('NOTIFY_URGENCY_LEVELS', () => {
    it('should contain all expected urgency levels', () => {
      expect(NOTIFY_URGENCY_LEVELS).toContain('low');
      expect(NOTIFY_URGENCY_LEVELS).toContain('normal');
      expect(NOTIFY_URGENCY_LEVELS).toContain('high');
      expect(NOTIFY_URGENCY_LEVELS).toContain('critical');
      expect(NOTIFY_URGENCY_LEVELS).toHaveLength(4);
    });
  });

  describe('isValidNotifyPayload', () => {
    it('should return true for a minimal valid payload', () => {
      expect(isValidNotifyPayload({ message: 'Hello' })).toBe(true);
    });

    it('should return true for a full valid payload', () => {
      const payload: NotifyPayload = {
        message: '## Update\n\nDetails here.',
        conversationId: 'conv-123',
        channelId: 'C0123',
        threadTs: '170743.001',
        type: 'task_completed',
        title: 'Task Done',
        urgency: 'normal',
      };
      expect(isValidNotifyPayload(payload)).toBe(true);
    });

    it('should return true for chat-only payload', () => {
      expect(isValidNotifyPayload({
        message: 'Status update',
        conversationId: 'conv-abc',
      })).toBe(true);
    });

    it('should return true for Slack-only payload', () => {
      expect(isValidNotifyPayload({
        message: 'Agent done',
        channelId: 'C0123',
        type: 'task_completed',
      })).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isValidNotifyPayload(null)).toBe(false);
      expect(isValidNotifyPayload(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidNotifyPayload('string')).toBe(false);
      expect(isValidNotifyPayload(123)).toBe(false);
    });

    it('should return false for missing message', () => {
      expect(isValidNotifyPayload({})).toBe(false);
      expect(isValidNotifyPayload({ type: 'alert' })).toBe(false);
    });

    it('should return false for empty message', () => {
      expect(isValidNotifyPayload({ message: '' })).toBe(false);
      expect(isValidNotifyPayload({ message: '   ' })).toBe(false);
    });

    it('should return false for non-string message', () => {
      expect(isValidNotifyPayload({ message: 123 })).toBe(false);
      expect(isValidNotifyPayload({ message: true })).toBe(false);
    });

    it('should return false for non-string optional string fields', () => {
      expect(isValidNotifyPayload({ message: 'ok', conversationId: 123 })).toBe(false);
      expect(isValidNotifyPayload({ message: 'ok', channelId: 123 })).toBe(false);
      expect(isValidNotifyPayload({ message: 'ok', threadTs: 123 })).toBe(false);
      expect(isValidNotifyPayload({ message: 'ok', type: 123 })).toBe(false);
      expect(isValidNotifyPayload({ message: 'ok', title: 123 })).toBe(false);
    });

    it('should return false for invalid urgency', () => {
      expect(isValidNotifyPayload({ message: 'ok', urgency: 'extreme' })).toBe(false);
      expect(isValidNotifyPayload({ message: 'ok', urgency: 123 })).toBe(false);
    });

    it('should return true for valid urgency values', () => {
      expect(isValidNotifyPayload({ message: 'ok', urgency: 'low' })).toBe(true);
      expect(isValidNotifyPayload({ message: 'ok', urgency: 'normal' })).toBe(true);
      expect(isValidNotifyPayload({ message: 'ok', urgency: 'high' })).toBe(true);
      expect(isValidNotifyPayload({ message: 'ok', urgency: 'critical' })).toBe(true);
    });

    it('should accept payloads with extra properties (backward compat)', () => {
      // Extra properties are ignored by isValidNotifyPayload (it checks known fields)
      expect(isValidNotifyPayload({ message: 'ok', metadata: { key: 'value' } })).toBe(true);
    });
  });

  describe('NotifyPayload type compilation', () => {
    it('should compile NotifyPayload type correctly', () => {
      const payload: NotifyPayload = {
        message: 'Test',
        conversationId: 'conv-1',
        channelId: 'C0123',
        threadTs: '170743.001',
        type: 'alert',
        title: 'Alert',
        urgency: 'high',
      };
      expect(payload).toBeDefined();
    });

    it('should compile NotifyUrgency type correctly', () => {
      const urgency: NotifyUrgency = 'normal';
      expect(urgency).toBe('normal');
    });
  });
});

// =============================================================================
// parseNotifyContent Tests
// =============================================================================

describe('parseNotifyContent', () => {
  describe('header+body format', () => {
    it('should parse a full header+body payload', () => {
      const raw = 'conversationId: conv-abc123\nchannelId: D0AC7NF5N7L\nthreadTs: 1770611081.834419\ntype: task_completed\ntitle: Task Completed\nurgency: normal\n---\n## Emily Status Update\n\nEmily is now **active**.';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.message).toBe('## Emily Status Update\n\nEmily is now **active**.');
      expect(payload!.conversationId).toBe('conv-abc123');
      expect(payload!.channelId).toBe('D0AC7NF5N7L');
      expect(payload!.threadTs).toBe('1770611081.834419');
      expect(payload!.type).toBe('task_completed');
      expect(payload!.title).toBe('Task Completed');
      expect(payload!.urgency).toBe('normal');
    });

    it('should parse a minimal header+body payload', () => {
      const raw = 'conversationId: conv-1\n---\nHello world';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.message).toBe('Hello world');
      expect(payload!.conversationId).toBe('conv-1');
    });

    it('should handle body-only content (no headers, no separator)', () => {
      const raw = '## Status Update\n\nAll systems go.';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.message).toBe('## Status Update\n\nAll systems go.');
      expect(payload!.conversationId).toBeUndefined();
      expect(payload!.channelId).toBeUndefined();
    });

    it('should return null for empty content', () => {
      expect(parseNotifyContent('')).toBeNull();
      expect(parseNotifyContent('   ')).toBeNull();
    });

    it('should return null for empty body after separator', () => {
      const raw = 'conversationId: conv-1\n---\n';
      expect(parseNotifyContent(raw)).toBeNull();
    });

    it('should ignore unknown header keys', () => {
      const raw = 'conversationId: conv-1\nunknownKey: some-value\n---\nBody text';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('conv-1');
      expect(payload!.message).toBe('Body text');
      // unknownKey should not appear
      expect((payload as unknown as Record<string, unknown>)['unknownKey']).toBeUndefined();
    });

    it('should ignore header lines without colons', () => {
      const raw = 'conversationId: conv-1\nmalformed line\n---\nBody';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('conv-1');
      expect(payload!.message).toBe('Body');
    });

    it('should ignore headers with empty values', () => {
      const raw = 'conversationId: conv-1\nchannelId: \n---\nBody';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('conv-1');
      expect(payload!.channelId).toBeUndefined();
    });

    it('should handle colon in header value (e.g., threadTs)', () => {
      const raw = 'threadTs: 1770611081.834419\n---\nBody';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.threadTs).toBe('1770611081.834419');
    });

    it('should strip ANSI escape sequences from raw content', () => {
      const raw = '\x1b[32mconversationId: conv-1\x1b[0m\n---\n\x1b[31mRed body\x1b[0m';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('conv-1');
      expect(payload!.message).toBe('Red body');
    });

    it('should strip orphaned SGR sequences', () => {
      const raw = '[39mconversationId: conv-1\n---\nBody text[0m';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('conv-1');
      expect(payload!.message).toBe('Body text');
    });

    it('should handle multiline body with markdown', () => {
      const raw = 'conversationId: conv-1\ntype: task_completed\n---\n## Task Done\n\nJoe finished:\n- ✅ Tests pass\n- ✅ Deployed\n\nShould I assign next task?';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.message).toContain('## Task Done');
      expect(payload!.message).toContain('- ✅ Tests pass');
      expect(payload!.message).toContain('Should I assign next task?');
      expect(payload!.type).toBe('task_completed');
    });
  });

  describe('legacy JSON fallback', () => {
    it('should parse valid JSON payload', () => {
      const raw = '{"message":"Hello","conversationId":"conv-1"}';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.message).toBe('Hello');
      expect(payload!.conversationId).toBe('conv-1');
    });

    it('should parse full JSON payload', () => {
      const raw = JSON.stringify({
        message: '## Update\n\nDetails.',
        conversationId: 'conv-abc',
        channelId: 'C0123',
        threadTs: '170743.001',
        type: 'task_completed',
        title: 'Done',
        urgency: 'normal',
      });
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.message).toBe('## Update\n\nDetails.');
      expect(payload!.channelId).toBe('C0123');
    });

    it('should clean PTY line-wrapping artifacts from JSON', () => {
      // PTY wraps JSON, injecting newlines + padding
      const raw = '{"message":"Hello","conversationId":"conv-1","cha\n      nnelId":"C0123"}';
      const payload = parseNotifyContent(raw);

      expect(payload).not.toBeNull();
      expect(payload!.channelId).toBe('C0123');
    });

    it('should return null for invalid JSON', () => {
      const raw = '{not valid json}';
      expect(parseNotifyContent(raw)).toBeNull();
    });

    it('should return null for JSON missing required message field', () => {
      const raw = '{"type":"alert","conversationId":"conv-1"}';
      expect(parseNotifyContent(raw)).toBeNull();
    });

    it('should skip non-JSON content that starts with backtick (prompt templates)', () => {
      const raw = '` or `[CHAT_RESPONSE]` markers for every status update.';
      // This doesn't start with { so it's treated as body-only (no headers)
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      // It becomes the message body since it has no --- separator
      expect(payload!.message).toContain('markers for every status update');
    });

    it('should parse headers with blank line separator (no ---)', () => {
      const raw = 'conversationId: conv-123\nchannelId: C123\nthreadTs: 1234.5678\n\nHello from the orchestrator';
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('conv-123');
      expect(payload!.channelId).toBe('C123');
      expect(payload!.threadTs).toBe('1234.5678');
      expect(payload!.message).toBe('Hello from the orchestrator');
    });

    it('should parse real-world NOTIFY with blank line separator', () => {
      const raw = [
        'conversationId: 98ce3d99-a083-479a-bd14-93152eef65af',
        'channelId: D0AC7NF5N7L',
        'threadTs: 1770656628.683769',
        '',
        'Setup Complete – Innovation Team is Live',
        '',
        'Here\'s everything I set up:',
        '- Team created',
        '- Agent is active',
      ].join('\n');
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('98ce3d99-a083-479a-bd14-93152eef65af');
      expect(payload!.channelId).toBe('D0AC7NF5N7L');
      expect(payload!.threadTs).toBe('1770656628.683769');
      expect(payload!.message).toContain('Setup Complete');
      expect(payload!.message).toContain('Agent is active');
    });

    it('should not use blank-line fallback if first line is not a known header', () => {
      const raw = 'Hello world\n\nThis is a message';
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      // Should be treated as full message (no header parsing)
      expect(payload!.message).toContain('Hello world');
      expect(payload!.channelId).toBeUndefined();
    });

    it('should prefer --- separator over blank line', () => {
      const raw = 'conversationId: conv-1\nchannelId: C1\n\nextra line\n---\nActual body';
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      expect(payload!.message).toBe('Actual body');
      expect(payload!.conversationId).toBe('conv-1');
    });
  });

  describe('TUI box-drawing border stripping', () => {
    it('should parse headers correctly when wrapped in TUI pipe borders', () => {
      const raw = [
        '| type: slack_reply |',
        '| title: Slack Reply |',
        '| conversationId: conv-abc |',
        '| channelId: D0AC7NF5N7L |',
        '| --- |',
        '| Hello from the orchestrator |',
      ].join('\n');
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      expect(payload!.type).toBe('slack_reply');
      expect(payload!.title).toBe('Slack Reply');
      expect(payload!.conversationId).toBe('conv-abc');
      expect(payload!.channelId).toBe('D0AC7NF5N7L');
      expect(payload!.message).toBe('Hello from the orchestrator');
    });

    it('should strip Unicode box-drawing borders (│, ┃, ║)', () => {
      const raw = [
        '│ conversationId: conv-1 │',
        '│ --- │',
        '│ Message body │',
      ].join('\n');
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('conv-1');
      expect(payload!.message).toBe('Message body');
    });

    it('should remove pure decoration lines (box corners, horizontal rules)', () => {
      const raw = [
        '┌──────────────────────────────┐',
        '│ conversationId: conv-1 │',
        '│ --- │',
        '│ Body text │',
        '└──────────────────────────────┘',
      ].join('\n');
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('conv-1');
      expect(payload!.message).toBe('Body text');
    });

    it('should preserve --- separator when TUI borders are present', () => {
      const raw = '| type: test |\n| --- |\n| Body |';
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      expect(payload!.type).toBe('test');
      expect(payload!.message).toBe('Body');
    });

    it('should handle mixed clean and bordered content', () => {
      const raw = 'conversationId: conv-1\n| channelId: C1 |\n---\nClean body';
      const payload = parseNotifyContent(raw);
      expect(payload).not.toBeNull();
      expect(payload!.conversationId).toBe('conv-1');
      expect(payload!.channelId).toBe('C1');
      expect(payload!.message).toBe('Clean body');
    });
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('Edge Cases', () => {
  describe('formatMessageContent edge cases', () => {
    it('should handle nested ANSI codes', () => {
      const content = '\x1b[1m\x1b[32mBold green\x1b[0m\x1b[0m';
      expect(formatMessageContent(content)).toBe('Bold green');
    });

    it('should handle Unicode characters', () => {
      const content = '\x1b[32m✓ Success 🎉\x1b[0m';
      expect(formatMessageContent(content)).toBe('✓ Success 🎉');
    });

    it('should handle very long content', () => {
      const longContent = '\x1b[32m' + 'A'.repeat(10000) + '\x1b[0m';
      const result = formatMessageContent(longContent);
      expect(result).toBe('A'.repeat(10000));
    });
  });

  describe('extractResponseFromOutput edge cases', () => {
    it('should handle empty markers', () => {
      const output = '[RESPONSE][/RESPONSE]';
      expect(extractResponseFromOutput(output)).toBe('');
    });

    it('should handle nested markers', () => {
      const output = '[RESPONSE][RESPONSE]Inner[/RESPONSE][/RESPONSE]';
      // Should match the first occurrence
      const result = extractResponseFromOutput(output);
      expect(result).toBeTruthy();
    });

    it('should handle markers with special regex characters', () => {
      const output = '[RESPONSE]Content with $pecial (characters) [and] {braces}[/RESPONSE]';
      expect(extractResponseFromOutput(output)).toBe('Content with $pecial (characters) [and] {braces}');
    });
  });

  describe('createChatMessage edge cases', () => {
    it('should handle empty content', () => {
      const message = createChatMessage({
        conversationId: 'conv-1',
        content: '',
        from: { type: 'user' },
      });
      expect(message.content).toBe('');
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(100000);
      const message = createChatMessage({
        conversationId: 'conv-1',
        content: longContent,
        from: { type: 'user' },
      });
      expect(message.content.length).toBe(100000);
    });

    it('should handle special characters in content', () => {
      const specialContent = '\\n\\t"quotes"\'apostrophes\'<html>&entities;';
      const message = createChatMessage({
        conversationId: 'conv-1',
        content: specialContent,
        from: { type: 'user' },
      });
      expect(message.content).toBe(specialContent);
    });
  });

  describe('detectContentType edge cases', () => {
    it('should handle content that looks like both code and markdown', () => {
      // Markdown indicators should take precedence
      const content = '## Code Example\n```typescript\nconst x = 1;\n```';
      expect(detectContentType(content)).toBe('markdown');
    });

    it('should handle empty content', () => {
      expect(detectContentType('')).toBe('text');
    });

    it('should handle whitespace-only content', () => {
      expect(detectContentType('   \n\t  ')).toBe('text');
    });
  });
});
