/**
 * Chat Types Module
 *
 * Type definitions for the chat-based dashboard. Provides a conversational
 * interface with the Orchestrator, transforming raw terminal output into
 * clean, formatted chat messages.
 *
 * @module types/chat
 */

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
export function createConversation(title?: string): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: generateChatId(),
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
 * Removes ANSI escape codes, control characters, and trims whitespace.
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
  // Remove ANSI color codes
  let cleaned = content.replace(/\x1b\[[0-9;]*m/g, '');

  // Remove other ANSI escape sequences (cursor movement, etc.)
  cleaned = cleaned.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

  // Remove other control characters except newlines and tabs
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  cleaned = cleaned.trim();

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
    pattern: /\[CHAT_RESPONSE\]([\s\S]*?)\[\/CHAT_RESPONSE\]/i,
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
