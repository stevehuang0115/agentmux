/**
 * Chat API Service
 *
 * Provides methods for interacting with the chat backend API.
 *
 * @module services/chat
 */

import {
  ChatMessage,
  ChatConversation,
  SendMessageInput,
  SendMessageResult,
} from '../types/chat.types';

/** Base URL for chat API endpoints */
const API_BASE = '/api/chat';

/**
 * Chat API service class providing access to chat endpoints.
 *
 * Features:
 * - Type-safe API responses
 * - Consistent error handling
 * - Promise-based async operations
 */
class ChatApiService {
  /**
   * Send a new message to the chat.
   *
   * @param input - Message content and optional conversation ID
   * @returns Promise resolving to the sent message and conversation
   * @throws Error if the request fails
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const response = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to send message');
    }

    return data.data;
  }

  /**
   * Get messages for a conversation.
   *
   * @param conversationId - ID of the conversation
   * @param limit - Optional maximum number of messages to return
   * @param before - Optional timestamp to get messages before
   * @returns Promise resolving to array of messages
   * @throws Error if the request fails
   */
  async getMessages(
    conversationId: string,
    limit?: number,
    before?: string
  ): Promise<ChatMessage[]> {
    const params = new URLSearchParams({ conversationId });
    if (limit) params.set('limit', limit.toString());
    if (before) params.set('before', before);

    const response = await fetch(`${API_BASE}/messages?${params.toString()}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load messages');
    }

    return data.data;
  }

  /**
   * Get all conversations.
   *
   * @param includeArchived - Whether to include archived conversations
   * @returns Promise resolving to array of conversations
   * @throws Error if the request fails
   */
  async getConversations(includeArchived = false): Promise<ChatConversation[]> {
    const params = includeArchived ? '?includeArchived=true' : '';
    const response = await fetch(`${API_BASE}/conversations${params}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load conversations');
    }

    return data.data;
  }

  /**
   * Get the current active conversation.
   *
   * @returns Promise resolving to current conversation or null
   * @throws Error if the request fails
   */
  async getCurrentConversation(): Promise<ChatConversation | null> {
    const response = await fetch(`${API_BASE}/conversations/current`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load current conversation');
    }

    return data.data;
  }

  /**
   * Create a new conversation.
   *
   * @param title - Optional title for the conversation
   * @returns Promise resolving to the created conversation
   * @throws Error if the request fails
   */
  async createConversation(title?: string): Promise<ChatConversation> {
    const response = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create conversation');
    }

    return data.data;
  }

  /**
   * Update a conversation.
   *
   * @param id - Conversation ID
   * @param updates - Fields to update
   * @returns Promise resolving to the updated conversation
   * @throws Error if the request fails
   */
  async updateConversation(
    id: string,
    updates: { title?: string }
  ): Promise<ChatConversation> {
    const response = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update conversation');
    }

    return data.data;
  }

  /**
   * Delete a conversation.
   *
   * @param id - Conversation ID to delete
   * @throws Error if the request fails
   */
  async deleteConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete conversation');
    }
  }

  /**
   * Archive a conversation.
   *
   * @param id - Conversation ID to archive
   * @throws Error if the request fails
   */
  async archiveConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/conversations/${id}/archive`, {
      method: 'PUT',
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to archive conversation');
    }
  }

  /**
   * Clear all messages from a conversation.
   *
   * @param id - Conversation ID to clear
   * @throws Error if the request fails
   */
  async clearConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/conversations/${id}/clear`, {
      method: 'POST',
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to clear conversation');
    }
  }
}

/** Singleton instance of the chat API service */
export const chatService = new ChatApiService();

/** Export class for testing */
export { ChatApiService };
