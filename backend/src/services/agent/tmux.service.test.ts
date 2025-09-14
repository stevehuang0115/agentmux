import { TmuxService } from './tmux.service.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { ClaudeAgentService } from './claude-agent.service.js';
import { AgentRegistrationService } from './agent-registration.service.js';
import { PromptBuilderService } from '../ai/prompt-builder.service.js';
import { LoggerService } from '../core/logger.service.js';

// Mock all dependencies
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

jest.mock('./tmux-command.service.js');
jest.mock('./claude-agent.service.js');
jest.mock('./agent-registration.service.js');
jest.mock('../ai/prompt-builder.service.js');

jest.mock('fs', () => ({
	accessSync: jest.fn(),
}));

jest.mock('child_process', () => ({
	spawn: jest.fn(),
}));

describe('TmuxService', () => {
	let service: TmuxService;
	let mockTmuxCommand: jest.Mocked<TmuxCommandService>;
	let mockClaudeAgent: jest.Mocked<ClaudeAgentService>;
	let mockAgentRegistration: jest.Mocked<AgentRegistrationService>;
	let mockPromptBuilder: jest.Mocked<PromptBuilderService>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock the constructors to return mocked instances
		mockTmuxCommand = {
			sessionExists: jest.fn(),
			killSession: jest.fn(),
			createSession: jest.fn(),
			sendMessage: jest.fn(),
			sendEnter: jest.fn(),
			sendKey: jest.fn(),
			capturePane: jest.fn(),
			listSessions: jest.fn(),
			setEnvironmentVariable: jest.fn(),
		} as any;

		mockClaudeAgent = {
			checkClaudeInstallation: jest.fn(),
			initializeClaudeInSession: jest.fn(),
			executeClaudeInitScript: jest.fn(),
			cleanupDetectionCache: jest.fn(),
		} as any;

		mockAgentRegistration = {
			initializeAgentWithRegistration: jest.fn(),
		} as any;

		mockPromptBuilder = {
			buildOrchestratorPrompt: jest.fn(),
		} as any;

		// Mock constructors
		(TmuxCommandService as jest.Mock).mockImplementation(() => mockTmuxCommand);
		(ClaudeAgentService as jest.Mock).mockImplementation(() => mockClaudeAgent);
		(AgentRegistrationService as jest.Mock).mockImplementation(() => mockAgentRegistration);
		(PromptBuilderService as jest.Mock).mockImplementation(() => mockPromptBuilder);

		// Mock fs.accessSync for project root detection
		require('fs').accessSync.mockImplementation(() => true);

		service = new TmuxService();
	});

	afterEach(() => {
		if (service) {
			service.destroy();
		}
	});

	describe('constructor', () => {
		it('should initialize all specialized services', () => {
			expect(TmuxCommandService).toHaveBeenCalledTimes(1);
			expect(ClaudeAgentService).toHaveBeenCalledTimes(1);
			expect(AgentRegistrationService).toHaveBeenCalledTimes(1);
			expect(PromptBuilderService).toHaveBeenCalledTimes(1);
			expect(LoggerService.getInstance).toHaveBeenCalled();
		});
	});

	describe('createOrchestratorSession', () => {
		it('should create orchestrator session successfully', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(false);
			mockTmuxCommand.createSession.mockResolvedValue();

			const config = {
				sessionName: 'orchestrator',
				projectPath: '/test/project',
				windowName: 'main',
			};

			const result = await service.createOrchestratorSession(config);

			expect(result.success).toBe(true);
			expect(result.sessionName).toBe('orchestrator');
			expect(result.message).toBe('Orchestrator session created successfully');
			expect(mockTmuxCommand.createSession).toHaveBeenCalledWith(
				'orchestrator',
				'/test/project',
				'main'
			);
		});

		it('should return success if session already exists', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(true);

			const config = {
				sessionName: 'orchestrator',
				projectPath: '/test/project',
			};

			const result = await service.createOrchestratorSession(config);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Orchestrator session already running');
			expect(mockTmuxCommand.createSession).not.toHaveBeenCalled();
		});

		it('should handle creation errors', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(false);
			mockTmuxCommand.createSession.mockRejectedValue(new Error('Creation failed'));

			const config = {
				sessionName: 'orchestrator',
				projectPath: '/test/project',
			};

			const result = await service.createOrchestratorSession(config);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Creation failed');
		});
	});

	describe('initializeOrchestrator', () => {
		it('should delegate to agent registration service', async () => {
			mockAgentRegistration.initializeAgentWithRegistration.mockResolvedValue({
				success: true,
				message: 'Orchestrator initialized',
			});

			const result = await service.initializeOrchestrator('orchestrator', 60000);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Orchestrator initialized');
			expect(mockAgentRegistration.initializeAgentWithRegistration).toHaveBeenCalledWith(
				'orchestrator',
				'orchestrator',
				expect.any(String),
				60000
			);
		});
	});

	describe('sendProjectStartPrompt', () => {
		it('should send project start prompt successfully', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(true);
			mockPromptBuilder.buildOrchestratorPrompt.mockReturnValue('Test orchestrator prompt');
			mockTmuxCommand.sendMessage.mockResolvedValue();
			mockTmuxCommand.sendEnter.mockResolvedValue();

			const projectData = {
				projectName: 'Test Project',
				projectPath: '/test/path',
				teamDetails: { name: 'Test Team' },
				requirements: 'Build an app',
			};

			const result = await service.sendProjectStartPrompt('orchestrator', projectData);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Project start prompt sent to orchestrator');
			expect(mockPromptBuilder.buildOrchestratorPrompt).toHaveBeenCalledWith(projectData);
		});

		it('should fail if session does not exist', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(false);

			const projectData = {
				projectName: 'Test Project',
				projectPath: '/test/path',
				teamDetails: { name: 'Test Team' },
			};

			const result = await service.sendProjectStartPrompt('orchestrator', projectData);

			expect(result.success).toBe(false);
			expect(result.error).toContain('does not exist');
		});
	});

	describe('checkClaudeInstallation', () => {
		it('should delegate to Claude agent service', async () => {
			mockClaudeAgent.checkClaudeInstallation.mockResolvedValue({
				installed: true,
				version: '1.0.0',
				message: 'Claude installed',
			});

			const result = await service.checkClaudeInstallation();

			expect(result.installed).toBe(true);
			expect(result.version).toBe('1.0.0');
			expect(mockClaudeAgent.checkClaudeInstallation).toHaveBeenCalled();
		});
	});

	describe('createTeamMemberSession', () => {
		const mockConfig = {
			name: 'test-dev',
			role: 'developer',
			projectPath: '/test/project',
			memberId: 'dev-123',
		};

		it('should create team member session successfully', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(false);
			mockTmuxCommand.killSession.mockResolvedValue();
			mockTmuxCommand.createSession.mockResolvedValue();
			mockTmuxCommand.setEnvironmentVariable.mockResolvedValue();
			mockAgentRegistration.initializeAgentWithRegistration.mockResolvedValue({
				success: true,
				message: 'Agent registered',
			});

			const result = await service.createTeamMemberSession(mockConfig, 'test-dev');

			expect(result.success).toBe(true);
			expect(result.sessionName).toBe('test-dev');
			expect(result.message).toBe('Team member session created successfully');
			expect(mockTmuxCommand.createSession).toHaveBeenCalledWith('test-dev', '/test/project');
			expect(mockAgentRegistration.initializeAgentWithRegistration).toHaveBeenCalledWith(
				'test-dev',
				'developer',
				'/test/project',
				90000,
				'dev-123'
			);
		});

		it('should handle agent initialization failure', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(false);
			mockTmuxCommand.killSession.mockResolvedValue();
			mockTmuxCommand.createSession.mockResolvedValue();
			mockTmuxCommand.setEnvironmentVariable.mockResolvedValue();
			mockAgentRegistration.initializeAgentWithRegistration.mockResolvedValue({
				success: false,
				error: 'Registration failed',
			});

			const result = await service.createTeamMemberSession(mockConfig, 'test-dev');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Agent initialization failed');
		});
	});

	describe('sendMessage', () => {
		it('should send message and enter key', async () => {
			mockTmuxCommand.sendMessage.mockResolvedValue();
			mockTmuxCommand.sendEnter.mockResolvedValue();

			await service.sendMessage('test-session', 'Hello Claude');

			expect(mockTmuxCommand.sendMessage).toHaveBeenCalledWith('test-session', 'Hello Claude');
			expect(mockTmuxCommand.sendEnter).toHaveBeenCalledWith('test-session');
		});

		it('should emit message_sent event', async () => {
			mockTmuxCommand.sendMessage.mockResolvedValue();
			mockTmuxCommand.sendEnter.mockResolvedValue();

			const eventSpy = jest.fn();
			service.on('message_sent', eventSpy);

			await service.sendMessage('test-session', 'Hello');

			expect(eventSpy).toHaveBeenCalledWith({
				sessionName: 'test-session',
				message: 'Hello',
			});
		});
	});

	describe('sessionExists', () => {
		it('should delegate to tmux command service', async () => {
			mockTmuxCommand.sessionExists.mockResolvedValue(true);

			const result = await service.sessionExists('test-session');

			expect(result).toBe(true);
			expect(mockTmuxCommand.sessionExists).toHaveBeenCalledWith('test-session');
		});
	});

	describe('listSessions', () => {
		it('should delegate to tmux command service', async () => {
			const mockSessions = [
				{
					sessionName: 'test-session',
					pid: 12345,
					windows: 1,
					created: '2023-01-01T00:00:00.000Z',
					attached: false,
				},
			];
			mockTmuxCommand.listSessions.mockResolvedValue(mockSessions);

			const result = await service.listSessions();

			expect(result).toEqual(mockSessions);
			expect(mockTmuxCommand.listSessions).toHaveBeenCalled();
		});
	});

	describe('killSession', () => {
		it('should kill session and clean up tracking', async () => {
			mockTmuxCommand.killSession.mockResolvedValue();

			const eventSpy = jest.fn();
			service.on('session_killed', eventSpy);

			await service.killSession('test-session');

			expect(mockTmuxCommand.killSession).toHaveBeenCalledWith('test-session');
			expect(eventSpy).toHaveBeenCalledWith({ sessionName: 'test-session' });
		});
	});

	describe('destroy', () => {
		it('should clean up resources', () => {
			// The constructor sets up an interval, destroy should clear it
			service.destroy();

			// Verify that subsequent destroy doesn't throw
			expect(() => service.destroy()).not.toThrow();
		});
	});
});