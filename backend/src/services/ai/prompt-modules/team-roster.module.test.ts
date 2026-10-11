import { TeamRosterModule } from './team-roster.module.js';
import { PromptAssemblyService } from './prompt-assembly.service.js';
import type { ModuleConfig } from './prompt-module.interface.js';
import { TEAM_ROSTER_CONSTANTS } from '../../../constants.js';

const config = (role: string): ModuleConfig =>
	({ sessionName: 'crewly-orc', memberId: '', role, agentSkillsPath: '/s/agent', tlSkillsPath: '/s/tl', projectRoot: process.cwd() }) as ModuleConfig;

describe('TeamRosterModule', () => {
	it('is included for the orchestrator only', () => {
		const m = new TeamRosterModule({ renderForPrompt: jest.fn() });
		expect(m.shouldInclude(config('orchestrator'))).toBe(true);
		expect(m.shouldInclude(config('team-leader'))).toBe(false);
		expect(m.shouldInclude(config('developer'))).toBe(false);
	});

	it('renders the roster the service builds', async () => {
		const render = jest.fn(async () => '## Team Roster\n### CE');
		expect(await new TeamRosterModule({ renderForPrompt: render }).build(config('orchestrator'))).toBe('## Team Roster\n### CE');
	});

	it('yields nothing, not an error, when the roster cannot be built', async () => {
		const render = jest.fn(async () => { throw new Error('boom'); });
		expect(await new TeamRosterModule({ renderForPrompt: render }).build(config('orchestrator'))).toBe('');
	});

	it('sits after the startup state and carries the prompt budget', () => {
		const m = new TeamRosterModule({ renderForPrompt: jest.fn() });
		expect(m.priority).toBeGreaterThan(1.7);
		expect(m.priority).toBeLessThan(2);
		expect(m.maxTokens).toBe(TEAM_ROSTER_CONSTANTS.PROMPT_MAX_TOKENS);
	});

	it('is part of the default assembly and appears in the orchestrator prompt only', async () => {
		const assembler = new PromptAssemblyService();
		assembler.removeModule('team-roster');
		assembler.addModule(new TeamRosterModule({ renderForPrompt: async () => '## Team Roster\n### CE — lead Owen' }));
		const orc = await assembler.assemble(config('orchestrator'));
		expect(orc.prompt).toContain('### CE — lead Owen');
		const dev = await assembler.assemble(config('developer'));
		expect(dev.prompt).not.toContain('### CE — lead Owen');
		expect(new PromptAssemblyService().getModules().map((x) => x.name)).toContain('team-roster');
	});
});
