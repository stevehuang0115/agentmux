/**
 * Terminal WebSocket Hook
 *
 * Custom React hook for managing WebSocket connections to terminal sessions.
 * Integrates with the global WebSocketService for consistent connection handling.
 *
 * @module useTerminalWebSocket
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { webSocketService } from '../../services/websocket.service';

/**
 * Options for the useTerminalWebSocket hook.
 */
export interface UseTerminalWebSocketOptions {
	/** Name of the terminal session to connect to */
	sessionName: string;
	/** Callback when terminal data is received */
	onData: (data: string) => void;
	/** Optional callback for initial terminal state restore */
	onRestore?: (data: string) => void;
	/** Optional callback when connection is established */
	onConnect?: () => void;
	/** Optional callback when connection is lost */
	onDisconnect?: () => void;
	/** Optional callback for connection errors */
	onError?: (error: string) => void;
}

/**
 * Return type for the useTerminalWebSocket hook.
 */
export interface UseTerminalWebSocketResult {
	/** Function to send input to the terminal */
	sendInput: (data: string) => void;
	/** Function to resize the terminal */
	resize: (cols: number, rows: number) => void;
	/** Whether the WebSocket is currently connected */
	isConnected: boolean;
	/** Current connection status */
	connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error';
	/** Any error message */
	error: string | null;
}

/**
 * Custom hook for WebSocket terminal communication.
 *
 * This hook manages the WebSocket connection lifecycle for a specific terminal session,
 * handling subscriptions, data events, and reconnection logic.
 *
 * @param options - Configuration options for the WebSocket connection
 * @returns Object containing sendInput function and connection status
 *
 * @example
 * ```tsx
 * const { sendInput, isConnected, connectionStatus } = useTerminalWebSocket({
 *   sessionName: 'my-session',
 *   onData: (data) => terminal.write(data),
 *   onConnect: () => console.log('Connected'),
 *   onDisconnect: () => console.log('Disconnected'),
 * });
 *
 * // Send user input
 * sendInput('ls -la\n');
 * ```
 */
export function useTerminalWebSocket({
	sessionName,
	onData,
	onRestore,
	onConnect,
	onDisconnect,
	onError,
}: UseTerminalWebSocketOptions): UseTerminalWebSocketResult {
	const [isConnected, setIsConnected] = useState(false);
	const [connectionStatus, setConnectionStatus] = useState<
		'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error'
	>('disconnected');
	const [error, setError] = useState<string | null>(null);

	const currentSessionRef = useRef<string | null>(null);
	const isInitializedRef = useRef(false);

	// Handle terminal output
	const handleTerminalOutput = useCallback(
		(data: { sessionName?: string; content?: string }) => {
			if (data?.sessionName === sessionName && data?.content) {
				onData(data.content);
			}
		},
		[sessionName, onData]
	);

	// Handle initial terminal state (for restoration)
	const handleInitialState = useCallback(
		(data: { sessionName?: string; content?: string }) => {
			if (data?.sessionName === sessionName && data?.content) {
				onRestore?.(data.content);
			}
		},
		[sessionName, onRestore]
	);

	// Handle connection status change
	const handleConnectionChange = useCallback(() => {
		const status = webSocketService.getConnectionState();
		setConnectionStatus(status);
		setIsConnected(status === 'connected');

		if (status === 'connected') {
			setError(null);
			onConnect?.();
		} else if (status === 'disconnected') {
			onDisconnect?.();
		}
	}, [onConnect, onDisconnect]);

	// Handle connection error
	const handleError = useCallback(
		(data: { error?: string }) => {
			const errorMessage = data?.error || 'WebSocket connection error';
			setError(errorMessage);
			setConnectionStatus('error');
			onError?.(errorMessage);
		},
		[onError]
	);

	// Initialize WebSocket connection
	useEffect(() => {
		if (isInitializedRef.current) return;
		isInitializedRef.current = true;

		const initializeConnection = async () => {
			try {
				setConnectionStatus('connecting');

				// Set up event listeners
				webSocketService.on('terminal_output', handleTerminalOutput);
				webSocketService.on('initial_terminal_state', handleInitialState);
				webSocketService.on('connected', handleConnectionChange);
				webSocketService.on('error', handleError);
				webSocketService.on('connection_failed', handleError);

				// Connect if not already connected
				if (!webSocketService.isConnected()) {
					await webSocketService.connect();
				}

				setConnectionStatus('connected');
				setIsConnected(true);

				// Subscribe to the session
				if (sessionName) {
					webSocketService.subscribeToSession(sessionName);
					currentSessionRef.current = sessionName;
				}
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Connection failed';
				setError(errorMessage);
				setConnectionStatus('error');
				onError?.(errorMessage);
			}
		};

		initializeConnection();

		return () => {
			// Cleanup on unmount
			if (currentSessionRef.current) {
				webSocketService.unsubscribeFromSession(currentSessionRef.current);
			}

			webSocketService.off('terminal_output', handleTerminalOutput);
			webSocketService.off('initial_terminal_state', handleInitialState);
			webSocketService.off('connected', handleConnectionChange);
			webSocketService.off('error', handleError);
			webSocketService.off('connection_failed', handleError);

			isInitializedRef.current = false;
		};
	}, []);

	// Handle session name changes
	useEffect(() => {
		if (!isConnected) return;

		// Unsubscribe from previous session
		if (currentSessionRef.current && currentSessionRef.current !== sessionName) {
			webSocketService.unsubscribeFromSession(currentSessionRef.current);
		}

		// Subscribe to new session
		if (sessionName) {
			webSocketService.subscribeToSession(sessionName);
			currentSessionRef.current = sessionName;
		}
	}, [sessionName, isConnected]);

	// Send input to the terminal
	const sendInput = useCallback(
		(data: string) => {
			if (isConnected && sessionName) {
				webSocketService.sendInput(sessionName, data);
			}
		},
		[sessionName, isConnected]
	);

	// Resize the terminal
	const resize = useCallback(
		(cols: number, rows: number) => {
			if (isConnected && sessionName) {
				webSocketService.resizeTerminal(sessionName, cols, rows);
			}
		},
		[sessionName, isConnected]
	);

	return {
		sendInput,
		resize,
		isConnected,
		connectionStatus,
		error,
	};
}
