import { AgentRegistrationService } from './agent-registration.service.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { StorageService } from '../core/storage.service.js';
import { LoggerService } from '../core/logger.service.js';

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

describe('AgentRegistrationService', () => {
	let service: AgentRegistrationService;
	let mockTmuxCommand: jest.Mocked<TmuxCommandService>;
	let mockStorageService: jest.Mocked<StorageService>;
	let mockReadFile: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock TmuxCommandService
		mockTmuxCommand = {
			sessionExists: jest.fn(),
			killSession: jest.fn(),
			createSession: jest.fn(),
			sendCtrlC: jest.fn(),
			sendMessage: jest.fn(),
			capturePane: jest.fn(),
			setEnvironmentVariable: jest.fn(),
		} as any;

		// Mock ClaudeAgentService
		mockClaudeAgent = {
			clearDetectionCache: jest.fn(),
			detectClaudeWithSlashCommand: jest.fn(),
			executeClaudeInitScript: jest.fn(),
			waitForClaudeReady: jest.fn(),
		} as any;

		// Mock StorageService
		mockStorageService = {
			updateAgentStatus: jest.fn().mockResolvedValue(undefined),
			updateOrchestratorStatus: jest.fn().mockResolvedValue(undefined),
		} as any;

		mockReadFile = require('fs/promises').readFile;

		service = new AgentRegistrationService(mockTmuxCommand, '/test/project', mockStorageService);
	});

	describe('initializeAgentWithRegistration', () => {
		it('should succeed on Step 1 (direct registration)', async () => {
			// Mock successful direct registration
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('Please register as {{ROLE}} with session {{SESSION_ID}}');
			mockTmuxCommand.sendCtrlC.mockResolvedValue();
			mockTmuxCommand.sendMessage.mockResolvedValue();
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			
			// Mock successful registration check
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('{"orchestrator": {"status": "active"}}');

			const result = await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Agent registered successfully via direct prompt');
			expect(mockClaudeAgent.clearDetectionCache).toHaveBeenCalledWith('test-session');
		});

		it('should proceed to Step 2 if Step 1 fails', async () => {
			// Mock Step 1 failure
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(false);

			// Mock Step 2 success
			mockTmuxCommand.sendCtrlC.mockResolvedValue();
			mockClaudeAgent.executeClaudeInitScript.mockResolvedValue();
			mockClaudeAgent.waitForClaudeReady.mockResolvedValue(true);
			mockClaudeAgent.detectClaudeWithSlashCommand
				.mockResolvedValueOnce(false) // Step 1 detection
				.mockResolvedValueOnce(true)  // Step 2 post-init detection
				.mockResolvedValueOnce(true); // Registration check detection
			mockReadFile.mockResolvedValue('Please register');
			mockTmuxCommand.sendMessage.mockResolvedValue();
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('{"orchestrator": {"status": "active"}}');

			const result = await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Agent registered successfully after cleanup and reinit');
		});

		it('should proceed to Step 3 if Step 2 fails', async () => {
			// Mock Step 1 failure
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(false);

			// Mock Step 2 failure (Claude not ready after reinit)
			mockTmuxCommand.sendCtrlC.mockResolvedValue();
			mockClaudeAgent.executeClaudeInitScript.mockResolvedValue();
			mockClaudeAgent.waitForClaudeReady.mockResolvedValue(false);

			// Mock Step 3 success
			mockTmuxCommand.killSession.mockResolvedValue();
			mockTmuxCommand.createSession.mockResolvedValue();
			mockClaudeAgent.executeClaudeInitScript.mockResolvedValue();
			mockClaudeAgent.waitForClaudeReady.mockResolvedValue(true);
			mockClaudeAgent.detectClaudeWithSlashCommand
				.mockResolvedValueOnce(false) // Step 1
				.mockResolvedValueOnce(true)  // Step 3 post-recreation
				.mockResolvedValueOnce(true); // Registration check
			mockReadFile.mockResolvedValue('Please register');
			mockTmuxCommand.sendMessage.mockResolvedValue();
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('{"orchestrator": {"status": "active"}}');

			const result = await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Agent registered successfully after full recreation');
		});

		it('should fail after all escalation attempts', async () => {
			// Mock all steps failing
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(false);
			mockTmuxCommand.sendCtrlC.mockResolvedValue();
			mockClaudeAgent.executeClaudeInitScript.mockResolvedValue();
			mockClaudeAgent.waitForClaudeReady.mockResolvedValue(false);
			mockTmuxCommand.killSession.mockResolvedValue();
			mockTmuxCommand.createSession.mockResolvedValue();

			const result = await service.initializeAgentWithRegistration(
				'test-session',
				'orchestrator',
				'/test/path',
				90000
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Failed to initialize agent after all escalation attempts');
		});
	});

	describe('loadRegistrationPrompt', () => {
		it('should load prompt from file and replace placeholders', async () => {
			const promptTemplate = 'Register as {{ROLE}} with session {{SESSION_ID}} and member {{MEMBER_ID}}';
			mockReadFile.mockResolvedValue(promptTemplate);

			// Use reflection to access private method
			const loadRegistrationPrompt = (service as any).loadRegistrationPrompt.bind(service);
			const result = await loadRegistrationPrompt('dev', 'test-session', 'member-123');

			expect(result).toBe('Register as dev with session test-session and member member-123');
			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining('/config/teams/prompts/dev-prompt.md'),
				'utf8'
			);
		});

		it('should remove member ID parameter when not provided', async () => {
			const promptTemplate = 'Register {"role": "{{ROLE}}", "sessionName": "{{SESSION_ID}}", "memberId": "{{MEMBER_ID}}"}';
			mockReadFile.mockResolvedValue(promptTemplate);

			const loadRegistrationPrompt = (service as any).loadRegistrationPrompt.bind(service);
			const result = await loadRegistrationPrompt('orchestrator', 'test-session');

			expect(result).toBe('Register {"role": "orchestrator", "sessionName": "test-session"}');
		});

		it('should use fallback prompt when file not found', async () => {
			mockReadFile.mockRejectedValue(new Error('File not found'));

			const loadRegistrationPrompt = (service as any).loadRegistrationPrompt.bind(service);
			const result = await loadRegistrationPrompt('dev', 'test-session');

			expect(result).toContain('Please immediately run: register_agent_status');
			expect(result).toContain('"role": "dev"');
			expect(result).toContain('"sessionName": "test-session"');
		});
	});

	describe('checkAgentRegistration', () => {
		it('should return false if session does not exist', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(false);

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'dev');

			expect(result).toBe(false);
		});

		it('should return false if Claude is not running', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(false);

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'dev');

			expect(result).toBe(false);
		});

		it('should check orchestrator registration in teams.json', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('{"orchestrator": {"status": "active"}}');

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'orchestrator');

			expect(result).toBe(true);
			expect(mockReadFile).toHaveBeenCalledWith(
				'/home/test/.agentmux/teams.json',
				'utf8'
			);
		});

		it('should check orchestrator registration in terminal output', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(true);
			mockReadFile.mockRejectedValue(new Error('teams.json not found'));
			mockTmuxCommand.capturePane.mockResolvedValue("Perfect! I'm now registered as the orchestrator");

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'orchestrator');

			expect(result).toBe(true);
		});

		it('should check team member registration in teams.json', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(true);
			mockReadFile.mockResolvedValue(`{
				"teams": [{
					"members": [{
						"sessionName": "test-session",
						"role": "dev"
					}]
				}]
			}`);

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'dev');

			expect(result).toBe(true);
		});

		it('should handle teams.json parsing errors', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('invalid json');

			const checkAgentRegistration = (service as any).checkAgentRegistration.bind(service);
			const result = await checkAgentRegistration('test-session', 'dev');

			expect(result).toBe(false);
		});
	});

	describe('waitForRegistration', () => {
		it('should return true when registration is confirmed', async () => {
			// Mock successful registration check
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			mockClaudeAgent.detectClaudeWithSlashCommand.mockResolvedValue(true);
			mockReadFile.mockResolvedValue('{"orchestrator": {"status": "active"}}');

			const waitForRegistration = (service as any).waitForRegistration.bind(service);
			const result = await waitForRegistration('test-session', 'orchestrator', 10000);

			expect(result).toBe(true);
		});

		it('should timeout if registration is not confirmed', async () => {
			// Mock failed registration check
			mockTmuxCommand.sessionExists.mockResolvedValue(false);

			const waitForRegistration = (service as any).waitForRegistration.bind(service);
			const startTime = Date.now();
			const result = await waitForRegistration('test-session', 'orchestrator', 1000);
			const elapsed = Date.now() - startTime;

			expect(result).toBe(false);
			expect(elapsed).toBeGreaterThan(900);
		});
	});
});