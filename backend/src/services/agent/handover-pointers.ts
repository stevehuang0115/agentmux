/**
 * Pointers for a handover file: what is still open, which artifacts hold the
 * facts, and which skills to call first. The facts themselves stay in those
 * artifacts (WorkItems, PRs, tickets); the handover only points at them.
 *
 * Also the one place a handover passes through secret redaction.
 *
 * @module services/agent/handover-pointers
 */

import * as fs from 'fs';
import * as path from 'path';
import { redactSecrets } from '../../utils/secret-redactor.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import { HANDOVER_POINTERS_CONSTANTS } from '../../constants.js';

/** One open WorkItem of the agent. */
export interface HandoverOpenWork {
	id: string;
	title: string;
	status: string;
}

const C = HANDOVER_POINTERS_CONSTANTS;

/**
 * Mask secrets (keys, tokens, bearer headers, `NAME=value` secrets) in text
 * that is about to be written to a handover file.
 *
 * @param text - Handover text
 * @returns The text with secrets masked (idempotent)
 */
export function redactHandoverText(text: string): string {
	return redactSecrets(text);
}

/**
 * The agent's open WorkItems, read synchronously from the pool file (handover
 * writers are synchronous). Open = targeted at the agent (or actively claimed
 * by it) and still in flight.
 *
 * @param sessionName - Agent session
 * @param crewlyHome - CREWLY_HOME (tests)
 * @returns Up to {@link HANDOVER_POINTERS_CONSTANTS.MAX_OPEN_WORK} items, or [] when the pool is unreadable
 */
export function readOpenWorkSync(sessionName: string, crewlyHome: string = getCrewlyHomePath()): HandoverOpenWork[] {
	try {
		const raw = JSON.parse(fs.readFileSync(path.join(crewlyHome, C.POOL_DIR, C.POOL_FILE), 'utf-8')) as {
			workItems?: Array<{ id?: string; title?: string; status?: string; target?: string }>;
			claims?: Array<{ agentId?: string; workItemId?: string; status?: string }>;
		};
		const claimed = new Set((raw.claims ?? []).filter((c) => c.agentId === sessionName && c.status === 'active').map((c) => c.workItemId));
		const out: HandoverOpenWork[] = [];
		for (const wi of raw.workItems ?? []) {
			if (!wi.id || !wi.status || !C.OPEN_STATUSES.includes(wi.status)) continue;
			if (wi.target !== sessionName && !claimed.has(wi.id)) continue;
			out.push({ id: wi.id, title: (wi.title ?? '').slice(0, C.TITLE_CHARS), status: wi.status });
			if (out.length >= C.MAX_OPEN_WORK) break;
		}
		return out;
	} catch {
		return [];
	}
}

/**
 * PR / issue / ticket references found in text.
 *
 * @param text - Transcript tail
 * @returns Distinct GitHub PR/issue URLs and `TKT-n` ids, in order of appearance (capped)
 */
export function findArtifactLinks(text: string): string[] {
	const found = new Set<string>();
	for (const m of text.matchAll(/https?:\/\/[^\s)>\]"']+\/(?:pull|issues)\/\d+/g)) found.add(m[0]);
	for (const m of text.matchAll(/\bTKT-\d+\b/g)) found.add(m[0]);
	return [...found].slice(0, C.MAX_LINKS);
}

/**
 * Skills the next conversation should call first, by role.
 *
 * @param role - Agent role (optional)
 * @returns Skill names
 */
export function suggestedSkillsFor(role?: string): string[] {
	const r = (role ?? '').toLowerCase();
	const base = ['recall', 'get-my-active-work', 'report-status'];
	if (r === 'orchestrator') return ['recall', 'get-my-active-work', 'search-chat', 'reply-chat'];
	if (r === 'team-leader' || r === 'tl') return [...base, 'delegate-task'];
	return base;
}

/**
 * Prepend the pointer header to a handover body. Does nothing when the body
 * already starts with one (chained handovers carry no second copy).
 *
 * @param body - Handover body (the transcript tail)
 * @param opts - Session, optional role, optional CREWLY_HOME and open work override (tests)
 * @returns Header plus body, redacted
 */
export function withHandoverPointers(
	body: string,
	opts: { sessionName: string; role?: string; crewlyHome?: string; openWork?: HandoverOpenWork[] },
): string {
	if (body.includes(C.START_MARK)) return body;
	const open = opts.openWork ?? readOpenWorkSync(opts.sessionName, opts.crewlyHome);
	const links = findArtifactLinks(body);
	const lines = [C.START_MARK, '## Open work', ''];
	if (open.length === 0) lines.push('None open for you (no WorkItems in flight).');
	else for (const w of open) lines.push(`- ${w.id} — ${w.title} (${w.status})`);
	if (links.length) lines.push('', 'Mentioned in the conversation: ' + links.join(', '));
	lines.push('', `## Suggested skills`, '', `Call the Skill tool for: ${suggestedSkillsFor(opts.role).join(', ')}.`, C.END_MARK, '');
	return redactHandoverText(`${lines.join('\n')}\n${body}`);
}

/**
 * Remove a pointer header from an earlier handover's text, so carrying it
 * forward does not duplicate the section.
 *
 * @param text - Earlier handover text
 * @returns Text without the header block
 */
export function stripHandoverPointers(text: string): string {
	const a = text.indexOf(C.START_MARK);
	const b = text.indexOf(C.END_MARK);
	if (a === -1 || b === -1 || b < a) return text;
	return (text.slice(0, a) + text.slice(b + C.END_MARK.length)).replace(/\n{3,}/g, '\n\n').trim();
}
