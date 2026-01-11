/**
 * Terminal Gateway Tests
 *
 * Tests for the WebSocket-based terminal streaming gateway.
 *
 * @module terminal-gateway.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TerminalGateway } from './terminal.gateway.js';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Mock the session module
vi.mock('../services/session/index.js', () => ({
	getSessionBackend: vi.fn(),
	getSessionBackendSync: vi.fn(),
}));

// Mock the logger service
vi.mock('../services/core/logger.service.js', () => ({
	LoggerService: {
		getInstance: vi.fn(() => ({
			createComponentLogger: vi.fn(() => ({
				info: vi.fn(),
				debug: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			})),
		})),
	},
}));

describe('TerminalGateway', () => {
	let gateway: TerminalGateway;
	let mockIo: Partial<SocketIOServer>;
	let mockSocket: Partial<Socket>;
	let mockSessionBackend: any;
	let mockSession: any;
	let connectionCallback: ((socket: Socket) => void) | null = null;

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks();

		// Create mock socket
		mockSocket = {
			id: 'test-socket-id',
			emit: vi.fn(),
			join: vi.fn(),
			leave: vi.fn(),
			on: vi.fn(),
		};

		// Create mock Socket.IO server
		mockIo = {
			on: vi.fn((event: string, callback: (socket: Socket) => void) => {
				if (event === 'connection') {
					connectionCallback = callback;
				}
			}),
			to: vi.fn(() => ({
				emit: vi.fn(),
				disconnectSockets: vi.fn(),
			})),
			emit: vi.fn(),
			sockets: {
				sockets: new Map([['test-socket-id', mockSocket]]),
			},
		} as any;

		// Create mock session
		mockSession = {
			write: vi.fn(),
			resize: vi.fn(),
			onData: vi.fn(() => vi.fn()), // Returns unsubscribe function
			onExit: vi.fn(() => vi.fn()),
		};

		// Create mock session backend
		mockSessionBackend = {
			getSession: vi.fn(() => mockSession),
			sessionExists: vi.fn(() => true),
			captureOutput: vi.fn(() => 'mock output content'),
		};

		// Set up the mock
		const { getSessionBackendSync } = require('../services/session/index.js');
		getSessionBackendSync.mockReturnValue(mockSessionBackend);

		// Create gateway
		gateway = new TerminalGateway(mockIo as SocketIOServer);
	});

	afterEach(() => {
		gateway.destroy();
		connectionCallback = null;
	});

	describe('constructor', () => {
		it('should set up connection handler', () => {
			expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
		});
	});

	describe('connection handling', () => {
		it('should emit connected message on new connection', () => {
			// Trigger the connection callback
			if (connectionCallback) {
				connectionCallback(mockSocket as Socket);
			}

			expect(mockSocket.emit).toHaveBeenCalledWith('connected', expect.objectContaining({
				type: 'connection_established',
				payload: { socketId: 'test-socket-id' },
			}));
		});

		it('should set up event handlers on connection', () => {
			if (connectionCallback) {
				connectionCallback(mockSocket as Socket);
			}

			expect(mockSocket.on).toHaveBeenCalledWith('subscribe_to_session', expect.any(Function));
			expect(mockSocket.on).toHaveBeenCalledWith('unsubscribe_from_session', expect.any(Function));
			expect(mockSocket.on).toHaveBeenCalledWith('send_input', expect.any(Function));
			expect(mockSocket.on).toHaveBeenCalledWith('terminal_resize', expect.any(Function));
			expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
		});
	});

	describe('subscribeToSession', () => {
		it('should add client to session room', () => {
			gateway.subscribeToSession('test-session', mockSocket as Socket);

			expect(mockSocket.join).toHaveBeenCalledWith('terminal_test-session');
		});

		it('should confirm subscription', () => {
			gateway.subscribeToSession('test-session', mockSocket as Socket);

			expect(mockSocket.emit).toHaveBeenCalledWith('subscription_confirmed', expect.objectContaining({
				type: 'subscription_confirmed',
				payload: { sessionName: 'test-session' },
			}));
		});

		it('should start PTY streaming on first subscriber', () => {
			gateway.subscribeToSession('test-session', mockSocket as Socket);

			expect(mockSessionBackend.getSession).toHaveBeenCalledWith('test-session');
			expect(mockSession.onData).toHaveBeenCalled();
		});

		it('should not duplicate PTY subscription for multiple clients', () => {
			gateway.subscribeToSession('test-session', mockSocket as Socket);

			const mockSocket2 = {
				id: 'test-socket-id-2',
				emit: vi.fn(),
				join: vi.fn(),
				leave: vi.fn(),
			} as any;

			gateway.subscribeToSession('test-session', mockSocket2 as Socket);

			// onData should only be called once (first subscription)
			expect(mockSession.onData).toHaveBeenCalledTimes(1);
		});
	});

	describe('unsubscribeFromSession', () => {
		it('should remove client from session room', () => {
			gateway.subscribeToSession('test-session', mockSocket as Socket);
			gateway.unsubscribeFromSession('test-session', mockSocket as Socket);

			expect(mockSocket.leave).toHaveBeenCalledWith('terminal_test-session');
		});

		it('should confirm unsubscription', () => {
			gateway.subscribeToSession('test-session', mockSocket as Socket);
			gateway.unsubscribeFromSession('test-session', mockSocket as Socket);

			expect(mockSocket.emit).toHaveBeenCalledWith('unsubscription_confirmed', expect.objectContaining({
				type: 'unsubscription_confirmed',
				payload: { sessionName: 'test-session' },
			}));
		});
	});

	describe('sendInput', () => {
		it('should write input to PTY session', async () => {
			await gateway.sendInput('test-session', 'hello\r', mockSocket as Socket);

			expect(mockSession.write).toHaveBeenCalledWith('hello\r');
		});

		it('should emit error if session not found', async () => {
			mockSessionBackend.getSession.mockReturnValue(null);

			await gateway.sendInput('nonexistent-session', 'hello', mockSocket as Socket);

			expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
				type: 'session_not_found',
			}));
		});
	});

	describe('getConnectionStats', () => {
		it('should return connection statistics', () => {
			gateway.subscribeToSession('session1', mockSocket as Socket);

			const stats = gateway.getConnectionStats();

			expect(stats).toEqual({
				totalClients: 1,
				sessionSubscriptions: { session1: 1 },
				totalSessions: 1,
				activeStreams: 1,
			});
		});
	});

	describe('destroy', () => {
		it('should clean up all subscriptions', () => {
			gateway.subscribeToSession('test-session', mockSocket as Socket);
			gateway.destroy();

			const stats = gateway.getConnectionStats();
			expect(stats.activeStreams).toBe(0);
			expect(stats.totalSessions).toBe(0);
		});
	});

	describe('broadcast methods', () => {
		it('should broadcast system notification', () => {
			gateway.broadcastSystemNotification('Test message', 'info');

			expect(mockIo.emit).toHaveBeenCalledWith('system_notification', expect.objectContaining({
				type: 'system_notification',
				payload: { message: 'Test message', notificationType: 'info' },
			}));
		});

		it('should broadcast orchestrator status', () => {
			gateway.broadcastOrchestratorStatus({ status: 'active' });

			expect(mockIo.emit).toHaveBeenCalledWith('orchestrator_status_changed', expect.objectContaining({
				type: 'orchestrator_status_changed',
				payload: { status: 'active' },
			}));
		});

		it('should broadcast team member status', () => {
			gateway.broadcastTeamMemberStatus({ member: 'test-member', status: 'active' });

			expect(mockIo.emit).toHaveBeenCalledWith('team_member_status_changed', expect.objectContaining({
				type: 'team_member_status_changed',
				payload: { member: 'test-member', status: 'active' },
			}));
		});

		it('should broadcast team activity', () => {
			gateway.broadcastTeamActivity({ activity: 'test' });

			expect(mockIo.emit).toHaveBeenCalledWith('team_activity_updated', expect.objectContaining({
				type: 'team_activity_updated',
				payload: { activity: 'test' },
			}));
		});
	});
});
