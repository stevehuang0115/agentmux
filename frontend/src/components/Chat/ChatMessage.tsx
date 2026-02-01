/**
 * Chat Message Component
 *
 * Displays an individual chat message with sender info and content.
 *
 * @module components/Chat/ChatMessage
 */

import React, { useState } from 'react';
import { ChatMessage as ChatMessageType } from '../../types/chat.types';
import { formatRelativeTime } from '../../utils/time';
import './ChatMessage.css';

// =============================================================================
// Types
// =============================================================================

interface ChatMessageProps {
  /** The message to display */
  message: ChatMessageType;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get display name for a sender
 */
function getSenderName(message: ChatMessageType): string {
  if (message.from.name) return message.from.name;
  switch (message.from.type) {
    case 'user':
      return 'You';
    case 'orchestrator':
      return 'Orchestrator';
    case 'agent':
      return message.from.role ?? 'Agent';
    case 'system':
      return 'System';
    default:
      return 'Unknown';
  }
}

/**
 * Get icon for a sender
 */
function getSenderIcon(message: ChatMessageType): string {
  switch (message.from.type) {
    case 'user':
      return '👤';
    case 'orchestrator':
      return '🤖';
    case 'agent':
      return '🔧';
    case 'system':
      return 'ℹ️';
    default:
      return '💬';
  }
}

/**
 * Format message content - basic markdown support
 */
function formatContent(content: string): React.ReactNode {
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    // Code block
    if (part.startsWith('```') && part.endsWith('```')) {
      const codeContent = part.slice(3, -3);
      const firstLineEnd = codeContent.indexOf('\n');
      const language =
        firstLineEnd > 0 ? codeContent.slice(0, firstLineEnd).trim() : '';
      const code =
        firstLineEnd > 0 ? codeContent.slice(firstLineEnd + 1) : codeContent;

      return (
        <pre key={index} className="code-block" data-language={language}>
          <code>{code}</code>
        </pre>
      );
    }

    // Regular text - apply inline formatting
    return (
      <span key={index}>
        {formatInlineContent(part)}
      </span>
    );
  });
}

/**
 * Format inline content (bold, italic, inline code)
 */
function formatInlineContent(text: string): React.ReactNode {
  // Split by inline code
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Apply bold and italic
    let result: React.ReactNode = part;

    // Bold
    const boldRegex = /\*\*([^*]+)\*\*/g;
    const boldParts = part.split(boldRegex);
    if (boldParts.length > 1) {
      result = boldParts.map((boldPart, i) =>
        i % 2 === 1 ? (
          <strong key={`bold-${index}-${i}`}>{boldPart}</strong>
        ) : (
          boldPart
        )
      );
    }

    return <React.Fragment key={index}>{result}</React.Fragment>;
  });
}

// =============================================================================
// Component
// =============================================================================

/**
 * Individual chat message component.
 *
 * Displays message content with sender information, timestamp,
 * and optional raw output toggle.
 *
 * @param message - The chat message to display
 * @returns JSX element with message content
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [showRaw, setShowRaw] = useState(false);

  const isUser = message.from.type === 'user';
  const isSystem = message.from.type === 'system';
  const hasRawOutput = Boolean(message.metadata?.rawOutput);

  /**
   * Render message content based on type and state
   */
  const renderContent = () => {
    if (showRaw && message.metadata?.rawOutput) {
      return (
        <pre className="raw-output" data-testid="raw-output">
          {message.metadata.rawOutput}
        </pre>
      );
    }

    if (
      message.contentType === 'code' ||
      message.contentType === 'markdown' ||
      message.contentType === 'text'
    ) {
      return <div className="formatted-content">{formatContent(message.content)}</div>;
    }

    return <p>{message.content}</p>;
  };

  const classNames = [
    'chat-message',
    message.from.type,
    isUser ? 'user-message' : '',
    isSystem ? 'system-message' : '',
    message.status === 'error' ? 'error-status' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} data-testid="chat-message">
      <div className="message-header">
        <span className="sender-icon" aria-hidden="true">
          {getSenderIcon(message)}
        </span>
        <span className="sender-name">{getSenderName(message)}</span>
        <span className="message-time">{formatRelativeTime(message.timestamp)}</span>
        {hasRawOutput && (
          <button
            className="toggle-raw-btn"
            onClick={() => setShowRaw(!showRaw)}
            title={showRaw ? 'Show formatted' : 'Show raw output'}
            aria-label={showRaw ? 'Show formatted' : 'Show raw output'}
            data-testid="toggle-raw-button"
          >
            {showRaw ? '📝' : '🔍'}
          </button>
        )}
      </div>

      <div className="message-content">{renderContent()}</div>

      {message.metadata?.skillUsed && (
        <div className="message-metadata">
          <span className="skill-badge">Skill: {message.metadata.skillUsed}</span>
        </div>
      )}

      {message.metadata?.taskCreated && (
        <div className="message-metadata">
          <span className="task-badge">
            Task created: {message.metadata.taskCreated}
          </span>
        </div>
      )}

      {message.status === 'error' && (
        <div className="message-error" role="alert">
          Failed to deliver
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
