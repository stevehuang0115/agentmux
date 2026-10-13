/**
 * Result phrases for the "Done today" strip (crewly#1247): a finished
 * ticket or WorkItem is described by what it produced ("post published"),
 * and equal results are counted ("2 posts published"). Deterministic keyword
 * rules over the title and kind; no model call.
 *
 * Pure (no I/O).
 *
 * @module services/board/board-outcome-phrases
 */

import { BOARD_CONSTANTS } from '../../constants.js';

/** One kind of result. */
interface ResultRule {
	/** Matches the title (and kind label) */
	pattern: RegExp;
	one: string;
	many: string;
}

const RULES: readonly ResultRule[] = [
	{ pattern: /\b(?:posts?|tweets?|threads?|linkedin|newsletter|publish(?:ed|ing)?|announce(?:ment)?s?|social)\b/i, one: 'post published', many: 'posts published' },
	{ pattern: /\b(?:customers?|clients?|support|inquir(?:y|ies)|repl(?:y|ies|ied)|dms?)\b/i, one: 'customer answered', many: 'customers answered' },
	{ pattern: /\b(?:bugs?|fix(?:es|ed)?|hotfix|regression|crash|broken)\b/i, one: 'bug fixed', many: 'bugs fixed' },
	{ pattern: /\b(?:releases?|deploy(?:ed|ment)?|ship(?:ped)?|rollout|launch)\b/i, one: 'release shipped', many: 'releases shipped' },
	{ pattern: /\b(?:pull request|pr #?\d+|merge[ds]?)\b/i, one: 'change merged', many: 'changes merged' },
	{ pattern: /\b(?:reports?|summary|digest|analysis|research|audit|review(?:ed)?|survey)\b/i, one: 'report delivered', many: 'reports delivered' },
	{ pattern: /\b(?:videos?|designs?|images?|banners?|graphics?|canva|thumbnails?|logo)\b/i, one: 'design created', many: 'designs created' },
	{ pattern: /\b(?:docs?|documents?|articles?|blog|write-?ups?|specs?|guides?|sop|copy|draft)\b/i, one: 'document written', many: 'documents written' },
	{ pattern: /\b(?:tests?|ci|lint|refactor|cleanup|chore|migrat(?:e|ion))\b/i, one: 'chore finished', many: 'chores finished' },
	{ pattern: /\b(?:features?|implement(?:ed)?|add(?:ed)?|build|built|page|app)\b/i, one: 'feature built', many: 'features built' },
];

/** Kind of a finished item, from its ticket kind when it has one. */
const KIND_FALLBACK: Record<string, ResultRule> = {
	issue: { pattern: /./, one: 'issue resolved', many: 'issues resolved' },
	feature: { pattern: /./, one: 'feature built', many: 'features built' },
	idea: { pattern: /./, one: 'idea explored', many: 'ideas explored' },
	question: { pattern: /./, one: 'question answered', many: 'questions answered' },
};

const GENERIC: ResultRule = { pattern: /./, one: 'task done', many: 'tasks done' };

/**
 * The rule describing a finished item.
 *
 * @param title - Item title
 * @param kind - Ticket kind (`issue`, `feature`, ...), when known
 * @returns A rule (a generic one when no keyword matches)
 */
export function ruleFor(title: string, kind?: string): ResultRule {
	for (const rule of RULES) if (rule.pattern.test(title)) return rule;
	if (kind && KIND_FALLBACK[kind]) return KIND_FALLBACK[kind];
	return GENERIC;
}

/**
 * The result of one finished item, in singular ("post published").
 *
 * @param title - Item title
 * @param kind - Ticket kind, when known
 * @returns Result phrase
 */
export function resultOf(title: string, kind?: string): string {
	return ruleFor(title, kind).one;
}

/**
 * Count equal results: ["post published","post published","bug fixed"] ->
 * ["2 posts published", "1 bug fixed"], most frequent first.
 *
 * @param results - Singular result phrases
 * @returns Summary phrases (at most {@link BOARD_CONSTANTS.MAX_SUMMARY_PHRASES})
 */
export function summarizeResults(results: readonly string[]): string[] {
	const counts = new Map<string, number>();
	for (const r of results) counts.set(r, (counts.get(r) ?? 0) + 1);
	const byOne = new Map<string, ResultRule>();
	for (const rule of [...RULES, ...Object.values(KIND_FALLBACK), GENERIC]) byOne.set(rule.one, rule);
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, BOARD_CONSTANTS.MAX_SUMMARY_PHRASES)
		.map(([one, n]) => `${n} ${n === 1 ? one : (byOne.get(one)?.many ?? one)}`);
}
