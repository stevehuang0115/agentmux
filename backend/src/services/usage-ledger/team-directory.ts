/**
 * Which team and project an agent session belongs to, read from the team
 * configs under CREWLY_HOME (`teams/<id>/config.json`, `projects.json`).
 * Cached; a stale cache is refreshed in the background so hot paths stay
 * synchronous and cheap.
 *
 * @module services/usage-ledger/team-directory
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';

/** Team and project of a session. */
export interface TeamInfo {
	team?: string;
	project?: string;
}

/** What the ledger asks of a directory. */
export interface TeamLookup {
	/** Team / project of an agent session (sync, from cache) */
	lookup(session: string): TeamInfo | null;
	/** Project name for a project id */
	projectName(projectId: string): string | undefined;
	/** Wait until the cache has been loaded at least once */
	ready(): Promise<void>;
}

/** How long a loaded cache is trusted. */
const TTL_MS = 60_000;

/** The orchestrator's session is not in any team. */
const ORCHESTRATOR_SESSION = /^crewly-orc(?:$|-)/;

interface TeamConfig {
	name?: string;
	projectIds?: string[];
	members?: Array<{ sessionName?: string; agentId?: string }>;
}

interface ProjectConfig {
	id?: string;
	name?: string;
}

/**
 * Reads team and project names from disk.
 */
export class TeamDirectory implements TeamLookup {
	private sessions = new Map<string, TeamInfo>();
	private projects = new Map<string, string>();
	private loadedAt = 0;
	private loading: Promise<void> | null = null;

	/**
	 * @param home - Crewly home (default CREWLY_HOME)
	 * @param now - Clock (ms)
	 */
	constructor(
		private readonly home: string = getCrewlyHomePath(),
		private readonly now: () => number = () => Date.now(),
	) {}

	lookup(session: string): TeamInfo | null {
		if (this.now() - this.loadedAt > TTL_MS) void this.refresh();
		if (ORCHESTRATOR_SESSION.test(session)) return { team: 'Orchestrator' };
		return this.sessions.get(session) ?? null;
	}

	projectName(projectId: string): string | undefined {
		return this.projects.get(projectId);
	}

	async ready(): Promise<void> {
		if (this.loadedAt === 0) await this.refresh();
		else if (this.loading) await this.loading;
	}

	/**
	 * Reload the cache (one load at a time).
	 */
	refresh(): Promise<void> {
		if (!this.loading) {
			this.loading = this.load()
				.catch(() => undefined)
				.finally(() => {
					this.loading = null;
				});
		}
		return this.loading;
	}

	private async load(): Promise<void> {
		const projects = new Map<string, string>();
		try {
			const list = JSON.parse(await fs.readFile(path.join(this.home, 'projects.json'), 'utf-8')) as ProjectConfig[];
			for (const p of Array.isArray(list) ? list : []) if (p?.id && p.name) projects.set(p.id, p.name);
		} catch {
			// no projects file
		}
		const sessions = new Map<string, TeamInfo>();
		try {
			const teamsDir = path.join(this.home, 'teams');
			for (const entry of await fs.readdir(teamsDir, { withFileTypes: true })) {
				if (!entry.isDirectory()) continue;
				try {
					const team = JSON.parse(await fs.readFile(path.join(teamsDir, entry.name, 'config.json'), 'utf-8')) as TeamConfig;
					if (!team?.name) continue;
					const project = team.projectIds?.map((id) => projects.get(id)).find((n): n is string => !!n);
					const info: TeamInfo = { team: team.name, ...(project ? { project } : {}) };
					for (const m of team.members ?? []) {
						if (m.sessionName) sessions.set(m.sessionName, info);
						if (m.agentId) sessions.set(m.agentId, info);
					}
				} catch {
					// unreadable team
				}
			}
		} catch {
			// no teams dir
		}
		this.sessions = sessions;
		this.projects = projects;
		this.loadedAt = this.now();
	}
}
