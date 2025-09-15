import { resolveStepPrompts, type StepConfig } from './prompt-resolver.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

// Mock fs/promises and fs
jest.mock('fs/promises');
jest.mock('fs');

const mockReadFile = jest.mocked(readFile);
const mockExistsSync = jest.mocked(existsSync);

describe('PromptResolver', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	describe('resolveStepPrompts', () => {
		it('should load prompts from markdown file with correct path structure', async () => {
			const mockContent = `# Test Prompt

This is a test prompt for {PROJECT_NAME}.

## Requirements
- Build the {FEATURE_NAME} component
- Use TypeScript`;

			mockExistsSync.mockReturnValue(true);
			mockReadFile.mockResolvedValue(mockContent);

			const step: StepConfig = {
				id: 1,
				name: 'Test Step',
				targetRole: 'developer',
				prompt_file: 'config/task_starters/prompts/build_spec_step1.md'
			};

			const projectVars = {
				PROJECT_NAME: 'AgentMux',
				FEATURE_NAME: 'TaskManager'
			};

			const result = await resolveStepPrompts(step, projectVars);

			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining('config/task_starters/prompts/build_spec_step1.md'),
				'utf-8'
			);
			expect(result).toHaveLength(1);
			expect(result[0]).toContain('AgentMux');
			expect(result[0]).toContain('TaskManager');
		});

		it('should handle orchestrator tasks prompts path correctly', async () => {
			const mockContent = 'Orchestrator prompt content';
			mockExistsSync.mockReturnValue(true);
			mockReadFile.mockResolvedValue(mockContent);

			const step: StepConfig = {
				id: 1,
				name: 'Orchestrator Step',
				targetRole: 'orchestrator',
				prompt_file: 'config/orchestrator_tasks/prompts/orchestrator-prompt.md'
			};

			await resolveStepPrompts(step);

			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining('config/orchestrator_tasks/prompts/orchestrator-prompt.md'),
				'utf-8'
			);
		});

		it('should handle teams prompts path correctly', async () => {
			const mockContent = 'Team member prompt content';
			mockExistsSync.mockReturnValue(true);
			mockReadFile.mockResolvedValue(mockContent);

			const step: StepConfig = {
				id: 1,
				name: 'Team Member Step',
				targetRole: 'developer',
				prompt_file: 'config/teams/prompts/fullstack-dev-prompt.md'
			};

			await resolveStepPrompts(step);

			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining('config/teams/prompts/fullstack-dev-prompt.md'),
				'utf-8'
			);
		});

		it('should fall back to inline prompts array when no prompt_file', async () => {
			const step: StepConfig = {
				id: 1,
				name: 'Inline Step',
				targetRole: 'developer',
				prompts: ['First prompt', 'Second prompt with {VAR}']
			};

			const projectVars = { VAR: 'replaced_value' };

			const result = await resolveStepPrompts(step, projectVars);

			expect(mockReadFile).not.toHaveBeenCalled();
			expect(result).toEqual(['First prompt', 'Second prompt with replaced_value']);
		});

		it('should handle template variable replacement correctly', async () => {
			const mockContent = `# {PROJECT_NAME} Specification

Build a {COMPONENT_TYPE} for {PROJECT_NAME}.

Variables:
- Project: {PROJECT_NAME}
- Component: {COMPONENT_TYPE}
- Author: {AUTHOR}`;

			mockExistsSync.mockReturnValue(true);
			mockReadFile.mockResolvedValue(mockContent);

			const step: StepConfig = {
				id: 1,
				name: 'Template Step',
				targetRole: 'developer',
				prompt_file: 'config/task_starters/prompts/template_test.md'
			};

			const projectVars = {
				PROJECT_NAME: 'AgentMux',
				COMPONENT_TYPE: 'Service',
				AUTHOR: 'AI Assistant'
			};

			const result = await resolveStepPrompts(step, projectVars);

			expect(result[0]).toContain('# AgentMux Specification');
			expect(result[0]).toContain('Build a Service for AgentMux');
			expect(result[0]).toContain('- Project: AgentMux');
			expect(result[0]).toContain('- Component: Service');
			expect(result[0]).toContain('- Author: AI Assistant');
		});
	});
});