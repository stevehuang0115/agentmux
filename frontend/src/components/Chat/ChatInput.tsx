/**
 * Chat Input Component
 *
 * Text input for sending messages with auto-resize and keyboard shortcuts.
 *
 * @module components/Chat/ChatInput
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useChat } from '../../contexts/ChatContext';
import './ChatInput.css';

// =============================================================================
// Component
// =============================================================================

/**
 * Chat input component with auto-resize and keyboard shortcuts.
 *
 * Features:
 * - Auto-resizing textarea
 * - Enter to send, Shift+Enter for new line
 * - Disabled state while sending
 * - Error display
 *
 * @returns JSX element with chat input
 */
export const ChatInput: React.FC = () => {
  const { sendMessage, isSending, error, clearError } = useChat();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (!input.trim() || isSending) return;

    const message = input.trim();
    setInput('');
    clearError();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await sendMessage(message);
  };

  /**
   * Handle keyboard events for shortcuts
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /**
   * Handle input change
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (error) {
      clearError();
    }
  };

  return (
    <div className="chat-input-container" data-testid="chat-input-container">
      {error && (
        <div className="input-error" role="alert" data-testid="chat-input-error">
          <span>Error: {error}</span>
          <button
            className="dismiss-error"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          disabled={isSending}
          rows={1}
          className="message-input"
          data-testid="chat-message-input"
          aria-label="Message input"
        />

        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isSending}
          className="send-button"
          title="Send message"
          data-testid="chat-send-button"
          aria-label={isSending ? 'Sending message' : 'Send message'}
        >
          {isSending ? (
            <span className="sending-indicator" aria-hidden="true">
              ⏳
            </span>
          ) : (
            <span className="send-icon" aria-hidden="true">
              ➤
            </span>
          )}
        </button>
      </div>

      <div className="input-hints">
        <span>
          Press <kbd>Enter</kbd> to send
        </span>
        <span>
          <kbd>Shift</kbd> + <kbd>Enter</kbd> for new line
        </span>
      </div>
    </div>
  );
};

export default ChatInput;
