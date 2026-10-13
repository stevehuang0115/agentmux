/**
 * Short, redacted excerpt of a terminal screen for owner-facing alerts.
 *
 * When an agent's input box cannot be read, the owner is asked to look at
 * it. A few readable rows (a permission dialog, a bare shell prompt) usually
 * answer "what is it stuck on" without opening the terminal. The rows can
 * hold secrets, so every row goes through the secret redactor, long opaque
 * tokens are masked, and the excerpt is capped in rows and characters.
 *
 * @module screen-excerpt
 */

import { redactSecrets } from './secret-redactor.js';

/** Rows kept (bottom-most non-empty ones) */
export const SCREEN_EXCERPT_MAX_ROWS = 6;
/** Characters kept per row */
export const SCREEN_EXCERPT_MAX_ROW_CHARS = 100;
/** Characters kept in total */
export const SCREEN_EXCERPT_MAX_CHARS = 420;

/** Long opaque runs (keys, hashes, base64) the pattern-based redactor may not know */
const OPAQUE_RUN_RE = /[A-Za-z0-9_\-+/=]{24,}/g;
/** Credentials inside URLs: scheme://user:pass@host */
const URL_CREDENTIALS_RE = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi;

/**
 * Build the excerpt from a screen's rows.
 *
 * @param lines - Screen rows, top to bottom
 * @returns The bottom rows, redacted and trimmed, joined by newlines ('' when blank)
 */
export function redactedScreenExcerpt(lines: readonly string[]): string {
	const rows = lines
		.map((l) => l.replace(/\s+$/u, ''))
		.filter((l) => l.trim() !== '')
		.slice(-SCREEN_EXCERPT_MAX_ROWS)
		.map((l) => {
			const masked = redactSecrets(l).replace(URL_CREDENTIALS_RE, '$1[redacted]@').replace(OPAQUE_RUN_RE, '[redacted]');
			const trimmed = masked.trim();
			return trimmed.length > SCREEN_EXCERPT_MAX_ROW_CHARS ? `${trimmed.slice(0, SCREEN_EXCERPT_MAX_ROW_CHARS - 1)}…` : trimmed;
		});
	let out = rows.join('\n');
	if (out.length > SCREEN_EXCERPT_MAX_CHARS) out = `…${out.slice(out.length - SCREEN_EXCERPT_MAX_CHARS + 1)}`;
	return out;
}

/**
 * Whether the last row looks like a bare shell prompt (`user@host dir %`,
 * `$ `, `# `): the agent's runtime has exited to the shell, so there is no
 * input box to read.
 *
 * @param excerpt - An excerpt from {@link redactedScreenExcerpt}
 * @returns True for a shell prompt
 */
export function looksLikeShellPrompt(excerpt: string): boolean {
	const last = excerpt.split('\n').pop() ?? '';
	return /^(?:\S+@\S+\s.*)?[%$#]$/u.test(last.trim()) || /^\S+@\S+\s+\S+\s+[%$#]$/u.test(last.trim());
}
