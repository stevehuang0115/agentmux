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
}

/** One team card. */
export interface BoardTeam {
	teamId: string;
	name: string;
	paused?: boolean;
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
}
