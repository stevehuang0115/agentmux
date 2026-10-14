/**
 * Production pieces of the canvas that need the running machine (crewly#1247
 * v2): where an agent's transcript is, how an owner stop is done, which
 * secrets to mask. Kept out of `index.ts`; each takes its collaborators, so
 * each is tested with fakes.
 *
 * @module services/board/canvas/canvas-wiring
 */

import { CANVAS_CONSTANTS, ORCHESTRATOR_SESSION_NAME, RUNTIME_TYPES } from '../../../constants.js';
import { collectSecretEnvValues, type SecretEnvValue } from '../../../utils/secret-env.js';
import { resolveMemberSessionName } from '../../../utils/member-session-name.utils.js';
import type { AgentCapabilities } from './canvas.types.js';
import type { TailTarget } from './canvas-transcript.tail.js';

/** What the session registry knows about an agent's runtime conversation. */
export interface SessionMeta {
	runtimeType?: string;
	claudeSessionId?: string;
	cwd?: string;
	env?: Record<string, string | undefined>;
}

/** Collaborators of {@link createTranscriptLocator}. */
export interface TranscriptLocatorDeps {
	meta: (session: string) => SessionMeta | undefined;
	/** Claude Code homes to look in (the session's CLAUDE_CONFIG_DIR first) */
	claudeHomes: (meta: SessionMeta) => string[];
	findClaude: (args: { sessionId: string; cwd: string; claudeHomes: readonly string[] }) => string | null;
	codexHome: () => string;
	findCodex: (codexHome: string, conversationId: string) => Promise<string | null>;
}

/**
 * Where an agent's transcript is: a Claude Code conversation file or a Codex
 * rollout. Gemini and agy keep none the canvas can read.
 *
 * @param deps - Session registry and the runtimes' finders
 * @returns Locator for {@link TranscriptTailService}
 */
export function createTranscriptLocator(deps: TranscriptLocatorDeps): (session: string) => Promise<TailTarget | null> {
	return async (session) => {
		const meta = deps.meta(session);
		if (!meta?.claudeSessionId) return null;
		if (meta.runtimeType === RUNTIME_TYPES.CLAUDE_CODE) {
			if (!meta.cwd) return null;
			const file = deps.findClaude({ sessionId: meta.claudeSessionId, cwd: meta.cwd, claudeHomes: deps.claudeHomes(meta) });
			return file ? { kind: 'claude', file } : null;
		}
		if (meta.runtimeType === RUNTIME_TYPES.CODEX_CLI) {
			const file = await deps.findCodex(deps.codexHome(), meta.claudeSessionId);
			return file ? { kind: 'codex', file } : null;
		}
		return null;
	};
}

/** Secret values of the backend's environment, recomputed at most once a minute. */
export function createSecretsProvider(env: () => NodeJS.ProcessEnv = () => process.env, ttlMs = 60_000, now: () => number = Date.now): () => SecretEnvValue[] {
	let cache: { at: number; values: SecretEnvValue[] } | null = null;
	return () => {
		const t = now();
		if (!cache || t - cache.at > ttlMs) cache = { at: t, values: collectSecretEnvValues(env()) };
		return cache.values;
	};
}

/** A team as the stop needs it. */
export interface StopTeam {
	id: string;
	name: string;
	members: Array<{ id: string; name: string; sessionName?: string; agentId?: string }>;
}

/** Collaborators of {@link createStopAgent}. */
export interface StopAgentDeps {
	webPort: number;
	teams: () => Promise<StopTeam[]>;
	/** Credentials of the owner's own calls (relay credential + API token) */
	headers: () => Record<string, string>;
	fetchImpl?: typeof fetch;
}

/**
 * Stop an agent the way the dashboard does: `POST /api/teams/:teamId/members/:memberId/stop`
 * on the local API, with the relay's owner credential.
 *
 * @param deps - Teams, port, credentials
 * @returns Stop function
 */
export function createStopAgent(deps: StopAgentDeps): (session: string) => Promise<{ ok: boolean; error?: string }> {
	const doFetch = deps.fetchImpl ?? fetch;
	return async (session) => {
		const teams = await deps.teams();
		for (const team of teams) {
			for (const member of team.members) {
				if (!member?.id) continue;
				let name: string;
				try {
					name = resolveMemberSessionName(team.name, member);
				} catch {
					continue;
				}
				if (name !== session) continue;
				try {
					const res = await doFetch(`http://127.0.0.1:${deps.webPort}/api/teams/${encodeURIComponent(team.id)}/members/${encodeURIComponent(member.id)}/stop`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', ...deps.headers() },
						body: '{}',
					});
					if (res.ok) return { ok: true };
					const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
					return { ok: false, error: typeof body?.error === 'string' ? body.error : `HTTP ${res.status}` };
				} catch (error) {
					return { ok: false, error: error instanceof Error ? error.message : String(error) };
				}
			}
		}
		return { ok: false, error: 'No such team member' };
	};
}

/** The remote-browser session of an agent, as far as capabilities need it. */
export interface BrowserSessionLike {
	id: string;
	status: string;
	lastActionAt: number;
}

/** Collaborators of {@link computeCapabilities}. */
export interface CapabilityDeps {
	browserSession: (session: string) => BrowserSessionLike | undefined;
	terminalExists: (session: string) => boolean;
}

/**
 * What the owner can do with an agent from the canvas.
 *
 * - browser: the agent's Chrome-extension session (the existing remote-browser
 *   session id) while it is live. Headless Playwright runs inside the agent's
 *   own runtime as an MCP child process the harness has no handle on, so no
 *   `headless` browser is ever offered;
 * - terminal: the agent has a live PTY session;
 * - message: every agent (a sleeping one is woken by the message);
 * - stop: every running agent except the orchestrator.
 *
 * @param session - Agent session
 * @param info - Whether the agent is stopped, and the time
 * @param deps - Browser sessions and the PTY backend
 * @returns Capabilities
 */
export function computeCapabilities(session: string, info: { stopped: boolean; now: number }, deps: CapabilityDeps): AgentCapabilities {
	const browser = deps.browserSession(session);
	const browserLive = !!browser && browser.status !== 'done' && browser.status !== 'stopped' && info.now - browser.lastActionAt <= CANVAS_CONSTANTS.BROWSER_ACTIVE_MS;
	let hasTerminal = false;
	try {
		hasTerminal = !info.stopped && deps.terminalExists(session);
	} catch {
		hasTerminal = false;
	}
	return {
		hasBrowser: browserLive,
		...(browserLive && browser ? { browserKind: 'chrome' as const, browserSessionId: browser.id } : {}),
		hasTerminal,
		canMessage: true,
		canStop: !info.stopped && session !== ORCHESTRATOR_SESSION_NAME,
	};
}
