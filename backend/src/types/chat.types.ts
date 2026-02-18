/**
 * Chat Types Module
 *
 * Type definitions for the chat-based dashboard. Provides a conversational
 * interface with the Orchestrator, transforming raw terminal output into
 * clean, formatted chat messages.
 *
 * @module types/chat
 */

import { TERMINAL_FORMATTING_CONSTANTS } from '../constants.js';
import { stripAnsiCodes } from '../utils/terminal-output.utils.js';

// =============================================================================
// Enums and Constants
// =============================================================================

/**
 * Valid sender types for chat messages
 */
export const CHAT_SENDER_TYPES = ['user', 'orchestrator', 'agent', 'system'] as const;

/**
 * Valid content types for chat messages
 */
export const CHAT_CONTENT_TYPES = [
  'text',
  'status',
  'task',
  'error',
  'system',
  'code',
  'markdown',
] as const;

/**
 * Valid message status values
 */
export const CHAT_MESSAGE_STATUSES = ['sending', 'sent', 'delivered', 'error'] as const;

/**
 * Chat-related constants
 */
export const CHAT_CONSTANTS = {
  /** Default limits */
  DEFAULTS: {
    /** Default message limit for pagination */
    MESSAGE_LIMIT: 100,
    /** Default conversation limit for pagination */
    CONVERSATION_LIMIT: 50,
    /** Maximum content length for last message preview */
    PREVIEW_LENGTH: 100,
  },
  /** Response extraction patterns */
  PATTERNS: {
    /** Pattern names */
    EXPLICIT: 'explicit',
    CHAT: 'chat',
    CODEBLOCK: 'codeblock',
  },
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Sender type for chat messages
 */
export type ChatSenderType = (typeof CHAT_SENDER_TYPES)[number];

/**
 * Message content type
 */
export type ChatContentType = (typeof CHAT_CONTENT_TYPES)[number];

/**
 * Message delivery status
 */
export type ChatMessageStatus = (typeof CHAT_MESSAGE_STATUSES)[number];

/**
 * Sender information for a chat message
 */
export interface ChatSender {
  /** Type of sender */
  type: ChatSenderType;

  /** ID of the agent/session if applicable */
  id?: string;

  /** Display name */
  name?: string;

  /** Role name if sender is an agent */
  role?: string;
}

/**
 * Valid Slack delivery statuses for NOTIFY reconciliation
 */
export const SLACK_DELIVERY_STATUSES = ['pending', 'delivered', 'failed'] as const;

/**
 * Slack delivery status type
 */
export type SlackDeliveryStatus = (typeof SLACK_DELIVERY_STATUSES)[number];

/**
 * Metadata attached to a chat message
 */
export interface ChatMessageMetadata {
  /** ID of skill used to generate this response */
  skillUsed?: string;

  /** ID of task created as a result of this message */
  taskCreated?: string;

  /** ID of project created */
  projectCreated?: string;

  /** Original raw terminal output (for debugging) */
  rawOutput?: string;

  /** Agent session ID that generated this message */
  sessionId?: string;

  /** Time taken to generate response in ms */
  responseTimeMs?: number;

  /** Slack delivery status for NOTIFY reconciliation */
  slackDeliveryStatus?: SlackDeliveryStatus;

  /** ISO timestamp of last Slack delivery attempt */
  slackDeliveryAttemptedAt?: string;

  /** Number of Slack delivery attempts */
  slackDeliveryAttempts?: number;

  /** Error message from last failed Slack delivery attempt */
  slackDeliveryError?: string;

  /** Slack channel ID for delivery/reconciliation */
  slackChannelId?: string;

  /** Slack thread timestamp for threaded replies */
  slackThreadTs?: string;

  /** NOTIFY type (e.g. task_completed, agent_error) */
  notifyType?: string;

  /** NOTIFY title header */
  notifyTitle?: string;

  /** NOTIFY urgency level */
  notifyUrgency?: string;

  /** Additional custom metadata */
  [key: string]: unknown;
}

/**
 * A single chat message
 */
export interface ChatMessage {
  /** Unique message ID */
  id: string;

  /** Conversation this message belongs to */
  conversationId: string;

  /** Sender information */
  from: ChatSender;

  /** Message content (may be markdown formatted) */
  content: string;

  /** Type of content */
  contentType: ChatContentType;

  /** Optional metadata */
  metadata?: ChatMessageMetadata;

  /** Delivery status */
  status: ChatMessageStatus;

  /** ISO timestamp */
  timestamp: string;

  /** Parent message ID for threading (optional) */
  parentId?: string;
}

/**
 * Last message preview in a conversation
 */
export interface LastMessagePreview {
  /** Truncated content preview */
  content: string;

  /** ISO timestamp of the message */
  timestamp: string;

  /** Sender information */
  from: ChatSender;
}

/**
 * A chat conversation (collection of messages)
 */
export interface ChatConversation {
  /** Unique conversation ID */
  id: string;

  /** Conversation title (auto-generated or user-set) */
  title?: string;

  /** IDs of participants (user, orchestrator, agents) */
  participantIds: string[];

  /** ISO timestamp of creation */
  createdAt: string;

  /** ISO timestamp of last update */
  updatedAt: string;

  /** Whether this conversation is archived */
  isArchived: boolean;

  /** Number of messages in conversation */
  messageCount: number;

  /** Last message preview */
  lastMessage?: LastMessagePreview;
}

/**
 * Input for sending a new message
 */
export interface SendMessageInput {
  /** Message content */
  content: string;

  /** Conversation ID (creates new if not provided) */
  conversationId?: string;

  /** Optional metadata to attach */
  metadata?: Record<string, unknown>;
}

/**
 * Response from sending a message
 */
export interface SendMessageResult {
  /** The sent message */
  message: ChatMessage;

  /** The conversation (may be newly created) */
  conversation: ChatConversation;
}

/**
 * Filter options for listing messages
 */
export interface ChatMessageFilter {
  /** Filter by conversation */
  conversationId?: string;

  /** Filter by sender type */
  senderType?: ChatSenderType;

  /** Filter by content type */
  contentType?: ChatContentType;

  /** Messages after this timestamp */
  after?: string;

  /** Messages before this timestamp */
  before?: string;

  /** Maximum number of messages to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Filter options for listing conversations
 */
export interface ConversationFilter {
  /** Include archived conversations */
  includeArchived?: boolean;

  /** Search in title and messages */
  search?: string;

  /** Limit number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Response extraction pattern configuration
 */
export interface ResponsePattern {
  /** Pattern name for identification */
  name: string;

  /** Regex pattern to match */
  pattern: RegExp;

  /** Extraction group index (default 1) */
  groupIndex?: number;
}

/**
 * Chat message WebSocket event
 */
export interface ChatMessageEvent {
  type: 'chat_message';
  data: ChatMessage;
}

/**
 * Typing indicator WebSocket event
 */
export interface ChatTypingEvent {
  type: 'chat_typing';
  data: {
    conversationId: string;
    sender: ChatSender;
    isTyping: boolean;
  };
}

/**
 * Message status update WebSocket event
 */
export interface ChatStatusEvent {
  type: 'chat_status';
  data: {
    messageId: string;
    status: ChatMessageStatus;
  };
}

/**
 * Conversation update WebSocket event
 */
export interface ConversationUpdatedEvent {
  type: 'conversation_updated';
  data: ChatConversation;
}

/**
 * Union type for all chat WebSocket events
 */
export type ChatWebSocketEvent =
  | ChatMessageEvent
  | ChatTypingEvent
  | ChatStatusEvent
  | ConversationUpdatedEvent;

/**
 * Input for creating a chat message
 */
export interface CreateChatMessageInput {
  /** Conversation ID */
  conversationId: string;

  /** Message content */
  content: string;

  /** Sender information */
  from: ChatSender;

  /** Optional content type (defaults to 'text') */
  contentType?: ChatContentType;

  /** Optional status (defaults to 'sent') */
  status?: ChatMessageStatus;

  /** Optional metadata */
  metadata?: ChatMessageMetadata;

  /** Optional timestamp (defaults to now) */
  timestamp?: string;

  /** Optional parent message ID for threading */
  parentId?: string;
}

/**
 * Urgency levels for notifications
 */
export const NOTIFY_URGENCY_LEVELS = ['low', 'normal', 'high', 'critical'] as const;

/**
 * Urgency level type
 */
export type NotifyUrgency = (typeof NOTIFY_URGENCY_LEVELS)[number];

/**
 * Unified notification payload from [NOTIFY]...[/NOTIFY] markers.
 *
 * The orchestrator outputs header+body content inside [NOTIFY] markers to route
 * messages to chat, Slack, or both depending on which header fields are present:
 * - `conversationId` present → route to chat UI
 * - `channelId` present → route to Slack
 * - Both → both (common case)
 * - Neither + activeConversationId exists → fallback to chat
 *
 * Format:
 * ```
 * [NOTIFY]
 * conversationId: conv-abc123
 * channelId: D0AC7NF5N7L
 * type: task_completed
 * ---
 * ## Message body here
 * [/NOTIFY]
 * ```
 */
export interface NotifyPayload {
  /** Required — markdown content for the notification */
  message: string;

  /** Route to chat UI conversation (copied from incoming [CHAT:convId]) */
  conversationId?: string;

  /** Route to Slack channel */
  channelId?: string;

  /** Slack thread timestamp for threaded replies */
  threadTs?: string;

  /** Notification type (e.g. task_completed, agent_error, project_update) */
  type?: string;

  /** Header text for Slack notifications */
  title?: string;

  /** Urgency level for notification routing */
  urgency?: NotifyUrgency;
}

/**
 * Check if a value is a valid NotifyPayload
 *
 * Validates that the payload has a required `message` string field
 * and that optional fields have correct types when present.
 *
 * @param value - Value to check
 * @returns True if value is a valid NotifyPayload
 */
export function isValidNotifyPayload(value: unknown): value is NotifyPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;

  // message is required and must be a non-empty string
  if (typeof payload.message !== 'string' || !payload.message.trim()) {
    return false;
  }

  // Optional string fields
  const optionalStringFields = ['conversationId', 'channelId', 'threadTs', 'type', 'title'] as const;
  for (const field of optionalStringFields) {
    if (payload[field] !== undefined && typeof payload[field] !== 'string') {
      return false;
    }
  }

  // urgency must be a valid level if present
  if (payload.urgency !== undefined) {
    if (typeof payload.urgency !== 'string' || !NOTIFY_URGENCY_LEVELS.includes(payload.urgency as NotifyUrgency)) {
      return false;
    }
  }

  return true;
}

/** Known header keys that can appear in NOTIFY blocks */
const KNOWN_HEADER_KEYS = new Set([
  'conversationId', 'channelId', 'threadTs', 'type', 'title', 'urgency',
]);

/**
 * TUI box-drawing and border characters used by Gemini CLI and other TUI tools.
 * Matches common Unicode box-drawing chars and ASCII pipe characters.
 */
const TUI_BORDER_CHARS = /[│┃┆┇┊┋╎╏║|]/;

/**
 * Strip TUI box-drawing border characters from content lines.
 *
 * Gemini CLI wraps terminal output in a TUI with box-drawing borders
 * (│, ┃, |, etc.) that corrupt header parsing and leak into message bodies.
 * This function removes leading/trailing border chars and associated whitespace
 * from each line, plus removes pure border/decoration lines (─, ┌, └, etc.).
 *
 * @param content - Content that may contain TUI border artifacts
 * @returns Content with TUI borders stripped from each line
 */
function stripTuiBorders(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      // Preserve --- separator lines (used for header-body split)
      if (/^\s*---\s*$/.test(line)) {
        return '---';
      }
      // Skip pure decoration lines (box corners, horizontal rules)
      // that contain only box-drawing characters, not regular dashes
      if (/^[\s│┃┆┇┊┋╎╏║─━┄┅┈┉╌╍═┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬╭╮╰╯]+$/.test(line)) {
        return '';
      }
      // Strip leading border chars and adjacent whitespace, and trailing whitespace + border chars.
      // Only strip whitespace that's adjacent to an actual border character to avoid
      // stripping meaningful whitespace from PTY-wrapped JSON continuation lines.
      return line
        .replace(/^[│┃┆┇┊┋╎╏║|]+\s*/, '')
        .replace(/\s*[│┃┆┇┊┋╎╏║|]+$/, '');
    })
    .join('\n');
}

