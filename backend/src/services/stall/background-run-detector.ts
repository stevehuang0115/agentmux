/**
 * Text heuristics for background runs (crewly#1363 kind c): an agent telling
 * the owner or a room that it started something that runs on its own ("已经
 * 开跑…预计 1 小时左右", "kicked off the render, about 40 min"), a later post
 * that reports it finished or failed, and a post that carries a deliverable
 * (a file or a link). No LLM. The duration comes from the open-items parser
 * so the two agree on "一个半小时".
 *
 * @module services/stall/background-run-detector
 */

import { STALL_WATCHER_CONSTANTS } from '../../constants.js';
import { durationMs, splitSentences } from '../open-items/open-item-extractor.js';

const C = STALL_WATCHER_CONSTANTS;

/** What an announcement says. */
export interface BackgroundRun {
	/** The announcing sentence, clipped to RUN_HEAD_MAX_CHARS */
	head: string;
	/** The duration named in that sentence or its neighbour (ms), or null */
	estimateMs: number | null;
}

/** A sentence that asks something is not an announcement. */
const QUESTION_END = /[?？]\s*[)）]?$/;

/**
 * Clip a sentence to one line of at most RUN_HEAD_MAX_CHARS.
 *
 * @param s - Sentence
 * @returns Clipped text
 */
function clipHead(s: string): string {
	const one = s.replace(/\s+/g, ' ').trim();
	return one.length > C.RUN_HEAD_MAX_CHARS ? `${one.slice(0, C.RUN_HEAD_MAX_CHARS - 1)}…` : one;
}

/**
 * Whether an agent post announces a run that will take a while.
 *
 * The announcing sentence must match {@link STALL_WATCHER_CONSTANTS.BACKGROUND_RUN_PATTERN};
 * the duration is read from that sentence, else from the sentence before or
 * after it ("已经开跑。预计 1 小时左右。"). Without a duration anywhere near, the
 * post is NOT a background run (the caller registers nothing): the watcher
 * only keys to the agent's own estimate. Finished-work reports and questions
 * return null.
 *
 * @param text - The agent's post
 * @returns The run, or null
 *
 * @example
 * ```typescript
 * detectBackgroundRun('已经开跑了，预计 1 小时左右出结果。');
 * // { head: '已经开跑了，预计 1 小时左右出结果。', estimateMs: 3600000 }
 * detectBackgroundRun('Kicked off the render.'); // null — no duration
 * ```
 */
export function detectBackgroundRun(text: string): BackgroundRun | null {
	const t = (text ?? '').trim();
	if (t.length < 4) return null;
	const sentences = splitSentences(t).map((s) => s.text.trim()).filter(Boolean);
	for (let i = 0; i < sentences.length; i++) {
		const s = sentences[i];
		if (QUESTION_END.test(s) || !C.BACKGROUND_RUN_PATTERN.test(s)) continue;
		if (isRunFinishedReport(s)) continue;
		const near = [s, sentences[i + 1], sentences[i - 1]].filter((x): x is string => !!x);
		let estimateMs: number | null = null;
		for (const n of near) {
			estimateMs = durationMs(n);
			if (estimateMs !== null) break;
		}
		if (estimateMs === null) return null;
		return { head: clipHead(s), estimateMs };
	}
	return null;
}

/**
 * Whether a post reports a run finished or failed (either closes the record).
 *
 * @param text - The agent's post
 * @returns True for a finished / failed report
 */
export function isRunFinishedReport(text: string): boolean {
	const t = (text ?? '').trim();
	if (!t || QUESTION_END.test(t)) return false;
	return C.RUN_FINISHED_PATTERN.test(t);
}

/**
 * Whether a post carries a deliverable: an attachment, a link or a file name.
 *
 * @param message - Content and attachment count
 * @returns True when something was delivered
 */
export function hasDeliverable(message: { content: string; attachmentCount?: number }): boolean {
	if ((message.attachmentCount ?? 0) > 0) return true;
	return C.DELIVERABLE_PATTERN.test(message.content ?? '');
}
