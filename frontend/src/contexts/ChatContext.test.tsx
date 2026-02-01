/**
 * Chat Context Tests
 *
 * Tests for the ChatContext provider and useChat hook.
 *
 * @module contexts/ChatContext.test
 */

import React from 'react';
import { render, act, renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatProvider, useChat } from './ChatContext';
import { chatService } from '../services/chat.service';
import { webSocketService } from '../services/websocket.service';
import type { ChatConversation, ChatMessage } from '../types/chat.types';

// Mock the services
vi.mock('../services/chat.service', () => ({
  chatService: {
    getConversations: vi.fn(),
    getCurrentConversation: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    archiveConversation: vi.fn(),
    clearConversation: vi.fn(),
  },
}));

vi.mock('../services/websocket.service', () => ({
  webSocketService: {
    on: vi.fn(),
    off: vi.fn(),
  },
}));

const mockChatService = chatService as jest.Mocked<typeof chatService>;
const mockWebSocketService = webSocketService as jest.Mocked<typeof webSocketService>;

// Sample test data
const mockConversation: ChatConversation = {
  id: 'conv-1',
  title: 'Test Chat',
  participantIds: ['user'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isArchived: false,
  messageCount: 1,
};

const mockMessage: ChatMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  from: { type: 'user' },
  content: 'Hello!',
  contentType: 'text',
  status: 'sent',
  timestamp: new Date().toISOString(),
};

