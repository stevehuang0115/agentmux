/**
 * Append-only audit of external traffic (`~/.crewly/external-audit.jsonl`).
 *
 * One line per event: who, which embed and conversation, how long, and why a
 * reply was blocked. Message text is never written here; it lives in Cloud.
 *
 * @module services/external/external-audit
 */

import * as fs from 'fs';
import * as path from 'path';
import { EXTERNAL_CONSTANTS } from '../../constants.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';

/** Kinds of audited events. */
export type ExternalAuditEvent = 'delivered' | 'delivery_failed' | 'replied' | 'reply_blocked' | 'host_call';

/** One audit line. */
export interface ExternalAuditEntry {
	event: ExternalAuditEvent;
	embedId: string;
	conversationId: string;
	/** Agent session involved */
	agent?: string;
	messageId?: string;
	/** Length of the text, never the text */
	chars?: number;
	reasons?: string[];
	/** host_call: method, path (no query) and status */
	method?: string;
	path?: string;
	status?: number;
}

/**
 * Write one audit line (best effort: a full disk never blocks a reply).
 *
 * @param entry - Event fields
 * @param dir - Directory (default CREWLY_HOME)
 * @param now - Clock
 */
export function auditExternal(entry: ExternalAuditEntry, dir: string = getCrewlyHomePath(), now: () => number = Date.now): void {
	try {
		fs.mkdirSync(dir, { recursive: true });
		fs.appendFileSync(path.join(dir, EXTERNAL_CONSTANTS.AUDIT_FILE), `${JSON.stringify({ at: new Date(now()).toISOString(), ...entry })}\n`, 'utf-8');
	} catch {
		// audit is best effort
	}
}
