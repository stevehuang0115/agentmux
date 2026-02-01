/**
 * Chat Panel Component
 *
 * Main chat panel displaying conversation messages and input.
 *
 * @module components/Chat/ChatPanel
 */

import React, { useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import './ChatPanel.css';

// =============================================================================
// Component
// =============================================================================

/**
 * Main chat panel component displaying conversation messages.
 *
 * Features:
 * - Auto-scroll to new messages
 * - Loading and error states
 * - Empty state with suggestions
 * - Typing indicator
 *
 * @returns JSX element with chat panel
 */
export const ChatPanel: React.FC = () => {
  const { messages, isLoading, error, isTyping, currentConversation } = useChat();

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Loading state
  if (isLoading && messages.length === 0) {
    return (
      <div className="chat-panel loading" data-testid="chat-panel-loading">
        <div className="loading-spinner">
          <div className="spinner" />
          <span>Loading conversation...</span>
        </div>
      </div>
    );
  }

  // Error state (only show if no messages)
  if (error && messages.length === 0) {
    return (
      <div className="chat-panel error" data-testid="chat-panel-error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel" data-testid="chat-panel">
      <header className="chat-header">
        <h2>{currentConversation?.title ?? 'Chat with Orchestrator'}</h2>
        <span className="message-count">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </header>

      <div
        className="messages-container"
        ref={messagesContainerRef}
        data-testid="messages-container"
      >
        {messages.length === 0 ? (
          <div className="empty-chat" data-testid="empty-chat">
            <div className="welcome-message">
              <h3>Welcome to AgentMux</h3>
              <p>Start a conversation with the Orchestrator.</p>
              <p>Try asking to:</p>
              <ul>
                <li>Create a new project</li>
                <li>Assign a task to an agent</li>
                <li>Check project status</li>
                <li>Configure a team</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </>
        )}

        {isTyping && <TypingIndicator />}

        <div className="messages-end" />
      </div>

      <ChatInput />
    </div>
  );
};

export default ChatPanel;
