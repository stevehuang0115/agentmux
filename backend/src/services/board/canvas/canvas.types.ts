/**
 * Crewly Canvas wire types (crewly#1247 v2). Mirrors CANVAS-CONTRACT.md; change
 * both together. Pure types.
 *
 * @module services/board/canvas/canvas.types
 */

/** What a step is. */
export type StepKind = 'read' | 'edit' | 'write' | 'command' | 'browse' | 'search' | 'message' | 'tool' | 'text' | 'wait';

/** Step state. */
export type StepStatus = 'running' | 'done' | 'error';

/**
 * One line of an agent's live step stream. Re-sent with the same `id` when its
 * status or duration changes (running -> done / error): Cloud upserts by
 * `(session, id)`.
 */
export interface StepEvent {
	session: string;
	/** Stable per step (the runtime's tool-call id, or a derived one) */
	id: string;
	/** When the step started (ISO) */
	at: string;
	kind: StepKind;
	/** The verb: "Read", "Edited", "Ran", "Opened", "Searched", "Sent message" */
	label: string;
	/** Redacted file path (repo-relative) / host+path / command name / channel */
	target?: string;
	/** The agent's own words, at most 280 characters, redacted (kind `text` only) */
	text?: string;
	durationMs?: number;
	status: StepStatus;
}

/** What the owner can do with an agent from the canvas. */
export interface AgentCapabilities {
	/** The agent has a live browser the owner can look at */
	hasBrowser: boolean;
	/** `chrome` = a Chrome-extension session (`browserSessionId`); `headless` = Playwright frames (not available yet) */
	browserKind?: 'chrome' | 'headless';
	/** Remote-browser session id for `chrome` (the portal's /portal/browser embeds it) */
	browserSessionId?: string;
	/** The agent has a terminal that can be tailed */
	hasTerminal: boolean;
	/** A message to this agent is delivered as the owner */
	canMessage: boolean;
	/** The agent can be stopped from here */
	canStop: boolean;
}

/** Owner action kinds. */
export type CanvasActionKind = 'message' | 'stop' | 'terminal_open' | 'terminal_renew' | 'terminal_close';

/** The relay push: ids only, the machine fetches the action from Cloud with its own token. */
export interface CanvasActionRelayData {
	actionId: string;
	instanceId: string;
	session: string;
	kind: CanvasActionKind;
}

/** What Cloud stores for the action (answer of `GET /api/cloud/canvas/actions/:actionId`). */
export interface CanvasActionFetchResponse {
	actionId: string;
	instanceId: string;
	session: string;
	kind: CanvasActionKind;
	/** `message` only */
	text?: string;
	/** `message` only: idempotency key (the action id when Cloud sends none) */
	clientMessageId?: string;
}

/** Reported back (`POST .../actions/:actionId/result`). */
export interface CanvasActionResultRequest {
	instanceId: string;
	ok: boolean;
	code?: string;
	error?: string;
}

/** One masked terminal frame (`POST /api/cloud/canvas/terminal/frame`). */
export interface TerminalFrame {
	instanceId: string;
	session: string;
	/** 1, 2, 3 ... per stream; the first frame is the last 200 lines */
	seq: number;
	at: string;
	/** The whole tail, oldest line first; masked */
	lines: string[];
	/** Set on the last frame of a stream */
	closed?: boolean;
	/** Why the stream ended (with `closed`) */
	reason?: 'closed' | 'lease_expired' | 'session_gone' | 'cloud_stopped' | 'too_long' | 'send_failed';
}
