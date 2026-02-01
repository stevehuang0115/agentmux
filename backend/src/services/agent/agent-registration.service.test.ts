/**
 * Tests for AgentRegistrationService
 * Tests the multi-step agent initialization and registration process
 */

import { AgentRegistrationService } from './agent-registration.service.js';
import { StorageService } from '../core/storage.service.js';
import { LoggerService } from '../core/logger.service.js';
import * as sessionModule from '../session/index.js';
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
}));

jest.mock('os', () => ({
	homedir: jest.fn().mockReturnValue('/home/test'),
}));

// Mock session module
jest.mock('../session/index.js', () => ({
	getSessionBackendSync: jest.fn(),
	createSessionBackend: jest.fn(),
	createSessionCommandHelper: jest.fn(),
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

		it('should update agent status to active when runtime is ready', async () => {
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
				AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE
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

			// Give time for async operation to complete
			await new Promise(resolve => setTimeout(resolve, 100));

			// Should have called sendMessage with the registration prompt
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
	});

	describe('sendMessageToAgent', () => {
		it('should send message and verify processing started (prompt gone)', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			// Message sent, prompt disappears indicating processing started
			mockSessionHelper.capturePane
				.mockReturnValueOnce('❯ ')  // Before: at prompt
				.mockReturnValueOnce('Hello, agent!\nThinking...');  // After: no prompt, processing

			const result = await service.sendMessageToAgent('test-session', 'Hello, agent!');

			expect(result.success).toBe(true);
			expect(mockSessionHelper.sendMessage).toHaveBeenCalledWith('test-session', 'Hello, agent!');
		});

		it('should send Enter again if message visible but prompt still showing', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			// Message pasted but prompt still shows (bracketed paste issue)
			// After sending Enter again, prompt disappears
			mockSessionHelper.capturePane
				.mockReturnValueOnce('❯ ')  // Before: at prompt
				.mockReturnValueOnce('❯ Hello')  // After send: message visible but prompt still there
				.mockReturnValueOnce('Hello\nProcessing...');  // After Enter: processing started

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			expect(result.success).toBe(true);
			expect(mockSessionHelper.sendEnter).toHaveBeenCalled();
		}, 15000);

		it('should detect processing indicators as success', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			mockSessionHelper.capturePane
				.mockReturnValueOnce('❯ ')  // Before: at prompt
				.mockReturnValueOnce('Hello\n⠋ thinking...');  // After: spinner visible

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			expect(result.success).toBe(true);
		});

		it('should send Escape when Claude not at prompt', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			mockSessionHelper.capturePane
				.mockReturnValueOnce('Some modal text...')  // Before: not at prompt
				.mockReturnValueOnce('Hello\nThinking...');  // After: processing

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			expect(result.success).toBe(true);
			expect(mockSessionHelper.sendEscape).toHaveBeenCalled();
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

		it('should fail after max retries when prompt never goes away', async () => {
			mockSessionHelper.sessionExists.mockReturnValue(true);
			// All attempts fail - prompt always visible, no processing
			mockSessionHelper.capturePane.mockReturnValue('❯ ');

			const result = await service.sendMessageToAgent('test-session', 'Hello');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Failed to deliver message');
		}, 20000);  // Increase timeout for retry test
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
			mockReadFile.mockResolvedValue('{"roles": [{"key": "dev", "promptFile": "dev-prompt.md"}]}');
			mockReadFile.mockResolvedValueOnce('{"roles": [{"key": "dev", "promptFile": "dev-prompt.md"}]}');
			mockReadFile.mockResolvedValueOnce(promptTemplate);

			// Access private method via reflection
			const loadRegistrationPrompt = (service as any).loadRegistrationPrompt.bind(service);
			const result = await loadRegistrationPrompt('dev', 'test-session', 'member-123');

			expect(result).toContain('test-session');
			expect(result).toContain('member-123');
		});

		it('should remove member ID parameter when not provided', async () => {
			const promptTemplate = 'Register {"sessionName": "{{SESSION_ID}}", "memberId": "{{MEMBER_ID}}"}';
			mockReadFile.mockResolvedValue('{"roles": [{"key": "orchestrator", "promptFile": "orc-prompt.md"}]}');
			mockReadFile.mockResolvedValueOnce('{"roles": [{"key": "orchestrator", "promptFile": "orc-prompt.md"}]}');
			mockReadFile.mockResolvedValueOnce(promptTemplate);

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
});
