/**
 * Chat Service Tests
 *
 * Tests for the chat API service.
 *
 * @module services/chat.service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatService, ChatApiService } from './chat.service';
import type { SendMessageResult, ChatConversation, ChatMessage } from '../types/chat.types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ChatApiService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // sendMessage Tests
  // ===========================================================================

  describe('sendMessage', () => {
    const mockResult: SendMessageResult = {
      message: {
        id: 'msg-1',
        conversationId: 'conv-1',
        from: { type: 'user' },
        content: 'Hello',
        contentType: 'text',
        status: 'sent',
        timestamp: new Date().toISOString(),
      },
      conversation: {
        id: 'conv-1',
        participantIds: ['user'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        messageCount: 1,
      },
    };

    it('should send a message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockResult }),
      });

      const result = await chatService.sendMessage({ content: 'Hello' });

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello' }),
      });
      expect(result).toEqual(mockResult);
    });

    it('should send a message with conversationId', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockResult }),
      });

      await chatService.sendMessage({
        content: 'Hello',
        conversationId: 'conv-1',
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello', conversationId: 'conv-1' }),
      });
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: 'Message send failed' }),
      });

      await expect(chatService.sendMessage({ content: 'Hello' })).rejects.toThrow(
        'Message send failed'
      );
    });

    it('should throw default error if no error message', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      });

      await expect(chatService.sendMessage({ content: 'Hello' })).rejects.toThrow(
        'Failed to send message'
      );
    });
  });

  // ===========================================================================
  // getMessages Tests
  // ===========================================================================

  describe('getMessages', () => {
    const mockMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        from: { type: 'user' },
        content: 'Hello',
        contentType: 'text',
        status: 'sent',
        timestamp: new Date().toISOString(),
      },
    ];

    it('should get messages for a conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockMessages }),
      });

      const result = await chatService.getMessages('conv-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat/messages?conversationId=conv-1'
      );
      expect(result).toEqual(mockMessages);
    });

    it('should include limit parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockMessages }),
      });

      await chatService.getMessages('conv-1', 50);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat/messages?conversationId=conv-1&limit=50'
      );
    });

    it('should include before parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockMessages }),
      });

      const before = '2024-01-15T10:00:00Z';
      await chatService.getMessages('conv-1', undefined, before);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/chat/messages?conversationId=conv-1&before=${encodeURIComponent(before)}`
      );
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: 'Messages not found' }),
      });

      await expect(chatService.getMessages('conv-1')).rejects.toThrow(
        'Messages not found'
      );
    });
  });

  // ===========================================================================
  // getConversations Tests
  // ===========================================================================

  describe('getConversations', () => {
    const mockConversations: ChatConversation[] = [
      {
        id: 'conv-1',
        participantIds: ['user'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        messageCount: 0,
      },
    ];

    it('should get all conversations', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockConversations }),
      });

      const result = await chatService.getConversations();

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/conversations');
      expect(result).toEqual(mockConversations);
    });

    it('should include archived flag', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockConversations }),
      });

      await chatService.getConversations(true);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat/conversations?includeArchived=true'
      );
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: 'Failed to fetch' }),
      });

      await expect(chatService.getConversations()).rejects.toThrow(
        'Failed to fetch'
      );
    });
  });

  // ===========================================================================
  // getCurrentConversation Tests
  // ===========================================================================

  describe('getCurrentConversation', () => {
    const mockConversation: ChatConversation = {
      id: 'conv-1',
      participantIds: ['user'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      messageCount: 0,
    };

    it('should get current conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: true, data: mockConversation }),
      });

      const result = await chatService.getCurrentConversation();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat/conversations/current'
      );
      expect(result).toEqual(mockConversation);
    });

    it('should return null when no current conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: null }),
      });

      const result = await chatService.getCurrentConversation();

      expect(result).toBeNull();
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: 'Not found' }),
      });

      await expect(chatService.getCurrentConversation()).rejects.toThrow(
        'Not found'
      );
    });
  });

  // ===========================================================================
  // createConversation Tests
  // ===========================================================================

  describe('createConversation', () => {
    const mockConversation: ChatConversation = {
      id: 'conv-1',
      title: 'Test',
      participantIds: ['user'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      messageCount: 0,
    };

    it('should create a conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: true, data: mockConversation }),
      });

      const result = await chatService.createConversation('Test');

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' }),
      });
      expect(result).toEqual(mockConversation);
    });

    it('should create conversation without title', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: true, data: mockConversation }),
      });

      await chatService.createConversation();

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: undefined }),
      });
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: 'Create failed' }),
      });

      await expect(chatService.createConversation()).rejects.toThrow(
        'Create failed'
      );
    });
  });

  // ===========================================================================
  // updateConversation Tests
  // ===========================================================================

  describe('updateConversation', () => {
    const mockConversation: ChatConversation = {
      id: 'conv-1',
      title: 'Updated Title',
      participantIds: ['user'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      messageCount: 0,
    };

    it('should update a conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: true, data: mockConversation }),
      });

      const result = await chatService.updateConversation('conv-1', {
        title: 'Updated Title',
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/conversations/conv-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Title' }),
      });
      expect(result).toEqual(mockConversation);
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: 'Update failed' }),
      });

      await expect(
        chatService.updateConversation('conv-1', { title: 'New' })
      ).rejects.toThrow('Update failed');
    });
  });

  // ===========================================================================
  // deleteConversation Tests
  // ===========================================================================

  describe('deleteConversation', () => {
    it('should delete a conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      await chatService.deleteConversation('conv-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/conversations/conv-1', {
        method: 'DELETE',
      });
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: 'Delete failed' }),
      });

      await expect(chatService.deleteConversation('conv-1')).rejects.toThrow(
        'Delete failed'
      );
    });
  });

  // ===========================================================================
  // archiveConversation Tests
  // ===========================================================================

  describe('archiveConversation', () => {
    it('should archive a conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      await chatService.archiveConversation('conv-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat/conversations/conv-1/archive',
        {
          method: 'PUT',
        }
      );
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: 'Archive failed' }),
      });

      await expect(chatService.archiveConversation('conv-1')).rejects.toThrow(
        'Archive failed'
      );
    });
  });

  // ===========================================================================
  // clearConversation Tests
  // ===========================================================================

  describe('clearConversation', () => {
    it('should clear a conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      await chatService.clearConversation('conv-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat/conversations/conv-1/clear',
        {
          method: 'POST',
        }
      );
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: 'Clear failed' }),
      });

      await expect(chatService.clearConversation('conv-1')).rejects.toThrow(
        'Clear failed'
      );
    });
  });

  // ===========================================================================
  // Singleton Tests
  // ===========================================================================

  describe('singleton', () => {
    it('should export a singleton instance', () => {
      expect(chatService).toBeInstanceOf(ChatApiService);
    });

    it('should be the same instance', () => {
      const service1 = chatService;
      const service2 = chatService;
      expect(service1).toBe(service2);
    });
  });
});
