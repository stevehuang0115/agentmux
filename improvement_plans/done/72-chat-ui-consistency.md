# Task 72: Refactor Chat Page for UI Consistency

## Priority: High

## Problem

The Chat page uses custom CSS with light theme fallback values, resulting in:
- Light gray sidebar background (`#f8f9fa`)
- Light blue active conversation highlight (`#e3f2fd`)
- White input backgrounds
- Light text colors designed for light backgrounds

This creates visual inconsistency with the dark-themed sidebar and other pages.

### Current Issues
1. **ChatSidebar.css**: Uses `--sidebar-bg: #f8f9fa` (light gray)
2. **ChatPanel.css**: Uses light backgrounds for messages
3. **ChatInput.css**: Uses light input styling
4. **ChatMessage.css**: Uses light message bubbles

## Solution

Refactor Chat components to use atomic UI components and design tokens.

## Implementation

### 1. Refactor ChatSidebar

**Update:** `frontend/src/components/Chat/ChatSidebar.tsx`

```typescript
import React, { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Card } from '../UI/Card';
import { MessageSquarePlus, Search, MoreVertical, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '../../utils/time';

export const ChatSidebar: React.FC = () => {
  const {
    conversations,
    currentConversation,
    createConversation,
    selectConversation,
    deleteConversation,
  } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filteredConversations = conversations.filter((conv) =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-72 h-full bg-surface-dark border-r border-border-dark">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-dark">
        <h3 className="text-sm font-semibold text-text-primary-dark">Conversations</h3>
        <Button
          variant="primary"
          size="sm"
          icon={MessageSquarePlus}
          onClick={() => createConversation()}
        >
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border-dark">
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
        />
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredConversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-secondary-dark">
            {searchQuery ? 'No matching conversations' : 'No conversations yet'}
          </p>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={`
                relative flex items-start gap-3 px-4 py-3 cursor-pointer
                transition-colors
                ${currentConversation?.id === conv.id
                  ? 'bg-primary/10 border-l-2 border-primary'
                  : 'hover:bg-background-dark'
                }
              `}
              onClick={() => selectConversation(conv.id)}
            >
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-text-primary-dark truncate">
                  {conv.title || 'New Chat'}
                </h4>
                {conv.lastMessage && (
                  <p className="text-xs text-text-secondary-dark truncate mt-0.5">
                    {conv.lastMessage}
                  </p>
                )}
                <span className="text-xs text-text-secondary-dark/70 mt-1 block">
                  {formatRelativeTime(conv.updatedAt)}
                </span>
              </div>

              {/* Menu */}
              <button
                className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary-dark hover:text-text-primary-dark"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                }}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpenId === conv.id && (
                <div className="absolute right-4 top-full z-10 bg-surface-dark border border-border-dark rounded-lg shadow-lg py-1">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                      setMenuOpenId(null);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Quick Links */}
      <div className="p-3 border-t border-border-dark">
        <div className="flex flex-wrap gap-2">
          <a href="/projects" className="text-xs text-text-secondary-dark hover:text-text-primary-dark">
            Projects
          </a>
          <a href="/teams" className="text-xs text-text-secondary-dark hover:text-text-primary-dark">
            Teams
          </a>
          <a href="/settings" className="text-xs text-text-secondary-dark hover:text-text-primary-dark">
            Settings
          </a>
        </div>
      </div>
    </div>
  );
};
```

### 2. Refactor ChatMessage

**Update:** `frontend/src/components/Chat/ChatMessage.tsx`

```typescript
import React from 'react';
import { ChatMessage as ChatMessageType } from '../../types/chat.types';
import { formatRelativeTime } from '../../utils/time';
import { User, Bot, AlertCircle } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.from.type === 'user';
  const isError = message.contentType === 'error';

  return (
    <div
      className={`flex gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : ''}`}
      data-testid="chat-message"
    >
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded-full
          flex items-center justify-center
          ${isUser
            ? 'bg-primary text-white'
            : isError
              ? 'bg-red-500/10 text-red-400'
              : 'bg-surface-dark border border-border-dark text-text-secondary-dark'
          }
        `}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-text-primary-dark">
            {message.from.name || (isUser ? 'You' : 'Orchestrator')}
          </span>
          <span className="text-xs text-text-secondary-dark">
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>

        <div
          className={`
            inline-block px-4 py-2 rounded-lg text-sm
            ${isUser
              ? 'bg-primary text-white rounded-br-sm'
              : isError
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-surface-dark text-text-primary-dark border border-border-dark rounded-bl-sm'
            }
          `}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
};
```

### 3. Refactor ChatInput

**Update:** `frontend/src/components/Chat/ChatInput.tsx`

```typescript
import React, { useState, useRef, useCallback } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { Button } from '../UI/Button';
import { Send } from 'lucide-react';

