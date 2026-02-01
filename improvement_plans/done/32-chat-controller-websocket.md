# Task: Create Chat Controller and WebSocket Integration

## Overview

Create the REST API controller for chat functionality and integrate chat events with the existing WebSocket gateway for real-time updates.

## Priority

**Sprint 3** - Chat System Backend

## Dependencies

- `31-chat-types-service.md` - Chat types and service must be complete

## Files to Create

### 1. `backend/src/controllers/chat/chat.controller.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { getChatService } from '../../services/chat/chat.service.js';
import { SendMessageInput, ChatMessageFilter, ConversationFilter } from '../../types/chat.types.js';

const router = Router();

/**
 * POST /api/chat/send
 * Send a message to the orchestrator
 */
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: SendMessageInput = {
      content: req.body.content,
      conversationId: req.body.conversationId,
      metadata: req.body.metadata,
    };

    if (!input.content || input.content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required',
      });
    }

    const chatService = getChatService();
    const result = await chatService.sendMessage(input);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/messages
 * Get messages with optional filtering
 */
router.get('/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: ChatMessageFilter = {
      conversationId: req.query.conversationId as string,
      senderType: req.query.senderType as any,
      contentType: req.query.contentType as any,
      after: req.query.after as string,
      before: req.query.before as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    if (!filter.conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required',
      });
    }

    const chatService = getChatService();
    const messages = await chatService.getMessages(filter);

    res.json({
      success: true,
      data: messages,
      count: messages.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/conversations
 * List all conversations
 */
router.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: ConversationFilter = {
      includeArchived: req.query.includeArchived === 'true',
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const chatService = getChatService();
    const conversations = await chatService.getConversations(filter);

    res.json({
      success: true,
      data: conversations,
      count: conversations.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/conversations/current
 * Get the current (most recent) conversation
 */
router.get('/conversations/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chatService = getChatService();
    const conversation = await chatService.getCurrentConversation();

    if (!conversation) {
      // Create a new conversation if none exists
      const newConversation = await chatService.createConversation('New Chat');
      return res.json({
        success: true,
        data: newConversation,
        isNew: true,
      });
    }

    res.json({
      success: true,
      data: conversation,
      isNew: false,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/conversations/:id
 * Get a single conversation by ID
 */
router.get('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chatService = getChatService();
    const conversation = await chatService.getConversation(req.params.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/conversations
 * Create a new conversation
 */
router.post('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title } = req.body;

    const chatService = getChatService();
    const conversation = await chatService.createConversation(title);

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/chat/conversations/:id/archive
 * Archive a conversation
 */
router.put('/conversations/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chatService = getChatService();
    await chatService.archiveConversation(req.params.id);

    res.json({
      success: true,
      message: 'Conversation archived',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chatService = getChatService();
    await chatService.deleteConversation(req.params.id);

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/conversations/:id/clear
 * Clear all messages in a conversation
 */
router.post('/conversations/:id/clear', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chatService = getChatService();
    await chatService.clearConversation(req.params.id);

    res.json({
      success: true,
      message: 'Conversation cleared',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### 2. Update `backend/src/websocket/terminal.gateway.ts`

Add chat event handling to the existing WebSocket gateway:

```typescript
import { getChatService } from '../services/chat/chat.service.js';
import { ChatMessage, ChatWebSocketEvent } from '../types/chat.types.js';

// Add to existing WebSocket setup

/**
 * Extended message types for the WebSocket
 */
export type WebSocketMessageType =
  | 'terminal_output'
  | 'terminal_error'
  | 'session_started'
  | 'session_ended'
  | 'chat_message'        // New: formatted chat message
  | 'chat_typing'         // New: typing indicator
  | 'chat_status'         // New: message delivery status
  | 'conversation_updated'; // New: conversation changes

/**
 * Initialize chat service event listeners for WebSocket broadcasting
 */
function initializeChatWebSocket(wss: WebSocket.Server): void {
  const chatService = getChatService();

  // Forward chat_message events to all connected clients
  chatService.on('chat_message', (event: ChatWebSocketEvent) => {
    broadcast(wss, {
      type: 'chat_message',
      data: event.data,
      timestamp: new Date().toISOString(),
    });
  });

  // Forward typing indicators
  chatService.on('chat_typing', (event: ChatWebSocketEvent) => {
    broadcast(wss, {
      type: 'chat_typing',
      data: event.data,
      timestamp: new Date().toISOString(),
    });
  });

  // Forward conversation updates
  chatService.on('conversation_updated', (event: ChatWebSocketEvent) => {
    broadcast(wss, {
      type: 'conversation_updated',
      data: event.data,
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Broadcast message to all connected WebSocket clients
 */
function broadcast(wss: WebSocket.Server, message: object): void {
  const messageString = JSON.stringify(message);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    }
  });
}

/**
 * Process terminal output and convert to chat message if applicable
 */
async function processTerminalOutputForChat(
  sessionId: string,
  output: string,
  conversationId?: string
): Promise<void> {
  // Only process if there's an active conversation
  if (!conversationId) return;

  const chatService = getChatService();

  // Check if output contains response markers
  const hasResponseMarker =
    output.includes('[RESPONSE]') ||
    output.includes('[CHAT_RESPONSE]') ||
    output.includes('```response');

  if (hasResponseMarker) {
    // Extract and add as chat message
    await chatService.addAgentMessage(
      conversationId,
      output,
      {
        type: 'orchestrator',
        id: sessionId,
        name: 'Orchestrator',
      },
      { sessionId }
    );
  }
}

// Export for integration
export { initializeChatWebSocket, processTerminalOutputForChat };
```

### 3. `backend/src/controllers/chat/chat.controller.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import chatController from './chat.controller.js';
import { resetChatService, getChatService } from '../../services/chat/chat.service.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Chat Controller', () => {
  let app: express.Application;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `chat-controller-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Initialize chat service with test directory
    const chatService = getChatService();
    (chatService as any).chatDir = testDir;
    await chatService.initialize();

    app = express();
    app.use(express.json());
    app.use('/api/chat', chatController);
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    resetChatService();
  });

  describe('POST /api/chat/send', () => {
    it('should send a message and return result', async () => {
      const response = await request(app)
        .post('/api/chat/send')
        .send({ content: 'Hello!' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message.content).toBe('Hello!');
      expect(response.body.data.conversation).toBeDefined();
    });

    it('should return 400 for empty content', async () => {
      const response = await request(app)
        .post('/api/chat/send')
        .send({ content: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should use existing conversation if specified', async () => {
      // Create a conversation first
      const createResponse = await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'Test' });

      const conversationId = createResponse.body.data.id;

      const response = await request(app)
        .post('/api/chat/send')
        .send({ content: 'Hello!', conversationId });

      expect(response.body.data.conversation.id).toBe(conversationId);
    });
  });

  describe('GET /api/chat/messages', () => {
    it('should return messages for a conversation', async () => {
      // Send some messages first
      const sendResponse = await request(app)
        .post('/api/chat/send')
        .send({ content: 'Test message' });

      const conversationId = sendResponse.body.data.conversation.id;

      const response = await request(app)
        .get('/api/chat/messages')
        .query({ conversationId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return 400 without conversationId', async () => {
      const response = await request(app).get('/api/chat/messages');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/chat/conversations', () => {
    it('should return list of conversations', async () => {
      await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'Conv 1' });

      await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'Conv 2' });

      const response = await request(app).get('/api/chat/conversations');

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
    });

    it('should exclude archived by default', async () => {
      const createResponse = await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'Archived' });

      await request(app)
        .put(`/api/chat/conversations/${createResponse.body.data.id}/archive`);

      const response = await request(app).get('/api/chat/conversations');

      expect(response.body.data.length).toBe(0);
    });
  });

  describe('GET /api/chat/conversations/current', () => {
    it('should return most recent conversation', async () => {
      await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'Current' });

      const response = await request(app).get('/api/chat/conversations/current');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should create new conversation if none exists', async () => {
      const response = await request(app).get('/api/chat/conversations/current');

      expect(response.status).toBe(200);
      expect(response.body.isNew).toBe(true);
    });
  });

  describe('POST /api/chat/conversations', () => {
    it('should create a new conversation', async () => {
      const response = await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'New Conversation' });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('New Conversation');
    });
  });

  describe('DELETE /api/chat/conversations/:id', () => {
    it('should delete a conversation', async () => {
      const createResponse = await request(app)
        .post('/api/chat/conversations')
        .send({ title: 'To Delete' });

      const response = await request(app)
        .delete(`/api/chat/conversations/${createResponse.body.data.id}`);

      expect(response.status).toBe(200);

      // Verify deleted
      const getResponse = await request(app)
        .get(`/api/chat/conversations/${createResponse.body.data.id}`);

      expect(getResponse.status).toBe(404);
    });
  });

  describe('POST /api/chat/conversations/:id/clear', () => {
    it('should clear messages in a conversation', async () => {
      const sendResponse = await request(app)
        .post('/api/chat/send')
        .send({ content: 'Message to clear' });

      const conversationId = sendResponse.body.data.conversation.id;

      await request(app)
        .post(`/api/chat/conversations/${conversationId}/clear`);

      const messagesResponse = await request(app)
        .get('/api/chat/messages')
        .query({ conversationId });

      expect(messagesResponse.body.data.length).toBe(0);
    });
  });
});
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/send` | Send a message |
| GET | `/api/chat/messages` | Get messages for a conversation |
| GET | `/api/chat/conversations` | List all conversations |
| GET | `/api/chat/conversations/current` | Get current conversation |
| GET | `/api/chat/conversations/:id` | Get a conversation |
| POST | `/api/chat/conversations` | Create a conversation |
| PUT | `/api/chat/conversations/:id/archive` | Archive a conversation |
| DELETE | `/api/chat/conversations/:id` | Delete a conversation |
| POST | `/api/chat/conversations/:id/clear` | Clear messages |

## WebSocket Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `chat_message` | Server → Client | New chat message |
| `chat_typing` | Server → Client | Typing indicator |
| `chat_status` | Server → Client | Message status update |
| `conversation_updated` | Server → Client | Conversation changes |

## Integration with Terminal Gateway

The WebSocket gateway needs to:

1. **Initialize Chat Listeners**: Set up event listeners from ChatService
2. **Broadcast Chat Events**: Forward chat events to all connected clients
3. **Process Terminal Output**: Convert terminal output to chat messages when response markers are detected

```typescript
// In terminal.gateway.ts initialization
import { initializeChatWebSocket } from './chat-integration.js';

// During WebSocket server setup
initializeChatWebSocket(wss);
```

## Acceptance Criteria

- [ ] All REST endpoints work correctly
- [ ] WebSocket integration broadcasts chat events
- [ ] Terminal output is processed for chat messages
- [ ] Message pagination works
- [ ] Conversation management works
- [ ] Comprehensive test coverage
- [ ] Error handling with proper status codes

## Testing Requirements

1. Integration tests for all endpoints
2. WebSocket event tests
3. Terminal output processing tests
4. Error handling tests
5. Pagination tests

## Notes

- Chat controller should be mounted at `/api/chat`
- WebSocket events use existing connection infrastructure
- Consider rate limiting for message sending
- May need to handle reconnection and message sync
