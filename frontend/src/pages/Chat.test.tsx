/**
 * Chat Page Tests
 *
 * Tests for the thread-based Chat page with two-pane layout.
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
vi.mock('../components/Chat/ThreadListPanel', () => ({
  ThreadListPanel: () => <div data-testid="thread-list-panel">Thread List</div>,
}));

vi.mock('../components/Chat/ThreadDetailPanel', () => ({
  ThreadDetailPanel: () => <div data-testid="thread-detail-panel">Thread Detail</div>,
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
    channelFilter: null,
    sendMessage: vi.fn(),
    selectConversation: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    archiveConversation: vi.fn(),
    clearConversation: vi.fn(),
    refreshMessages: vi.fn(),
    loadOlderMessages: vi.fn(),
    hasMoreMessages: false,
    isLoadingMore: false,
    clearError: vi.fn(),
    setChannelFilter: vi.fn(),
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
        screen.getByText(/Communicate with the Crewly orchestrator/)
      ).toBeInTheDocument();
    });

    it('should render the thread list panel', () => {
      render(
        <TestWrapper>
          <Chat />
        </TestWrapper>
      );

      expect(screen.getByTestId('thread-list-panel')).toBeInTheDocument();
    });

    it('should render the thread detail panel', () => {
      render(
        <TestWrapper>
          <Chat />
        </TestWrapper>
      );

      expect(screen.getByTestId('thread-detail-panel')).toBeInTheDocument();
    });
  });

  describe('Structure', () => {
    it('should have correct class structure for thread-based layout', () => {
      const { container } = render(
        <TestWrapper>
          <Chat />
        </TestWrapper>
      );

      expect(container.querySelector('.chat-page')).toBeInTheDocument();
      expect(container.querySelector('.chat-page.thread-layout')).toBeInTheDocument();
      expect(container.querySelector('.chat-page-header')).toBeInTheDocument();
      expect(container.querySelector('.chat-page-content')).toBeInTheDocument();
      expect(container.querySelector('.chat-page-main')).toBeInTheDocument();
    });

    it('should have sidebar (thread-layout)', () => {
      const { container } = render(
        <TestWrapper>
          <Chat />
        </TestWrapper>
      );

      expect(container.querySelector('.chat-page-sidebar')).toBeInTheDocument();
    });
  });
});
