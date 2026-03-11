/**
 * Thread Preview Component
 *
 * A compact card showing a conversation thread summary in the thread list.
 *
 * @module components/Chat/ThreadPreview
 */

import React from 'react';
import type { ChatConversation } from '../../types/chat.types';
import { ChannelBadge } from './ChannelBadge';
import { formatRelativeTime } from '../../utils/time';
import './ThreadPreview.css';

// =============================================================================
// Types
// =============================================================================

interface ThreadPreviewProps {
  /** The conversation to preview */
  conversation: ChatConversation;
  /** Whether this thread is currently selected */
  isActive: boolean;
  /** Callback when the thread is clicked */
  onClick: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Thread preview card showing channel badge, title, message count, and last activity.
 *
 * @param props - Component props
 * @returns JSX element with thread preview card
 */
export const ThreadPreview: React.FC<ThreadPreviewProps> = ({
  conversation,
  isActive,
  onClick,
}) => {
  const channelType = conversation.channelType ?? 'crewly_chat';
  const title = conversation.title || conversation.lastMessage?.content?.slice(0, 60) || 'New conversation';
  const preview = conversation.lastMessage?.content ?? '';
  const senderName = conversation.lastMessage?.from?.name ?? conversation.lastMessage?.from?.type ?? '';

  return (
    <button
      className={`thread-preview ${isActive ? 'active' : ''}`}
      onClick={onClick}
      data-testid="thread-preview"
      aria-pressed={isActive}
    >
      <div className="thread-preview-header">
        <ChannelBadge channelType={channelType} showLabel={false} />
        <span className="thread-preview-title">{title}</span>
        <span className="thread-preview-time">
          {formatRelativeTime(conversation.updatedAt)}
        </span>
      </div>

      <div className="thread-preview-body">
        {senderName && (
          <span className="thread-preview-sender">{senderName}: </span>
        )}
        <span className="thread-preview-content">
          {preview.length > 80 ? preview.slice(0, 77) + '...' : preview}
        </span>
      </div>

      <div className="thread-preview-footer">
        <span className="thread-preview-count">
          {conversation.messageCount} {conversation.messageCount === 1 ? 'message' : 'messages'}
        </span>
      </div>
    </button>
  );
};

export default ThreadPreview;
