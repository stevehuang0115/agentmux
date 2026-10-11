/**
 * Team roster service (specs/2026-10-10-team-roster.md).
 *
 * Reads the harness's records, builds the roster with
 * {@link buildRoster}, and keeps the result for a short time so the prompt
 * module, the API and the skills share one build. Every source is read-only
 * and fail-soft: a source that cannot be read leaves that part of the roster
 * empty instead of failing the whole thing.
 *
 * @module services/team-roster/team-roster.service
 */

import { readFile } from 'fs/promises';
import * as path from 'path';
import { SLACK_TEAM_CHANNEL_CONSTANTS, TEAM_ROSTER_CONSTANTS as C } from '../../constants.js';
import type { Project, Team } from '../../types/index.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { StorageService } from '../core/storage.service.js';
import { ProjectTicketService } from '../project-tickets/project-ticket.service.js';
import { TaskPoolService } from '../task-pool/task-pool.service.js';
import {
	buildRoster,
	findOwnersFor,
	renderRoster,
	type OwnerCandidate,
	type RosterTeam,
	type RosterTicket,
	type RosterWorkItem,
} from './team-roster.builder.js';

/** Where the roster reads from; every member is replaceable in tests. */
export interface TeamRosterDeps {
	getTeams: () => Promise<Team[]>;
	getProjects: () => Promise<Project[]>;
	listTickets: (projectPath: string) => Promise<RosterTicket[]>;
	getWorkItems: () => Promise<RosterWorkItem[]>;
	getChannels: () => Promise<Map<string, string>>;
	now: () => Date;
}

/** Read Slack channel names per team from the mapping store. */
async function readChannels(): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	const raw = await readFile(path.join(getCrewlyHomePath(), SLACK_TEAM_CHANNEL_CONSTANTS.STORE_FILENAME), 'utf8');
	const parsed = JSON.parse(raw) as { mappings?: Array<{ teamId?: unknown; slackChannelName?: unknown }> };
	for (const m of parsed.mappings ?? []) {
		if (typeof m.teamId === 'string' && typeof m.slackChannelName === 'string' && m.slackChannelName) out.set(m.teamId, m.slackChannelName);
	}
	return out;
}

/** Production sources. */
function defaultDeps(): TeamRosterDeps {
	return {
		getTeams: () => StorageService.getInstance().getTeams(),
		getProjects: () => StorageService.getInstance().getProjects(),
		listTickets: async (projectPath) => {
			const { tickets } = await ProjectTicketService.getInstance().list(projectPath);
			return tickets.map((t) => ({ id: t.id, title: t.title, status: t.status, assignee: t.assignee, team: t.team, updatedAt: t.updatedAt, priority: t.priority, projectPath }));
		},
		getWorkItems: () => TaskPoolService.getInstance().getAllItems(),
		getChannels: readChannels,
		now: () => new Date(),
	};
}

/**
 * Builds and serves the team roster.
 *
 * @example
 * ```typescript
 * const md = await TeamRosterService.getInstance().renderForPrompt();
 * const hits = await TeamRosterService.getInstance().find('record a promo video for flopost');
 * ```
 */
export class TeamRosterService {
	private static instance: TeamRosterService | null = null;

	private readonly deps: TeamRosterDeps;
	private readonly logger: ComponentLogger;
	private cached: { at: number; teams: RosterTeam[] } | null = null;
	private inflight: Promise<RosterTeam[]> | null = null;

	/**
	 * @param deps - Replacement sources (tests)
	 */
	constructor(deps: Partial<TeamRosterDeps> = {}) {
		this.deps = { ...defaultDeps(), ...deps };
		this.logger = LoggerService.getInstance().createComponentLogger('TeamRosterService');
	}

	/**
	 * Process-wide instance.
	 *
	 * @returns The singleton
	 */
	static getInstance(): TeamRosterService {
		if (!TeamRosterService.instance) TeamRosterService.instance = new TeamRosterService();
		return TeamRosterService.instance;
	}

	/** Reset the singleton (tests). */
	static resetInstance(): void {
		TeamRosterService.instance = null;
	}

	/** Drop the cached roster so the next read rebuilds it (a charter or team changed). */
	invalidate(): void {
		this.cached = null;
	}

	/**
	 * The roster, rebuilt at most once per {@link TEAM_ROSTER_CONSTANTS.CACHE_TTL_MS}.
	 *
	 * @param opts - `fresh` skips the cache
	 * @returns One entry per live team, busiest first
	 */
	async getRoster(opts: { fresh?: boolean } = {}): Promise<RosterTeam[]> {
		const now = this.deps.now().getTime();
		if (!opts.fresh && this.cached && now - this.cached.at < C.CACHE_TTL_MS) return this.cached.teams;
		if (this.inflight) return this.inflight;
		this.inflight = this.build().then(
			(teams) => {
				this.cached = { at: this.deps.now().getTime(), teams };
				this.inflight = null;
				return teams;
			},
			(err) => {
				this.inflight = null;
				throw err;
			},
		);
		return this.inflight;
	}

	/**
	 * The roster as prompt markdown, under the token budget.
	 *
	 * @param maxTokens - Budget (defaults to {@link TEAM_ROSTER_CONSTANTS.PROMPT_MAX_TOKENS})
	 * @returns Markdown, or '' when there are no teams
	 */
	async renderForPrompt(maxTokens: number = C.PROMPT_MAX_TOKENS): Promise<string> {
		return renderRoster(await this.getRoster(), maxTokens);
	}

	/**
	 * Rank teams and members for a request.
	 *
	 * @param request - What the owner asked for
	 * @param limit - Candidates to return
	 * @returns Best first; empty when nothing matches
	 */
	async find(request: string, limit?: number): Promise<OwnerCandidate[]> {
		return findOwnersFor(await this.getRoster(), request, limit);
	}

	/** Read every source and build. */
	private async build(): Promise<RosterTeam[]> {
		const warn = (what: string) => (err: unknown): never[] => {
			this.logger.warn(`Team roster: could not read ${what} — continuing without it`, { error: err instanceof Error ? err.message : String(err) });
			return [];
		};
		const [teams, projects] = await Promise.all([this.deps.getTeams(), this.deps.getProjects().catch(warn('projects'))]);
		// Every project, not only those a team lists: a ticket assigned to an agent
		// belongs to that agent's team even when the team's projectIds is empty.
		const paths = [...new Set(projects.filter((p) => p.path).map((p) => p.path))];
		const [ticketLists, workItems, channels] = await Promise.all([
			Promise.all(paths.map((p) => this.deps.listTickets(p).catch(warn(`tickets of ${p}`)))),
			this.deps.getWorkItems().catch(warn('work items')),
			this.deps.getChannels().catch(() => new Map<string, string>()),
		]);
		return buildRoster({ teams, projects, tickets: ticketLists.flat(), workItems, channels, now: this.deps.now() });
	}
}
