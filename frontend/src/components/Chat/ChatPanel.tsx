/**
 * Chat Panel Component
 *
 * Main chat panel displaying conversation messages and input.
 *
 * @module components/Chat/ChatPanel
 */

import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useChat } from '../../contexts/ChatContext';
import { useOrchestratorStatus } from '../../hooks/useOrchestratorStatus';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { QueueStatusBar } from './QueueStatusBar';
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
  const { status: orchestratorStatus, isLoading: statusLoading } = useOrchestratorStatus();

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

  // Determine if orchestrator is offline
  const isOrchestratorOffline = !statusLoading && orchestratorStatus && !orchestratorStatus.isActive;

  return (
    <div className="chat-panel" data-testid="chat-panel">
      <header className="chat-header">
        <h2>{currentConversation?.title ?? 'Chat with Orchestrator'}</h2>
        <span className="message-count">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </header>

      <QueueStatusBar />

      {isOrchestratorOffline && (
        <div className="orchestrator-offline-banner" data-testid="orchestrator-offline-banner">
          <span className="offline-icon" aria-hidden="true">⚠️</span>
          <div className="offline-content">
            <strong>Orchestrator Offline</strong>
            <p>{orchestratorStatus?.offlineMessage || orchestratorStatus?.message}</p>
          </div>
          <Link to="/" className="dashboard-link">
            Go to Dashboard
          </Link>
        </div>
      )}

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

      <ChatInput
        disabled={isOrchestratorOffline}
        disabledPlaceholder="Orchestrator is offline. Start it from the Dashboard to chat."
      />
    </div>
  );
};

export default ChatPanel;
