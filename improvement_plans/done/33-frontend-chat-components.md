# Task: Create Frontend Chat Components

## Overview

Create the React components for the chat-based dashboard, including the chat panel, message components, input field, and sidebar for conversation management. This transforms the dashboard into a conversational interface with the Orchestrator.

## Priority

**Sprint 4** - Chat UI + Integration

## Dependencies

- `31-chat-types-service.md` - Chat types must be defined
- `32-chat-controller-websocket.md` - Backend API must be available

## Files to Create

### 1. `frontend/src/contexts/ChatContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, ChatConversation, SendMessageInput } from '../types/chat.types.js';
import { chatService } from '../services/chat.service.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

interface ChatContextValue {
  // State
  conversations: ChatConversation[];
  currentConversation: ChatConversation | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  isTyping: boolean;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createConversation: (title?: string) => Promise<ChatConversation>;
  deleteConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  clearConversation: (id: string) => Promise<void>;
  refreshMessages: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket();

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'chat_message':
        handleNewMessage(lastMessage.data as ChatMessage);
        break;
      case 'chat_typing':
        const typingData = lastMessage.data as { conversationId: string; isTyping: boolean };
        if (typingData.conversationId === currentConversation?.id) {
          setIsTyping(typingData.isTyping);
        }
        break;
      case 'conversation_updated':
        handleConversationUpdate(lastMessage.data as ChatConversation);
        break;
    }
  }, [lastMessage, currentConversation?.id]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [convs, current] = await Promise.all([
        chatService.getConversations(),
        chatService.getCurrentConversation(),
      ]);

      setConversations(convs);
      if (current) {
        setCurrentConversation(current);
        const msgs = await chatService.getMessages(current.id);
        setMessages(msgs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewMessage = useCallback((message: ChatMessage) => {
    if (message.conversationId === currentConversation?.id) {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      setIsTyping(false);
    }

    // Update conversation in list
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === message.conversationId
          ? {
              ...conv,
              lastMessage: {
                content: message.content.slice(0, 100),
                timestamp: message.timestamp,
                from: message.from,
              },
              messageCount: conv.messageCount + 1,
              updatedAt: message.timestamp,
            }
          : conv
      )
    );
  }, [currentConversation?.id]);

  const handleConversationUpdate = useCallback((conversation: ChatConversation) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversation.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = conversation;
        return updated;
      }
      return [conversation, ...prev];
    });

    if (currentConversation?.id === conversation.id) {
      setCurrentConversation(conversation);
    }
  }, [currentConversation?.id]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const result = await chatService.sendMessage({
        content,
        conversationId: currentConversation?.id,
      });

      // Update local state optimistically
      setMessages((prev) => [...prev, result.message]);

      if (!currentConversation) {
        setCurrentConversation(result.conversation);
        setConversations((prev) => [result.conversation, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const selectConversation = async (id: string) => {
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation) return;

    setCurrentConversation(conversation);
    setIsLoading(true);

    try {
      const msgs = await chatService.getMessages(id);
      setMessages(msgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const createConversation = async (title?: string) => {
    const conversation = await chatService.createConversation(title);
    setConversations((prev) => [conversation, ...prev]);
    setCurrentConversation(conversation);
    setMessages([]);
    return conversation;
  };

  const deleteConversation = async (id: string) => {
    await chatService.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));

    if (currentConversation?.id === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        await selectConversation(remaining[0].id);
      } else {
        setCurrentConversation(null);
        setMessages([]);
      }
    }
  };

  const archiveConversation = async (id: string) => {
    await chatService.archiveConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const clearConversation = async (id: string) => {
    await chatService.clearConversation(id);
    if (currentConversation?.id === id) {
      setMessages([]);
    }
  };

  const refreshMessages = async () => {
    if (!currentConversation) return;

    const msgs = await chatService.getMessages(currentConversation.id);
    setMessages(msgs);
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        currentConversation,
        messages,
        isLoading,
        isSending,
        error,
        isTyping,
        sendMessage,
        selectConversation,
        createConversation,
        deleteConversation,
        archiveConversation,
        clearConversation,
        refreshMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
```

### 2. `frontend/src/components/Chat/ChatPanel.tsx`

```typescript
import React, { useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext.js';
import { ChatMessage } from './ChatMessage.js';
import { ChatInput } from './ChatInput.js';
import { TypingIndicator } from './TypingIndicator.js';
import './ChatPanel.css';

/**
 * Main chat panel component displaying conversation messages
 */
export const ChatPanel: React.FC = () => {
  const {
    messages,
    isLoading,
    error,
    isTyping,
    currentConversation,
  } = useChat();

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  if (isLoading) {
    return (
      <div className="chat-panel loading">
        <div className="loading-spinner">Loading conversation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-panel error">
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <header className="chat-header">
        <h2>{currentConversation?.title ?? 'Chat with Orchestrator'}</h2>
        <span className="message-count">
          {messages.length} messages
        </span>
      </header>

      <div className="messages-container" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="empty-chat">
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
```

### 3. `frontend/src/components/Chat/ChatMessage.tsx`

```typescript
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { ChatMessage as ChatMessageType } from '../../types/chat.types.js';
import { formatRelativeTime } from '../../utils/time.js';
import './ChatMessage.css';

interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * Individual chat message component with markdown rendering
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [showRaw, setShowRaw] = useState(false);

  const isUser = message.from.type === 'user';
  const isSystem = message.from.type === 'system';

  const getSenderName = () => {
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
  };

  const getSenderIcon = () => {
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
  };

  const renderContent = () => {
    if (showRaw && message.metadata?.rawOutput) {
      return (
        <pre className="raw-output">
          {message.metadata.rawOutput}
        </pre>
      );
    }

    if (message.contentType === 'markdown' || message.contentType === 'text') {
      return (
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      );
    }

    if (message.contentType === 'code') {
      return (
        <SyntaxHighlighter PreTag="div">
          {message.content}
        </SyntaxHighlighter>
      );
    }

    return <p>{message.content}</p>;
  };

  return (
    <div
      className={`chat-message ${message.from.type} ${isUser ? 'user-message' : ''} ${isSystem ? 'system-message' : ''}`}
    >
      <div className="message-header">
        <span className="sender-icon">{getSenderIcon()}</span>
        <span className="sender-name">{getSenderName()}</span>
        <span className="message-time">
          {formatRelativeTime(message.timestamp)}
        </span>
        {message.metadata?.rawOutput && (
          <button
            className="toggle-raw-btn"
            onClick={() => setShowRaw(!showRaw)}
            title={showRaw ? 'Show formatted' : 'Show raw output'}
          >
            {showRaw ? '📝' : '🔍'}
          </button>
        )}
      </div>

      <div className="message-content">
        {renderContent()}
      </div>

      {message.metadata?.skillUsed && (
        <div className="message-metadata">
          <span className="skill-badge">Skill: {message.metadata.skillUsed}</span>
        </div>
      )}

      {message.metadata?.taskCreated && (
        <div className="message-metadata">
          <span className="task-badge">Task created: {message.metadata.taskCreated}</span>
        </div>
      )}

      {message.status === 'error' && (
        <div className="message-error">
          Failed to deliver
        </div>
      )}
    </div>
  );
};
```

### 4. `frontend/src/components/Chat/ChatInput.tsx`

```typescript
import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useChat } from '../../contexts/ChatContext.js';
import './ChatInput.css';

/**
 * Chat input component with auto-resize and keyboard shortcuts
 */
export const ChatInput: React.FC = () => {
  const { sendMessage, isSending, error } = useChat();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async () => {
    if (!input.trim() || isSending) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input-container">
      {error && (
        <div className="input-error">
          <span>Error: {error}</span>
        </div>
      )}

      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          disabled={isSending}
          rows={1}
          className="message-input"
        />

        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isSending}
          className="send-button"
          title="Send message"
        >
          {isSending ? (
            <span className="sending-indicator">⏳</span>
          ) : (
            <span className="send-icon">➤</span>
          )}
        </button>
      </div>

      <div className="input-hints">
        <span>Press <kbd>Enter</kbd> to send</span>
        <span><kbd>Shift</kbd> + <kbd>Enter</kbd> for new line</span>
      </div>
    </div>
  );
};
```

### 5. `frontend/src/components/Chat/ChatSidebar.tsx`

```typescript
import React, { useState } from 'react';
import { useChat } from '../../contexts/ChatContext.js';
import { ChatConversation } from '../../types/chat.types.js';
import { formatRelativeTime } from '../../utils/time.js';
import './ChatSidebar.css';

/**
 * Sidebar showing conversation list and management
 */
export const ChatSidebar: React.FC = () => {
  const {
    conversations,
    currentConversation,
    selectConversation,
    createConversation,
    deleteConversation,
    archiveConversation,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState<string | null>(null);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.title?.toLowerCase().includes(query) ||
      conv.lastMessage?.content.toLowerCase().includes(query)
    );
  });

  const handleNewChat = async () => {
    await createConversation('New Chat');
  };

  const handleContextMenu = (e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    setShowMenu(showMenu === convId ? null : convId);
  };

  const handleDelete = async (convId: string) => {
    if (confirm('Delete this conversation?')) {
      await deleteConversation(convId);
    }
    setShowMenu(null);
  };

  const handleArchive = async (convId: string) => {
    await archiveConversation(convId);
    setShowMenu(null);
  };

  const renderConversationItem = (conversation: ChatConversation) => {
    const isActive = currentConversation?.id === conversation.id;

    return (
      <div
        key={conversation.id}
        className={`conversation-item ${isActive ? 'active' : ''}`}
        onClick={() => selectConversation(conversation.id)}
        onContextMenu={(e) => handleContextMenu(e, conversation.id)}
      >
        <div className="conversation-info">
          <h4 className="conversation-title">
            {conversation.title || 'Untitled Chat'}
          </h4>
          {conversation.lastMessage && (
            <p className="conversation-preview">
              {conversation.lastMessage.content}
            </p>
          )}
          <span className="conversation-time">
            {formatRelativeTime(conversation.updatedAt)}
          </span>
        </div>

        <button
          className="menu-trigger"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(showMenu === conversation.id ? null : conversation.id);
          }}
        >
          ⋮
        </button>

        {showMenu === conversation.id && (
          <div className="context-menu">
            <button onClick={() => handleArchive(conversation.id)}>
              📁 Archive
            </button>
            <button
              className="danger"
              onClick={() => handleDelete(conversation.id)}
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="chat-sidebar">
      <div className="sidebar-header">
        <h3>Conversations</h3>
        <button className="new-chat-btn" onClick={handleNewChat}>
          + New Chat
        </button>
      </div>

      <div className="search-container">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="conversations-list">
        {filteredConversations.length === 0 ? (
          <div className="empty-list">
            {searchQuery ? 'No matching conversations' : 'No conversations yet'}
          </div>
        ) : (
          filteredConversations.map(renderConversationItem)
        )}
      </div>

      <div className="sidebar-footer">
        <nav className="quick-links">
          <a href="/projects">📁 Projects</a>
          <a href="/teams">👥 Teams</a>
          <a href="/settings">⚙️ Settings</a>
        </nav>
      </div>
    </aside>
  );
};
```

### 6. `frontend/src/components/Chat/TypingIndicator.tsx`

```typescript
import React from 'react';
import './TypingIndicator.css';

/**
 * Typing indicator shown when orchestrator is processing
 */
export const TypingIndicator: React.FC = () => {
  return (
    <div className="typing-indicator">
      <span className="sender-icon">🤖</span>
      <span className="sender-name">Orchestrator</span>
      <div className="typing-dots">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    </div>
  );
};
```

### 7. `frontend/src/services/chat.service.ts`

```typescript
import {
  ChatMessage,
  ChatConversation,
  SendMessageInput,
  SendMessageResult,
} from '../types/chat.types.js';

const API_BASE = '/api/chat';

/**
 * Chat API service
 */
class ChatApiService {
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const response = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to send message');
    }

    return data.data;
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const response = await fetch(
      `${API_BASE}/messages?conversationId=${conversationId}`
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to load messages');
    }

    return data.data;
  }

  async getConversations(): Promise<ChatConversation[]> {
    const response = await fetch(`${API_BASE}/conversations`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load conversations');
    }

    return data.data;
  }

  async getCurrentConversation(): Promise<ChatConversation | null> {
    const response = await fetch(`${API_BASE}/conversations/current`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load current conversation');
    }

    return data.data;
  }

  async createConversation(title?: string): Promise<ChatConversation> {
    const response = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create conversation');
    }

    return data.data;
  }

  async deleteConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete conversation');
    }
  }

  async archiveConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/conversations/${id}/archive`, {
      method: 'PUT',
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to archive conversation');
    }
  }

  async clearConversation(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/conversations/${id}/clear`, {
      method: 'POST',
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to clear conversation');
    }
  }
}

