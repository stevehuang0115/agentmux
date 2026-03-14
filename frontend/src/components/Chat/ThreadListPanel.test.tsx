/**
 * Thread List Panel Tests
 *
 * Tests for the ThreadListPanel component that displays a scrollable
 * list of conversation threads with channel filtering.
 *
 * @module components/Chat/ThreadListPanel.test
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThreadListPanel } from './ThreadListPanel';
import type { ChatConversation, ChatChannelType } from '../../types/chat.types';

// Mock the ChannelFilterBar component
vi.mock('./ChannelFilterBar', () => ({
  ChannelFilterBar: ({
    activeFilter,
    onFilterChange,
    conversations,
  }: {
    activeFilter: ChatChannelType | null;
    onFilterChange: (filter: ChatChannelType | null) => void;
    conversations: ChatConversation[];
  }) => (
    <div
      data-testid="channel-filter-bar"
      data-active-filter={activeFilter ?? 'all'}
      data-count={conversations.length}
    >
      ChannelFilterBar
    </div>
  ),
}));

// Mock the ThreadPreview component
vi.mock('./ThreadPreview', () => ({
  ThreadPreview: ({
    conversation,
    isActive,
    onClick,
  }: {
    conversation: ChatConversation;
    isActive: boolean;
    onClick: () => void;
  }) => (
    <div
      data-testid="thread-preview"
      data-conv-id={conversation.id}
      data-active={isActive}
      onClick={onClick}
    >
      {conversation.title}
    </div>
  ),
}));

/**
 * Helper to create a mock conversation.
 *
 * @param id - Unique conversation ID
 * @param channelType - Channel type
 * @param updatedAt - ISO timestamp for sorting
 * @returns A mock ChatConversation
 */
function createMockConversation(
  id: string,
  channelType: ChatConversation['channelType'],
  updatedAt: string = '2026-03-08T00:00:00Z'
): ChatConversation {
  return {
    id,
    title: `Thread ${id}`,
    participantIds: ['user'],
    createdAt: '2026-03-08T00:00:00Z',
    updatedAt,
    isArchived: false,
    messageCount: 5,
    channelType,
    lastMessage: {
      content: 'Hello',
      timestamp: '2026-03-08T00:00:00Z',
      from: { type: 'user', name: 'You' },
    },
  };
}

describe('ThreadListPanel', () => {
  const mockOnSelectThread = vi.fn();
  const mockOnChannelFilterChange = vi.fn();

  const mixedConversations: ChatConversation[] = [
    createMockConversation('conv-1', 'slack', '2026-03-08T01:00:00Z'),
    createMockConversation('conv-2', 'crewly_chat', '2026-03-08T03:00:00Z'),
    createMockConversation('conv-3', 'slack', '2026-03-08T02:00:00Z'),
    createMockConversation('conv-4', 'api', '2026-03-08T00:30:00Z'),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('thread rendering', () => {
    it('renders a ThreadPreview for each conversation', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      expect(previews).toHaveLength(4);
    });

    it('passes isActive=true for the selected conversation', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId="conv-2"
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      const activePreview = previews.find(
        (p) => p.getAttribute('data-conv-id') === 'conv-2'
      );
      expect(activePreview).toHaveAttribute('data-active', 'true');
    });

    it('passes isActive=false for non-selected conversations', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId="conv-2"
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      const otherPreviews = previews.filter(
        (p) => p.getAttribute('data-conv-id') !== 'conv-2'
      );
      otherPreviews.forEach((p) => {
        expect(p).toHaveAttribute('data-active', 'false');
      });
    });

    it('calls onSelectThread with conversation ID when a thread is clicked', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      const firstPreview = previews.find(
        (p) => p.getAttribute('data-conv-id') === 'conv-1'
      );
      firstPreview?.click();
      expect(mockOnSelectThread).toHaveBeenCalledWith('conv-1');
    });
  });

  describe('empty state', () => {
    it('shows empty state when no conversations exist', () => {
      render(
        <ThreadListPanel
          conversations={[]}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      expect(screen.getByTestId('thread-list-empty')).toBeInTheDocument();
      expect(screen.getByText('No conversations yet.')).toBeInTheDocument();
    });

    it('shows channel-specific empty message when filter is active and no matches', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter="telegram"
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      expect(screen.getByTestId('thread-list-empty')).toBeInTheDocument();
      expect(screen.getByText('No conversations for this channel.')).toBeInTheDocument();
    });

    it('does not render any ThreadPreview when empty', () => {
      render(
        <ThreadListPanel
          conversations={[]}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      expect(screen.queryByTestId('thread-preview')).not.toBeInTheDocument();
    });
  });

  describe('channel filtering', () => {
    it('shows all conversations when channelFilter is null', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      expect(previews).toHaveLength(4);
    });

    it('filters conversations by slack channel', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter="slack"
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      expect(previews).toHaveLength(2);
      previews.forEach((p) => {
        const id = p.getAttribute('data-conv-id');
        expect(id === 'conv-1' || id === 'conv-3').toBe(true);
      });
    });

    it('filters conversations by crewly_chat channel', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter="crewly_chat"
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      expect(previews).toHaveLength(1);
      expect(previews[0]).toHaveAttribute('data-conv-id', 'conv-2');
    });

    it('filters conversations by api channel', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter="api"
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      expect(previews).toHaveLength(1);
      expect(previews[0]).toHaveAttribute('data-conv-id', 'conv-4');
    });

    it('treats conversations without channelType as crewly_chat when filtering', () => {
      const conversationsWithUndefined: ChatConversation[] = [
        createMockConversation('conv-noType', undefined),
        ...mixedConversations,
      ];

      render(
        <ThreadListPanel
          conversations={conversationsWithUndefined}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter="crewly_chat"
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      // conv-2 (crewly_chat) + conv-noType (undefined -> crewly_chat)
      expect(previews).toHaveLength(2);
    });
  });

  describe('ChannelFilterBar', () => {
    it('renders the ChannelFilterBar component', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      expect(screen.getByTestId('channel-filter-bar')).toBeInTheDocument();
    });

    it('passes activeFilter to ChannelFilterBar', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter="slack"
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      expect(screen.getByTestId('channel-filter-bar')).toHaveAttribute(
        'data-active-filter',
        'slack'
      );
    });

    it('passes all conversations (unfiltered) to ChannelFilterBar for counts', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter="slack"
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      // The ChannelFilterBar should receive the full unfiltered list
      expect(screen.getByTestId('channel-filter-bar')).toHaveAttribute(
        'data-count',
        '4'
      );
    });
  });

  describe('sorting', () => {
    it('sorts conversations by updatedAt descending', () => {
      render(
        <ThreadListPanel
          conversations={mixedConversations}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      const previews = screen.getAllByTestId('thread-preview');
      const ids = previews.map((p) => p.getAttribute('data-conv-id'));
      // conv-2 (03:00) > conv-3 (02:00) > conv-1 (01:00) > conv-4 (00:30)
      expect(ids).toEqual(['conv-2', 'conv-3', 'conv-1', 'conv-4']);
    });
  });

  describe('data-testid', () => {
    it('has data-testid="thread-list-panel" on the container', () => {
      render(
        <ThreadListPanel
          conversations={[]}
          selectedConversationId={null}
          onSelectThread={mockOnSelectThread}
          channelFilter={null}
          onChannelFilterChange={mockOnChannelFilterChange}
        />
      );

      expect(screen.getByTestId('thread-list-panel')).toBeInTheDocument();
    });
  });
});