/**
 * Attempt to parse headers from content where a blank line is used as separator
 * instead of `---`. This handles the common LLM behavior of omitting the `---`.
 *
 * Only activates if the first line matches a known header key pattern.
 *
 * @param cleaned - ANSI-stripped, trimmed content
 * @returns Object with headers and body strings, or null if not header-like
 */
function parseHeadersWithBlankLineSeparator(cleaned: string): { headers: string; body: string } | null {
  // Check if first line looks like a known header
  const firstNewline = cleaned.indexOf('\n');
  if (firstNewline === -1) return null;

  const firstLine = cleaned.slice(0, firstNewline).trim();
  const colonIdx = firstLine.indexOf(':');
  if (colonIdx === -1) return null;

  const firstKey = firstLine.slice(0, colonIdx).trim();
  if (!KNOWN_HEADER_KEYS.has(firstKey)) return null;

  // Split on first blank line (two consecutive newlines)
  const blankMatch = cleaned.match(/^([\s\S]*?)\n\s*\n([\s\S]*)$/);
  if (!blankMatch) return null;

  const headers = blankMatch[1].trim();
  const body = blankMatch[2].trim();
  if (!body) return null;

  return { headers, body };
}

/**
 * Parse raw content from a [NOTIFY]...[/NOTIFY] block into a NotifyPayload.
 *
 * Supports three formats:
 * 1. **Header+body with `---`** (preferred): key-value headers before a `---` separator,
 *    with the message body after it. Headers are short (~25 chars), so they are
 *    never corrupted by PTY line-wrapping.
 * 2. **Header+body with blank line** (fallback): same as above but with a blank
 *    line instead of `---`. Activated only when the first line is a known header.
 * 3. **Legacy JSON** (fallback): if the content starts with `{`, it is parsed as
 *    JSON with PTY artifact cleanup for backward compatibility.
 *
 * @param raw - Raw content between [NOTIFY] and [/NOTIFY] markers
 * @returns Parsed NotifyPayload or null if content is invalid
 *
 * @example
 * ```typescript
 * // Header+body format
 * const payload = parseNotifyContent(
 *   'conversationId: conv-abc\ntype: task_completed\n---\n## Done\nTask finished.'
 * );
 * // => { message: '## Done\nTask finished.', conversationId: 'conv-abc', type: 'task_completed' }
 *
 * // Legacy JSON format (auto-detected)
 * const legacy = parseNotifyContent('{"message":"Hello","conversationId":"conv-1"}');
 * // => { message: 'Hello', conversationId: 'conv-1' }
 * ```
 */
