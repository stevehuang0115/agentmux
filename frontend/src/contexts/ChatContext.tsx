/**
 * Chat Context
 *
 * Provides chat state and actions to the component tree.
 *
 * @module contexts/ChatContext
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  ChatMessage,
  ChatConversation,
  ChatSender,
} from '../types/chat.types';
import { chatService } from '../services/chat.service';
import { webSocketService } from '../services/websocket.service';

// =============================================================================
// Types
// =============================================================================

/**
 * Shape of the chat context value
 */
interface ChatContextValue {
  /** List of all conversations */
  conversations: ChatConversation[];
  /** Currently selected conversation */
  currentConversation: ChatConversation | null;
  /** Messages in the current conversation */
  messages: ChatMessage[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether a message is being sent */
  isSending: boolean;
  /** Current error message */
  error: string | null;
  /** Whether the orchestrator is typing */
  isTyping: boolean;

  /** Send a new message */
  sendMessage: (content: string) => Promise<void>;
  /** Select a conversation */
  selectConversation: (id: string) => Promise<void>;
  /** Create a new conversation */
  createConversation: (title?: string) => Promise<ChatConversation>;
  /** Delete a conversation */
  deleteConversation: (id: string) => Promise<void>;
  /** Archive a conversation */
  archiveConversation: (id: string) => Promise<void>;
  /** Clear messages in a conversation */
  clearConversation: (id: string) => Promise<void>;
  /** Refresh messages from server */
  refreshMessages: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;
}

// =============================================================================
// Context
// =============================================================================

const ChatContext = createContext<ChatContextValue | null>(null);

// =============================================================================
// Provider Props
// =============================================================================

interface ChatProviderProps {
  children: ReactNode;
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * Provider component for chat state management.
 *
 * Connects to WebSocket for real-time updates and provides
 * methods for interacting with the chat API.
 *
 * @param children - Child components that need access to chat state
 * @returns JSX element wrapping children with chat context
 */
export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  // State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Ref to track current conversation for event handlers
  const currentConversationRef = useRef<ChatConversation | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentConversationRef.current = currentConversation;
  }, [currentConversation]);

  // ---------------------------------------------------------------------------
  // WebSocket Event Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle incoming chat message from WebSocket
   */
  const handleNewMessage = useCallback((data: unknown) => {
    // Extract message from wrapped or direct format
    let message: ChatMessage | undefined;
    const payload = data as Record<string, unknown>;

    if (payload && typeof payload === 'object') {
      if ('data' in payload && payload.data && typeof payload.data === 'object') {
        message = payload.data as ChatMessage;
      } else if ('id' in payload) {
        message = payload as unknown as ChatMessage;
      }
    }

    if (!message || !message.id) return;

    const currentConv = currentConversationRef.current;

    if (message.conversationId === currentConv?.id) {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === message!.id)) {
          return prev;
        }
        return [...prev, message!];
      });
      setIsTyping(false);
    }

    // Update conversation in list
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === message!.conversationId
          ? {
              ...conv,
              lastMessage: {
                content: message!.content.slice(0, 100),
                timestamp: message!.timestamp,
                from: message!.from,
              },
              messageCount: conv.messageCount + 1,
              updatedAt: message!.timestamp,
            }
          : conv
      )
    );
  }, []);

  /**
   * Handle typing indicator from WebSocket
   */
  const handleTypingIndicator = useCallback((data: unknown) => {
    const typingData = data as {
      data?: { conversationId: string; sender: ChatSender; isTyping: boolean };
      conversationId?: string;
      isTyping?: boolean;
    };

    const parsed = typingData.data || typingData;
    const currentConv = currentConversationRef.current;

    if (parsed.conversationId === currentConv?.id) {
      setIsTyping(parsed.isTyping ?? false);
    }
  }, []);

  /**
   * Handle conversation update from WebSocket
   */
  const handleConversationUpdate = useCallback((data: unknown) => {
    // Extract conversation from wrapped or direct format
    let conversation: ChatConversation | undefined;
    const payload = data as Record<string, unknown>;

    if (payload && typeof payload === 'object') {
      if ('data' in payload && payload.data && typeof payload.data === 'object') {
        conversation = payload.data as ChatConversation;
      } else if ('id' in payload) {
        conversation = payload as unknown as ChatConversation;
      }
    }

    if (!conversation || !conversation.id) return;

    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversation!.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = conversation!;
        return updated;
      }
      return [conversation!, ...prev];
    });

    const currentConv = currentConversationRef.current;
    if (currentConv?.id === conversation.id) {
      setCurrentConversation(conversation);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // WebSocket Setup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Register WebSocket event handlers
    webSocketService.on('chat_message', handleNewMessage);
    webSocketService.on('chat_typing', handleTypingIndicator);
    webSocketService.on('conversation_updated', handleConversationUpdate);

    // Cleanup on unmount
    return () => {
      webSocketService.off('chat_message', handleNewMessage);
      webSocketService.off('chat_typing', handleTypingIndicator);
      webSocketService.off('conversation_updated', handleConversationUpdate);
    };
  }, [handleNewMessage, handleTypingIndicator, handleConversationUpdate]);

  // ---------------------------------------------------------------------------
  // Initial Data Load
  // ---------------------------------------------------------------------------

  useEffect(() => {
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

    loadInitialData();
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Send a new message
   */
  const sendMessage = useCallback(async (content: string) => {
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
  }, [isSending, currentConversation]);

  /**
   * Select a conversation
   */
  const selectConversation = useCallback(async (id: string) => {
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation) return;

    setCurrentConversation(conversation);
    setIsLoading(true);
    setError(null);

    try {
      const msgs = await chatService.getMessages(id);
      setMessages(msgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [conversations]);

  /**
   * Create a new conversation
   */
  const createConversation = useCallback(async (title?: string) => {
    const conversation = await chatService.createConversation(title);
    setConversations((prev) => [conversation, ...prev]);
    setCurrentConversation(conversation);
    setMessages([]);
    return conversation;
  }, []);

  /**
   * Delete a conversation
   */
  const deleteConversation = useCallback(async (id: string) => {
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
  }, [currentConversation, conversations, selectConversation]);

  /**
   * Archive a conversation
   */
  const archiveConversation = useCallback(async (id: string) => {
    await chatService.archiveConversation(id);
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
  }, [currentConversation, conversations, selectConversation]);

  /**
   * Clear messages in a conversation
   */
  const clearConversation = useCallback(async (id: string) => {
    await chatService.clearConversation(id);
    if (currentConversation?.id === id) {
      setMessages([]);
    }
  }, [currentConversation]);

  /**
   * Refresh messages from server
   */
  const refreshMessages = useCallback(async () => {
    if (!currentConversation) return;

    const msgs = await chatService.getMessages(currentConversation.id);
    setMessages(msgs);
  }, [currentConversation]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Context Value
  // ---------------------------------------------------------------------------

  const value: ChatContextValue = {
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
    clearError,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access chat context.
 *
 * @returns ChatContextValue object with state and actions
 * @throws Error if used outside of ChatProvider
 *
 * @example
 * ```typescript
 * const { messages, sendMessage, isTyping } = useChat();
 * ```
 */
export const useChat = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
