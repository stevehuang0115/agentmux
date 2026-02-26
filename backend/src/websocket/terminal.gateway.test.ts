/**
 * Terminal Gateway Tests
 *
 * Tests for the WebSocket-based terminal streaming gateway.
 *
 * @module terminal-gateway.test
 */

import { TerminalGateway } from './terminal.gateway.js';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Mock the session module
jest.mock('../services/session/index.js', () => ({
	getSessionBackend: jest.fn(),
	getSessionBackendSync: jest.fn(),
}));

// Mock the chat gateway
jest.mock('./chat.gateway.js', () => ({
	getChatGateway: jest.fn(() => ({
		processTerminalOutput: jest.fn().mockResolvedValue(undefined),
		processNotifyMessage: jest.fn().mockResolvedValue(undefined),
	})),
}));

// Mock the Slack bridge
const mockBridgeSendNotification = jest.fn().mockResolvedValue(undefined);
const mockBridgeMarkDeliveredBySkill = jest.fn();
jest.mock('../services/slack/slack-orchestrator-bridge.js', () => ({
	getSlackOrchestratorBridge: jest.fn(() => ({
		isInitialized: jest.fn(() => true),
		sendNotification: mockBridgeSendNotification,
		markDeliveredBySkill: mockBridgeMarkDeliveredBySkill,
	})),
}));

// Mock the chat service (used for updateMessageMetadata when channelId present)
const mockUpdateMessageMetadata = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/chat/chat.service.js', () => ({
	getChatService: jest.fn(() => ({
		updateMessageMetadata: mockUpdateMessageMetadata,
	})),
}));