export function parseNotifyContent(raw: string): NotifyPayload | null {
  // Strip ANSI escape sequences using the canonical utility, then strip
  // TUI box-drawing borders (Gemini CLI wraps output in │...│ borders)
  const cleaned = stripTuiBorders(stripAnsiCodes(raw)).trim();

  if (!cleaned) {
    return null;
  }

  // JSON fallback for transition period
  if (cleaned.startsWith('{')) {
    return parseLegacyJsonNotify(cleaned);
  }

  // Split on --- separator line (separator may be followed by content or end of string)
  // The \n before --- is optional to handle content that starts directly with ---
  const sepMatch = cleaned.match(/^([\s\S]*?)(?:^|\n)---(?:\n([\s\S]*))?$/);

  let headerSection: string;
  let body: string;

  if (sepMatch) {
    headerSection = sepMatch[1].trim();
    body = (sepMatch[2] || '').trim();
  } else {
    // Fallback: LLMs sometimes use a blank line instead of ---
    // If the content starts with known header-like lines, split on first blank line
    const blankLineResult = parseHeadersWithBlankLineSeparator(cleaned);
    if (blankLineResult) {
      headerSection = blankLineResult.headers;
      body = blankLineResult.body;
    } else {
      // No headers — entire content is the message
      const msg = cleaned.trim();
      return msg ? { message: msg } : null;
    }
  }

  if (!body) {
    return null;
  }

  const payload: NotifyPayload = { message: body };
  for (const line of headerSection.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!value) continue;
    switch (key) {
      case 'conversationId': payload.conversationId = value; break;
      case 'channelId': payload.channelId = value; break;
      case 'threadTs': payload.threadTs = value; break;
      case 'type': payload.type = value; break;
      case 'title': payload.title = value; break;
      case 'urgency':
        if (NOTIFY_URGENCY_LEVELS.includes(value as NotifyUrgency)) {
          payload.urgency = value as NotifyUrgency;
        }
        break;
    }
  }

  return payload;
}

