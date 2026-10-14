/**
 * Late-bound hooks so low-level services (token usage, trace recorder) can
 * feed the usage ledger without importing it (the ledger imports them).
 *
 * @module services/usage-ledger/ledger-hooks
 */

import type { TokenUsageEvent } from '../monitoring/token-usage.service.js';

/** What the ledger needs to know about a new request. */
export interface RequestMeta {
	traceId: string;
	ticketId?: string;
	requestId: string;
	title: string;
	description?: string;
	channel?: string;
	threadRef?: string;
	createdAt?: string;
}

let usageObserver: ((session: string, event: TokenUsageEvent) => void) | null = null;
let requestObserver: ((meta: RequestMeta) => void) | null = null;

/**
 * Register the ledger's usage observer.
 *
 * @param fn - Called after every recorded usage event; null removes it
 */
export function setUsageObserver(fn: ((session: string, event: TokenUsageEvent) => void) | null): void {
	usageObserver = fn;
}

/**
 * Register the ledger's request observer.
 *
 * @param fn - Called when a request gets its trace; null removes it
 */
export function setRequestObserver(fn: ((meta: RequestMeta) => void) | null): void {
	requestObserver = fn;
}

/**
 * A usage event was recorded. Never throws.
 *
 * @param session - Agent session
 * @param event - The event (trace id already stamped)
 */
export function notifyUsage(session: string, event: TokenUsageEvent): void {
	try {
		usageObserver?.(session, event);
	} catch {
		// accounting must never break a turn
	}
}

/**
 * A request was given its trace. Never throws.
 *
 * @param meta - Request facts
 */
export function notifyRequest(meta: RequestMeta): void {
	try {
		requestObserver?.(meta);
	} catch {
		// accounting must never break a request
	}
}
