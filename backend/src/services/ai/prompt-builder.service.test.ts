import { PromptBuilderService } from './prompt-builder.service.js';
import { LoggerService } from '../core/logger.service.js';
import { TeamMemberSessionConfig } from '../../types/index.js';

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
	access: jest.fn(),
}));

describe('PromptBuilderService', () => {
	let service: PromptBuilderService;
	let mockReadFile: jest.Mock;
	let mockAccess: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		mockReadFile = require('fs/promises').readFile;
		mockAccess = require('fs/promises').access;
		service = new PromptBuilderService('/test/project');
	});

	describe('buildOrchestratorPrompt', () => {
		it('should build orchestrator prompt with team members', () => {
			const projectData = {
				projectName: 'Test Project',
				projectPath: '/test/path',
				teamDetails: {
					name: 'Development Team',
					members: [
						{ name: 'John', role: 'Frontend Developer', skills: 'React, TypeScript' },
						{ name: 'Jane', role: 'Backend Developer', skills: 'Node.js, PostgreSQL' },
					],
				},
				requirements: 'Build a web application',
			};

			const result = service.buildOrchestratorPrompt(projectData);

			expect(result).toContain('Test Project');
			expect(result).toContain('/test/path');
			expect(result).toContain('Development Team');
			expect(result).toContain('John: Frontend Developer');
			expect(result).toContain('Jane: Backend Developer');
			expect(result).toContain('Build a web application');
			expect(result).toContain('Start all teams on Phase 1 simultaneously');
		});

		it('should handle missing team members', () => {
			const projectData = {
				projectName: 'Test Project',
				projectPath: '/test/path',
				teamDetails: {
					name: 'Development Team',
				},
			};

			const result = service.buildOrchestratorPrompt(projectData);

			expect(result).toContain('No team members specified');
			expect(result).toContain('Test Project');
		});

		it('should use default requirements when not provided', () => {
			const projectData = {
				projectName: 'Test Project',
				projectPath: '/test/path',
				teamDetails: { name: 'Team' },
			};

			const result = service.buildOrchestratorPrompt(projectData);

			expect(result).toContain('See project documentation in .agentmux/specs/');
		});
	});

	describe('buildSystemPrompt', () => {
		const mockConfig: TeamMemberSessionConfig = {
			name: 'test-session',
			role: 'developer',
			projectPath: '/test/project',
			memberId: 'member-123',
		};

		it('should load role-specific prompt when available', async () => {
			const promptContent = 'Role-specific prompt for {{ROLE}} with session {{SESSION_ID}}';
			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue(promptContent);

			const result = await service.buildSystemPrompt(mockConfig);

			expect(result).toContain('Role-specific prompt for developer with session test-session');
			expect(mockAccess).toHaveBeenCalledWith(
				expect.stringContaining('/config/prompts/developer-prompt.md')
			);
			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining('/config/prompts/developer-prompt.md'),
				'utf8'
			);
		});

		it('should use fallback prompt when role-specific prompt not found', async () => {
			mockAccess.mockRejectedValue(new Error('File not found'));

			const result = await service.buildSystemPrompt(mockConfig);

			expect(result).toContain('AgentMux Agent: DEVELOPER');
			expect(result).toContain('You are a developer agent');
			expect(result).toContain('register_agent_status({ "role": "developer" })');
			expect(result).toContain('Session: test-session');
		});

		it('should replace multiple template variables', async () => {
			const promptContent = `Role: {{ROLE}}, Session: {{SESSION_ID}}, Path: {{PROJECT_PATH}}, Member: {{MEMBER_ID}}`;
			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue(promptContent);

			const result = await service.buildSystemPrompt(mockConfig);

			expect(result).toBe('Role: developer, Session: test-session, Path: /test/project, Member: member-123');
		});
	});

	describe('loadRegistrationPrompt', () => {
		it('should load registration prompt with member ID', async () => {
			const promptContent = 'Register as {{ROLE}} with session {{SESSION_ID}} and member {{MEMBER_ID}}';
			mockReadFile.mockResolvedValue(promptContent);

			const result = await service.loadRegistrationPrompt('dev', 'test-session', 'member-123');

			expect(result).toBe('Register as dev with session test-session and member member-123');
			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining('/config/prompts/dev-prompt.md'),
				'utf8'
			);
		});

		it('should remove member ID parameter when not provided', async () => {
			const promptContent = 'Register {"role": "{{ROLE}}", "sessionId": "{{SESSION_ID}}", "memberId": "{{MEMBER_ID}}"}';
			mockReadFile.mockResolvedValue(promptContent);

			const result = await service.loadRegistrationPrompt('orchestrator', 'test-session');

			expect(result).toBe('Register {"role": "orchestrator", "sessionId": "test-session"}');
		});

		it('should use fallback when prompt file not found', async () => {
			mockReadFile.mockRejectedValue(new Error('File not found'));

			const result = await service.loadRegistrationPrompt('dev', 'test-session', 'member-123');

			expect(result).toContain('Please immediately run: register_agent_status');
			expect(result).toContain('"role": "dev"');
			expect(result).toContain('"sessionId": "test-session"');
			expect(result).toContain('"memberId": "member-123"');
		});

		it('should exclude member ID from fallback when not provided', async () => {
			mockReadFile.mockRejectedValue(new Error('File not found'));

			const result = await service.loadRegistrationPrompt('orchestrator', 'test-session');

			expect(result).toContain('"role": "orchestrator"');
			expect(result).toContain('"sessionId": "test-session"');
			expect(result).not.toContain('memberId');
		});
	});

	describe('loadPromptTemplate', () => {
		it('should load prompt template successfully', async () => {
			const templateContent = 'Template content';
			mockReadFile.mockResolvedValue(templateContent);

			const result = await service.loadPromptTemplate('test-template.md');

			expect(result).toBe(templateContent);
			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining('/config/prompts/test-template.md'),
				'utf8'
			);
		});

		it('should return null when template not found', async () => {
			mockReadFile.mockRejectedValue(new Error('File not found'));

			const result = await service.loadPromptTemplate('nonexistent.md');

			expect(result).toBeNull();
		});
	});

	describe('promptTemplateExists', () => {
		it('should return true when template exists', async () => {
			mockAccess.mockResolvedValue(undefined);

			const result = await service.promptTemplateExists('existing-template.md');

			expect(result).toBe(true);
			expect(mockAccess).toHaveBeenCalledWith(
				expect.stringContaining('/config/prompts/existing-template.md')
			);
		});

		it('should return false when template does not exist', async () => {
			mockAccess.mockRejectedValue(new Error('File not found'));

			const result = await service.promptTemplateExists('nonexistent.md');

			expect(result).toBe(false);
		});
	});

	describe('buildTaskAssignmentPrompt', () => {
		it('should build task assignment prompt with all fields', () => {
			const task = {
				id: 'task-123',
				title: 'Implement user authentication',
				description: 'Add login and registration functionality',
				assigneeRole: 'backend-developer',
				priority: 'high' as const,
				estimatedHours: 8,
			};

			const result = service.buildTaskAssignmentPrompt(task);

			expect(result).toContain('Task ID: task-123');
			expect(result).toContain('Title: Implement user authentication');
			expect(result).toContain('Assigned to: backend-developer');
			expect(result).toContain('Priority: HIGH');
			expect(result).toContain('Estimated Hours: 8');
			expect(result).toContain('Add login and registration functionality');
		});

		it('should build task assignment prompt without estimated hours', () => {
			const task = {
				id: 'task-456',
				title: 'Fix bug in payment processing',
				description: 'Resolve issue with payment validation',
				assigneeRole: 'developer',
				priority: 'medium' as const,
			};

			const result = service.buildTaskAssignmentPrompt(task);

			expect(result).toContain('Task ID: task-456');
			expect(result).toContain('Priority: MEDIUM');
			expect(result).not.toContain('Estimated Hours');
		});
	});

	describe('buildStatusUpdatePrompt', () => {
		it('should build status update prompt', () => {
			const result = service.buildStatusUpdatePrompt('test-session', 'developer');

			expect(result).toContain('Status Update Request');
			expect(result).toContain('Current Task');
			expect(result).toContain('Progress');
			expect(result).toContain('Blockers');
			expect(result).toContain('Next Steps');
			expect(result).toContain('ETA');
		});
	});

	describe('getPromptsDirectory', () => {
		it('should return prompts directory path', () => {
			const result = service.getPromptsDirectory();

			expect(result).toContain('/config/prompts');
		});
	});
});