export const chatService = new ChatApiService();
```

### 8. Update `frontend/src/pages/Dashboard.tsx`

Refactor to use the chat-centric layout:

```typescript
import React from 'react';
import { ChatProvider } from '../contexts/ChatContext.js';
import { ChatPanel } from '../components/Chat/ChatPanel.js';
import { ChatSidebar } from '../components/Chat/ChatSidebar.js';
import './Dashboard.css';

/**
 * Main dashboard page with chat-centric layout
 */
export const Dashboard: React.FC = () => {
  return (
    <ChatProvider>
      <div className="dashboard-layout">
        <ChatSidebar />
        <main className="dashboard-main">
          <ChatPanel />
        </main>
      </div>
    </ChatProvider>
  );
};

export default Dashboard;
```

## Test Files Required

Create test files for each component:

- `frontend/src/contexts/ChatContext.test.tsx`
- `frontend/src/components/Chat/ChatPanel.test.tsx`
- `frontend/src/components/Chat/ChatMessage.test.tsx`
- `frontend/src/components/Chat/ChatInput.test.tsx`
- `frontend/src/components/Chat/ChatSidebar.test.tsx`
- `frontend/src/components/Chat/TypingIndicator.test.tsx`
- `frontend/src/services/chat.service.test.ts`

## CSS Files Required

- `frontend/src/components/Chat/ChatPanel.css`
- `frontend/src/components/Chat/ChatMessage.css`
- `frontend/src/components/Chat/ChatInput.css`
- `frontend/src/components/Chat/ChatSidebar.css`
- `frontend/src/components/Chat/TypingIndicator.css`
- `frontend/src/pages/Dashboard.css` (update)

## Acceptance Criteria

- [ ] Chat panel displays messages with markdown rendering
- [ ] Message input works with keyboard shortcuts
- [ ] Real-time updates via WebSocket
- [ ] Typing indicator shows when orchestrator is processing
- [ ] Sidebar shows conversation list
- [ ] Conversation switching works
- [ ] New conversation creation works
- [ ] Delete and archive work
- [ ] Search/filter conversations works
- [ ] Auto-scroll to new messages
- [ ] Raw output toggle works
- [ ] Responsive design for mobile/tablet
- [ ] All components have tests

## Testing Requirements

1. Unit tests for all components
2. Context state management tests
3. WebSocket integration tests
4. User interaction tests
5. Accessibility tests

## Notes

- Use react-markdown for markdown rendering
- Consider lazy loading for older messages
- Add error boundaries for component errors
- Use CSS modules or styled-components for styling
- Consider mobile-first responsive design
