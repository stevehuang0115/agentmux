/**
 * CanvasInboundService - the machine side of the owner actions on the Crewly
 * Canvas (crewly#1247 v2).
 *
 * The owner uses the canvas in the Crewly Cloud portal: message an agent, stop
 * an agent, open / renew / close an agent's terminal. Cloud stores the action
 * and pushes a `canvas_action` relay message with only ids in it
 * (`{actionId, instanceId, session, kind}`) - the same secure pattern as Cloud
 * Talk and "waiting on you". This service:
 *
 *  1. checks the push is for this machine and names an agent that exists here;
 *  2. fetches the action from Cloud with this machine's own token
 *     (`GET /api/cloud/canvas/actions/:actionId?instanceId=`). Cloud answers
 *     only for an action stored by the OWNER of the token's account for this
 *     machine, so a push anybody else dropped in the relay queue (or one from a
 *     member / guest of the account) is never run; the fetched ids and kind
 *     must match the push;
 *  3. runs it: a message is recorded in the agent's DM as an owner message and
 *     handed to the agent exactly like a Talk / Crewly Chat message (replies
 *     route as usual); a stop is the dashboard's stop; terminal actions drive
 *     {@link CanvasTerminalService};
 *  4. reports the result (`POST .../actions/:actionId/result`).
 *
 * Idempotent: an action carried out is not run again when Cloud re-pushes it
 * (it only re-reports); a message is also keyed by `clientMessageId` in the DM.
 *
 * Older OSS versions ignore `canvas_action` (every relay listener filters on
 * its own `type`), and Cloud only sends it to machines advertising the
 * `canvas_actions` capability, which this service turns on when it starts.
 *
 * @module services/board/canvas/canvas-inbound.service
 */

import { CANVAS_CONSTANTS, ORCHESTRATOR_SESSION_NAME, SLACK_AGENT_DM_CONSTANTS } from '../../../constants.js';
import { LoggerService, type ComponentLogger } from '../../core/logger.service.js';
import { recordCloudTalkTurn } from '../../chat-v2/owner-inbound.utils.js';
import type { ChatChannelDTO, ChatMessageDTO } from '../../chat-v2/types.js';
import type { IncomingMessage } from '../../cloud/cloud-sync.types.js';
import type { CloudTalkCloud, CloudTalkFetch, CloudTalkInboundChat, CloudTalkSource } from '../../cloud/cloud-talk-inbound.service.js';
import type { CanvasTerminalService } from './canvas-terminal.service.js';
import type {
	CanvasActionFetchResponse,
	CanvasActionKind,
	CanvasActionRelayData,
	CanvasActionResultRequest,
} from './canvas.types.js';

const C = CANVAS_CONSTANTS;

/** Session names; `@` only for the orchestrator spelled per machine (`crewly-orc@<instance>`). */
const SESSION_PATTERN = /^[A-Za-z0-9._@-]{1,128}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isKind = (v: unknown): v is CanvasActionKind => typeof v === 'string' && (C.ACTION_KINDS as readonly string[]).includes(v);

/**
 * Validate the relay push. Never throws.
 *
 * @param raw - `msg.payload`
 * @returns The ids, or null when malformed
 */
export function parseCanvasRelayData(raw: unknown): CanvasActionRelayData | null {
	if (!isRecord(raw)) return null;
	const { actionId, instanceId, session, kind } = raw;
	if (typeof actionId !== 'string' || !ID_PATTERN.test(actionId)) return null;
	if (typeof instanceId !== 'string' || instanceId.length === 0 || instanceId.length > 128) return null;
	if (typeof session !== 'string' || !SESSION_PATTERN.test(session)) return null;
	if (!isKind(kind)) return null;
	return { actionId, instanceId, session, kind };
}

/**
 * Validate Cloud's answer to the action fetch (`{success, data: {...}}`). Never throws.
 *
 * @param raw - Parsed JSON body
 * @returns The action, or null when unusable
 */
