/**
 * Turn a delivered message / trace summary into a readable ticket title or
 * excerpt: routing tags and harness-only notes removed.
 *
 * @module services/usage-ledger/excerpt
 */

/** Longest excerpt kept in a fact. */
export const EXCERPT_MAX = 280;
/** Longest title kept in a fact. */
export const TITLE_MAX = 120;

/**
 * Strip routing noise from a message.
 *
 * Removes `[CHAT:…]` / `[GCHAT:…]` / `[TICKET:…]` / `[TRACE:…]` tags, Slack
 * routing tokens (`<U123@#C456>`), and the harness's parenthetical internal
 * note (`(Crewly …)`), then collapses whitespace.
 *
 * @param text - Raw text
 * @returns Clean text
 */
export function cleanText(text: string): string {
	return text
		.replace(/\[(?:G?CHAT|TICKET|TRACE|WI|DECISION)[^\]]*\]/g, ' ')
		.replace(/<[A-Z0-9]+@[^>\s]*>/g, ' ')
		.replace(/\(Crewly [^)]*\)/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Cut text to a length on a character boundary, adding an ellipsis.
 *
 * @param text - Text
 * @param max - Maximum length
 * @returns Possibly shortened text
 */
export function cut(text: string, max: number): string {
	const chars = Array.from(text);
	return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`;
}

/**
 * Title of a unit from its trace summary (`TKT-12: [Request] do x` → `[Request] do x`).
 *
 * @param summary - Trace root summary
 * @returns Title (may be empty)
 */
export function titleFromSummary(summary: string): string {
	return cut(cleanText(summary).replace(/^[A-Z]+-\d+:\s*/, ''), TITLE_MAX);
}
