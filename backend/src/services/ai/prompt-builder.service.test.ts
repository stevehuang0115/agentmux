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

// Mock MemoryService
const mockInitializeForSession = jest.fn().mockResolvedValue(undefined);
const mockGetFullContext = jest.fn().mockResolvedValue('');

jest.mock('../memory/memory.service.js', () => ({
	MemoryService: {
		getInstance: jest.fn(() => ({
			initializeForSession: mockInitializeForSession,
			getFullContext: mockGetFullContext,
		})),
	},
}));

// Mock SOPService
const mockGenerateSOPContext = jest.fn().mockResolvedValue('');

jest.mock('../sop/sop.service.js', () => ({
	SOPService: {
		getInstance: jest.fn(() => ({
			generateSOPContext: mockGenerateSOPContext,
		})),
	},
}));

// Mock RoleService - return null to force file fallback for testing file paths
const mockGetRoleByName = jest.fn().mockResolvedValue(null);

jest.mock('../settings/role.service.js', () => ({
	getRoleService: jest.fn(() => ({
		getRoleByName: mockGetRoleByName,
	})),
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
			systemPrompt: 'test prompt',
			runtimeType: 'claude-code' as any
		};

		it('should load role-specific prompt when available', async () => {
			const promptContent = 'Role-specific prompt for {{ROLE}} with session {{SESSION_ID}}';
			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue(promptContent);

			const result = await service.buildSystemPrompt(mockConfig);

			expect(result).toContain('Role-specific prompt for developer with session test-session');
			expect(mockAccess).toHaveBeenCalledWith(
				expect.stringContaining('/config/roles/developer/prompt.md')
			);
			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining('/config/roles/developer/prompt.md'),
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
				expect.stringContaining('/config/roles/dev/prompt.md'),
				'utf8'
			);
		});

		it('should remove member ID parameter when not provided', async () => {
			const promptContent = 'Register {"role": "{{ROLE}}", "sessionName": "{{SESSION_ID}}", "memberId": "{{MEMBER_ID}}"}';
			mockReadFile.mockResolvedValue(promptContent);

			const result = await service.loadRegistrationPrompt('orchestrator', 'test-session');

			expect(result).toBe('Register {"role": "orchestrator", "sessionName": "test-session"}');
		});

		it('should use fallback when prompt file not found', async () => {
			mockReadFile.mockRejectedValue(new Error('File not found'));

			const result = await service.loadRegistrationPrompt('dev', 'test-session', 'member-123');

			// Fallback prompt contains registration instructions
			expect(result).toContain('IMMEDIATELY');
			expect(result).toContain('register_agent_status');
			expect(result).toContain('"role": "dev"');
			expect(result).toContain('"sessionName": "test-session"');
			expect(result).toContain('member-123');
		});

		it('should exclude member ID from fallback when not provided', async () => {
			mockReadFile.mockRejectedValue(new Error('File not found'));

			const result = await service.loadRegistrationPrompt('orchestrator', 'test-session');

			expect(result).toContain('"role": "orchestrator"');
			expect(result).toContain('"sessionName": "test-session"');
			expect(result).not.toContain('memberId');
		});
	});

	describe('loadPromptTemplate', () => {
		it('should load prompt template successfully', async () => {
			const templateContent = 'Template content';
			mockReadFile.mockResolvedValue(templateContent);

			// Pass role name (test-template) or old filename (test-template-prompt.md)
			const result = await service.loadPromptTemplate('test-template-prompt.md');

			expect(result).toBe(templateContent);
			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining('/config/roles/test-template/prompt.md'),
				'utf8'
			);
		});

		it('should return null when template not found', async () => {
			mockReadFile.mockRejectedValue(new Error('File not found'));

			const result = await service.loadPromptTemplate('nonexistent-prompt.md');

			expect(result).toBeNull();
		});
	});

	describe('promptTemplateExists', () => {
		it('should return true when template exists', async () => {
			mockAccess.mockResolvedValue(undefined);

			// Pass role name directly or old filename pattern
			const result = await service.promptTemplateExists('existing-template-prompt.md');

			expect(result).toBe(true);
			expect(mockAccess).toHaveBeenCalledWith(
				expect.stringContaining('/config/roles/existing-template/prompt.md')
			);
		});

		it('should return false when template does not exist', async () => {
			mockAccess.mockRejectedValue(new Error('File not found'));

			const result = await service.promptTemplateExists('nonexistent-prompt.md');

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

			expect(result).toContain('**Task ID**: task-123');
			expect(result).toContain('**Title**: Implement user authentication');
			expect(result).toContain('**Assigned to**: backend-developer');
			expect(result).toContain('**Priority**: HIGH');
			expect(result).toContain('**Estimated Hours**: 8');
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

			expect(result).toContain('**Task ID**: task-456');
			expect(result).toContain('**Priority**: MEDIUM');
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

	describe('getRolesDirectory', () => {
		it('should return roles directory path', () => {
			const result = service.getRolesDirectory();

			expect(result).toContain('/config/roles');
		});
	});

	describe('config path resolution', () => {
		it('should construct correct path for roles directory', () => {
			const testService = new PromptBuilderService('/test/project');
			const rolesDir = testService.getRolesDirectory();

			expect(rolesDir).toBe('/test/project/config/roles');
		});

		it('should use correct path structure when loading prompts', async () => {
			const mockPromptContent = 'Test prompt content';
			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue(mockPromptContent);

			const testService = new PromptBuilderService('/custom/project/root');

			// Pass the old filename format which gets converted to role name
			await testService.loadPromptTemplate('developer-prompt.md');

			expect(mockReadFile).toHaveBeenCalledWith(
				'/custom/project/root/config/roles/developer/prompt.md',
				'utf8'
			);
		});

		it('should check existence with correct path structure', async () => {
			mockAccess.mockResolvedValue(undefined);

			const testService = new PromptBuilderService('/test/root');

			await testService.promptTemplateExists('tpm-prompt.md');

			expect(mockAccess).toHaveBeenCalledWith(
				'/test/root/config/roles/tpm/prompt.md'
			);
		});

		it('should handle path resolution for different role prompt files', async () => {
			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue('Prompt content');

			const roles = ['fullstack-dev', 'designer', 'qa', 'architect'];

			for (const role of roles) {
				await service.loadPromptTemplate(`${role}-prompt.md`);

				expect(mockReadFile).toHaveBeenCalledWith(
					expect.stringContaining(`/config/roles/${role}/prompt.md`),
					'utf8'
				);
			}
		});

		it('should build system prompt with correct path lookup', async () => {
			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue('Role-specific prompt for {{ROLE}}');

			const config: TeamMemberSessionConfig = {
				name: 'test-session',
				role: 'tpm',
				projectPath: '/test/project',
				memberId: 'member-123',
				systemPrompt: 'test prompt',
				runtimeType: 'claude-code' as any
			};

			await service.buildSystemPrompt(config);

			// Should attempt to load prompt from teams prompts directory
			expect(mockAccess).toHaveBeenCalledWith(
				expect.stringContaining('/config/roles/tpm/prompt.md')
			);
		});
	});

	describe('buildMemoryContext', () => {
		beforeEach(() => {
			mockInitializeForSession.mockClear();
			mockGetFullContext.mockClear();
			mockInitializeForSession.mockResolvedValue(undefined);
			mockGetFullContext.mockResolvedValue('');
		});

		it('should return formatted memory context when available', async () => {
			mockGetFullContext.mockResolvedValue('## Test Memory Context\nSome knowledge');

			const result = await service.buildMemoryContext('agent-001', '/test/project', { role: 'developer' });

			expect(mockInitializeForSession).toHaveBeenCalledWith(
				'agent-001',
				'developer',
				'/test/project'
			);
			expect(result).toContain('Your Knowledge Base');
			expect(result).toContain('Test Memory Context');
			expect(result).toContain('remember');
			expect(result).toContain('recall');
		});

		it('should return empty string when no memory available', async () => {
			mockGetFullContext.mockResolvedValue('');

			const result = await service.buildMemoryContext('agent-001', '/test/project');

			expect(result).toBe('');
		});

		it('should use default role when not provided', async () => {
			mockGetFullContext.mockResolvedValue('');

			await service.buildMemoryContext('agent-001', '/test/project');

			expect(mockInitializeForSession).toHaveBeenCalledWith(
				'agent-001',
				'developer',
				'/test/project'
			);
		});

		it('should handle errors gracefully', async () => {
			mockInitializeForSession.mockRejectedValue(new Error('Memory error'));

			const result = await service.buildMemoryContext('agent-001', '/test/project');

			expect(result).toBe('');
		});
	});

	describe('buildSystemPromptWithMemory', () => {
		const mockConfig: TeamMemberSessionConfig = {
			name: 'test-session',
			role: 'developer',
			projectPath: '/test/project',
			memberId: 'member-123',
			systemPrompt: 'test prompt',
			runtimeType: 'claude-code' as any
		};

		beforeEach(() => {
			mockInitializeForSession.mockClear();
			mockGetFullContext.mockClear();
			mockInitializeForSession.mockResolvedValue(undefined);
			mockGetFullContext.mockResolvedValue('');
			mockAccess.mockRejectedValue(new Error('File not found')); // Use fallback prompt
		});

		it('should include memory context when available', async () => {
			mockGetFullContext.mockResolvedValue('## Agent Knowledge\nImportant fact');

			const result = await service.buildSystemPromptWithMemory(mockConfig);

			expect(result).toContain('AgentMux Agent');
			expect(result).toContain('Your Knowledge Base');
			expect(result).toContain('Important fact');
			expect(result).toContain('Your Identity');
			expect(result).toContain('Communication');
		});

		it('should return base prompt when memory is empty', async () => {
			mockGetFullContext.mockResolvedValue('');

			const result = await service.buildSystemPromptWithMemory(mockConfig);

			expect(result).toContain('AgentMux Agent');
			expect(result).not.toContain('Your Knowledge Base');
		});

		it('should skip memory when includeMemory is false', async () => {
			mockGetFullContext.mockResolvedValue('## Agent Knowledge\nImportant fact');

			const result = await service.buildSystemPromptWithMemory(mockConfig, { includeMemory: false });

			expect(result).not.toContain('Your Knowledge Base');
			expect(mockInitializeForSession).not.toHaveBeenCalled();
		});

		it('should skip memory when projectPath is missing', async () => {
			const configWithoutProject = { ...mockConfig, projectPath: undefined };
			mockGetFullContext.mockResolvedValue('## Agent Knowledge\nImportant fact');

			const result = await service.buildSystemPromptWithMemory(configWithoutProject);

			expect(result).not.toContain('Your Knowledge Base');
		});

		it('should skip memory when memberId is missing', async () => {
			const configWithoutMember = { ...mockConfig, memberId: undefined };
			mockGetFullContext.mockResolvedValue('## Agent Knowledge\nImportant fact');

			const result = await service.buildSystemPromptWithMemory(configWithoutMember);

			expect(result).not.toContain('Your Knowledge Base');
		});
	});

	describe('buildContinuationPrompt', () => {
		beforeEach(() => {
			mockInitializeForSession.mockClear();
			mockGetFullContext.mockClear();
			mockGenerateSOPContext.mockClear();
			mockInitializeForSession.mockResolvedValue(undefined);
			mockGetFullContext.mockResolvedValue('');
			mockGenerateSOPContext.mockResolvedValue('');
		});

		it('should build continuation prompt with memory context', async () => {
			mockGetFullContext.mockResolvedValue('## Your Knowledge Base\n\nRelevant patterns');

			const result = await service.buildContinuationPrompt(
				'agent-001',
				'developer',
				'/test/project',
				{ title: 'Fix authentication bug', description: 'Users cannot log in' }
			);

			expect(result).toContain('Continue Your Work');
			expect(result).toContain('Fix authentication bug');
			expect(result).toContain('Users cannot log in');
			expect(result).toContain('Your Knowledge Base');
		});

		it('should handle missing memory context', async () => {
			mockGetFullContext.mockResolvedValue('');

			const result = await service.buildContinuationPrompt(
				'agent-001',
				'developer',
				'/test/project',
				{ title: 'Implement feature' }
			);

			expect(result).toContain('Continue Your Work');
			expect(result).toContain('No prior memory context available');
			expect(result).toContain('Implement feature');
		});

		it('should handle task without description', async () => {
			mockGetFullContext.mockResolvedValue('');

			const result = await service.buildContinuationPrompt(
				'agent-001',
				'developer',
				'/test/project',
				{ title: 'Quick fix' }
			);

			expect(result).toContain('**Quick fix**');
			expect(result).not.toMatch(/Quick fix\n\n\n/); // No empty description block
		});

		it('should include SOP context when available', async () => {
			mockGetFullContext.mockResolvedValue('');
			mockGenerateSOPContext.mockResolvedValue('## Standard Operating Procedures\n\n### Git Workflow\nCommit frequently...');

			const result = await service.buildContinuationPrompt(
				'agent-001',
				'developer',
				'/test/project',
				{ title: 'Commit changes', description: 'Committing code changes' }
			);

			expect(result).toContain('Continue Your Work');
			expect(result).toContain('Standard Operating Procedures');
			expect(result).toContain('Git Workflow');
			expect(mockGenerateSOPContext).toHaveBeenCalled();
		});
	});

	describe('buildSOPContext', () => {
		beforeEach(() => {
			mockGenerateSOPContext.mockClear();
			mockGenerateSOPContext.mockResolvedValue('');
		});

		it('should return SOP context when available', async () => {
			mockGenerateSOPContext.mockResolvedValue('## Standard Operating Procedures\n\n### Git Workflow\nFollow these steps...');

			const result = await service.buildSOPContext('developer', 'committing changes');

			expect(result).toContain('Standard Operating Procedures');
			expect(result).toContain('Git Workflow');
			expect(mockGenerateSOPContext).toHaveBeenCalledWith({
				role: 'developer',
				taskContext: 'committing changes',
				taskType: undefined,
				limit: undefined,
			});
		});

		it('should return empty string when no SOPs match', async () => {
			mockGenerateSOPContext.mockResolvedValue('');

			const result = await service.buildSOPContext('developer', 'random context');

			expect(result).toBe('');
		});

		it('should pass taskType to SOP service', async () => {
			mockGenerateSOPContext.mockResolvedValue('## SOPs');

			await service.buildSOPContext('developer', 'testing', 'testing', 3);

			expect(mockGenerateSOPContext).toHaveBeenCalledWith({
				role: 'developer',
				taskContext: 'testing',
				taskType: 'testing',
				limit: 3,
			});
		});

		it('should handle SOP service errors gracefully', async () => {
			mockGenerateSOPContext.mockRejectedValue(new Error('SOP service error'));

			const result = await service.buildSOPContext('developer', 'context');

			expect(result).toBe('');
		});
	});

	describe('buildSystemPromptWithMemory with SOPs', () => {
		const mockConfig: TeamMemberSessionConfig = {
			name: 'test-session',
			role: 'developer',
			projectPath: '/test/project',
			memberId: 'member-123',
			systemPrompt: 'test prompt',
			runtimeType: 'claude-code' as any
		};

		beforeEach(() => {
			mockInitializeForSession.mockClear();
			mockGetFullContext.mockClear();
			mockGenerateSOPContext.mockClear();
			mockInitializeForSession.mockResolvedValue(undefined);
			mockGetFullContext.mockResolvedValue('');
			mockGenerateSOPContext.mockResolvedValue('');
			mockAccess.mockRejectedValue(new Error('File not found')); // Use fallback prompt
		});

		it('should include SOP context when available', async () => {
			mockGenerateSOPContext.mockResolvedValue('## Standard Operating Procedures\n\n### Coding Standards\nUse TypeScript...');

			const result = await service.buildSystemPromptWithMemory(mockConfig, {
				taskContext: 'writing code'
			});

			expect(result).toContain('AgentMux Agent');
			expect(result).toContain('Standard Operating Procedures');
			expect(result).toContain('Coding Standards');
		});

		it('should skip SOPs when includeSOPs is false', async () => {
			mockGenerateSOPContext.mockResolvedValue('## Standard Operating Procedures\n\nSome SOPs...');

			const result = await service.buildSystemPromptWithMemory(mockConfig, { includeSOPs: false });

			expect(result).not.toContain('Standard Operating Procedures');
			expect(mockGenerateSOPContext).not.toHaveBeenCalled();
		});

		it('should include both memory and SOP context', async () => {
			mockGetFullContext.mockResolvedValue('## Agent Knowledge\nImportant fact');
			mockGenerateSOPContext.mockResolvedValue('## Standard Operating Procedures\n\n### Git Workflow\nCommit frequently');

			const result = await service.buildSystemPromptWithMemory(mockConfig, {
				taskContext: 'committing code'
			});

			expect(result).toContain('Your Knowledge Base');
			expect(result).toContain('Important fact');
			expect(result).toContain('Standard Operating Procedures');
			expect(result).toContain('Git Workflow');
		});

		it('should include get_sops in communication tools', async () => {
			mockGenerateSOPContext.mockResolvedValue('## SOPs');

			const result = await service.buildSystemPromptWithMemory(mockConfig);

			expect(result).toContain('get_sops');
		});
	});
});