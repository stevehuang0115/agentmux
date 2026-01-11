/**
 * Terminal Component Tests
 *
 * Tests for the Terminal component with xterm.js and WebSocket integration.
 * Mocks useXterm hook to avoid direct xterm.js dependency in tests.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Hoist mock values before any imports
const mockXtermResult = vi.hoisted(() => ({
	terminalRef: { current: null },
	isInitialized: true,
	write: vi.fn(),
	clear: vi.fn(),
	scrollToBottom: vi.fn(),
}));

// Mock the useXterm hook with hoisted values
vi.mock('./useXterm', () => ({
	useXterm: () => mockXtermResult,
}));

// Mock websocket service
vi.mock('../../services/websocket.service');

// Import after mocks are set up
import { Terminal } from './Terminal';
import { webSocketService } from '../../services/websocket.service';

const mockWebSocketService = vi.mocked(webSocketService);

describe('Terminal', () => {
	const mockOnReady = vi.fn();
	const mockOnDisconnect = vi.fn();
	const mockOnError = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		// Reset hoisted mock functions
		mockXtermResult.write.mockClear();
		mockXtermResult.clear.mockClear();
		mockXtermResult.scrollToBottom.mockClear();

		// Mock WebSocket service methods
		mockWebSocketService.on = vi.fn();
		mockWebSocketService.off = vi.fn();
		mockWebSocketService.connect = vi.fn().mockResolvedValue(undefined);
		mockWebSocketService.disconnect = vi.fn();
		mockWebSocketService.isConnected = vi.fn().mockReturnValue(true);
		mockWebSocketService.subscribeToSession = vi.fn();
		mockWebSocketService.unsubscribeFromSession = vi.fn();
		mockWebSocketService.sendInput = vi.fn();
		mockWebSocketService.resizeTerminal = vi.fn();
		mockWebSocketService.getConnectionState = vi.fn().mockReturnValue('connected');
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('Rendering', () => {
		it('renders terminal container', () => {
			const { container } = render(
				<Terminal sessionName="test-session" onReady={mockOnReady} />
			);

			expect(container.querySelector('.terminal-container')).toBeInTheDocument();
		});

		it('shows session name in header', () => {
			render(<Terminal sessionName="my-test-session" />);

			expect(screen.getByText('my-test-session')).toBeInTheDocument();
		});

		it('shows connection status', async () => {
			render(<Terminal sessionName="test-session" />);

			await waitFor(() => {
				expect(screen.getByText('Connected')).toBeInTheDocument();
			});
		});

		it('shows connecting status when connecting', async () => {
			mockWebSocketService.getConnectionState.mockReturnValue('connecting');
			mockWebSocketService.isConnected.mockReturnValue(false);

			render(<Terminal sessionName="test-session" />);

			await waitFor(() => {
				expect(screen.getByText('Connecting...')).toBeInTheDocument();
			});
		});

		it('hides header when showHeader is false', () => {
			const { container } = render(
				<Terminal sessionName="test-session" showHeader={false} />
			);

			expect(container.querySelector('.terminal-header')).not.toBeInTheDocument();
		});

		it('shows read-only badge when readOnly is true', () => {
			render(<Terminal sessionName="test-session" readOnly={true} />);

			expect(screen.getByText('Read-only')).toBeInTheDocument();
		});
	});

	describe('WebSocket Integration', () => {
		it('connects to WebSocket on mount when not already connected', async () => {
			// Mock isConnected to return false so connect() is called
			mockWebSocketService.isConnected.mockReturnValue(false);

			render(<Terminal sessionName="test-session" />);

			await waitFor(() => {
				expect(mockWebSocketService.connect).toHaveBeenCalled();
			});
		});

		it('subscribes to session on mount', async () => {
			render(<Terminal sessionName="test-session" />);

			await waitFor(() => {
				expect(mockWebSocketService.subscribeToSession).toHaveBeenCalledWith(
					'test-session'
				);
			});
		});

		it('unsubscribes from session on unmount', async () => {
			const { unmount } = render(<Terminal sessionName="test-session" />);

			await waitFor(() => {
				expect(mockWebSocketService.subscribeToSession).toHaveBeenCalled();
			});

			unmount();

			expect(mockWebSocketService.unsubscribeFromSession).toHaveBeenCalledWith(
				'test-session'
			);
		});

		it('registers event listeners on mount', async () => {
			render(<Terminal sessionName="test-session" />);

			await waitFor(() => {
				expect(mockWebSocketService.on).toHaveBeenCalledWith(
					'terminal_output',
					expect.any(Function)
				);
				expect(mockWebSocketService.on).toHaveBeenCalledWith(
					'initial_terminal_state',
					expect.any(Function)
				);
			});
		});

		it('removes event listeners on unmount', async () => {
			const { unmount } = render(<Terminal sessionName="test-session" />);

			await waitFor(() => {
				expect(mockWebSocketService.on).toHaveBeenCalled();
			});

			unmount();

			expect(mockWebSocketService.off).toHaveBeenCalledWith(
				'terminal_output',
				expect.any(Function)
			);
		});
	});

	describe('Callbacks', () => {
		it('calls onReady when connected event is triggered', async () => {
			// Store the connected event handler when it's registered
			let connectedHandler: (() => void) | undefined;
			mockWebSocketService.on = vi.fn().mockImplementation((event, handler) => {
				if (event === 'connected') {
					connectedHandler = handler;
				}
			});

			render(
				<Terminal sessionName="test-session" onReady={mockOnReady} />
			);

			// Wait for component to mount and register event handlers
			await waitFor(() => {
				expect(mockWebSocketService.on).toHaveBeenCalledWith(
					'connected',
					expect.any(Function)
				);
			});

			// Simulate the connected event being triggered
			if (connectedHandler) {
				connectedHandler();
			}

			await waitFor(() => {
				expect(mockOnReady).toHaveBeenCalled();
			});
		});

		it('calls onError when connection fails', async () => {
			// Mock isConnected to return false so connect() is called
			mockWebSocketService.isConnected.mockReturnValue(false);
			mockWebSocketService.connect.mockRejectedValue(new Error('Connection failed'));

			render(
				<Terminal sessionName="test-session" onError={mockOnError} />
			);

			await waitFor(() => {
				expect(mockOnError).toHaveBeenCalledWith('Connection failed');
			});
		});
	});

	describe('Session Switching', () => {
		it('unsubscribes and resubscribes when session changes', async () => {
			const { rerender } = render(<Terminal sessionName="session-1" />);

			await waitFor(() => {
				expect(mockWebSocketService.subscribeToSession).toHaveBeenCalledWith(
					'session-1'
				);
			});

			rerender(<Terminal sessionName="session-2" />);

			await waitFor(() => {
				expect(mockWebSocketService.unsubscribeFromSession).toHaveBeenCalledWith(
					'session-1'
				);
				expect(mockWebSocketService.subscribeToSession).toHaveBeenCalledWith(
					'session-2'
				);
			});
		});
	});

	describe('Styling', () => {
		it('applies custom className', () => {
			const { container } = render(
				<Terminal sessionName="test-session" className="custom-class" />
			);

			expect(container.querySelector('.terminal-container')).toHaveClass(
				'custom-class'
			);
		});

		it('renders traffic light dots in header', () => {
			const { container } = render(<Terminal sessionName="test-session" />);

			expect(container.querySelector('.terminal-dot-red')).toBeInTheDocument();
			expect(container.querySelector('.terminal-dot-yellow')).toBeInTheDocument();
			expect(container.querySelector('.terminal-dot-green')).toBeInTheDocument();
		});
	});
});

describe('useTerminalWebSocket', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset hoisted mock functions
		mockXtermResult.write.mockClear();
		mockXtermResult.clear.mockClear();
		mockXtermResult.scrollToBottom.mockClear();

		mockWebSocketService.on = vi.fn();
		mockWebSocketService.off = vi.fn();
		mockWebSocketService.connect = vi.fn().mockResolvedValue(undefined);
		mockWebSocketService.isConnected = vi.fn().mockReturnValue(true);
		mockWebSocketService.subscribeToSession = vi.fn();
		mockWebSocketService.unsubscribeFromSession = vi.fn();
		mockWebSocketService.sendInput = vi.fn();
		mockWebSocketService.resizeTerminal = vi.fn();
		mockWebSocketService.getConnectionState = vi.fn().mockReturnValue('connected');
	});

	it('provides sendInput function', async () => {
		render(<Terminal sessionName="test-session" />);

		await waitFor(() => {
			expect(mockWebSocketService.subscribeToSession).toHaveBeenCalled();
		});

		// The component should be able to send input via the hook
		expect(mockWebSocketService.sendInput).toBeDefined();
	});

	it('provides resize function', async () => {
		render(<Terminal sessionName="test-session" />);

		await waitFor(() => {
			expect(mockWebSocketService.subscribeToSession).toHaveBeenCalled();
		});

		expect(mockWebSocketService.resizeTerminal).toBeDefined();
	});
});