export function parseCanvasFetchResponse(raw: unknown): CanvasActionFetchResponse | null {
	const data = isRecord(raw) && isRecord(raw['data']) ? raw['data'] : null;
	if (!data) return null;
	const { actionId, instanceId, session, kind, text, clientMessageId } = data;
	if (typeof actionId !== 'string' || !ID_PATTERN.test(actionId)) return null;
	if (typeof instanceId !== 'string' || !instanceId) return null;
	if (typeof session !== 'string' || !SESSION_PATTERN.test(session)) return null;
	if (!isKind(kind)) return null;
	return {
		actionId,
		instanceId,
		session,
		kind,
		...(typeof text === 'string' ? { text } : {}),
		...(typeof clientMessageId === 'string' && ID_PATTERN.test(clientMessageId) ? { clientMessageId } : {}),
	};
}

/** Constructor dependencies. */
export interface CanvasInboundDeps {
	source: CloudTalkSource;
	cloud: CloudTalkCloud;
	chat: CloudTalkInboundChat;
	identity: () => Promise<{ instanceId: string; deviceName?: string }>;
	/** Hand the recorded message to the agent (ticket intake + dispatcher), as Cloud Talk does. */
	deliver: (channel: ChatChannelDTO, message: ChatMessageDTO) => Promise<void>;
	/** Whether the agent exists on this machine */
	agentExists: (session: string) => Promise<boolean>;
	/** Stop the agent (the dashboard's stop). */
	stopAgent: (session: string) => Promise<{ ok: boolean; error?: string }>;
	terminal: Pick<CanvasTerminalService, 'open' | 'renew' | 'close'>;
	/** An owner action arrived: someone is watching */
	onAction?: () => void;
	ownerUserId?: string;
	fetchImpl?: CloudTalkFetch;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	logger?: ComponentLogger;
}

/** What {@link CanvasInboundService.handle} did (tests, logs). */
export type CanvasActionOutcome =
	| 'done'
	| 'refused'
	| 'duplicate'
	| 'ignored'
	| 'not_for_this_machine'
	| 'unverified'
	| 'fetch_failed';

type FetchOutcome = { kind: 'ok'; action: CanvasActionFetchResponse } | { kind: 'not_found' } | { kind: 'expired' } | { kind: 'error'; error: string };

let active = false;

/**
 * Capabilities to advertise to Cloud (heartbeat and uploads).
 *
 * @returns `['canvas_actions']` while the handler runs, else `[]`
 */
export function canvasCapabilities(): string[] {
	return active ? [C.CAPABILITY] : [];
}

/** Runs the owner's canvas actions pushed from Crewly Cloud - see module docs. */
export class CanvasInboundService {
	private readonly logger: ComponentLogger;
	private readonly fetchImpl: CloudTalkFetch;
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly now: () => number;
	private readonly ownerUserId: string;
	private readonly inFlight = new Set<string>();
	private readonly done = new Map<string, { at: number; result: CanvasActionResultRequest }>();
	private readonly listener = (msg: IncomingMessage): void => {
		void this.handle(msg);
	};
	private started = false;

