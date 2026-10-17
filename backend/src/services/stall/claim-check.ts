/**
 * "X is doing it" claims (crewly#1362): an agent tells the owner a named
 * teammate is doing something. The watcher later checks that a WorkItem or
 * project ticket for that teammate exists around that time; when none does,
 * the speaker is told once to delegate or correct the thread. This module is
 * the text side: finding the claims and wording the nudge. No LLM.
 *
 * @module services/stall/claim-check
 */

import { STALL_WATCHER_CONSTANTS } from '../../constants.js';
import { splitSentences } from '../open-items/open-item-extractor.js';

const C = STALL_WATCHER_CONSTANTS;

/** A teammate the agent can name. */
export interface ClaimableMember {
	/** Display name as teammates write it ("Pia") */
	name: string;
	/** Agent session */
	session: string;
}

/** One claim found in a post. */
export interface TeammateClaim {
	/** The teammate's session */
	member: string;
	/** The name as matched */
	memberName: string;
	/** The claiming sentence (clipped to RUN_HEAD_MAX_CHARS) */
	sentence: string;
}

/** A sentence that asks is not a claim ("让 Pia 做？"). */
const QUESTION_END = /[?？]\s*[)）]?$/;

/** A sentence that denies or undoes the claim. */
const NEGATED = /(?:不是|没有?让|没有?交给|并不是|不再|不用|别让)|\b(?:not|isn'?t|wasn'?t|haven'?t|hasn'?t|no longer|didn'?t)\b/iu;

/**
 * Escape a name for use in a RegExp.
 *
 * @param name - Display name
 * @returns Escaped text
 */
function escapeName(name: string): string {
	return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The claim patterns for one name.
 *
 * @param name - Display name
 * @returns Patterns that match a claim about that teammate
 */
export function claimPatternsFor(name: string): RegExp[] {
	const n = escapeName(name);
	// English names need word boundaries; CJK names have none, so the verb
	// lists carry the shape on their own.
	const latin = /^[\p{Script=Latin}\d\s.'-]+$/u.test(name);
	const b = latin ? '\\b' : '';
	return [
		new RegExp(`${b}${n}${b}\\s*${C.CLAIM_ZH_AFTER_NAME}`, 'iu'),
		new RegExp(`${C.CLAIM_ZH_BEFORE_NAME}\\s*${n}${b}`, 'iu'),
		new RegExp(`${b}${n}${b}\\s*${C.CLAIM_EN_AFTER_NAME}\\b`, 'iu'),
		new RegExp(`\\b${C.CLAIM_EN_BEFORE_NAME}\\s+${n}${b}`, 'iu'),
	];
}

/**
 * Claims in an agent's post that a named teammate is doing the work.
 *
 * A member is matched by its display name (not the speaker itself); each
 * member is reported once, with the first sentence that claims it. Questions
 * and negated sentences ("不是 Pia 在做") are skipped.
 *
 * @param text - The agent's post
 * @param members - The speaker's teammates (name + session)
 * @param speaker - The speaker's session (never a claim about itself)
 * @returns Claims found, in sentence order
 *
 * @example
 * ```typescript
 * detectTeammateClaims('对，视频已经是 Pia 在做了。', [{ name: 'Pia', session: 'flopost-pia' }], 'flopost-ella');
 * // [{ member: 'flopost-pia', memberName: 'Pia', sentence: '对，视频已经是 Pia 在做了。' }]
 * ```
 */
export function detectTeammateClaims(text: string, members: readonly ClaimableMember[], speaker: string): TeammateClaim[] {
	const t = (text ?? '').trim();
	if (t.length < 4 || members.length === 0) return [];
	const candidates = members.filter((m) => m.session !== speaker && m.name.trim().length > 0);
	if (candidates.length === 0) return [];
	const patterns = candidates.map((m) => ({ m, res: claimPatternsFor(m.name.trim()) }));
	const out: TeammateClaim[] = [];
	const seen = new Set<string>();
	for (const { text: raw } of splitSentences(t)) {
		const s = raw.trim();
		if (!s || QUESTION_END.test(s) || NEGATED.test(s)) continue;
		for (const { m, res } of patterns) {
			if (seen.has(m.session) || !res.some((re) => re.test(s))) continue;
			seen.add(m.session);
			const one = s.replace(/\s+/g, ' ');
			out.push({ member: m.session, memberName: m.name.trim(), sentence: one.length > C.RUN_HEAD_MAX_CHARS ? `${one.slice(0, C.RUN_HEAD_MAX_CHARS - 1)}…` : one });
		}
	}
	return out;
}

/**
 * The one line the speaker gets when nothing is assigned to the teammate.
 *
 * @param memberName - The teammate as named
 * @param sentence - The claiming sentence
 * @returns Nudge text
 */
export function claimNudgeText(memberName: string, sentence: string): string {
	return (
		`${C.CLAIM_CHECK_TAG} You told the owner ${memberName} is doing it ("${sentence}"); nothing is assigned to ${memberName} ` +
		`(no work item or ticket for ${memberName} within ${Math.round(C.CLAIM_CHECK_WINDOW_MS / 60_000)} minutes of that reply). Delegate it now, or correct the thread.`
	);
}
