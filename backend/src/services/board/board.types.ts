/**
 * Owner Board wire types (crewly#1247). Mirrors the shared contract
 * `CONTRACT.md`; change both together. Pure types.
 *
 * @module services/board/board.types
 */

import type { AgentCapabilities, StepEvent } from './canvas/canvas.types.js';

/** What an agent is doing right now. */
export type BoardActivityType = 'coding' | 'browsing' | 'command' | 'writing' | 'messaging' | 'waiting_owner' | 'thinking' | 'other';

/** Agent row state. */
export type BoardAgentState = 'working' | 'waiting' | 'idle' | 'stopped' | 'error' | 'queued';

/** One agent's current activity. `detail` is a path / host+path / command name / channel, never contents. */
export interface BoardActivity {
	type: BoardActivityType;
	detail: string;
	/** ISO */
	since: string;
}

/** A project an agent or team works in. */
export interface BoardProjectRef {
	id: string;
	name: string;
}

/** What a link between two agents means (CANVAS-V2-CONTRACT.md). */
export type BoardLinkKind = 'reports_to' | 'delegated' | 'messaging' | 'same_task';

/**
 * A line on the canvas. `from` / `to` are sessions; an agent on another
 * machine is `<session>@<instanceId>`. Identity = {@link linkKey}.
 */
export interface BoardLink {
	from: string;
	to: string;
	kind: BoardLinkKind;
	active: boolean;
	/** ISO */
	since: string;
	/** Ticket id / title, scrubbed, at most 60 characters */
	label?: string;
	weight?: number;
}

/**
 * The identity of a link.
 *
 * @param link - Link (or its identity parts)
 * @returns `kind|from|to`
 */
export function linkKey(link: Pick<BoardLink, 'kind' | 'from' | 'to'>): string {
	return `${link.kind}|${link.from}|${link.to}`;
}

/** One agent row. */
export interface BoardAgent {
	session: string;
	name: string;
	role: string;
	runtime: string;
	model?: string;
	state: BoardAgentState;
	activity?: BoardActivity;
	task?: { id?: string; title: string; since: string };
	lastAction?: { text: string; at: string };
	todayUsd?: number;
	todayTokens?: number;
	/** What the owner can do with this agent from the canvas (crewly#1247 v2) */
	capabilities?: AgentCapabilities;
	/** The project the agent is on now (single element, `projectKnown`), else its team's projects */
	projects?: BoardProjectRef[];
	/** `projects` is the agent's own current project, not the team fallback */
	projectKnown?: boolean;
	/** Last time the agent was busy or took a step (ISO) */
	lastActiveAt?: string;
}

/** One team card. */
export interface BoardTeam {
	teamId: string;
	name: string;
	paused?: boolean;
	/** Projects the team is assigned to */
	projects?: BoardProjectRef[];
	agents: BoardAgent[];
}

/** One timeline event (plain words, already redacted). */
export interface BoardTimelineEvent {
	session: string;
	at: string;
	type: BoardActivityType;
	text: string;
}

export interface BoardDoneItem {
	ticketId?: string;
	title: string;
	result: string;
	team: string;
	agent?: string;
	at: string;
}

export type BoardWaitingKind = 'decision' | 'review' | 'approval' | 'reconnect' | 'question';

export interface BoardWaitingItem {
	id: string;
	kind: BoardWaitingKind;
	title: string;
	team?: string;
	agent?: string;
	since: string;
	action?: { label: string; url?: string };
}

export interface BoardStuckItem {
	id: string;
	title: string;
	team?: string;
	agent?: string;
	since: string;
	on: 'owner' | 'agent' | 'external' | 'system';
	reason: string;
}

export interface BoardSpend {
	todayUsd: number;
	weekUsd: number;
	todayTokens: number;
	weekTokens: number;
	ownerMinutesToday?: number;
	ownerMinutesWeek?: number;
}

/** The full snapshot (`POST /api/cloud/board/snapshot`, `GET /api/board`). */
export interface BoardSnapshot {
	v: 1;
	instanceId: string;
	machineName: string;
	crewlyVersion: string;
	generatedAt: string;
	outcomes: {
		doneToday: BoardDoneItem[];
		doneTodaySummary: string[];
		waitingOnOwner: BoardWaitingItem[];
		stuck: BoardStuckItem[];
		spend: BoardSpend;
	};
	teams: BoardTeam[];
	/** Reporting and collaboration lines: the full current set (CANVAS-V2-CONTRACT.md) */
	links?: BoardLink[];
}

/** Changed agent rows (`POST /api/cloud/board/delta`). */
export interface BoardDelta {
	v: 1;
	instanceId: string;
	generatedAt: string;
	agents: Array<BoardAgent & { teamId: string }>;
	timeline?: BoardTimelineEvent[];
	/** Canvas step stream: new steps and steps whose status changed (same `id`, upsert) */
	steps?: StepEvent[];
	/** Links that are new or changed (upsert by {@link linkKey}) */
	links?: BoardLink[];
	/** Identities of links that ended */
	removedLinks?: string[];
}
