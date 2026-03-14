/**
 * Channel Filter Bar Tests
 *
 * Tests for the ChannelFilterBar component that provides
 * toggle chips for filtering conversations by channel type.
 *
 * @module components/Chat/ChannelFilterBar.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChannelFilterBar } from './ChannelFilterBar';
import type { ChatConversation } from '../../types/chat.types';

/**
 * Helper to create a mock conversation with a specific channel type.
 *
 * @param id - Unique conversation ID
 * @param channelType - Channel type for the conversation
 * @returns A mock ChatConversation object
 */
function createMockConversation(
  id: string,
  channelType: ChatConversation['channelType']
): ChatConversation {
  return {
    id,
    title: `Thread ${id}`,
    participantIds: ['user'],
    createdAt: '2026-03-08T00:00:00Z',
    updatedAt: '2026-03-08T00:00:00Z',
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

describe('ChannelFilterBar', () => {
  const mockOnFilterChange = vi.fn();

  const mixedConversations: ChatConversation[] = [
    createMockConversation('conv-1', 'slack'),
    createMockConversation('conv-2', 'slack'),
    createMockConversation('conv-3', 'crewly_chat'),
    createMockConversation('conv-4', 'api'),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('chip rendering', () => {
    it('always renders the "All" chip', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={[]}
        />
      );

      expect(screen.getByTestId('filter-chip-all')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('only renders chips for channels that have conversations', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      // Should show All, Slack, Crewly, API (not Telegram since no telegram conversations)
      expect(screen.getByTestId('filter-chip-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-chip-slack')).toBeInTheDocument();
      expect(screen.getByTestId('filter-chip-crewly_chat')).toBeInTheDocument();
      expect(screen.getByTestId('filter-chip-api')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-chip-telegram')).not.toBeInTheDocument();
    });

    it('does not render channel chips when there are no conversations', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={[]}
        />
      );

      // Only "All" chip should exist
      expect(screen.getByTestId('filter-chip-all')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-chip-slack')).not.toBeInTheDocument();
      expect(screen.queryByTestId('filter-chip-crewly_chat')).not.toBeInTheDocument();
      expect(screen.queryByTestId('filter-chip-telegram')).not.toBeInTheDocument();
      expect(screen.queryByTestId('filter-chip-api')).not.toBeInTheDocument();
    });
  });

  describe('counts', () => {
    it('shows correct total count on All chip', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      const allChip = screen.getByTestId('filter-chip-all');
      expect(allChip).toHaveTextContent('4');
    });

    it('shows correct count per channel type', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      // Slack: 2 conversations
      const slackChip = screen.getByTestId('filter-chip-slack');
      expect(slackChip).toHaveTextContent('2');

      // Crewly: 1 conversation
      const crewlyChip = screen.getByTestId('filter-chip-crewly_chat');
      expect(crewlyChip).toHaveTextContent('1');

      // API: 1 conversation
      const apiChip = screen.getByTestId('filter-chip-api');
      expect(apiChip).toHaveTextContent('1');
    });

    it('shows 0 count on All chip when no conversations', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={[]}
        />
      );

      const allChip = screen.getByTestId('filter-chip-all');
      expect(allChip).toHaveTextContent('0');
    });
  });

  describe('active filter', () => {
    it('applies active class to the currently active filter chip', () => {
      render(
        <ChannelFilterBar
          activeFilter="slack"
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      const slackChip = screen.getByTestId('filter-chip-slack');
      expect(slackChip).toHaveClass('active');
    });

    it('applies active class to All chip when activeFilter is null', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      const allChip = screen.getByTestId('filter-chip-all');
      expect(allChip).toHaveClass('active');
    });

    it('does not apply active class to non-active chips', () => {
      render(
        <ChannelFilterBar
          activeFilter="slack"
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      const allChip = screen.getByTestId('filter-chip-all');
      expect(allChip).not.toHaveClass('active');

      const crewlyChip = screen.getByTestId('filter-chip-crewly_chat');
      expect(crewlyChip).not.toHaveClass('active');
    });

    it('sets aria-pressed on active chip', () => {
      render(
        <ChannelFilterBar
          activeFilter="slack"
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      const slackChip = screen.getByTestId('filter-chip-slack');
      expect(slackChip).toHaveAttribute('aria-pressed', 'true');

      const allChip = screen.getByTestId('filter-chip-all');
      expect(allChip).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('click handling', () => {
    it('calls onFilterChange with channel type when chip is clicked', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      fireEvent.click(screen.getByTestId('filter-chip-slack'));
      expect(mockOnFilterChange).toHaveBeenCalledWith('slack');
    });

    it('calls onFilterChange with null when All chip is clicked', () => {
      render(
        <ChannelFilterBar
          activeFilter="slack"
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      fireEvent.click(screen.getByTestId('filter-chip-all'));
      expect(mockOnFilterChange).toHaveBeenCalledWith(null);
    });

    it('calls onFilterChange with crewly_chat when Crewly chip is clicked', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={mixedConversations}
        />
      );

      fireEvent.click(screen.getByTestId('filter-chip-crewly_chat'));
      expect(mockOnFilterChange).toHaveBeenCalledWith('crewly_chat');
    });
  });

  describe('conversations without channelType', () => {
    it('treats conversations without channelType as crewly_chat', () => {
      const conversationsWithoutType: ChatConversation[] = [
        createMockConversation('conv-1', undefined),
        createMockConversation('conv-2', undefined),
      ];

      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={conversationsWithoutType}
        />
      );

      // Should show crewly_chat chip with count 2
      const crewlyChip = screen.getByTestId('filter-chip-crewly_chat');
      expect(crewlyChip).toHaveTextContent('2');
    });
  });

  describe('data-testid', () => {
    it('has data-testid="channel-filter-bar" on the container', () => {
      render(
        <ChannelFilterBar
          activeFilter={null}
          onFilterChange={mockOnFilterChange}
          conversations={[]}
        />
      );

      expect(screen.getByTestId('channel-filter-bar')).toBeInTheDocument();
    });
  });
});
