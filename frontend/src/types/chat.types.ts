/**
 * Chat Types Module
 *
 * Type definitions for the chat UI components.
 *
 * @module types/chat
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Sender type for chat messages
 */
export type ChatSenderType = 'user' | 'orchestrator' | 'agent' | 'system';

/**
 * Message content type
 */
export type ChatContentType = 'text' | 'status' | 'task' | 'error' | 'system' | 'code' | 'markdown';

/**
 * Message delivery status
 */
export type ChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'error';

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
 * WebSocket event data for chat message
 */
export interface ChatMessageEventData {
  type: 'chat_message';
  data: ChatMessage;
  timestamp: string;
}

/**
 * WebSocket event data for typing indicator
 */
export interface ChatTypingEventData {
  type: 'chat_typing';
  data: {
    conversationId: string;
    sender: ChatSender;
    isTyping: boolean;
  };
  timestamp: string;
}

/**
 * WebSocket event data for conversation update
 */
export interface ConversationUpdatedEventData {
  type: 'conversation_updated';
  data: ChatConversation;
  timestamp: string;
}

/**
 * Union type for all chat WebSocket events
 */
export type ChatWebSocketEventData =
  | ChatMessageEventData
  | ChatTypingEventData
  | ConversationUpdatedEventData;
