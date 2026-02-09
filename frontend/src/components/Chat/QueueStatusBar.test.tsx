/**
 * Queue Status Bar Tests
 *
 * Tests for the QueueStatusBar component.
 *
 * @module components/Chat/QueueStatusBar.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueueStatusBar } from './QueueStatusBar';
import { apiService } from '../../services/api.service';
import { webSocketService } from '../../services/websocket.service';
import type { QueueStatus, QueuedMessage } from '../../types';

// Mock services
vi.mock('../../services/api.service', () => ({
  apiService: {
    getQueueStatus: vi.fn(),
    getPendingMessages: vi.fn(),
    cancelQueueMessage: vi.fn(),
  },
}));

vi.mock('../../services/websocket.service', () => ({
  webSocketService: {
    on: vi.fn(),
    off: vi.fn(),
  },
}));

const mockApiService = apiService as jest.Mocked<typeof apiService>;
const mockWebSocketService = webSocketService as jest.Mocked<typeof webSocketService>;

// =============================================================================
// Test Data
// =============================================================================

/**
 * Create a mock QueueStatus for testing.
 *
 * @param overrides - Partial overrides for the default status
 * @returns QueueStatus test fixture
 */
function createMockQueueStatus(overrides: Partial<QueueStatus> = {}): QueueStatus {
  return {
    pendingCount: 2,
    isProcessing: true,
    totalProcessed: 10,
    totalFailed: 1,
    historyCount: 11,
    ...overrides,
  };
}

/**
 * Create a mock QueuedMessage for testing.
 *
 * @param overrides - Partial overrides for the default message
 * @returns QueuedMessage test fixture
 */
