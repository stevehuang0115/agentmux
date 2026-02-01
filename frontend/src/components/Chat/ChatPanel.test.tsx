/**
 * Chat Panel Tests
 *
 * Tests for the ChatPanel component.
 *
 * @module components/Chat/ChatPanel.test
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChatPanel } from './ChatPanel';
import { useChat } from '../../contexts/ChatContext';
import type { ChatMessage, ChatConversation } from '../../types/chat.types';

// Mock the useChat hook
vi.mock('../../contexts/ChatContext', () => ({
  useChat: vi.fn(),
}));

// Mock the child components
vi.mock('./ChatMessage', () => ({
  ChatMessage: ({ message }: { message: ChatMessage }) => (
    <div data-testid="chat-message">{message.content}</div>
  ),
}));

vi.mock('./ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input">Chat Input</div>,
}));

vi.mock('./TypingIndicator', () => ({
  TypingIndicator: () => <div data-testid="typing-indicator">Typing...</div>,
}));

const mockUseChat = useChat as jest.MockedFunction<typeof useChat>;

describe('ChatPanel', () => {
  const mockConversation: ChatConversation = {
    id: 'conv-1',
    title: 'Test Conversation',
    participantIds: ['user'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isArchived: false,
    messageCount: 2,
  };

  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      from: { type: 'user' },
      content: 'Hello!',
      contentType: 'text',
      status: 'sent',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      from: { type: 'orchestrator' },
      content: 'Hi there!',
      contentType: 'text',
      status: 'sent',
      timestamp: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue({
      conversations: [mockConversation],
      currentConversation: mockConversation,
      messages: mockMessages,
      isLoading: false,
      isSending: false,
      error: null,
      isTyping: false,
      sendMessage: vi.fn(),
      selectConversation: vi.fn(),
      createConversation: vi.fn(),
      deleteConversation: vi.fn(),
      archiveConversation: vi.fn(),
      clearConversation: vi.fn(),
      refreshMessages: vi.fn(),
      clearError: vi.fn(),
    });
  });

  describe('normal state', () => {
    it('renders the chat panel', () => {
      render(<ChatPanel />);
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });

    it('renders conversation title', () => {
      render(<ChatPanel />);
      expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    });

    it('renders message count', () => {
      render(<ChatPanel />);
      expect(screen.getByText('2 messages')).toBeInTheDocument();
    });

    it('renders all messages', () => {
      render(<ChatPanel />);
      const messages = screen.getAllByTestId('chat-message');
      expect(messages).toHaveLength(2);
    });

    it('renders chat input', () => {
      render(<ChatPanel />);
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    });

    it('shows singular message text for 1 message', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        messages: [mockMessages[0]],
      });

      render(<ChatPanel />);
      expect(screen.getByText('1 message')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when loading with no messages', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        isLoading: true,
        messages: [],
      });

      render(<ChatPanel />);
      expect(screen.getByTestId('chat-panel-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading conversation...')).toBeInTheDocument();
    });

    it('does not show loading spinner when loading with messages', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        isLoading: true,
      });

      render(<ChatPanel />);
      expect(screen.queryByTestId('chat-panel-loading')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error with no messages', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        error: 'Failed to load',
        messages: [],
      });

      render(<ChatPanel />);
      expect(screen.getByTestId('chat-panel-error')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        error: 'Failed to load',
        messages: [],
      });

      render(<ChatPanel />);
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('does not show error when there are messages', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        error: 'Some error',
      });

      render(<ChatPanel />);
      expect(screen.queryByTestId('chat-panel-error')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows welcome message when no messages', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        messages: [],
      });

      render(<ChatPanel />);
      expect(screen.getByTestId('empty-chat')).toBeInTheDocument();
      expect(screen.getByText('Welcome to AgentMux')).toBeInTheDocument();
    });

    it('shows suggestions for what to ask', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        messages: [],
      });

      render(<ChatPanel />);
      expect(screen.getByText('Create a new project')).toBeInTheDocument();
      expect(screen.getByText('Assign a task to an agent')).toBeInTheDocument();
      expect(screen.getByText('Check project status')).toBeInTheDocument();
      expect(screen.getByText('Configure a team')).toBeInTheDocument();
    });
  });

  describe('typing indicator', () => {
    it('shows typing indicator when isTyping is true', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        isTyping: true,
      });

      render(<ChatPanel />);
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    });

    it('does not show typing indicator when isTyping is false', () => {
      render(<ChatPanel />);
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
    });
  });

  describe('default conversation title', () => {
    it('shows default title when no current conversation', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        currentConversation: null,
      });

      render(<ChatPanel />);
      expect(screen.getByText('Chat with Orchestrator')).toBeInTheDocument();
    });

    it('shows default title when conversation has no title', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChat(),
        currentConversation: { ...mockConversation, title: undefined },
      });

      render(<ChatPanel />);
      expect(screen.getByText('Chat with Orchestrator')).toBeInTheDocument();
    });
  });

  describe('messages container', () => {
    it('renders messages container', () => {
      render(<ChatPanel />);
      expect(screen.getByTestId('messages-container')).toBeInTheDocument();
    });
  });
});
