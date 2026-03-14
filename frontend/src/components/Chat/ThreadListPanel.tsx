/**
 * Thread List Panel Component
 *
 * Displays a scrollable list of conversation threads with channel filtering.
 *
 * @module components/Chat/ThreadListPanel
 */

import React from 'react';
import type { ChatConversation, ChatChannelType } from '../../types/chat.types';
import { ChannelFilterBar } from './ChannelFilterBar';
import { ThreadPreview } from './ThreadPreview';
import './ThreadListPanel.css';

// =============================================================================
// Types
// =============================================================================

interface ThreadListPanelProps {
  /** All conversations */
  conversations: ChatConversation[];
  /** Currently selected conversation ID */
  selectedConversationId: string | null;
  /** Callback when a thread is selected */
  onSelectThread: (conversationId: string) => void;
  /** Active channel filter */
  channelFilter: ChatChannelType | null;
  /** Callback when channel filter changes */
  onChannelFilterChange: (filter: ChatChannelType | null) => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Panel listing all conversation threads with channel filter bar.
 *
 * Conversations are sorted by updatedAt desc. Respects channel filter.
 *
 * @param props - Component props
 * @returns JSX element with thread list panel
 */
export const ThreadListPanel: React.FC<ThreadListPanelProps> = ({
  conversations,
  selectedConversationId,
  onSelectThread,
  channelFilter,
  onChannelFilterChange,
}) => {
  /** Apply channel filter */
  const filteredConversations = channelFilter
    ? conversations.filter((c) => (c.channelType ?? 'crewly_chat') === channelFilter)
    : conversations;

  /** Sort by updatedAt desc */
  const sortedConversations = [...filteredConversations].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt)
  );

  return (
    <div className="thread-list-panel" data-testid="thread-list-panel">
      <ChannelFilterBar
        activeFilter={channelFilter}
        onFilterChange={onChannelFilterChange}
        conversations={conversations}
      />

      <div className="thread-list-scroll">
        {sortedConversations.length === 0 ? (
          <div className="thread-list-empty" data-testid="thread-list-empty">
            <p>
              {channelFilter
                ? 'No conversations for this channel.'
                : 'No conversations yet.'}
            </p>
          </div>
        ) : (
          sortedConversations.map((conversation) => (
            <ThreadPreview
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === selectedConversationId}
              onClick={() => onSelectThread(conversation.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ThreadListPanel;