	constructor(private readonly deps: CanvasInboundDeps) {
		this.logger = deps.logger ?? LoggerService.getInstance().createComponentLogger('CanvasInbound');
		this.fetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init));
		this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
		this.now = deps.now ?? Date.now;
		this.ownerUserId = deps.ownerUserId ?? SLACK_AGENT_DM_CONSTANTS.OWNER_USER_ID;
	}

	/** Subscribe to relay messages and advertise the capability. Idempotent. */
	start(): void {
		if (this.started) return;
		this.started = true;
		this.deps.source.on('message', this.listener);
		active = true;
		this.logger.info('Canvas action handler started');
	}

	/** Unsubscribe; the capability is no longer advertised. */
	stop(): void {
		if (!this.started) return;
		this.started = false;
		this.deps.source.off('message', this.listener);
		active = false;
	}

	/**
	 * Handle one relay message. Anything but a well-formed `canvas_action` is
	 * ignored. Never throws.
	 *
	 * @param msg - Relay message from CloudSyncService
	 * @returns What was done
	 */
	async handle(msg: IncomingMessage): Promise<CanvasActionOutcome> {
		if (msg?.type !== C.RELAY_MESSAGE_TYPE) return 'ignored';
		const data = parseCanvasRelayData(msg.payload);
		if (!data) {
			this.logger.warn('Ignored a malformed canvas_action relay message');
			return 'ignored';
		}
		if (this.inFlight.has(data.actionId)) return 'duplicate';
		this.inFlight.add(data.actionId);
		try {
			return await this.process(data);
		} catch (error) {
			this.logger.warn('Canvas action failed', { actionId: data.actionId, error: error instanceof Error ? error.message : String(error) });
			return 'fetch_failed';
		} finally {
			this.inFlight.delete(data.actionId);
		}
	}

	private async process(data: CanvasActionRelayData): Promise<CanvasActionOutcome> {
		const { instanceId, deviceName } = await this.deps.identity();
		if (data.instanceId !== instanceId) {
			this.logger.warn('Ignored a canvas_action addressed to another machine', { target: data.instanceId });
			return 'not_for_this_machine';
		}
		this.pruneDone();
		const earlier = this.done.get(data.actionId);
		if (earlier) {
			await this.report(data.actionId, earlier.result);
			return 'duplicate';
		}

		const fetched = await this.fetchAction(data, instanceId);
		if (fetched.kind === 'not_found') {
			// Not an action the account's owner stored for this machine: not from Cloud
			this.logger.warn('Ignored a canvas_action Crewly Cloud does not know for this machine', { actionId: data.actionId });
			return 'unverified';
		}
		if (fetched.kind === 'expired') return 'duplicate';
		if (fetched.kind === 'error') {
			this.logger.warn('Could not fetch a canvas action; Cloud will push it again', { actionId: data.actionId, error: fetched.error });
			return 'fetch_failed';
		}
		const action = fetched.action;
		if (action.actionId !== data.actionId || action.instanceId !== instanceId || action.session !== data.session || action.kind !== data.kind) {
			this.logger.warn('Ignored a canvas_action that does not match what Cloud stored', { actionId: data.actionId });
			return 'unverified';
		}

		this.deps.onAction?.();
		const device = deviceName || 'this machine';
		const session = action.session.startsWith(`${ORCHESTRATOR_SESSION_NAME}@`) ? ORCHESTRATOR_SESSION_NAME : action.session;
		let result: CanvasActionResultRequest;
		if (!(await this.deps.agentExists(session))) {
			result = { instanceId, ok: false, code: 'no_agent', error: `No agent named "${session}" on ${device}` };
		} else {
			result = await this.run(action, session, instanceId, device);
		}
		this.done.set(data.actionId, { at: this.now(), result });
		await this.report(data.actionId, result);
		return result.ok ? 'done' : 'refused';
	}

	private async run(action: CanvasActionFetchResponse, session: string, instanceId: string, device: string): Promise<CanvasActionResultRequest> {
		const fail = (code: string, error: string): CanvasActionResultRequest => ({ instanceId, ok: false, code, error });
		switch (action.kind) {
			case 'message': {
				const text = (action.text ?? '').trim();
				if (!text) return fail('empty', 'The message is empty');
				if (text.length > C.MESSAGE_MAX) return fail('too_long', `The message is longer than ${C.MESSAGE_MAX} characters`);
				let recorded: ReturnType<typeof recordCloudTalkTurn>;
				try {
					recorded = recordCloudTalkTurn(this.deps.chat, {
						agentSession: session,
						text,
						clientMessageId: action.clientMessageId ?? `canvas-${action.actionId}`,
						ownerUserId: this.ownerUserId,
					});
				} catch (error) {
					return fail('record_failed', `Could not record the message on ${device}: ${error instanceof Error ? error.message : String(error)}`);
				}
				if (recorded.deduped) return { instanceId, ok: true };
				try {
					const channel = this.deps.chat.getChannel(recorded.channelId, { userId: this.ownerUserId, source: 'oss' });
					await this.deps.deliver(channel, recorded.message);
				} catch (error) {
					// Recorded, but the agent was not paged: it reads the DM when it next looks
					this.logger.warn('Canvas message recorded but not handed to the agent', { session, error: error instanceof Error ? error.message : String(error) });
				}
				this.logger.info('Canvas message received', { session });
				return { instanceId, ok: true };
			}
			case 'stop': {
				if (session === ORCHESTRATOR_SESSION_NAME) return fail('not_allowed', 'The orchestrator is stopped on the machine itself');
				const r = await this.deps.stopAgent(session);
				this.logger.info('Canvas stop', { session, ok: r.ok });
				return r.ok ? { instanceId, ok: true } : fail('stop_failed', r.error ?? 'Could not stop the agent');
			}
			case 'terminal_open':
			case 'terminal_renew': {
				if (action.kind === 'terminal_renew' && this.deps.terminal.renew(session)) return { instanceId, ok: true };
				// A renew after a restart opens again: the viewer is still there
				const r = this.deps.terminal.open(session);
				return r.ok ? { instanceId, ok: true } : fail(r.code, r.code === 'too_many_streams' ? 'Too many terminals are open' : r.code === 'no_session' ? 'The agent has no terminal right now' : 'Not signed in to Crewly Cloud');
			}
			case 'terminal_close':
				this.deps.terminal.close(session, 'closed');
				return { instanceId, ok: true };
		}
	}

	private pruneDone(): void {
		const cutoff = this.now() - C.DONE_ACTIONS_TTL_MS;
		for (const [id, entry] of this.done) if (entry.at < cutoff) this.done.delete(id);
		while (this.done.size > C.DONE_ACTIONS_MAX) this.done.delete(this.done.keys().next().value as string);
	}

	private url(suffix: string): string | null {
		const base = this.deps.cloud.getCloudUrl();
		return base ? `${base.replace(/\/$/, '')}${C.ACTIONS_PATH}${suffix}` : null;
	}

	/** Fetch the action from Cloud with this machine's token; one refresh on 401, a few retries on network / 5xx. */
	private async fetchAction(data: CanvasActionRelayData, instanceId: string): Promise<FetchOutcome> {
		const url = this.url(`/${encodeURIComponent(data.actionId)}?instanceId=${encodeURIComponent(instanceId)}`);
		if (!url) return { kind: 'error', error: 'not signed in to Crewly Cloud' };
		const delays = C.FETCH_RETRY_DELAYS_MS;
		let refreshed = false;
		let lastError = 'unknown';
		for (let attempt = 0; attempt <= delays.length; attempt++) {
			if (attempt > 0) await this.sleep(delays[attempt - 1] ?? 0);
			const token = this.deps.cloud.getToken();
			if (!token) return { kind: 'error', error: 'not signed in to Crewly Cloud' };
			let response: Response;
			try {
				response = await this.fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(C.REQUEST_TIMEOUT_MS) });
			} catch (error) {
				lastError = error instanceof Error ? error.message : String(error);
				continue;
			}
			if (response.status === 401 && !refreshed && this.deps.cloud.tryRefreshToken) {
				refreshed = true;
				if (await this.deps.cloud.tryRefreshToken().catch(() => false)) {
					attempt--;
					continue;
				}
			}
			// 403: the token's account is not the owner of this action (a member / guest)
			if (response.status === 404 || response.status === 403) return { kind: 'not_found' };
			if (response.status === 410) return { kind: 'expired' };
			if (response.ok) {
				const parsed = parseCanvasFetchResponse(await response.json().catch(() => null));
				return parsed ? { kind: 'ok', action: parsed } : { kind: 'error', error: 'unusable response from Crewly Cloud' };
			}
			lastError = `HTTP ${response.status}`;
			if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
		}
		return { kind: 'error', error: lastError };
	}

	/** Report the result to Cloud (best effort; a re-push re-reports). */
	private async report(actionId: string, body: CanvasActionResultRequest): Promise<void> {
		const url = this.url(`/${encodeURIComponent(actionId)}/result`);
		const token = this.deps.cloud.getToken();
		if (!url || !token) return;
		try {
			await this.fetchImpl(url, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(C.REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			this.logger.debug('Could not report a canvas action result', { actionId, error: error instanceof Error ? error.message : String(error) });
		}
	}
}