/**
 * Parse legacy JSON notify content with PTY artifact cleanup.
 *
 * Cleans terminal line-wrapping artifacts (newlines, padding spaces, orphaned
 * ANSI sequences) before parsing as JSON, then validates via isValidNotifyPayload.
 *
 * @param cleaned - Pre-cleaned content that starts with '{'
 * @returns Parsed NotifyPayload or null if parsing/validation fails
 */
function parseLegacyJsonNotify(cleaned: string): NotifyPayload | null {
  const jsonCleaned = cleaned
    .replace(/[\r\n]+\s*/g, '')     // remove newlines and trailing padding (PTY indent)
    .replace(/\s{2,}/g, ' ');       // collapse remaining multi-space runs

  try {
    const parsed = JSON.parse(jsonCleaned);
    if (!isValidNotifyPayload(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Storage format for chat data
 */
export interface ChatStorageFormat {
  /** The conversation */
  conversation: ChatConversation;

  /** Messages in the conversation */
  messages: ChatMessage[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid sender type
 *
 * @param value - Value to check
 * @returns True if value is a valid ChatSenderType
 */
export function isValidSenderType(value: string): value is ChatSenderType {
  return CHAT_SENDER_TYPES.includes(value as ChatSenderType);
}

/**
 * Check if a value is a valid content type
 *
 * @param value - Value to check
 * @returns True if value is a valid ChatContentType
 */
export function isValidContentType(value: string): value is ChatContentType {
  return CHAT_CONTENT_TYPES.includes(value as ChatContentType);
}

/**
 * Check if a value is a valid message status
 *
 * @param value - Value to check
 * @returns True if value is a valid ChatMessageStatus
 */
export function isValidMessageStatus(value: string): value is ChatMessageStatus {
  return CHAT_MESSAGE_STATUSES.includes(value as ChatMessageStatus);
}

/**
 * Check if an object is a valid ChatSender
 *
 * @param value - Value to check
 * @returns True if value is a valid ChatSender object
 */
export function isValidChatSender(value: unknown): value is ChatSender {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const sender = value as Record<string, unknown>;

  if (typeof sender.type !== 'string' || !isValidSenderType(sender.type)) {
    return false;
  }

  if (sender.id !== undefined && typeof sender.id !== 'string') {
    return false;
  }

  if (sender.name !== undefined && typeof sender.name !== 'string') {
    return false;
  }

  if (sender.role !== undefined && typeof sender.role !== 'string') {
    return false;
  }

  return true;
}

/**
 * Check if an object is a valid ChatMessage
 *
 * @param value - Value to check
 * @returns True if value is a valid ChatMessage object
 */
export function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Record<string, unknown>;

  if (typeof message.id !== 'string' || !message.id) {
    return false;
  }

  if (typeof message.conversationId !== 'string' || !message.conversationId) {
    return false;
  }

  if (!isValidChatSender(message.from)) {
    return false;
  }

  if (typeof message.content !== 'string') {
    return false;
  }

  if (typeof message.contentType !== 'string' || !isValidContentType(message.contentType)) {
    return false;
  }

  if (typeof message.status !== 'string' || !isValidMessageStatus(message.status)) {
    return false;
  }

  if (typeof message.timestamp !== 'string') {
    return false;
  }

  return true;
}

/**
 * Check if an object is a valid ChatConversation
 *
 * @param value - Value to check
 * @returns True if value is a valid ChatConversation object
 */
export function isValidChatConversation(value: unknown): value is ChatConversation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const conv = value as Record<string, unknown>;

  if (typeof conv.id !== 'string' || !conv.id) {
    return false;
  }

  if (!Array.isArray(conv.participantIds)) {
    return false;
  }

  if (typeof conv.createdAt !== 'string') {
    return false;
  }

  if (typeof conv.updatedAt !== 'string') {
    return false;
  }

  if (typeof conv.isArchived !== 'boolean') {
    return false;
  }

  if (typeof conv.messageCount !== 'number') {
    return false;
  }

  return true;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique ID for chat entities
 *
 * @returns A unique identifier string
 */
export function generateChatId(): string {
  return crypto.randomUUID();
}

/**
 * Create a chat message with defaults
 *
 * @param input - Partial message input with required fields
 * @returns A complete ChatMessage object
 *
 * @example
 * ```typescript
 * const message = createChatMessage({
 *   conversationId: 'conv-1',
 *   content: 'Hello!',
 *   from: { type: 'user' },
 * });
 * ```
 */
export function createChatMessage(input: CreateChatMessageInput): ChatMessage {
  return {
    id: generateChatId(),
    conversationId: input.conversationId,
    from: input.from,
    content: input.content,
    contentType: input.contentType ?? 'text',
    status: input.status ?? 'sent',
    timestamp: input.timestamp ?? new Date().toISOString(),
    metadata: input.metadata,
    parentId: input.parentId,
  };
}

/**
 * Create a conversation with defaults
 *
 * @param title - Optional title for the conversation
 * @returns A new ChatConversation object
 *
 * @example
 * ```typescript
 * const conversation = createConversation('Project Discussion');
 * ```
 */
export function createConversation(title?: string, idOverride?: string): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: idOverride ?? generateChatId(),
    title,
    participantIds: [],
    createdAt: now,
    updatedAt: now,
    isArchived: false,
    messageCount: 0,
  };
}

/**
 * Format message content by cleaning terminal output
 *
 * Removes ANSI escape codes, control characters, carriage returns (which cause
 * text to overwrite itself in terminals), and trims whitespace.
 *
 * @param content - Raw content to format
 * @returns Cleaned content string
 *
 * @example
 * ```typescript
 * const clean = formatMessageContent('\x1b[32mGreen text\x1b[0m');
 * // Returns: 'Green text'
 * ```
 */
export function formatMessageContent(content: string): string {
  let cleaned = content;

  // IMPORTANT: Convert cursor movement sequences to spaces BEFORE stripping other ANSI codes
  // Terminal uses \x1b[nC (cursor forward n positions) to create visual spacing
  // We need to convert these to actual spaces to preserve word separation
  // Uses TERMINAL_FORMATTING_CONSTANTS.MAX_CURSOR_REPEAT to cap repeat count
  const maxRepeat = TERMINAL_FORMATTING_CONSTANTS.MAX_CURSOR_REPEAT;
  cleaned = cleaned.replace(/\x1b\[(\d+)C/g, (_match, count) => {
    const num = parseInt(count, 10);
    if (Number.isNaN(num) || num < 0) return '';
    return ' '.repeat(Math.min(num, maxRepeat));
  });

  // Convert cursor down sequences to newlines
  cleaned = cleaned.replace(/\x1b\[(\d+)B/g, (_match, count) => {
    const num = parseInt(count, 10);
    if (Number.isNaN(num) || num < 0) return '';
    return '\n'.repeat(Math.min(num, maxRepeat));
  });

  // Remove ANSI color/style codes (SGR sequences)
  cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, '');

  // Remove remaining ANSI escape sequences (cursor position, clear screen, etc.)
  cleaned = cleaned.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

  // Remove OSC (Operating System Command) sequences (e.g., terminal title changes)
  cleaned = cleaned.replace(/\x1b\][^\x07]*\x07/g, '');

  // Remove CSI sequences that might not be caught above
  cleaned = cleaned.replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, '');

  // Handle carriage returns - terminal uses \r to return cursor to start of line
  // This can cause text overwriting. Split by \r and keep the last segment of each line
  cleaned = cleaned
    .split('\n')
    .map((line) => {
      // If line contains \r, split by it and keep the last non-empty segment
      if (line.includes('\r')) {
        const segments = line.split('\r');
        // Find the last non-empty segment
        for (let i = segments.length - 1; i >= 0; i--) {
          if (segments[i].trim()) {
            return segments[i];
          }
        }
        return '';
      }
      return line;
    })
    .join('\n');

  // Clean orphaned CSI fragments from PTY buffer boundary splits.
  // When ESC char lands in one chunk and the CSI params in the next,
  // artifacts like "[1C" or "[22m" appear mid-word.
  // Note: \d+ (one or more digits) to avoid matching [C in [CHAT_RESPONSE]
  // Multi-param CSI like [38;2;249;226;175m from Gemini CLI truecolor output
  cleaned = cleaned.replace(/\[\d+C/g, ' ');
  cleaned = cleaned.replace(/\[\d+(?:;\d+)*[A-BJKHfm]/g, '');

  // Remove other control characters except newlines and tabs
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize multiple consecutive spaces to single space (but preserve newlines)
  cleaned = cleaned.replace(/ +/g, ' ');

  // Clean up multiple blank lines (more than 2 consecutive newlines become 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace from each line and remove leading/trailing whitespace
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return cleaned;
}

/**
 * Default response extraction patterns
 */
export const DEFAULT_RESPONSE_PATTERNS: ResponsePattern[] = [
  {
    name: CHAT_CONSTANTS.PATTERNS.EXPLICIT,
    pattern: /\[RESPONSE\]([\s\S]*?)\[\/RESPONSE\]/i,
    groupIndex: 1,
  },
  {
    name: CHAT_CONSTANTS.PATTERNS.CHAT,
    pattern: /\[CHAT_RESPONSE(?::[^\]]*)?\]([\s\S]*?)\[\/CHAT_RESPONSE\]/i,
    groupIndex: 1,
  },
  {
    name: CHAT_CONSTANTS.PATTERNS.CODEBLOCK,
    pattern: /```response\n([\s\S]*?)```/i,
    groupIndex: 1,
  },
];

/**
 * Extract response from raw output using patterns
 *
 * Tries multiple patterns to extract the clean response from
 * raw terminal output. Returns the original output if no pattern matches.
 *
 * @param rawOutput - Raw terminal output
 * @param customPatterns - Optional custom patterns to use instead of defaults
 * @returns Extracted response content
 *
 * @example
 * ```typescript
 * const response = extractResponseFromOutput(
 *   'some text [RESPONSE]Hello World[/RESPONSE] more text'
 * );
 * // Returns: 'Hello World'
 * ```
 */
export function extractResponseFromOutput(
  rawOutput: string,
  customPatterns?: ResponsePattern[]
): string {
  const patterns = customPatterns ?? DEFAULT_RESPONSE_PATTERNS;

  for (const { pattern, groupIndex = 1 } of patterns) {
    const match = rawOutput.match(pattern);
    // Check if match exists and has the capture group (even if empty string)
    if (match && match[groupIndex] !== undefined) {
      return match[groupIndex].trim();
    }
  }

  // No pattern matched, return original output
  return rawOutput;
}

/**
 * Detect the content type of a message based on its content
 *
 * @param content - Message content to analyze
 * @returns Detected content type
 *
 * @example
 * ```typescript
 * const type = detectContentType('## Heading\n- Item');
 * // Returns: 'markdown'
 * ```
 */
export function detectContentType(content: string): ChatContentType {
  // Check for markdown indicators
  if (
    content.includes('```') ||
    content.includes('##') ||
    content.includes('**') ||
    /^[-*] /.test(content) ||
    /^\d+\. /.test(content)
  ) {
    return 'markdown';
  }

  // Check for code patterns
  if (
    content.includes('function ') ||
    content.includes('const ') ||
    content.includes('import ') ||
    content.includes('export ') ||
    content.includes('class ') ||
    /^(let|var)\s/.test(content)
  ) {
    return 'code';
  }

  // Check for error patterns
  if (
    content.toLowerCase().includes('error:') ||
    content.toLowerCase().includes('exception:') ||
    content.includes('Error:') ||
    content.includes('Failed:')
  ) {
    return 'error';
  }

  return 'text';
}

/**
 * Create a last message preview from a chat message
 *
 * @param message - The chat message to create preview from
 * @param maxLength - Maximum content length (default: CHAT_CONSTANTS.DEFAULTS.PREVIEW_LENGTH)
 * @returns A LastMessagePreview object
 */
export function createLastMessagePreview(
  message: ChatMessage,
  maxLength: number = CHAT_CONSTANTS.DEFAULTS.PREVIEW_LENGTH
): LastMessagePreview {
  let previewContent = message.content;
  if (previewContent.length > maxLength) {
    previewContent = previewContent.slice(0, maxLength - 3) + '...';
  }

  return {
    content: previewContent,
    timestamp: message.timestamp,
    from: message.from,
  };
}

/**
 * Validate SendMessageInput
 *
 * @param input - Input to validate
 * @returns Object with valid flag and optional error message
 */
export function validateSendMessageInput(input: unknown): { valid: boolean; error?: string } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Input must be an object' };
  }

  const data = input as Record<string, unknown>;

  if (typeof data.content !== 'string') {
    return { valid: false, error: 'Content must be a string' };
  }

  if (data.content.trim().length === 0) {
    return { valid: false, error: 'Content cannot be empty' };
  }

  if (data.conversationId !== undefined && typeof data.conversationId !== 'string') {
    return { valid: false, error: 'ConversationId must be a string' };
  }

  if (data.metadata !== undefined && (typeof data.metadata !== 'object' || data.metadata === null)) {
    return { valid: false, error: 'Metadata must be an object' };
  }

  return { valid: true };
}

/**
 * Validate ChatMessageFilter
 *
 * @param filter - Filter to validate
 * @returns Object with valid flag and optional error message
 */
export function validateChatMessageFilter(filter: unknown): { valid: boolean; error?: string } {
  if (!filter || typeof filter !== 'object') {
    return { valid: false, error: 'Filter must be an object' };
  }

  const data = filter as Record<string, unknown>;

  if (data.conversationId !== undefined && typeof data.conversationId !== 'string') {
    return { valid: false, error: 'ConversationId must be a string' };
  }

  if (data.senderType !== undefined && !isValidSenderType(data.senderType as string)) {
    return { valid: false, error: 'Invalid sender type' };
  }

  if (data.contentType !== undefined && !isValidContentType(data.contentType as string)) {
    return { valid: false, error: 'Invalid content type' };
  }

  if (data.limit !== undefined && (typeof data.limit !== 'number' || data.limit < 1)) {
    return { valid: false, error: 'Limit must be a positive number' };
  }

  if (data.offset !== undefined && (typeof data.offset !== 'number' || data.offset < 0)) {
    return { valid: false, error: 'Offset must be a non-negative number' };
  }

  return { valid: true };
}

/**
 * Validate ConversationFilter
 *
 * @param filter - Filter to validate
 * @returns Object with valid flag and optional error message
 */
export function validateConversationFilter(filter: unknown): { valid: boolean; error?: string } {
  if (!filter || typeof filter !== 'object') {
    return { valid: false, error: 'Filter must be an object' };
  }

  const data = filter as Record<string, unknown>;

  if (data.includeArchived !== undefined && typeof data.includeArchived !== 'boolean') {
    return { valid: false, error: 'IncludeArchived must be a boolean' };
  }

  if (data.search !== undefined && typeof data.search !== 'string') {
    return { valid: false, error: 'Search must be a string' };
  }

  if (data.limit !== undefined && (typeof data.limit !== 'number' || data.limit < 1)) {
    return { valid: false, error: 'Limit must be a positive number' };
  }

  if (data.offset !== undefined && (typeof data.offset !== 'number' || data.offset < 0)) {
    return { valid: false, error: 'Offset must be a non-negative number' };
  }

  return { valid: true };
}
