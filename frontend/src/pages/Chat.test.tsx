/**
 * Chat Page Tests
 *
 * Tests for the dedicated Chat page (messenger-style without sidebar).
 *
 * @module pages/Chat.test
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Chat } from './Chat';
import * as useChatHook from '../contexts/ChatContext';

// Mock the useChat hook
vi.mock('../contexts/ChatContext');

// Mock child components
vi.mock('../components/Chat/ChatPanel', () => ({
  ChatPanel: () => <div data-testid="chat-panel">Chat Panel</div>,
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('Chat Page', () => {
  const mockChatContext = {
    conversations: [],
    currentConversation: null,
    messages: [],
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChatHook.useChat).mockReturnValue(mockChatContext);
  });

  describe('Layout', () => {
    it('should render the page header', () => {
      render(
        <TestWrapper>
          <Chat />
        </TestWrapper>
      );

      expect(screen.getByText('Chat with Orchestrator')).toBeInTheDocument();
    });

    it('should render the page description', () => {
      render(
        <TestWrapper>
          <Chat />
        </TestWrapper>
      );

      expect(
        screen.getByText(/Communicate with the AgentMux orchestrator/)
      ).toBeInTheDocument();
    });

    it('should render the chat panel', () => {
      render(
        <TestWrapper>
          <Chat />
        </TestWrapper>
      );

      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });
  });

  describe('Structure', () => {
    it('should have correct class structure for messenger-style layout', () => {
      const { container } = render(
        <TestWrapper>
          <Chat />
        </TestWrapper>
      );

      expect(container.querySelector('.chat-page')).toBeInTheDocument();
      expect(container.querySelector('.chat-page.messenger-style')).toBeInTheDocument();
      expect(container.querySelector('.chat-page-header')).toBeInTheDocument();
      expect(container.querySelector('.chat-page-content')).toBeInTheDocument();
      expect(container.querySelector('.chat-page-main')).toBeInTheDocument();
    });

    it('should NOT have sidebar (messenger-style)', () => {
      const { container } = render(
        <TestWrapper>
          <Chat />
        </TestWrapper>
      );

      expect(container.querySelector('.chat-page-sidebar')).not.toBeInTheDocument();
    });
  });
});
