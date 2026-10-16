/**
 * Hand an owner-approved change to a recurring deliverable to the agent that
 * runs the schedule (crewly#1137).
 *
 * Incident (2026-10-04, D-203): Atlas asked the owner to change the daily tech
 * brief to "summary + app link". The owner agreed, but the brief is produced by
 * another agent's schedule and nobody told it; the next briefs were unchanged.
 *
 * When a decision is answered and the question names a recurring schedule run
 * by someone other than the asker, the owner of that schedule gets the approved
 * change as a WorkItem, and the asker is told it was handed off.
 *
 * Pure matching lives here; the real collaborators are wired in
 * `decision.wiring.ts`.
 *
 * @module services/decisions/recurring-change-handoff
 */

import { RECURRING_CHANGE_HANDOFF_CONSTANTS as C } from '../../constants.js';
import type { Trigger } from '../../types/v2/trigger.types.js';
import type { OwnerDecision } from '../../types/decision.types.js';

/** A recurring schedule and who runs it. */
export interface RecurringSchedule {
	triggerId: string;
	/** Human name of the job (trigger name or the WorkItem title it creates) */
	label: string;
	/** Session the schedule's work goes to */
	owner: string;
}

/** Collaborators of {@link handOffRecurringChange}. */
export interface HandoffDeps {
	/** Active recurring schedules on this instance */
	listSchedules: () => RecurringSchedule[];
	/** Give the owner agent the approved change; false when it could not */
	assign: (schedule: RecurringSchedule, brief: string, decision: OwnerDecision) => Promise<boolean>;
}

/**
 * Words of a text: Latin words, and bigrams of CJK runs.
 *
 * @param text - Any text
 * @returns Lower-cased distinct terms
 */
export function termsOf(text: string): Set<string> {
	const out = new Set<string>();
	for (const w of text.toLowerCase().match(/[\p{Script=Latin}\p{N}]+/gu) ?? []) {
		if (w.length >= C.MIN_WORD_CHARS) out.add(w);
	}
	for (const run of text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu) ?? []) {
		if (run.length === 1) continue;
		for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2));
	}
	return out;
}

/**
 * Terms that say what a text is about: {@link termsOf} without the when-words
 * (every morning, daily, Monday...) that unrelated jobs share.
 *
 * @param text - Any text
 * @returns Lower-cased distinct subject terms
 */
export function subjectTermsOf(text: string): Set<string> {
	const out = termsOf(text.replace(C.GENERIC_CADENCE_PATTERN, ' '));
	for (const w of C.GENERIC_CADENCE_WORDS) out.delete(w);
	return out;
}

/**
 * The part of a schedule label that names the job: its name and the start of
 * its title, up to the first `:` / `(` / sentence end. The rest of a label is
 * the job's instructions (hundreds of words), whose common words made any
 * decision "mention" the job.
 *
 * @param label - Trigger name plus work item title
 * @returns The identifying head of the label
 */
export function identityOf(label: string): string {
	const cut = label.search(/[:(：（。\n]|\.\s/u);
	return (cut > 0 ? label.slice(0, cut) : label).slice(0, C.MAX_IDENTITY_CHARS);
}

/**
 * Recurring schedules a set of triggers describes.
 *
 * @param triggers - Triggers (any status; only active cron ones count)
 * @returns One row per active recurring trigger with a target
 */
export function recurringSchedules(triggers: readonly Trigger[]): RecurringSchedule[] {
	const out: RecurringSchedule[] = [];
	for (const t of triggers) {
		if (t.status !== 'active' || t.config.type !== 'time' || !t.config.cronExpression) continue;
		const wi = t.action?.createWorkItem;
		const owner = (typeof wi?.target === 'string' && wi.target) || t.action?.sendMessage?.target;
		const label = [t.name, wi?.title].filter((s): s is string => typeof s === 'string' && s.length > 0).join(' ');
		if (owner && label) out.push({ triggerId: t.id, label, owner });
	}
	return out;
}

/**
 * Whether the owner's answer approves something (not a decline).
 *
 * @param d - Decision, already answered
 * @returns True when there is a change to carry out
 */
export function isApprovedChange(d: OwnerDecision): boolean {
	if (d.status !== 'resolved') return false;
	const answer = d.chosenKey ? (d.options.find((o) => o.key === d.chosenKey)?.label ?? '') : (d.answerText ?? '');
	return answer.trim() !== '' && !C.DECLINE_PATTERN.test(answer);
}

/**
 * The schedule, run by someone else, that a decision is about.
 *
 * @param d - Decision
 * @param schedules - Recurring schedules
 * @returns The best match, or null
 */
export function scheduleOfDecision(d: OwnerDecision, schedules: readonly RecurringSchedule[]): RecurringSchedule | null {
	// The card says what it is about; the owner's free-text answer (often a long
	// voice transcript) says what they want, and its common words match any job.
	const text = [d.question, ...d.options.map((o) => `${o.label} ${o.detail ?? ''}`)].join(' ');
	const have = subjectTermsOf(text);
	let best: { s: RecurringSchedule; coverage: number } | null = null;
	for (const s of schedules) {
		if (s.owner === d.asker || s.owner === d.requestedBy) continue;
		const terms = subjectTermsOf(identityOf(s.label));
		if (terms.size === 0) continue;
		const shared = [...terms].filter((t) => have.has(t)).length;
		const coverage = shared / terms.size;
		if (shared < C.MIN_SHARED_TERMS || (coverage < C.MIN_COVERAGE && shared < C.SURE_SHARED_TERMS)) continue;
		if (!best || coverage > best.coverage) best = { s, coverage };
	}
	return best?.s ?? null;
}

/**
 * The brief the schedule's owner gets.
 *
 * @param d - The answered decision
 * @param s - The schedule
 * @returns Harness text
 */
export function handoffBrief(d: OwnerDecision, s: RecurringSchedule): string {
	const answer = d.chosenKey ? (d.options.find((o) => o.key === d.chosenKey)?.label ?? d.chosenKey) : (d.answerText ?? '');
	return (
		`The owner approved a change to a job you run ("${s.label}", schedule ${s.triggerId}). ` +
		`${d.asker} asked ${d.id}: "${d.question}" — the owner answered: "${answer}". ` +
		'Apply it from the next run and say in the owner thread what changed. If the answer does not change this job, close this item with a one-line reason.'
	);
}

/**
 * After an answer: hand the approved change to the agent that runs the
 * recurring job it concerns. Never throws.
 *
 * @param d - The answered decision
 * @param deps - Collaborators
 * @returns A line for the asker ("handed to X"), or null when nothing was handed off
 */
export async function handOffRecurringChange(d: OwnerDecision, deps: HandoffDeps): Promise<string | null> {
	try {
		if (!isApprovedChange(d)) return null;
		const s = scheduleOfDecision(d, deps.listSchedules());
		if (!s) return null;
		if (!(await deps.assign(s, handoffBrief(d, s), d))) return null;
		return `That change belongs to "${s.label}", which ${s.owner} runs. Crewly handed it to ${s.owner} as a WorkItem — you do not need to do it yourself.`;
	} catch {
		return null;
	}
}
