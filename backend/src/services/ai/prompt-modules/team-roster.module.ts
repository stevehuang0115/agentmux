import { PromptModule, ModuleConfig } from './prompt-module.interface.js';
import { ORCHESTRATOR_ROLE, TEAM_ROSTER_CONSTANTS } from '../../../constants.js';
import { TeamRosterService } from '../../team-roster/team-roster.service.js';
import { LoggerService, type ComponentLogger } from '../../core/logger.service.js';

/**
 * Team roster module (specs/2026-10-10-team-roster.md) — orchestrator only.
 *
 * Tells the orchestrator which team owns what: charter, members with roles
 * and specialties, projects, channel, and what each team is working on now
 * and finished this week. Built by the harness from live records (no LLM),
 * capped at `PROMPT_MAX_TOKENS`, so an owner request that names nobody can be
 * routed without asking. It is re-read on every orchestrator registration,
 * which includes restarts and fresh-conversation handovers.
 *
 * Priority 1.8: right after Standing Answers (1.7), before the soul.
 * Compactable because the `team-roster` skill returns the same content on
 * demand; its own cap keeps it far inside `maxTokens`.
 * Fail-soft: any error yields '' rather than breaking assembly.
 */
export class TeamRosterModule implements PromptModule {
	name = 'team-roster';
	priority = 1.8;
	maxTokens = TEAM_ROSTER_CONSTANTS.PROMPT_MAX_TOKENS;
	compactable = true;

	private readonly logger: ComponentLogger;

	/**
	 * @param service - Roster source (injectable for tests)
	 */
	constructor(private readonly service: Pick<TeamRosterService, 'renderForPrompt'> = TeamRosterService.getInstance()) {
		this.logger = LoggerService.getInstance().createComponentLogger('TeamRosterModule');
	}

	/**
	 * Only the orchestrator routes owner requests.
	 *
	 * @param config - Module configuration
	 * @returns true for the orchestrator role
	 */
	shouldInclude(config: ModuleConfig): boolean {
		return config.role === ORCHESTRATOR_ROLE;
	}

	/**
	 * Render the roster.
	 *
	 * @param config - Module configuration (session name for logs)
	 * @returns Section markdown, or '' when there are no teams or reading fails
	 */
	async build(config: ModuleConfig): Promise<string> {
		try {
			return await this.service.renderForPrompt();
		} catch (err) {
			this.logger.warn('Team roster could not be built — skipping', {
				sessionName: config.sessionName,
				error: err instanceof Error ? err.message : String(err),
			});
			return '';
		}
	}
}
