/**
 * Tests for AgentRegistrationService
 * Tests the multi-step agent initialization and registration process
 */

import { AgentRegistrationService } from './agent-registration.service.js';
import { StorageService } from '../core/storage.service.js';
import { LoggerService } from '../core/logger.service.js';
import * as sessionModule from '../session/index.js';
import { getSessionStatePersistence } from '../session/index.js';
import { RuntimeServiceFactory } from './runtime-service.factory.js';
import { AGENTMUX_CONSTANTS, RUNTIME_TYPES } from '../../constants.js';

// Mock dependencies
jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: jest.fn().mockReturnValue({
			createComponentLogger: jest.fn().mockReturnValue({
				info: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			}),
		}),
	},
}));

jest.mock('fs/promises', () => ({
	readFile: jest.fn(),
	mkdir: jest.fn().mockResolvedValue(undefined),
	writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('os', () => ({
	homedir: jest.fn().mockReturnValue('/home/test'),
}));

// Mock session module
jest.mock('../session/index.js', () => ({
	getSessionBackendSync: jest.fn(),
	createSessionBackend: jest.fn(),
	createSessionCommandHelper: jest.fn(),
	getSessionStatePersistence: jest.fn(),
}));

// Mock RuntimeServiceFactory
jest.mock('./runtime-service.factory.js', () => ({
	RuntimeServiceFactory: {
		create: jest.fn(),
	},
}));

describe('AgentRegistrationService', () => {
	let service: AgentRegistrationService;
	let mockStorageService: jest.Mocked<StorageService>;
	let mockReadFile: jest.Mock;
	let mockSessionHelper: any;
	let mockRuntimeService: any;

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock session for event-driven delivery
		// The onData callback simulates terminal output stream
		let onDataCallback: ((data: string) => void) | null = null;
		const mockSession = {
			name: 'test-session',
			pid: 1234,
			cwd: '/test',
			onData: jest.fn().mockImplementation((callback: (data: string) => void) => {
				onDataCallback = callback;
				// Simulate prompt appearing after brief delay
				setTimeout(() => {
					if (onDataCallback) {
						onDataCallback('❯ '); // Claude at prompt
					}
				}, 50);
				// Simulate processing indicator after message sent
				setTimeout(() => {
					if (onDataCallback) {
						onDataCallback('⠋ Thinking...'); // Processing started
					}
				}, 100);
				return jest.fn(); // unsubscribe function
			}),
			onExit: jest.fn().mockReturnValue(jest.fn()),
			write: jest.fn(),
			resize: jest.fn(),
			kill: jest.fn(),
		};

		// Mock SessionCommandHelper
		mockSessionHelper = {
			sessionExists: jest.fn().mockReturnValue(false),
			killSession: jest.fn().mockResolvedValue(undefined),
			createSession: jest.fn().mockResolvedValue({ pid: 1234, cwd: '/test', name: 'test-session' }),
			sendCtrlC: jest.fn().mockResolvedValue(undefined),
			clearCurrentCommandLine: jest.fn().mockResolvedValue(undefined),
			sendMessage: jest.fn().mockResolvedValue(undefined),
			sendKey: jest.fn().mockResolvedValue(undefined),
			sendEscape: jest.fn().mockResolvedValue(undefined),
			sendEnter: jest.fn().mockResolvedValue(undefined),
			capturePane: jest.fn().mockReturnValue('❯ '), // Claude at prompt by default
			setEnvironmentVariable: jest.fn().mockResolvedValue(undefined),
			getSession: jest.fn().mockReturnValue(mockSession), // For event-driven delivery
		};

		// Mock RuntimeService
		mockRuntimeService = {
			clearDetectionCache: jest.fn(),
			detectRuntimeWithCommand: jest.fn().mockResolvedValue(true),
			executeRuntimeInitScript: jest.fn().mockResolvedValue(undefined),
			waitForRuntimeReady: jest.fn().mockResolvedValue(true),
		};

		// Setup session module mocks
		(sessionModule.getSessionBackendSync as jest.Mock).mockReturnValue({});
		(sessionModule.createSessionBackend as jest.Mock).mockResolvedValue({});
		(sessionModule.createSessionCommandHelper as jest.Mock).mockReturnValue(mockSessionHelper);

		// Setup RuntimeServiceFactory mock
		(RuntimeServiceFactory.create as jest.Mock).mockReturnValue(mockRuntimeService);

		// Mock StorageService
		mockStorageService = {
			updateAgentStatus: jest.fn().mockResolvedValue(undefined),
			updateOrchestratorStatus: jest.fn().mockResolvedValue(undefined),
			getOrchestratorStatus: jest.fn().mockResolvedValue({ agentStatus: 'active' }),
			getTeams: jest.fn().mockResolvedValue([]),
		} as any;

		mockReadFile = require('fs/promises').readFile;
		mockReadFile.mockResolvedValue('{"roles": [{"key": "orchestrator", "promptFile": "orchestrator-prompt.md"}]}');

		// Mock SessionStatePersistence
		(sessionModule.getSessionStatePersistence as jest.Mock).mockReturnValue({
			registerSession: jest.fn(),
			unregisterSession: jest.fn(),
			isSessionRegistered: jest.fn().mockReturnValue(false),
			isRestoredSession: jest.fn().mockReturnValue(false),
			getSessionId: jest.fn().mockReturnValue(undefined),
			updateSessionId: jest.fn(),
		});

		service = new AgentRegistrationService(null, '/test/project', mockStorageService);
	});

	describe('initializeAgentWithRegistration', () => {
		it('should succeed when runtime is ready after cleanup and reinit', async () => {
			// Mock runtime ready after reinit
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('Register with {{SESSION_ID}}');

			const result = await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Agent registered successfully after cleanup and reinit');
			expect(mockRuntimeService.clearDetectionCache).toHaveBeenCalledWith('test-session');
		});

		it('should attempt full recreation if cleanup and reinit fails', async () => {
			// Mock Step 1 failure (reinit doesn't work)
			mockRuntimeService.waitForRuntimeReady
				.mockResolvedValueOnce(false) // Step 1 fails
				.mockResolvedValueOnce(true);  // Step 2 succeeds

			mockReadFile.mockResolvedValue('Register with {{SESSION_ID}}');

			const result = await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Agent registered successfully after full recreation');
			expect(mockSessionHelper.killSession).toHaveBeenCalledWith('test-session');
		});

		it('should fail after all escalation attempts', async () => {
			// Mock all steps failing
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(false);

			const result = await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Failed to initialize agent after optimized escalation attempts');
		});

		it('should update agent status to started when runtime is ready', async () => {
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('Register with {{SESSION_ID}}');

			await service.initializeAgentWithRegistration(
				'test-session',
				'developer',
				'/test/path',
				90000
			);

			expect(mockStorageService.updateAgentStatus).toHaveBeenCalledWith(
				'test-session',
				AGENTMUX_CONSTANTS.AGENT_STATUSES.STARTED
			);
		});
	});

	describe('sendRegistrationPromptAsync', () => {
		it('should send registration prompt without blocking', async () => {
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('Register {{SESSION_ID}} as {{ROLE}}');

			await service.initializeAgentWithRegistration(
				'test-session',
				'developer',
				'/test/path',
				90000
			);

			// Give time for async operation to complete (file write + delays in sendPromptRobustly)
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Should have called sendMessage with the instruction to read the prompt file
			expect(mockSessionHelper.sendMessage).toHaveBeenCalled();
		});
	});

	describe('createAgentSession', () => {
		it('should create a new session when one does not exist', async () => {
			// Ensure session does not exist initially
			mockSessionHelper.sessionExists
				.mockReturnValueOnce(false)  // Initial check
				.mockReturnValueOnce(true);  // After creation check
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);

			// Mock the roles config properly
			mockReadFile
				.mockResolvedValueOnce('{"roles": [{"key": "developer", "promptFile": "dev-prompt.md"}]}')
				.mockResolvedValueOnce('Register {{SESSION_ID}}');

			const result = await service.createAgentSession({
				sessionName: 'test-session',
				role: 'developer',
				projectPath: '/test/project',
			});

			expect(result.success).toBe(true);
			expect(mockSessionHelper.createSession).toHaveBeenCalledWith('test-session', '/test/project');
		});

		it('should set environment variables after creating session', async () => {
			mockSessionHelper.sessionExists
				.mockReturnValueOnce(false)  // Initial check
				.mockReturnValueOnce(true);  // After creation check
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);
			mockReadFile
				.mockResolvedValueOnce('{"roles": [{"key": "developer", "promptFile": "dev-prompt.md"}]}')
				.mockResolvedValueOnce('Register {{SESSION_ID}}');

			const result = await service.createAgentSession({
				sessionName: 'test-session',
				role: 'developer',
			});

			// Session should be created successfully
			expect(result.success).toBe(true);

			// Environment variables should be set
			expect(mockSessionHelper.setEnvironmentVariable).toHaveBeenCalledWith(
				'test-session',
				'TMUX_SESSION_NAME',
				'test-session'
			);
			expect(mockSessionHelper.setEnvironmentVariable).toHaveBeenCalledWith(
				'test-session',
				'AGENTMUX_ROLE',
				'developer'
			);
		});

		it('should attempt recovery when session already exists', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			mockRuntimeService.detectRuntimeWithCommand.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('{"roles": [{"key": "developer", "promptFile": "dev-prompt.md"}]}');
			// Mock capturePane to show processing indicators so sendPromptRobustly succeeds
			mockSessionHelper.capturePane.mockReturnValue('⠋ Thinking... registering agent');

			// Mock successful registration check
			mockStorageService.getTeams.mockResolvedValue([{
				id: 'team-1',
				members: [{
					sessionName: 'test-session',
					role: 'developer',
					agentStatus: 'active',
				}],
			}] as any);

			const result = await service.createAgentSession({
				sessionName: 'test-session',
				role: 'developer',
			});

			expect(result.success).toBe(true);
			expect(result.message).toContain('recovered');
		});

		it('should fall back to session recreation when recovery fails', async () => {
			mockSessionHelper.sessionExists
				.mockReturnValueOnce(true)  // Initial check
				.mockReturnValueOnce(true); // After kill, check again returns false

			mockRuntimeService.detectRuntimeWithCommand.mockResolvedValue(false);
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('{"roles": [{"key": "developer", "promptFile": "dev-prompt.md"}]}');

			const result = await service.createAgentSession({
				sessionName: 'test-session',
				role: 'developer',
			});

			expect(mockSessionHelper.killSession).toHaveBeenCalled();
			expect(result.success).toBe(true);
		});
	});

	describe('terminateAgentSession', () => {
		it('should kill existing session and update status', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			const result = await service.terminateAgentSession('test-session', 'developer');

			expect(result.success).toBe(true);
			expect(mockSessionHelper.killSession).toHaveBeenCalledWith('test-session');
			expect(mockStorageService.updateAgentStatus).toHaveBeenCalledWith(
				'test-session',
				AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE
			);
		});

		it('should update status even if session does not exist', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(false);

			const result = await service.terminateAgentSession('test-session', 'developer');

			expect(result.success).toBe(true);
			expect(result.message).toContain('already terminated');
			expect(mockStorageService.updateAgentStatus).toHaveBeenCalledWith(
				'test-session',
				AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE
			);
		});

		it('should unregister session from persistence on termination', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			const result = await service.terminateAgentSession('test-session', 'developer');

			expect(result.success).toBe(true);
			const mockPersistence = (sessionModule.getSessionStatePersistence as jest.Mock).mock.results[0]?.value;
			expect(mockPersistence.unregisterSession).toHaveBeenCalledWith('test-session');
		});
	});

	describe('sendMessageToAgent', () => {
		// Helper to create a mock session with configurable onData behavior
		// Timings account for: prompt detection -> message sent -> Enter sent (500ms) -> processing
		const createMockSession = (outputSequence: Array<{ output: string; delayMs: number }>) => {
			return {
				name: 'test-session',
				pid: 1234,
				cwd: '/test',
				onData: jest.fn().mockImplementation((callback: (data: string) => void) => {
					// Emit outputs from sequence at specified delays
					outputSequence.forEach(({ output, delayMs }) => {
						setTimeout(() => callback(output), delayMs);
					});
					return jest.fn(); // unsubscribe function
				}),
				onExit: jest.fn().mockReturnValue(jest.fn()),
				write: jest.fn(),
				resize: jest.fn(),
				kill: jest.fn(),
			};
		};

		it('should send message and verify processing started (prompt gone)', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			// capturePane shows clean prompt (isClaudeAtPrompt passes)
			// then message not stuck (isMessageStuckAtPrompt returns false)
			mockSessionHelper.capturePane.mockReturnValue('❯ \n');

			const result = await service.sendMessageToAgent('test-session', 'Hello, agent!');

			expect(result.success).toBe(true);
			expect(mockSessionHelper.sendMessage).toHaveBeenCalledWith('test-session', 'Hello, agent!');
		});

		it('should detect processing indicators as success', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			// Configure session to emit spinner character after Enter
			const mockSession = createMockSession([
				{ output: '❯ ', delayMs: 50 },
				{ output: '⠋ thinking...', delayMs: 700 }, // After Enter (500ms)
			]);
			mockSessionHelper.getSession.mockReturnValue(mockSession);

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			expect(result.success).toBe(true);
		});

		it('should fail gracefully when agent is not at prompt', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			// capturePane shows non-prompt content (agent is busy/modal)
			mockSessionHelper.capturePane.mockReturnValue('Some modal text...');

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			// Should fail — message never sent since agent was never at prompt
			expect(result.success).toBe(false);
			expect(mockSessionHelper.sendMessage).not.toHaveBeenCalled();
		});

		it('should fail if session does not exist', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(false);

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			expect(result.success).toBe(false);
			expect(result.error).toContain('does not exist');
		});

		it('should fail if message is empty', async () => {
			const result = await service.sendMessageToAgent('test-session', '');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Message is required');
		});

		it('should fail after max retries when event-driven delivery times out', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			// Configure session that never shows any recognizable pattern
			const mockSession = {
				name: 'test-session',
				pid: 1234,
				cwd: '/test',
				onData: jest.fn().mockImplementation(() => {
					// Don't emit anything - will cause timeout
					return jest.fn();
				}),
				onExit: jest.fn().mockReturnValue(jest.fn()),
				write: jest.fn(),
				resize: jest.fn(),
				kill: jest.fn(),
			};
			mockSessionHelper.getSession.mockReturnValue(mockSession);
			// IMPORTANT: Return non-prompt output so immediate check fails
			// This tests the scenario where Claude is not at prompt
			mockSessionHelper.capturePane.mockReturnValue('Loading...\nPlease wait');

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Failed to deliver message');
		}, 40000);  // Increase timeout for event-driven retry test
	});

	describe('sendKeyToAgent', () => {
		it('should send key to existing session', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			const result = await service.sendKeyToAgent('test-session', 'Enter');

			expect(result.success).toBe(true);
			expect(mockSessionHelper.sendKey).toHaveBeenCalledWith('test-session', 'Enter');
		});

		it('should fail if session does not exist', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(false);

			const result = await service.sendKeyToAgent('test-session', 'Enter');

			expect(result.success).toBe(false);
			expect(result.error).toContain('does not exist');
		});
	});

	describe('checkAgentHealth', () => {
		it('should return active status when session exists', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			const result = await service.checkAgentHealth('test-session', 'developer');

			expect(result.success).toBe(true);
			expect(result.data?.agent.running).toBe(true);
			expect(result.data?.agent.status).toBe(AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE);
		});

		it('should return inactive status when session does not exist', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(false);

			const result = await service.checkAgentHealth('test-session', 'developer');

			expect(result.success).toBe(true);
			expect(result.data?.agent.running).toBe(false);
			expect(result.data?.agent.status).toBe(AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE);
		});

		it('should include timestamp in response', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			const result = await service.checkAgentHealth('test-session');

			expect(result.data?.timestamp).toBeDefined();
			expect(new Date(result.data!.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
		});
	});

	describe('loadRegistrationPrompt (private method)', () => {
		it('should load prompt from file and replace placeholders', async () => {
			const promptTemplate = 'Register as {{ROLE}} with session {{SESSION_ID}} and member {{MEMBER_ID}}';
			mockReadFile.mockResolvedValue(promptTemplate);

			// Access private method via reflection
			const loadRegistrationPrompt = (service as any).loadRegistrationPrompt.bind(service);
			const result = await loadRegistrationPrompt('dev', 'test-session', 'member-123');

			expect(result).toContain('test-session');
			expect(result).toContain('member-123');
		});

		it('should remove member ID parameter when not provided', async () => {
			const promptTemplate = 'Register {"sessionName": "{{SESSION_ID}}", "memberId": "{{MEMBER_ID}}"}';
			mockReadFile.mockResolvedValue(promptTemplate);

			const loadRegistrationPrompt = (service as any).loadRegistrationPrompt.bind(service);
			const result = await loadRegistrationPrompt('orchestrator', 'test-session');

			expect(result).toContain('test-session');
			expect(result).not.toContain('{{MEMBER_ID}}');
		});

		it('should use fallback prompt when file not found', async () => {
			mockReadFile.mockRejectedValue(new Error('File not found'));

			const loadRegistrationPrompt = (service as any).loadRegistrationPrompt.bind(service);
			const result = await loadRegistrationPrompt('dev', 'test-session');

			expect(result).toContain('register_agent_status');
			expect(result).toContain('"role": "dev"');
			expect(result).toContain('"sessionName": "test-session"');
		});
	});

	describe('checkAgentRegistration (private method)', () => {
		it('should return true for active orchestrator', async () => {
			mockStorageService.getOrchestratorStatus.mockResolvedValue({
				agentStatus: AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE,
			} as any);

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'orchestrator');

			expect(result).toBe(true);
		});

		it('should return false for inactive orchestrator', async () => {
			mockStorageService.getOrchestratorStatus.mockResolvedValue({
				agentStatus: AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE,
			} as any);

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'orchestrator');

			expect(result).toBe(false);
		});

		it('should check team member registration in teams.json', async () => {
			mockStorageService.getTeams.mockResolvedValue([{
				id: 'team-1',
				members: [{
					sessionName: 'test-session',
					role: 'developer',
					agentStatus: AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE,
				}],
			}] as any);

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'developer');

			expect(result).toBe(true);
		});

		it('should return false when team member not found', async () => {
			mockStorageService.getTeams.mockResolvedValue([{
				id: 'team-1',
				members: [],
			}] as any);

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'developer');

			expect(result).toBe(false);
		});
	});

	describe('session state persistence registration', () => {
		it('should register session for persistence after creating a new session', async () => {
			// Ensure session does not exist initially
			mockSessionHelper.sessionExists
				.mockReturnValueOnce(false)  // Initial check
				.mockReturnValueOnce(true);  // After creation check
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);

			mockReadFile
				.mockResolvedValueOnce('{"roles": [{"key": "developer", "promptFile": "dev-prompt.md"}]}')
				.mockResolvedValueOnce('Register {{SESSION_ID}}');

			await service.createAgentSession({
				sessionName: 'test-session',
				role: 'developer',
				projectPath: '/test/project',
				teamId: 'team-123',
			});

			const mockPersistence = (sessionModule.getSessionStatePersistence as jest.Mock).mock.results[0]?.value;
			expect(mockPersistence.registerSession).toHaveBeenCalledWith(
				'test-session',
				expect.objectContaining({
					cwd: '/test/project',
					args: [],
				}),
				'claude-code',
				'developer',
				'team-123'
			);
		});

		it('should register recovered session for persistence', async () => {
			// Session already exists and runtime is running
			mockSessionHelper.sessionExists.mockReturnValue(true);
			mockRuntimeService.detectRuntimeWithCommand.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('Register {{SESSION_ID}}');
			// Mock capturePane to show processing indicators so sendPromptRobustly succeeds
			mockSessionHelper.capturePane.mockReturnValue('⠋ Thinking... registering agent');

			// Mock successful registration check
			mockStorageService.getTeams.mockResolvedValue([{
				id: 'team-1',
				members: [{
					sessionName: 'test-session',
					role: 'developer',
					agentStatus: 'active',
				}],
			}] as any);

			await service.createAgentSession({
				sessionName: 'test-session',
				role: 'developer',
				projectPath: '/test/project',
				teamId: 'team-456',
			});

			const mockPersistence = (sessionModule.getSessionStatePersistence as jest.Mock).mock.results[0]?.value;
			expect(mockPersistence.registerSession).toHaveBeenCalledWith(
				'test-session',
				expect.objectContaining({
					cwd: '/test/project',
				}),
				expect.any(String),
				'developer',
				'team-456'
			);
		});

		it('should not fail session creation if persistence registration fails', async () => {
			mockSessionHelper.sessionExists
				.mockReturnValueOnce(false)
				.mockReturnValueOnce(true);
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('Register {{SESSION_ID}}');

			// Make persistence throw
			(sessionModule.getSessionStatePersistence as jest.Mock).mockImplementation(() => {
				throw new Error('Persistence unavailable');
			});

			const result = await service.createAgentSession({
				sessionName: 'test-session',
				role: 'developer',
			});

			// Session creation should still succeed
			expect(result.success).toBe(true);
		});
	});

	describe('resumeClaudeCodeSession via /resume command', () => {
		it('should send /resume and Enter for restored Claude Code sessions', async () => {
			// Mark session as restored by updating the mock persistence to return true for isRestoredSession
			(sessionModule.getSessionStatePersistence as jest.Mock).mockReturnValue({
				registerSession: jest.fn(),
				unregisterSession: jest.fn(),
				isSessionRegistered: jest.fn().mockReturnValue(false),
				isRestoredSession: jest.fn().mockReturnValue(true),
				getSessionId: jest.fn().mockReturnValue(undefined),
				updateSessionId: jest.fn(),
			});

			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('Register with {{SESSION_ID}}');

			await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000,
				undefined, // memberId
				RUNTIME_TYPES.CLAUDE_CODE
			);

			// Should have sent /resume command and Enter key
			expect(mockSessionHelper.sendMessage).toHaveBeenCalledWith('test-session', '/resume');
			expect(mockSessionHelper.sendKey).toHaveBeenCalledWith('test-session', 'Enter');
		});

		it('should not send /resume for non-restored sessions', async () => {
			// Session is NOT restored (default mock)
			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('Register with {{SESSION_ID}}');

			await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000,
				undefined, // memberId
				RUNTIME_TYPES.CLAUDE_CODE
			);

			// sendMessage should only be called for registration prompt, not /resume
			const sendMessageCalls = mockSessionHelper.sendMessage.mock.calls;
			const resumeCalls = sendMessageCalls.filter((call: any[]) => call[1] === '/resume');
			expect(resumeCalls).toHaveLength(0);
		});

		it('should not send /resume for non-Claude runtimes', async () => {
			(sessionModule.getSessionStatePersistence as jest.Mock).mockReturnValue({
				registerSession: jest.fn(),
				unregisterSession: jest.fn(),
				isSessionRegistered: jest.fn().mockReturnValue(false),
				isRestoredSession: jest.fn().mockReturnValue(true),
				getSessionId: jest.fn().mockReturnValue(undefined),
				updateSessionId: jest.fn(),
			});

			mockRuntimeService.waitForRuntimeReady.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('Register with {{SESSION_ID}}');

			await service.initializeAgentWithRegistration(
				'test-session',
				'developer',
				'/test/path',
				90000,
				undefined, // memberId
				RUNTIME_TYPES.GEMINI_CLI
			);

			// sendMessage should NOT include /resume for Gemini
			const sendMessageCalls = mockSessionHelper.sendMessage.mock.calls;
			const resumeCalls = sendMessageCalls.filter((call: any[]) => call[1] === '/resume');
			expect(resumeCalls).toHaveLength(0);
		});

		it('should continue gracefully if resume fails', async () => {
			(sessionModule.getSessionStatePersistence as jest.Mock).mockReturnValue({
				registerSession: jest.fn(),
				unregisterSession: jest.fn(),
				isSessionRegistered: jest.fn().mockReturnValue(false),
				isRestoredSession: jest.fn().mockReturnValue(true),
				getSessionId: jest.fn().mockReturnValue(undefined),
				updateSessionId: jest.fn(),
			});

			// First waitForRuntimeReady call succeeds (init), second fails (resume ready check)
			mockRuntimeService.waitForRuntimeReady
				.mockResolvedValueOnce(true)  // tryCleanupAndReinit ready check
				.mockResolvedValueOnce(false); // resume ready check fails
			mockReadFile.mockResolvedValue('Register with {{SESSION_ID}}');

			const result = await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000,
				undefined, // memberId
				RUNTIME_TYPES.CLAUDE_CODE
			);

			// Should still succeed overall — resume failure is non-fatal
			expect(result.success).toBe(true);
		});
	});

		describe('waitForRegistration (private method)', () => {
		it('should return true when registration is confirmed', async () => {
			mockStorageService.getOrchestratorStatus.mockResolvedValue({
				agentStatus: AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE,
			} as any);

			const waitForRegistration = (service as any).waitForRegistration.bind(service);
			const result = await waitForRegistration('test-session', 'orchestrator', 10000);

			expect(result).toBe(true);
		});

		it('should timeout if registration is not confirmed', async () => {
			mockStorageService.getOrchestratorStatus.mockResolvedValue({
				agentStatus: AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE,
			} as any);

			const waitForRegistration = (service as any).waitForRegistration.bind(service);
			const startTime = Date.now();
			const result = await waitForRegistration('test-session', 'orchestrator', 1000);
			const elapsed = Date.now() - startTime;

			expect(result).toBe(false);
			expect(elapsed).toBeGreaterThanOrEqual(900);
		});
	});

	describe('isMessageStuckAtPrompt (private method)', () => {
		it('should detect CHAT prefix message stuck at prompt', async () => {
			// capturePane shows the message text still on the last line
			mockSessionHelper.capturePane.mockReturnValue(
				'Some output\n❯ [CHAT:abc-123] Hello orchestrator\n'
			);

			const isStuck = (service as any).isMessageStuckAtPrompt.bind(service);
			const result = await isStuck('test-session', '[CHAT:abc-123] Hello orchestrator');

			expect(result).toBe(true);
		});

		it('should return false for clean prompt (no message text)', async () => {
			mockSessionHelper.capturePane.mockReturnValue(
				'Previous output\n❯ \n'
			);

			const isStuck = (service as any).isMessageStuckAtPrompt.bind(service);
			const result = await isStuck('test-session', '[CHAT:abc-123] Hello orchestrator');

			expect(result).toBe(false);
		});

		it('should detect plain message without CHAT prefix', async () => {
			mockSessionHelper.capturePane.mockReturnValue(
				'❯ Register as developer with session test\n'
			);

			const isStuck = (service as any).isMessageStuckAtPrompt.bind(service);
			const result = await isStuck('test-session', 'Register as developer with session test');

			expect(result).toBe(true);
		});

		it('should return false when capturePane returns empty output', async () => {
			mockSessionHelper.capturePane.mockReturnValue('');

			const isStuck = (service as any).isMessageStuckAtPrompt.bind(service);
			const result = await isStuck('test-session', 'Hello');

			expect(result).toBe(false);
		});
	});

	describe('stuck Enter detection in message delivery', () => {
		// Helper to create a mock session with configurable onData behavior
		const createMockSession = (outputSequence: Array<{ output: string; delayMs: number }>) => {
			return {
				name: 'test-session',
				pid: 1234,
				cwd: '/test',
				onData: jest.fn().mockImplementation((callback: (data: string) => void) => {
					outputSequence.forEach(({ output, delayMs }) => {
						setTimeout(() => callback(output), delayMs);
					});
					return jest.fn();
				}),
				onExit: jest.fn().mockReturnValue(jest.fn()),
				write: jest.fn(),
				resize: jest.fn(),
				kill: jest.fn(),
			};
		};

		it('should detect stuck message and return false on timeout', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			// First capturePane call: clean prompt (isClaudeAtPrompt passes)
			// Second capturePane call: message stuck at prompt (isMessageStuckAtPrompt detects stuck)
			// Repeat for each retry attempt
			let capturePaneCount = 0;
			mockSessionHelper.capturePane.mockImplementation(() => {
				capturePaneCount++;
				// Odd calls = isClaudeAtPrompt check (clean prompt)
				// Even calls = isMessageStuckAtPrompt check (stuck message)
				if (capturePaneCount % 2 === 1) {
					return '❯ \n';
				}
				return '❯ [CHAT:abc] Hello orchestrator';
			});

			const result = await service.sendMessageToAgent(
				'test-session',
				'[CHAT:abc] Hello orchestrator'
			);

			expect(result.success).toBe(false);
			expect(mockSessionHelper.clearCurrentCommandLine).toHaveBeenCalled();
		});

		it('should succeed when Enter accepted after retry', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			// Session emits prompt, then processing indicator after 2nd Enter attempt
			const mockSession = createMockSession([
				{ output: '❯ ', delayMs: 50 },
				{ output: '⠋ Thinking...', delayMs: 1800 }, // After 2nd Enter attempt
			]);
			mockSessionHelper.getSession.mockReturnValue(mockSession);

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			expect(result.success).toBe(true);
		}, 15000);

		it('should accept when text disappears on timeout (no false negative)', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			// Session emits prompt, Enter sent, but no processing indicators detected
			const mockSession = createMockSession([
				{ output: '❯ ', delayMs: 50 },
			]);
			mockSessionHelper.getSession.mockReturnValue(mockSession);

			// capturePane shows clean prompt (message was accepted, text is gone)
			mockSessionHelper.capturePane.mockReturnValue('❯ \n');

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			// Should succeed because the message text is not stuck at the prompt
			expect(result.success).toBe(true);
		}, 40000);

		it('should clear leftover input on retry when at prompt', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			// Track capturePane calls:
			// Attempt 1: isClaudeAtPrompt → clean prompt, isMessageStuckAtPrompt → stuck
			// Attempt 2: isClaudeAtPrompt → clean prompt, isMessageStuckAtPrompt → clean (success)
			let capturePaneCount = 0;
			mockSessionHelper.capturePane.mockImplementation(() => {
				capturePaneCount++;
				// Call 1 (attempt 1, isClaudeAtPrompt): clean prompt
				if (capturePaneCount === 1) return '❯ \n';
				// Call 2 (attempt 1, isMessageStuckAtPrompt): stuck message
				if (capturePaneCount === 2) return '❯ Hello stuck message';
				// Call 3 (attempt 2, isClaudeAtPrompt): clean prompt
				if (capturePaneCount === 3) return '❯ \n';
				// Call 4+ (attempt 2, isMessageStuckAtPrompt): clean prompt (message gone)
				return '❯ \n';
			});

			const result = await service.sendMessageToAgent('test-session', 'Hello stuck message');

			// clearCurrentCommandLine should have been called during retry after stuck detection
			expect(mockSessionHelper.clearCurrentCommandLine).toHaveBeenCalled();
			// Second attempt succeeds
			expect(result.success).toBe(true);
		});

		it('should run retry cleanup on every failed attempt, not just first', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);

			// All attempts: at prompt but message always stuck after send
			// isClaudeAtPrompt (odd calls) → clean prompt
			// isMessageStuckAtPrompt (even calls) → stuck message
			let capturePaneCount = 0;
			mockSessionHelper.capturePane.mockImplementation(() => {
				capturePaneCount++;
				if (capturePaneCount % 2 === 1) {
					return '❯ \n';
				}
				return '❯ Hello stuck';
			});

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			expect(result.success).toBe(false);
			// clearCurrentCommandLine should be called on every failed attempt
			// With 3 attempts all stuck, expect 3 cleanup calls
			expect(mockSessionHelper.clearCurrentCommandLine.mock.calls.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('resolveRuntimeFlags (private method)', () => {
		it('should return flags from role skills', async () => {
			// Mock role.json with assignedSkills
			mockReadFile.mockImplementation((filePath: string) => {
				if (filePath.includes('role.json')) {
					return Promise.resolve(JSON.stringify({
						assignedSkills: ['chrome-browser'],
					}));
				}
				if (filePath.includes('skill.json')) {
					return Promise.resolve(JSON.stringify({
						runtime: { runtime: 'claude-code', flags: ['--chrome'] },
					}));
				}
				return Promise.resolve('{}');
			});

			const resolveRuntimeFlags = (service as any).resolveRuntimeFlags.bind(service);
			const flags = await resolveRuntimeFlags('generalist', 'claude-code');

			expect(flags).toEqual(['--chrome']);
		});

		it('should apply skill overrides and exclusions', async () => {
			mockReadFile.mockImplementation((filePath: string) => {
				if (filePath.includes('role.json')) {
					return Promise.resolve(JSON.stringify({
						assignedSkills: ['skill-alpha', 'skill-beta'],
					}));
				}
				if (filePath.endsWith('skill-alpha/skill.json')) {
					return Promise.resolve(JSON.stringify({
						runtime: { runtime: 'claude-code', flags: ['--alpha'] },
					}));
				}
				if (filePath.endsWith('skill-beta/skill.json')) {
					return Promise.resolve(JSON.stringify({
						runtime: { runtime: 'claude-code', flags: ['--beta'] },
					}));
				}
				if (filePath.endsWith('skill-gamma/skill.json')) {
					return Promise.resolve(JSON.stringify({
						runtime: { runtime: 'claude-code', flags: ['--gamma'] },
					}));
				}
				return Promise.resolve('{}');
			});

			const resolveRuntimeFlags = (service as any).resolveRuntimeFlags.bind(service);
			// Exclude skill-alpha, add skill-gamma
			const flags = await resolveRuntimeFlags(
				'generalist', 'claude-code',
				['skill-gamma'],
				['skill-alpha']
			);

			expect(flags).toContain('--gamma');
			expect(flags).toContain('--beta');
			expect(flags).not.toContain('--alpha');
		});

		it('should return empty for non-matching runtime', async () => {
			mockReadFile.mockImplementation((filePath: string) => {
				if (filePath.includes('role.json')) {
					return Promise.resolve(JSON.stringify({
						assignedSkills: ['chrome-browser'],
					}));
				}
				if (filePath.includes('skill.json')) {
					return Promise.resolve(JSON.stringify({
						runtime: { runtime: 'claude-code', flags: ['--chrome'] },
					}));
				}
				return Promise.resolve('{}');
			});

			const resolveRuntimeFlags = (service as any).resolveRuntimeFlags.bind(service);
			// Query for gemini-cli runtime — chrome-browser's flags are claude-code only
			const flags = await resolveRuntimeFlags('generalist', 'gemini-cli');

			expect(flags).toEqual([]);
		});

		it('should handle missing role config gracefully', async () => {
			mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

			const resolveRuntimeFlags = (service as any).resolveRuntimeFlags.bind(service);
			const flags = await resolveRuntimeFlags('nonexistent-role', 'claude-code');

			expect(flags).toEqual([]);
		});

		it('should handle missing skill config gracefully', async () => {
			mockReadFile.mockImplementation((filePath: string) => {
				if (filePath.includes('role.json')) {
					return Promise.resolve(JSON.stringify({
						assignedSkills: ['nonexistent-skill'],
					}));
				}
				// Skill file doesn't exist
				return Promise.reject(new Error('ENOENT: no such file'));
			});

			const resolveRuntimeFlags = (service as any).resolveRuntimeFlags.bind(service);
			const flags = await resolveRuntimeFlags('generalist', 'claude-code');

			expect(flags).toEqual([]);
		});

		it('should deduplicate flags from multiple skills', async () => {
			mockReadFile.mockImplementation((filePath: string) => {
				if (filePath.includes('role.json')) {
					return Promise.resolve(JSON.stringify({
						assignedSkills: ['skill-a', 'skill-b'],
					}));
				}
				// Both skills produce the same flag
				if (filePath.includes('skill.json')) {
					return Promise.resolve(JSON.stringify({
						runtime: { runtime: 'claude-code', flags: ['--chrome'] },
					}));
				}
				return Promise.resolve('{}');
			});

			const resolveRuntimeFlags = (service as any).resolveRuntimeFlags.bind(service);
			const flags = await resolveRuntimeFlags('generalist', 'claude-code');

			expect(flags).toEqual(['--chrome']);
		});
	});

	describe('isGeminiInShellMode (private method)', () => {
		let isGeminiInShellMode: (output: string) => boolean;

		beforeEach(() => {
			isGeminiInShellMode = (service as any).isGeminiInShellMode.bind(service);
		});

		it('should return false for normal Gemini CLI prompt', () => {
			expect(isGeminiInShellMode('│ > Type your message... │')).toBe(false);
		});

		it('should return false for empty/null input', () => {
			expect(isGeminiInShellMode('')).toBe(false);
			expect(isGeminiInShellMode(null as any)).toBe(false);
			expect(isGeminiInShellMode(undefined as any)).toBe(false);
		});

		it('should detect shell mode from bordered ! prompt', () => {
			expect(isGeminiInShellMode('│ ! │')).toBe(true);
		});

		it('should detect shell mode from bordered ! prompt with text', () => {
			expect(isGeminiInShellMode('│ ! ls -la │')).toBe(true);
		});

		it('should detect shell mode from stripped ! prompt', () => {
			expect(isGeminiInShellMode('! ')).toBe(true);
		});

		it('should detect shell mode from bare ! character', () => {
			expect(isGeminiInShellMode('!')).toBe(true);
		});

		it('should detect shell mode on last line of multi-line output', () => {
			const output = [
				'Welcome to Gemini CLI',
				'Model: gemini-2.5-pro',
				'│ ! │',
			].join('\n');
			expect(isGeminiInShellMode(output)).toBe(true);
		});

		it('should not detect shell mode from normal > prompt', () => {
			const output = [
				'Welcome to Gemini CLI',
				'│ > Type your message │',
			].join('\n');
			expect(isGeminiInShellMode(output)).toBe(false);
		});
	});

	describe('escapeGeminiShellMode (private method)', () => {
		let escapeGeminiShellMode: (sessionName: string, helper: any) => Promise<boolean>;

		beforeEach(() => {
			escapeGeminiShellMode = (service as any).escapeGeminiShellMode.bind(service);
		});

		it('should send Escape and return true when shell mode exits', async () => {
			// First capturePane: still in shell mode (but isGeminiInShellMode will see normal prompt)
			mockSessionHelper.capturePane.mockReturnValue('│ > Type your message │');

			const result = await escapeGeminiShellMode('agentmux-orc', mockSessionHelper);

			expect(result).toBe(true);
			expect(mockSessionHelper.sendEscape).toHaveBeenCalledWith('agentmux-orc');
		});

		it('should retry and return false after max attempts if still in shell mode', async () => {
			// capturePane always shows shell mode
			mockSessionHelper.capturePane.mockReturnValue('│ ! │');

			const result = await escapeGeminiShellMode('agentmux-orc', mockSessionHelper);

			expect(result).toBe(false);
			expect(mockSessionHelper.sendEscape).toHaveBeenCalledTimes(3); // MAX_ESCAPE_ATTEMPTS
		});
	});

	describe('sendMessageToAgent with Gemini shell mode', () => {
		beforeEach(() => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
		});

		it('should detect and escape shell mode before sending message to Gemini CLI', async () => {
			let callCount = 0;
			mockSessionHelper.capturePane.mockImplementation(() => {
				callCount++;
				// First call (prompt check in sendMessageWithRetry): shell mode
				if (callCount === 1) return '│ ! │';
				// Second call (after escape, isGeminiInShellMode check): normal mode
				if (callCount === 2) return '│ > Type your message │';
				// Third call (before-send snapshot for TUI delivery detection): normal prompt
				if (callCount === 3) return '│ > │';
				// Fourth call+ (after-send snapshot): processing (message delivered)
				return '⠋ Thinking...';
			});

			const result = await service.sendMessageToAgent(
				'agentmux-orc',
				'Hello!',
				RUNTIME_TYPES.GEMINI_CLI
			);

			expect(result.success).toBe(true);
			expect(mockSessionHelper.sendEscape).toHaveBeenCalled();
		});

		it('should not attempt shell mode escape for Claude Code runtime', async () => {
			mockSessionHelper.capturePane
				.mockReturnValueOnce('❯ ')    // prompt check
				.mockReturnValueOnce('⠋ ');   // stuck check (processing = not stuck)

			const result = await service.sendMessageToAgent(
				'agentmux-orc',
				'Hello',
				RUNTIME_TYPES.CLAUDE_CODE
			);

			expect(result.success).toBe(true);
			// sendEscape should NOT have been called for shell mode escape
			// (it might be called for other reasons like stuck message retry, but not before message send)
			expect(mockSessionHelper.sendEscape).not.toHaveBeenCalled();
		});
	});
});