// Mock the logger service
jest.mock('../services/core/logger.service.js', () => ({
	LoggerService: {
		getInstance: jest.fn(() => ({
			createComponentLogger: jest.fn(() => ({
				info: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
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
		jest.clearAllMocks();

		// Create mock socket
		mockSocket = {
			id: 'test-socket-id',
			emit: jest.fn(),
			join: jest.fn(),
			leave: jest.fn(),
			on: jest.fn(),
		};

		// Create mock Socket.IO server
		mockIo = {
			on: jest.fn((event: string, callback: (socket: Socket) => void) => {
				if (event === 'connection') {
					connectionCallback = callback;
				}
			}),
			to: jest.fn(() => ({
				emit: jest.fn(),
				disconnectSockets: jest.fn(),
			})),
			emit: jest.fn(),
			sockets: {
				sockets: new Map([['test-socket-id', mockSocket]]),
			},
		} as any;

		// Create mock session
		mockSession = {
			write: jest.fn(),
			resize: jest.fn(),
			onData: jest.fn(() => jest.fn()), // Returns unsubscribe function
			onExit: jest.fn(() => jest.fn()),
		};

		// Create mock session backend
		mockSessionBackend = {
			getSession: jest.fn(() => mockSession),
			sessionExists: jest.fn(() => true),
			captureOutput: jest.fn(() => 'mock output content'),
			getRawHistory: jest.fn(() => 'mock raw history with ANSI codes'),
			listSessions: jest.fn(() => ['test-session']),
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
				payload: { sessionName: 'test-session', sessionExists: true },
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
				emit: jest.fn(),
				join: jest.fn(),
				leave: jest.fn(),
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

	describe('activeConversationId', () => {
		it('should initially be null', () => {
			expect(gateway.getActiveConversationId()).toBeNull();
		});

		it('should set and get active conversation ID', () => {
			gateway.setActiveConversationId('test-conv-123');

			expect(gateway.getActiveConversationId()).toBe('test-conv-123');
		});

		it('should allow setting to null', () => {
			gateway.setActiveConversationId('test-conv-123');
			gateway.setActiveConversationId(null);

			expect(gateway.getActiveConversationId()).toBeNull();
		});

		it('should update to new conversation ID', () => {
			gateway.setActiveConversationId('conv-1');
			gateway.setActiveConversationId('conv-2');

			expect(gateway.getActiveConversationId()).toBe('conv-2');
		});
	});

	describe('disconnectSessionClients', () => {
		it('should disconnect all clients from session', () => {
			gateway.subscribeToSession('test-session', mockSocket as Socket);

			gateway.disconnectSessionClients('test-session');

			expect(mockIo.to).toHaveBeenCalledWith('terminal_test-session');
		});

		it('should clean up session subscription after disconnect', () => {
			gateway.subscribeToSession('test-session', mockSocket as Socket);

			gateway.disconnectSessionClients('test-session');

			const stats = gateway.getConnectionStats();
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

	describe('orchestrator output buffer', () => {
		it('should clear buffer when setActiveConversationId is called', () => {
			gateway.setActiveConversationId('conv-1');
			gateway.clearOrchestratorBuffer();

			// Set new conversation should clear buffer
			gateway.setActiveConversationId('conv-2');

			expect(gateway.getActiveConversationId()).toBe('conv-2');
		});

		it('should clear buffer on clearOrchestratorBuffer call', () => {
			gateway.setActiveConversationId('test-conv');
			gateway.clearOrchestratorBuffer();

			// No error should occur
			expect(gateway.getActiveConversationId()).toBe('test-conv');
		});

		it('should not clear buffer when setting same conversation ID', () => {
			gateway.setActiveConversationId('conv-1');
			// Set same ID - should not clear buffer
			gateway.setActiveConversationId('conv-1');

			expect(gateway.getActiveConversationId()).toBe('conv-1');
		});
	});

	describe('processOrchestratorOutputForChat', () => {
		let mockChatGateway: any;

		beforeEach(() => {
			const { getChatGateway } = require('./chat.gateway.js');
			mockChatGateway = {
				processTerminalOutput: jest.fn().mockResolvedValue(undefined),
			};
			getChatGateway.mockReturnValue(mockChatGateway);
		});

		it('should extract conversation ID from [CHAT_RESPONSE:convId] and route to it', () => {
			// Set up orchestrator session streaming
			const onDataCallbacks: ((data: string) => void)[] = [];
			mockSession.onData.mockImplementation((cb: (data: string) => void) => {
				onDataCallbacks.push(cb);
				return jest.fn();
			});

			// Set a fallback active conversation ID
			gateway.setActiveConversationId('fallback-conv');

			// Subscribe to orchestrator session to start streaming
			mockSessionBackend.listSessions.mockReturnValue(['crewly-orc']);
			gateway.subscribeToSession('crewly-orc', mockSocket as Socket);

			// Simulate orchestrator output with embedded conversation ID
			const output = '[CHAT_RESPONSE:conv-123]Hello from conv-123[/CHAT_RESPONSE]';
			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			// Should route to the embedded conversation ID, not the fallback
			expect(mockChatGateway.processTerminalOutput).toHaveBeenCalledWith(
				'crewly-orc',
				expect.stringContaining('Hello from conv-123'),
				'conv-123'
			);
		});

		it('should fall back to activeConversationId for old [CHAT_RESPONSE] format', () => {
			const onDataCallbacks: ((data: string) => void)[] = [];
			mockSession.onData.mockImplementation((cb: (data: string) => void) => {
				onDataCallbacks.push(cb);
				return jest.fn();
			});

			gateway.setActiveConversationId('active-conv');

			mockSessionBackend.listSessions.mockReturnValue(['crewly-orc']);
			gateway.subscribeToSession('crewly-orc', mockSocket as Socket);

			// Simulate old-format orchestrator output without conversation ID
			const output = '[CHAT_RESPONSE]Hello from old format[/CHAT_RESPONSE]';
			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			// Should route to activeConversationId since no embedded ID
			expect(mockChatGateway.processTerminalOutput).toHaveBeenCalledWith(
				'crewly-orc',
				expect.stringContaining('Hello from old format'),
				'active-conv'
			);
		});
	});

	describe('proactive Slack notifications', () => {
		let onDataCallbacks: ((data: string) => void)[];

		beforeEach(() => {
			onDataCallbacks = [];
			mockSession.onData.mockImplementation((cb: (data: string) => void) => {
				onDataCallbacks.push(cb);
				return jest.fn();
			});

			mockSessionBackend.listSessions.mockReturnValue(['crewly-orc']);
			gateway.setActiveConversationId('conv-1');
			gateway.subscribeToSession('crewly-orc', mockSocket as Socket);
			mockBridgeSendNotification.mockClear();
		});

		it('should detect [SLACK_NOTIFY] markers and send notification to bridge', () => {
			const notification = JSON.stringify({
				type: 'task_completed',
				title: 'Task Done',
				message: '*Fix bug* completed by Joe',
				urgency: 'normal',
			});
			const output = `[SLACK_NOTIFY]${notification}[/SLACK_NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockBridgeSendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'task_completed',
					title: 'Task Done',
					message: '*Fix bug* completed by Joe',
					urgency: 'normal',
				})
			);
		});

		it('should apply default urgency and title when not provided', () => {
			const notification = JSON.stringify({
				type: 'alert',
				message: 'Something happened',
			});
			const output = `[SLACK_NOTIFY]${notification}[/SLACK_NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockBridgeSendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'alert',
					title: 'alert',
					message: 'Something happened',
					urgency: 'normal',
				})
			);
		});

		it('should skip invalid JSON in SLACK_NOTIFY markers', () => {
			const output = '[SLACK_NOTIFY]not valid json[/SLACK_NOTIFY]';

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
		});

		it('should skip notifications missing required fields', () => {
			const output = `[SLACK_NOTIFY]${JSON.stringify({ title: 'No type or message' })}[/SLACK_NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
		});

		it('should process multiple SLACK_NOTIFY blocks in same output', () => {
			const n1 = JSON.stringify({ type: 'task_completed', message: 'First' });
			const n2 = JSON.stringify({ type: 'agent_error', message: 'Second', urgency: 'high' });
			const output = `[SLACK_NOTIFY]${n1}[/SLACK_NOTIFY]\n[SLACK_NOTIFY]${n2}[/SLACK_NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockBridgeSendNotification).toHaveBeenCalledTimes(2);
			expect(mockBridgeSendNotification).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'task_completed', message: 'First' })
			);
			expect(mockBridgeSendNotification).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'agent_error', message: 'Second', urgency: 'high' })
			);
		});

		it('should send Slack notifications even without an active conversation ID', () => {
			// Reset — clear the active conversation set in beforeEach
			gateway.setActiveConversationId(null);

			const notification = JSON.stringify({
				type: 'proactive_update',
				title: 'Status Update',
				message: 'Agent completed a background task',
				urgency: 'normal',
			});
			const output = `[SLACK_NOTIFY]${notification}[/SLACK_NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockBridgeSendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'proactive_update',
					title: 'Status Update',
					message: 'Agent completed a background task',
				})
			);
		});

		it('should clean terminal line-wrapping artifacts from JSON before parsing', () => {
			// Simulate PTY wrapping: newlines and padding spaces injected into JSON
			const wrappedJson = '{"type":"task_completed","title":"Task                         \n\n  Assigned","message":"Emily is working on the      \n\n  support task.","urgency":"normal","channelId":"C123"}';
			const output = `[SLACK_NOTIFY]${wrappedJson}[/SLACK_NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockBridgeSendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'task_completed',
					title: 'Task Assigned',
					message: 'Emily is working on the support task.',
					channelId: 'C123',
				})
			);
		});

		it('should skip non-JSON SLACK_NOTIFY content from prompt templates', () => {
			// The orchestrator prompt contains [SLACK_NOTIFY] examples with backtick fences
			const output = '[SLACK_NOTIFY]` or `[CHAT_RESPONSE]` markers for every status update.[/SLACK_NOTIFY]';

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
		});

		it('should strip residual ANSI codes from SLACK_NOTIFY JSON', () => {
			// Sometimes ANSI codes survive the initial stripAnsiCodes pass
			const json = '{"type":"agent_error","title":"Error","message":"*Joe*\x1b[39m encountered a failure","urgency":"high"}';
			const output = `[SLACK_NOTIFY]${json}[/SLACK_NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockBridgeSendNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'agent_error',
					message: '*Joe* encountered a failure',
				})
			);
		});
	});

	describe('unified [NOTIFY] markers', () => {
		let onDataCallbacks: ((data: string) => void)[];
		let mockChatGateway: any;

		beforeEach(() => {
			onDataCallbacks = [];
			mockSession.onData.mockImplementation((cb: (data: string) => void) => {
				onDataCallbacks.push(cb);
				return jest.fn();
			});

			const { getChatGateway } = require('./chat.gateway.js');
			mockChatGateway = {
				processTerminalOutput: jest.fn().mockResolvedValue(undefined),
				processNotifyMessage: jest.fn().mockResolvedValue(undefined),
			};
			getChatGateway.mockReturnValue(mockChatGateway);

			mockSessionBackend.listSessions.mockReturnValue(['crewly-orc']);
			gateway.setActiveConversationId('conv-1');
			gateway.subscribeToSession('crewly-orc', mockSocket as Socket);
			mockBridgeSendNotification.mockClear();
			mockBridgeMarkDeliveredBySkill.mockClear();
		});

		it('should route [NOTIFY] with conversationId to chat (header+body format)', async () => {
			const output = `[NOTIFY]\nconversationId: conv-abc\n---\n## Update\n\nDetails here.\n[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockChatGateway.processNotifyMessage).toHaveBeenCalledWith(
				'crewly-orc',
				'## Update\n\nDetails here.',
				'conv-abc',
				undefined
			);
			// No Slack routing (no channelId)
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
		});

		it('should skip Slack routing when channelId present and mark delivered by skill', async () => {
			// No conversationId, no activeConversationId
			gateway.setActiveConversationId(null);

			const output = `[NOTIFY]\nchannelId: C0123\nthreadTs: 170743.001\ntype: task_completed\n---\nAgent done\n[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			// Slack delivery is now handled by the reply-slack skill, NOT by NOTIFY handler
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
			// Should mark as delivered by skill so the bridge skips its fallback
			expect(mockBridgeMarkDeliveredBySkill).toHaveBeenCalledWith('C0123', '170743.001');
			// No chat routing (no conversationId, no activeConversationId)
			expect(mockChatGateway.processNotifyMessage).not.toHaveBeenCalled();
		});

		it('should route [NOTIFY] to chat and mark Slack as skill-delivered when both fields present', async () => {
			const output = `[NOTIFY]\nconversationId: conv-abc\nchannelId: C0123\nthreadTs: 170743.001\ntype: task_completed\nurgency: normal\n---\n## Task Done\n\nJoe finished.\n[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			// Chat routing (with Slack delivery tracking metadata)
			expect(mockChatGateway.processNotifyMessage).toHaveBeenCalledWith(
				'crewly-orc',
				'## Task Done\n\nJoe finished.',
				'conv-abc',
				expect.objectContaining({
					slackChannelId: 'C0123',
					slackDeliveryStatus: 'pending',
					slackDeliveryAttempts: 0,
					slackThreadTs: '170743.001',
					notifyType: 'task_completed',
					notifyUrgency: 'normal',
				})
			);

			// Slack delivery is now handled by the reply-slack skill
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
			expect(mockBridgeMarkDeliveredBySkill).toHaveBeenCalledWith('C0123', '170743.001');
		});

		it('should NOT route to Slack when type is present but channelId is missing', async () => {
			gateway.setActiveConversationId('conv-123');

			const output = `[NOTIFY]\nconversationId: conv-123\ntype: daily_summary\n---\nDaily progress update\n[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			// Should route to chat (with notifyType metadata)
			expect(mockChatGateway.processNotifyMessage).toHaveBeenCalledWith(
				'crewly-orc',
				'Daily progress update',
				'conv-123',
				expect.objectContaining({ notifyType: 'daily_summary' })
			);
			// Should NOT route to Slack — type alone is not a routing signal
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
		});

		it('should fallback to activeConversationId when no conversationId in payload', async () => {
			gateway.setActiveConversationId('active-conv-fallback');

			const output = `[NOTIFY]\n---\nFallback test\n[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockChatGateway.processNotifyMessage).toHaveBeenCalledWith(
				'crewly-orc',
				'Fallback test',
				'active-conv-fallback',
				undefined
			);
		});

		it('should not fallback to activeConversationId for typed event payloads', async () => {
			gateway.setActiveConversationId('active-conv-fallback');

			const output = `[NOTIFY]\ntype: agent_inactive\n---\nAgent Ella became inactive\n[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockChatGateway.processNotifyMessage).not.toHaveBeenCalled();
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
		});

		it('should skip legacy JSON NOTIFY payloads missing required message field', () => {
			const output = `[NOTIFY]${JSON.stringify({ type: 'alert', conversationId: 'conv-1' })}[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockChatGateway.processNotifyMessage).not.toHaveBeenCalled();
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
		});

		it('should skip empty NOTIFY blocks', () => {
			const output = '[NOTIFY]   [/NOTIFY]';

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockChatGateway.processNotifyMessage).not.toHaveBeenCalled();
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
		});

		it('should skip NOTIFY with headers but empty body', () => {
			const output = '[NOTIFY]\nconversationId: conv-1\n---\n[/NOTIFY]';

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}

			expect(mockChatGateway.processNotifyMessage).not.toHaveBeenCalled();
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
		});

		it('should handle legacy JSON NOTIFY and mark Slack as skill-delivered (transition period)', async () => {
			const payload = JSON.stringify({
				message: '## Task Done\n\nJoe finished.',
				conversationId: 'conv-abc',
				channelId: 'C123',
				type: 'task_completed',
			});
			const output = `[NOTIFY]${payload}[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockChatGateway.processNotifyMessage).toHaveBeenCalledWith(
				'crewly-orc',
				'## Task Done\n\nJoe finished.',
				'conv-abc',
				expect.objectContaining({
					slackChannelId: 'C123',
					slackDeliveryStatus: 'pending',
					slackDeliveryAttempts: 0,
					notifyType: 'task_completed',
				})
			);
			// Slack delivery is now handled by the reply-slack skill
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
			expect(mockBridgeMarkDeliveredBySkill).toHaveBeenCalledWith('C123', undefined);
		});

		it('should clean terminal line-wrapping artifacts from legacy JSON NOTIFY', async () => {
			const wrappedJson = '{"message":"## Task Done\\n\\nJoe                         \n\n  finished the work.","conversationId":"conv-abc","type":"task_completed","channelId":"C123"}';
			const output = `[NOTIFY]${wrappedJson}[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockChatGateway.processNotifyMessage).toHaveBeenCalled();
			// Slack delivery is now handled by the reply-slack skill
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
			expect(mockBridgeMarkDeliveredBySkill).toHaveBeenCalled();
		});

		it('should process multiple NOTIFY blocks and route chat-only or mark skill-delivered accordingly', async () => {
			gateway.setActiveConversationId(null);

			const n1 = `[NOTIFY]\nconversationId: conv-1\n---\nFirst update\n[/NOTIFY]`;
			const n2 = `[NOTIFY]\nchannelId: C123\ntype: alert\n---\nSecond update\n[/NOTIFY]`;
			const output = `${n1}\n${n2}`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			// First block routes to chat (has conversationId)
			expect(mockChatGateway.processNotifyMessage).toHaveBeenCalledTimes(1);
			// Second block has channelId but no Slack send — skill handles it
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
			expect(mockBridgeMarkDeliveredBySkill).toHaveBeenCalledTimes(1);
			expect(mockBridgeMarkDeliveredBySkill).toHaveBeenCalledWith('C123', undefined);
		});

		it('should deduplicate identical NOTIFY messages', async () => {
			const output = `[NOTIFY]\nconversationId: conv-1\n---\nDuplicate test\n[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			// Should only be called once (second is a duplicate)
			expect(mockChatGateway.processNotifyMessage).toHaveBeenCalledTimes(1);
		});

		it('should route header+body NOTIFY with all headers to chat and mark Slack as skill-delivered', async () => {
			const output = `[NOTIFY]\nconversationId: conv-1\nchannelId: C456\nthreadTs: 12345.001\ntype: project_update\ntitle: Update\nurgency: high\n---\n## Progress\n\nAll done.\n[/NOTIFY]`;

			if (onDataCallbacks.length > 0) {
				onDataCallbacks[0](output);
			}
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockChatGateway.processNotifyMessage).toHaveBeenCalledWith(
				'crewly-orc',
				'## Progress\n\nAll done.',
				'conv-1',
				expect.objectContaining({
					slackChannelId: 'C456',
					slackDeliveryStatus: 'pending',
					slackDeliveryAttempts: 0,
					slackThreadTs: '12345.001',
					notifyType: 'project_update',
					notifyTitle: 'Update',
					notifyUrgency: 'high',
				})
			);
			// Slack delivery is now handled by the reply-slack skill
			expect(mockBridgeSendNotification).not.toHaveBeenCalled();
			expect(mockBridgeMarkDeliveredBySkill).toHaveBeenCalledWith('C456', '12345.001');
		});
	});
});
