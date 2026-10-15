/**
 * Shared parts of the external-conversation layer and its start hook
 * (specs/2026-10-15-embedded-agent.md).
 *
 * The poller and the service share one store and the instance's Crewly Apps
 * Cloud client (the embed endpoints live under `/api/apps/v1/embeds`).
 *
 * @module services/external/external.wiring
 */

import { EXTERNAL_CONSTANTS, ORCHESTRATOR_SESSION_NAME } from '../../constants.js';
import { LoggerService } from '../core/logger.service.js';
import { getAppsParts, type AppsTeamsSource } from '../apps/apps.wiring.js';
import { getActingFor } from '../people/acting-for.service.js';
import { auditExternal } from './external-audit.js';
import { EmbedPollService } from './embed-poll.service.js';
import { ExternalService } from './external.service.js';
import { ExternalStore } from './external-store.js';

/** The layer's parts. */
export interface ExternalParts {
	store: ExternalStore;
	poller: EmbedPollService;
	service: ExternalService;
}

/** Delivers text to an agent, starting it when it is down. */
export type ExternalAgentSender = (session: string, text: string) => Promise<boolean>;

let parts: ExternalParts | null = null;
let sender: ExternalAgentSender | null = null;
let teamsSource: AppsTeamsSource | null = null;
let skillsRoot = '';

/**
 * Agent session names of this instance, for the reply guard.
 *
 * @returns Session names (the orchestrator included)
 */
async function internalSessions(): Promise<string[]> {
	const out = new Set<string>([ORCHESTRATOR_SESSION_NAME]);
	for (const team of (await teamsSource?.()) ?? []) {
		for (const m of team.members ?? []) if (m.sessionName) out.add(m.sessionName);
	}
	return [...out];
}

/**
 * @returns The shared parts (built on first use)
 */
export function getExternalParts(): ExternalParts {
	if (!parts) {
		const logger = LoggerService.getInstance().createComponentLogger('ExternalLayer');
		const store = new ExternalStore();
		const cloud = getAppsParts().client;
		const poller = new EmbedPollService({
			store,
			cloud,
			skillsPath: () => skillsRoot,
			sendToAgent: async (session, text) => (sender ? sender(session, text) : false),
			recordActingFor: (session, personId) => getActingFor().record(session, personId, 'embed'),
			audit: (e) => auditExternal(e),
			warn: (msg, meta) => logger.warn(msg, meta),
		});
		const service = new ExternalService({
			store,
			cloud,
			audit: (e) => auditExternal(e),
			setTyping: (embedId, conversationId, on) => poller.setTyping(embedId, conversationId, on),
			refreshPolling: () => poller.refresh(),
			internalSessions,
		});
		parts = { store, poller, service };
	}
	return parts;
}

/**
 * Replace the parts (tests), or null to rebuild lazily.
 *
 * @param next - Parts or null
 */
export function setExternalParts(next: ExternalParts | null): void {
	parts = next;
}

/** Inputs of {@link startExternalLayer}. */
export interface StartExternalInput {
	/** Agent skills root (`config/skills/agent`) */
	skillsPath: string;
	sendToAgent: ExternalAgentSender;
	getTeams: AppsTeamsSource;
}

/**
 * Start polling the attached embeds. Off when `CREWLY_EXTERNAL=0`.
 *
 * @param input - Delivery to agents, teams for the guard
 * @returns True when started
 */
export function startExternalLayer(input: StartExternalInput): boolean {
	if (process.env[EXTERNAL_CONSTANTS.ENV_SWITCH] === '0') return false;
	sender = input.sendToAgent;
	teamsSource = input.getTeams;
	skillsRoot = input.skillsPath;
	getExternalParts().poller.start();
	return true;
}

/** Stop polling (shutdown). */
export function stopExternalLayer(): void {
	parts?.poller.stop();
}