describe('ChatContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockChatService.getConversations.mockResolvedValue([mockConversation]);
    mockChatService.getCurrentConversation.mockResolvedValue(mockConversation);
    mockChatService.getMessages.mockResolvedValue([mockMessage]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ChatProvider', () => {
    it('provides chat context to children', async () => {
      const TestChild = () => {
        const { messages } = useChat();
        return <div data-testid="messages">{messages.length}</div>;
      };

      const { getByTestId } = render(
        <ChatProvider>
          <TestChild />
        </ChatProvider>
      );

      await waitFor(() => {
        expect(getByTestId('messages')).toBeInTheDocument();
      });
    });

    it('loads initial data on mount', async () => {
      const TestChild = () => {
        const { isLoading } = useChat();
        return <div>{isLoading ? 'loading' : 'loaded'}</div>;
      };

      const { findByText } = render(
        <ChatProvider>
          <TestChild />
        </ChatProvider>
      );

      await findByText('loaded');
      expect(mockChatService.getConversations).toHaveBeenCalled();
      expect(mockChatService.getCurrentConversation).toHaveBeenCalled();
    });

    it('registers WebSocket event handlers', () => {
      render(
        <ChatProvider>
          <div />
        </ChatProvider>
      );

      expect(mockWebSocketService.on).toHaveBeenCalledWith(
        'chat_message',
        expect.any(Function)
      );
      expect(mockWebSocketService.on).toHaveBeenCalledWith(
        'chat_typing',
        expect.any(Function)
      );
      expect(mockWebSocketService.on).toHaveBeenCalledWith(
        'conversation_updated',
        expect.any(Function)
      );
    });

    it('unregisters WebSocket handlers on unmount', () => {
      const { unmount } = render(
        <ChatProvider>
          <div />
        </ChatProvider>
      );

      unmount();

      expect(mockWebSocketService.off).toHaveBeenCalledWith(
        'chat_message',
        expect.any(Function)
      );
      expect(mockWebSocketService.off).toHaveBeenCalledWith(
        'chat_typing',
        expect.any(Function)
      );
      expect(mockWebSocketService.off).toHaveBeenCalledWith(
        'conversation_updated',
        expect.any(Function)
      );
    });

    it('sets error state on load failure', async () => {
      mockChatService.getConversations.mockRejectedValue(new Error('Network error'));

      const TestChild = () => {
        const { error } = useChat();
        return <div data-testid="error">{error}</div>;
      };

      const { findByTestId } = render(
        <ChatProvider>
          <TestChild />
        </ChatProvider>
      );

      const errorEl = await findByTestId('error');
      expect(errorEl.textContent).toBe('Network error');
    });
  });

  describe('useChat hook', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useChat());
      }).toThrow('useChat must be used within a ChatProvider');

      consoleSpy.mockRestore();
    });

    it('provides all expected properties and methods', async () => {
      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // State properties
      expect(result.current).toHaveProperty('conversations');
      expect(result.current).toHaveProperty('currentConversation');
      expect(result.current).toHaveProperty('messages');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isSending');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isTyping');

      // Action methods
      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.selectConversation).toBe('function');
      expect(typeof result.current.createConversation).toBe('function');
      expect(typeof result.current.deleteConversation).toBe('function');
      expect(typeof result.current.archiveConversation).toBe('function');
      expect(typeof result.current.clearConversation).toBe('function');
      expect(typeof result.current.refreshMessages).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('sendMessage', () => {
    it('sends a message successfully', async () => {
      const sendResult = {
        message: mockMessage,
        conversation: mockConversation,
      };
      mockChatService.sendMessage.mockResolvedValue(sendResult);

      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.sendMessage('Hello!');
      });

      expect(mockChatService.sendMessage).toHaveBeenCalledWith({
        content: 'Hello!',
        conversationId: 'conv-1',
      });
    });

    it('does not send empty messages', async () => {
      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.sendMessage('   ');
      });

      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('sets error on send failure', async () => {
      mockChatService.sendMessage.mockRejectedValue(new Error('Send failed'));

      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.sendMessage('Hello!');
      });

      expect(result.current.error).toBe('Send failed');
    });
  });

  describe('selectConversation', () => {
    it('selects a conversation and loads messages', async () => {
      const otherConv: ChatConversation = {
        ...mockConversation,
        id: 'conv-2',
        title: 'Other Chat',
      };
      mockChatService.getConversations.mockResolvedValue([
        mockConversation,
        otherConv,
      ]);

      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectConversation('conv-2');
      });

      expect(mockChatService.getMessages).toHaveBeenCalledWith('conv-2');
    });

    it('does nothing for non-existent conversation', async () => {
      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectConversation('non-existent');
      });

      // Should only be called for initial load
      expect(mockChatService.getMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('createConversation', () => {
    it('creates a new conversation', async () => {
      const newConv: ChatConversation = {
        ...mockConversation,
        id: 'conv-new',
        title: 'New Chat',
      };
      mockChatService.createConversation.mockResolvedValue(newConv);

      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let createdConv: ChatConversation | undefined;
      await act(async () => {
        createdConv = await result.current.createConversation('New Chat');
      });

      expect(mockChatService.createConversation).toHaveBeenCalledWith('New Chat');
      expect(createdConv?.id).toBe('conv-new');
    });
  });

  describe('deleteConversation', () => {
    it('deletes a conversation', async () => {
      mockChatService.deleteConversation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteConversation('conv-1');
      });

      expect(mockChatService.deleteConversation).toHaveBeenCalledWith('conv-1');
    });
  });

  describe('archiveConversation', () => {
    it('archives a conversation', async () => {
      mockChatService.archiveConversation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.archiveConversation('conv-1');
      });

      expect(mockChatService.archiveConversation).toHaveBeenCalledWith('conv-1');
    });
  });

  describe('clearConversation', () => {
    it('clears messages in a conversation', async () => {
      mockChatService.clearConversation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.clearConversation('conv-1');
      });

      expect(mockChatService.clearConversation).toHaveBeenCalledWith('conv-1');
    });
  });

  describe('refreshMessages', () => {
    it('refreshes messages from server', async () => {
      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshMessages();
      });

      // Should be called twice - initial load and refresh
      expect(mockChatService.getMessages).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearError', () => {
    it('clears the error state', async () => {
      mockChatService.sendMessage.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useChat(), {
        wrapper: ChatProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Create an error
      await act(async () => {
        await result.current.sendMessage('test');
      });

      expect(result.current.error).toBe('Test error');

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
