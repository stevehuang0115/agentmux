/**
 * Thread Preview Tests
 *
 * Tests for the ThreadPreview component that displays a compact
 * summary card for a conversation thread.
 *
 * @module components/Chat/ThreadPreview.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThreadPreview } from './ThreadPreview';
import type { ChatConversation } from '../../types/chat.types';

// Mock the ChannelBadge component
vi.mock('./ChannelBadge', () => ({
  ChannelBadge: ({ channelType, showLabel }: { channelType: string; showLabel?: boolean }) => (
    <span data-testid="channel-badge" data-channel={channelType} data-show-label={showLabel}>
      {channelType}
    </span>
  ),
}));

// Mock the formatRelativeTime utility
vi.mock('../../utils/time', () => ({
  formatRelativeTime: vi.fn(() => '5 minutes ago'),
}));

describe('ThreadPreview', () => {
  const mockConversation: ChatConversation = {
    id: 'conv-123',
    title: 'Test Thread',
    participantIds: ['user'],
    createdAt: '2026-03-08T00:00:00Z',
    updatedAt: '2026-03-08T00:00:00Z',
    isArchived: false,
    messageCount: 5,
    channelType: 'slack',
    lastMessage: {
      content: 'Hello',
      timestamp: '2026-03-08T00:00:00Z',
      from: { type: 'user', name: 'You' },
    },
  };

  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('title rendering', () => {
    it('renders the conversation title', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Test Thread')).toBeInTheDocument();
    });

    it('falls back to last message content when title is missing', () => {
      const noTitleConversation: ChatConversation = {
        ...mockConversation,
        title: undefined,
        lastMessage: {
          content: 'Fallback message content',
          timestamp: '2026-03-08T00:00:00Z',
          from: { type: 'user', name: 'You' },
        },
      };

      render(
        <ThreadPreview
          conversation={noTitleConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      // The title element uses the last message content as fallback.
      // Since the same text also appears in the preview body, query by class.
      const titleEl = screen.getByTestId('thread-preview').querySelector('.thread-preview-title');
      expect(titleEl).toHaveTextContent('Fallback message content');
    });

    it('shows "New conversation" when no title and no last message', () => {
      const emptyConversation: ChatConversation = {
        ...mockConversation,
        title: undefined,
        lastMessage: undefined,
      };

      render(
        <ThreadPreview
          conversation={emptyConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('New conversation')).toBeInTheDocument();
    });
  });

  describe('channel badge', () => {
    it('renders a ChannelBadge with the conversation channel type', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      const badge = screen.getByTestId('channel-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-channel', 'slack');
      expect(badge).toHaveAttribute('data-show-label', 'false');
    });

    it('defaults to crewly_chat when channelType is undefined', () => {
      const noChannelConversation: ChatConversation = {
        ...mockConversation,
        channelType: undefined,
      };

      render(
        <ThreadPreview
          conversation={noChannelConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      const badge = screen.getByTestId('channel-badge');
      expect(badge).toHaveAttribute('data-channel', 'crewly_chat');
    });
  });

  describe('message count', () => {
    it('shows pluralized message count', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('5 messages')).toBeInTheDocument();
    });

    it('shows singular message text for 1 message', () => {
      const singleMessageConv: ChatConversation = {
        ...mockConversation,
        messageCount: 1,
      };

      render(
        <ThreadPreview
          conversation={singleMessageConv}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('1 message')).toBeInTheDocument();
    });
  });

  describe('relative time', () => {
    it('shows the formatted relative time', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    });

    it('calls formatRelativeTime with the conversation updatedAt', async () => {
      const { formatRelativeTime } = await import('../../utils/time');

      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(formatRelativeTime).toHaveBeenCalledWith('2026-03-08T00:00:00Z');
    });
  });

  describe('active state', () => {
    it('has active class when isActive is true', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={true}
          onClick={mockOnClick}
        />
      );

      const preview = screen.getByTestId('thread-preview');
      expect(preview).toHaveClass('active');
    });

    it('does not have active class when isActive is false', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      const preview = screen.getByTestId('thread-preview');
      expect(preview).not.toHaveClass('active');
    });

    it('sets aria-pressed based on isActive', () => {
      const { rerender } = render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={true}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByTestId('thread-preview')).toHaveAttribute('aria-pressed', 'true');

      rerender(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByTestId('thread-preview')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('click handling', () => {
    it('calls onClick when the thread preview is clicked', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      fireEvent.click(screen.getByTestId('thread-preview'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('last message preview', () => {
    it('shows sender name with colon when available', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('You:')).toBeInTheDocument();
    });

    it('truncates long message content to 80 characters', () => {
      const longContent = 'A'.repeat(100);
      const longMessageConv: ChatConversation = {
        ...mockConversation,
        lastMessage: {
          content: longContent,
          timestamp: '2026-03-08T00:00:00Z',
          from: { type: 'user', name: 'You' },
        },
      };

      render(
        <ThreadPreview
          conversation={longMessageConv}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      // Should truncate to 77 chars + '...'
      const expectedContent = 'A'.repeat(77) + '...';
      expect(screen.getByText(expectedContent)).toBeInTheDocument();
    });

    it('does not truncate short message content', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  describe('data-testid', () => {
    it('has data-testid="thread-preview"', () => {
      render(
        <ThreadPreview
          conversation={mockConversation}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByTestId('thread-preview')).toBeInTheDocument();
    });
  });
});