function createMockQueuedMessage(overrides: Partial<QueuedMessage> = {}): QueuedMessage {
  return {
    id: 'msg-1',
    content: 'Hello, can you help me with the project setup?',
    conversationId: 'conv-1',
    source: 'web_chat',
    status: 'pending',
    enqueuedAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('QueueStatusBar', () => {
  /** Captured WebSocket event handlers for simulating events */
  let wsHandlers: Map<string, (data: unknown) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    wsHandlers = new Map();

    // Capture WebSocket event handlers
    mockWebSocketService.on.mockImplementation((event: string, handler: (data: unknown) => void) => {
      wsHandlers.set(event, handler);
    });

    // Default: empty queue
    mockApiService.getQueueStatus.mockResolvedValue(
      createMockQueueStatus({ pendingCount: 0, isProcessing: false })
    );
    mockApiService.getPendingMessages.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hidden state', () => {
    it('renders nothing when queue is empty', async () => {
      const { container } = render(<QueueStatusBar />);
      await waitFor(() => {
        expect(mockApiService.getQueueStatus).toHaveBeenCalled();
      });
      expect(container.querySelector('.queue-status-bar')).not.toBeInTheDocument();
    });
  });

  describe('visible state', () => {
    beforeEach(() => {
      mockApiService.getQueueStatus.mockResolvedValue(createMockQueueStatus());
      mockApiService.getPendingMessages.mockResolvedValue([
        createMockQueuedMessage({ id: 'msg-1', status: 'processing', content: 'Processing message' }),
        createMockQueuedMessage({ id: 'msg-2', status: 'pending', content: 'Pending message' }),
        createMockQueuedMessage({ id: 'msg-3', status: 'pending', content: 'Another pending message', source: 'slack' }),
      ]);
    });

    it('shows the status bar when messages are queued', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });
    });

    it('shows pending count and processing indicator in summary', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByText(/2 queued/)).toBeInTheDocument();
        expect(screen.getByText(/1 processing/)).toBeInTheDocument();
      });
    });

    it('shows processing spinner when a message is being processed', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-spinner')).toBeInTheDocument();
      });
    });

    it('does not show spinner when only pending (not processing)', async () => {
      mockApiService.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pendingCount: 1, isProcessing: false })
      );
      mockApiService.getPendingMessages.mockResolvedValue([
        createMockQueuedMessage({ status: 'pending' }),
      ]);

      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('queue-spinner')).not.toBeInTheDocument();
    });
  });

  describe('expand/collapse', () => {
    beforeEach(() => {
      mockApiService.getQueueStatus.mockResolvedValue(createMockQueueStatus());
      mockApiService.getPendingMessages.mockResolvedValue([
        createMockQueuedMessage({ id: 'msg-1', status: 'pending', content: 'Test message' }),
      ]);
    });

    it('expands the message list when summary is clicked', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      const summary = screen.getByTestId('queue-status-summary');
      fireEvent.click(summary);

      const list = screen.getByTestId('queue-message-list');
      expect(list).toHaveClass('expanded');
    });

    it('collapses when clicked again', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      const summary = screen.getByTestId('queue-status-summary');
      fireEvent.click(summary);
      fireEvent.click(summary);

      const list = screen.getByTestId('queue-message-list');
      expect(list).not.toHaveClass('expanded');
    });

    it('expands on Enter key press', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      const summary = screen.getByTestId('queue-status-summary');
      fireEvent.keyDown(summary, { key: 'Enter' });

      const list = screen.getByTestId('queue-message-list');
      expect(list).toHaveClass('expanded');
    });
  });

  describe('message items', () => {
    const longContent = 'This is a very long message that should be truncated because it exceeds the maximum preview length limit';

    beforeEach(() => {
      mockApiService.getQueueStatus.mockResolvedValue(createMockQueueStatus());
      mockApiService.getPendingMessages.mockResolvedValue([
        createMockQueuedMessage({ id: 'msg-1', status: 'pending', content: longContent }),
        createMockQueuedMessage({ id: 'msg-2', status: 'pending', content: 'Short msg', source: 'slack' }),
      ]);
    });

    it('truncates long message content', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      // Expand to see messages
      fireEvent.click(screen.getByTestId('queue-status-summary'));

      // The truncated text should end with "..."
      const items = screen.getAllByTestId('queue-message-item');
      expect(items[0].textContent).toContain('...');
    });

    it('shows source badges', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('queue-status-summary'));

      expect(screen.getByText('web')).toBeInTheDocument();
      expect(screen.getByText('slack')).toBeInTheDocument();
    });

    it('shows cancel button only for pending messages', async () => {
      mockApiService.getPendingMessages.mockResolvedValue([
        createMockQueuedMessage({ id: 'msg-1', status: 'processing', content: 'Processing' }),
        createMockQueuedMessage({ id: 'msg-2', status: 'pending', content: 'Pending' }),
      ]);

      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('queue-status-summary'));

      const cancelButtons = screen.getAllByTestId('queue-cancel-btn');
      expect(cancelButtons).toHaveLength(1);
    });
  });

  describe('cancel action', () => {
    beforeEach(() => {
      mockApiService.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pendingCount: 1, isProcessing: false })
      );
      mockApiService.getPendingMessages.mockResolvedValue([
        createMockQueuedMessage({ id: 'msg-1', status: 'pending', content: 'Cancel me' }),
      ]);
      mockApiService.cancelQueueMessage.mockResolvedValue(undefined);
    });

    it('calls cancelQueueMessage when cancel button is clicked', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('queue-status-summary'));
      fireEvent.click(screen.getByTestId('queue-cancel-btn'));

      expect(mockApiService.cancelQueueMessage).toHaveBeenCalledWith('msg-1');
    });

    it('shows Cancelling... text while cancel is in progress', async () => {
      // Make cancelQueueMessage hang
      mockApiService.cancelQueueMessage.mockReturnValue(new Promise(() => {}));

      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('queue-status-summary'));
      fireEvent.click(screen.getByTestId('queue-cancel-btn'));

      expect(screen.getByText('Cancelling...')).toBeInTheDocument();
    });
  });

  describe('WebSocket real-time updates', () => {
    beforeEach(() => {
      mockApiService.getQueueStatus.mockResolvedValue(
        createMockQueueStatus({ pendingCount: 1, isProcessing: false })
      );
      mockApiService.getPendingMessages.mockResolvedValue([
        createMockQueuedMessage({ id: 'msg-1', status: 'pending', content: 'Initial message' }),
      ]);
    });

    it('subscribes to all 6 queue events on mount', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(mockWebSocketService.on).toHaveBeenCalledWith('queue:status_update', expect.any(Function));
        expect(mockWebSocketService.on).toHaveBeenCalledWith('queue:message_enqueued', expect.any(Function));
        expect(mockWebSocketService.on).toHaveBeenCalledWith('queue:message_processing', expect.any(Function));
        expect(mockWebSocketService.on).toHaveBeenCalledWith('queue:message_completed', expect.any(Function));
        expect(mockWebSocketService.on).toHaveBeenCalledWith('queue:message_failed', expect.any(Function));
        expect(mockWebSocketService.on).toHaveBeenCalledWith('queue:message_cancelled', expect.any(Function));
      });
    });

    it('unsubscribes from all events on unmount', async () => {
      const { unmount } = render(<QueueStatusBar />);
      await waitFor(() => {
        expect(mockWebSocketService.on).toHaveBeenCalled();
      });

      unmount();

      expect(mockWebSocketService.off).toHaveBeenCalledWith('queue:status_update', expect.any(Function));
      expect(mockWebSocketService.off).toHaveBeenCalledWith('queue:message_enqueued', expect.any(Function));
      expect(mockWebSocketService.off).toHaveBeenCalledWith('queue:message_processing', expect.any(Function));
      expect(mockWebSocketService.off).toHaveBeenCalledWith('queue:message_completed', expect.any(Function));
      expect(mockWebSocketService.off).toHaveBeenCalledWith('queue:message_failed', expect.any(Function));
      expect(mockWebSocketService.off).toHaveBeenCalledWith('queue:message_cancelled', expect.any(Function));
    });

    it('adds new message on queue:message_enqueued event', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      // Simulate enqueued event
      const handler = wsHandlers.get('queue:message_enqueued');
      expect(handler).toBeDefined();

      act(() => {
        handler!(createMockQueuedMessage({ id: 'msg-new', content: 'New enqueued message' }));
      });

      // Expand and check
      fireEvent.click(screen.getByTestId('queue-status-summary'));
      const items = screen.getAllByTestId('queue-message-item');
      expect(items).toHaveLength(2);
    });

    it('removes message on queue:message_completed event', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      // Simulate completed event
      const handler = wsHandlers.get('queue:message_completed');
      expect(handler).toBeDefined();

      act(() => {
        handler!(createMockQueuedMessage({ id: 'msg-1' }));
      });

      // Also update status to empty
      const statusHandler = wsHandlers.get('queue:status_update');
      act(() => {
        statusHandler!(createMockQueueStatus({ pendingCount: 0, isProcessing: false }));
      });

      // Bar should hide
      expect(screen.queryByTestId('queue-status-bar')).not.toBeInTheDocument();
    });

    it('updates message status on queue:message_processing event', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      const handler = wsHandlers.get('queue:message_processing');
      expect(handler).toBeDefined();

      act(() => {
        handler!(createMockQueuedMessage({ id: 'msg-1', status: 'processing' }));
      });

      // Expand and check - processing item should not have cancel button
      fireEvent.click(screen.getByTestId('queue-status-summary'));
      expect(screen.queryByTestId('queue-cancel-btn')).not.toBeInTheDocument();
    });

    it('does not add duplicate message on enqueued event', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      const handler = wsHandlers.get('queue:message_enqueued');
      act(() => {
        handler!(createMockQueuedMessage({ id: 'msg-1', content: 'Duplicate' }));
      });

      fireEvent.click(screen.getByTestId('queue-status-summary'));
      const items = screen.getAllByTestId('queue-message-item');
      expect(items).toHaveLength(1);
    });

    it('updates queue status on queue:status_update event', async () => {
      render(<QueueStatusBar />);
      await waitFor(() => {
        expect(screen.getByTestId('queue-status-bar')).toBeInTheDocument();
      });

      const handler = wsHandlers.get('queue:status_update');
      act(() => {
        handler!(createMockQueueStatus({ pendingCount: 5, isProcessing: true }));
      });

      expect(screen.getByText(/5 queued/)).toBeInTheDocument();
    });
  });

  describe('initial load failure', () => {
    it('renders nothing when API calls fail', async () => {
      mockApiService.getQueueStatus.mockRejectedValue(new Error('Network error'));
      mockApiService.getPendingMessages.mockRejectedValue(new Error('Network error'));

      const { container } = render(<QueueStatusBar />);
      await waitFor(() => {
        expect(mockApiService.getQueueStatus).toHaveBeenCalled();
      });

      expect(container.querySelector('.queue-status-bar')).not.toBeInTheDocument();
    });
  });
});