export const ChatInput: React.FC = () => {
  const { sendMessage, isTyping } = useChat();
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    if (!message.trim() || isTyping) return;
    sendMessage(message.trim());
    setMessage('');
  }, [message, isTyping, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="border-t border-border-dark p-4 bg-surface-dark">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          disabled={isTyping}
          className="
            flex-1 min-h-[44px] max-h-32 px-4 py-2.5
            bg-background-dark border border-border-dark rounded-lg
            text-text-primary-dark text-sm
            placeholder:text-text-secondary-dark/50
            focus:outline-none focus:border-primary
            disabled:opacity-50
            resize-none
          "
          rows={1}
        />
        <Button
          variant="primary"
          icon={Send}
          onClick={handleSubmit}
          disabled={!message.trim() || isTyping}
          loading={isTyping}
        >
          Send
        </Button>
      </div>
      <p className="mt-2 text-xs text-text-secondary-dark">
        Press <kbd className="px-1.5 py-0.5 bg-background-dark border border-border-dark rounded text-xs">Enter</kbd> to send,{' '}
        <kbd className="px-1.5 py-0.5 bg-background-dark border border-border-dark rounded text-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-background-dark border border-border-dark rounded text-xs">Enter</kbd> for new line
      </p>
    </div>
  );
};
```

### 4. Refactor ChatPanel

**Update:** `frontend/src/components/Chat/ChatPanel.tsx`

```typescript
import React, { useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { MessageSquare } from 'lucide-react';

export const ChatPanel: React.FC = () => {
  const { messages, isLoading, error, isTyping, currentConversation } = useChat();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background-dark">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-text-secondary-dark">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background-dark">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-3">
            ⚠️
          </div>
          <p className="text-red-400 mb-3">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-background-dark">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border-dark bg-surface-dark">
        <h2 className="text-lg font-semibold text-text-primary-dark">
          {currentConversation?.title ?? 'New Chat'}
        </h2>
        <span className="text-sm text-text-secondary-dark">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </header>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 bg-surface-dark border border-border-dark rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-text-secondary-dark" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary-dark mb-2">
              Welcome to AgentMux
            </h3>
            <p className="text-text-secondary-dark mb-4 max-w-md">
              Start a conversation with the Orchestrator. Try asking to:
            </p>
            <ul className="text-sm text-text-secondary-dark space-y-1">
              <li>• Create a new project</li>
              <li>• Assign a task to an agent</li>
              <li>• Check project status</li>
              <li>• Configure a team</li>
            </ul>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput />
    </div>
  );
};
```

### 5. Delete Old CSS Files

After migration, remove:
- `frontend/src/components/Chat/ChatSidebar.css`
- `frontend/src/components/Chat/ChatPanel.css`
- `frontend/src/components/Chat/ChatInput.css`
- `frontend/src/components/Chat/ChatMessage.css`

## Dependencies

- Task 71 (Atomic UI Component System) - Requires design tokens and atomic components

## Files to Modify

1. `frontend/src/components/Chat/ChatSidebar.tsx` - Refactor to use Tailwind
2. `frontend/src/components/Chat/ChatPanel.tsx` - Refactor to use Tailwind
3. `frontend/src/components/Chat/ChatInput.tsx` - Refactor to use Tailwind
4. `frontend/src/components/Chat/ChatMessage.tsx` - Refactor to use Tailwind
5. `frontend/src/components/Chat/TypingIndicator.tsx` - Refactor to use Tailwind

## Files to Delete

1. `frontend/src/components/Chat/*.css` - All CSS files after migration

## Testing Requirements

1. Chat sidebar matches dark theme
2. Conversations list displays correctly
3. Active conversation highlight is visible (primary color tint)
4. Messages display with proper styling
5. User messages vs orchestrator messages are distinguishable
6. Input area matches dark theme
7. All interactive states work (hover, focus, disabled)

## Acceptance Criteria

- [ ] Chat sidebar uses dark background (surface-dark)
- [ ] Conversation items have proper hover/active states
- [ ] Search input matches Input component style
- [ ] Messages use dark theme bubbles
- [ ] User messages align right with primary color
- [ ] Orchestrator messages align left with surface background
- [ ] Input area has dark theme styling
- [ ] No light-colored backgrounds visible
- [ ] All CSS files removed after migration
