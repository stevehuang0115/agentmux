/**
 * Redaction for what the canvas shows (crewly#1247 v2), on the machine, before
 * anything leaves it:
 *
 * - {@link shortAgentLine}: the agent's own words from a transcript, reduced
 *   to one short line (at most 280 characters), no code blocks, no secrets;
 * - {@link maskTerminalText}: a terminal tail with every secret, token, email
 *   and URL query masked.
 *
 * Both reuse the board's {@link scrubText} and the secret redactor that guards
 * the session logs; this file only adds what those do not cover (zero-width
 * characters, base64 blobs, spaced `key = value` secrets, ANSI).
 *
 * Pure (no I/O).
 *
 * @module services/board/canvas/canvas-redact
 */

import { CANVAS_CONSTANTS } from '../../../constants.js';
import { redactSecrets } from '../../../utils/secret-redactor.js';
import type { SecretEnvValue } from '../../../utils/secret-env.js';
import { clip, looksLikeToken, REDACTED, scrubText } from '../board-redact.js';

const C = CANVAS_CONSTANTS;

/** A terminal capture is cut to this many characters from the end before any pattern runs. */
const MAX_RAW_CHARS = 400_000;
/** A raw line is cut to this many characters (an escape-heavy line shrinks after ANSI removal). */
const MAX_RAW_LINE = 6_000;
/** A line is masked over its first this many characters (the displayed 400 plus room for a secret that straddles the cut; the cost is quadratic in it). */
const MASK_LINE_CHARS = 600;

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[PX^_][^\x1b]*\x1b\\|\x1b[@-Z\\^_=>]|\x9b[0-9;?]*[ -/]*[@-~]/g;
/** Characters that hide text or reorder it. */
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
/** A long run of base64 / base64url, or a data: URI payload. */
const BASE64_BLOB = /data:[\w/+.-]+;base64,[A-Za-z0-9+/_=-]+|[A-Za-z0-9+_]{40,}={0,2}/g;
/** `secret_key = value` with spaces around the separator (the shared redactor wants `NAME=value`). */
const SPACED_SECRET = /((?:api[_ -]?key|secret|token|passw(?:or)?d|passphrase|private[_ -]?key|credential|auth)[\w-]*\s*(?:[:=]|is)\s+)["']?[^\s"',;]{4,}/gi;
const PROMPT_SECRET = /((?:password|passphrase|pin|otp|verification code|2fa code)(?:\s+for\s+\S+)?\s*(?:\([^)]*\))?\s*[:?]\s*)\S.*$/gim;
/** `[REDACTED NAME]` from the shared redactor, without the name (which env var it was is not Cloud's business). */
const REDACTED_MASK = /\[REDACTED[^\]]*\]/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const URL_QUERY = /(\bhttps?:\/\/[^\s?#"'<>]+)\?[^\s"'<>]*/gi;
const URL_CREDENTIALS = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi;
const BEARER = /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi;
const HEX_LONG = /\b[0-9a-fA-F]{32,}\b/g;
/** A phone number: international (`+...`) or three-three-four groups. Dates, versions and model ids are not. */
const PHONE = /(?<![\w.-])(?:\+\d[\d\s().-]{8,}\d|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})(?![\w-])/g;

/**
 * Whether a word of a terminal line looks like a credential. Slugs such as
 * `claude-opus-4-5-20251101` (lowercase words joined by dashes) are not.
 *
 * @param word - Word without surrounding punctuation
 * @returns True when it should be masked
 */
function looksSecretWord(word: string): boolean {
	if (word.length < 24 || !/^[A-Za-z0-9_+=/-]+$/.test(word)) return false;
	if (!/\d/.test(word) || !/[A-Za-z]/.test(word)) return false;
	if (/^[a-z0-9]+(?:-[a-z0-9.]+)+$/.test(word)) return false;
	if (word.includes('/')) return false; // a path
	return looksLikeToken(word) || (/[A-Z]/.test(word) && /[a-z]/.test(word));
}

/**
 * Mask what must not be shown in either surface.
 *
 * @param text - One line or a whole text
 * @returns Text with emails, URL queries / credentials, bearer tokens, long hex, blobs and spaced secrets masked
 */
function maskCommon(text: string): string {
	let s = text;
	s = s.replace(URL_CREDENTIALS, `$1${REDACTED}@`);
	s = s.replace(URL_QUERY, '$1?[query]');
	s = s.replace(EMAIL, '[email]');
	s = s.replace(BEARER, REDACTED);
	s = s.replace(SPACED_SECRET, `$1${REDACTED}`);
	s = s.replace(HEX_LONG, REDACTED);
	s = s.replace(BASE64_BLOB, (m) => (m.startsWith('data:') || m.endsWith('=') || (/\d/.test(m) && /[A-Z]/.test(m) && /[a-z]/.test(m)) ? REDACTED : m));
	return s;
}

/**
 * Reduce an assistant message block to one short, safe line.
 *
 * Takes the first paragraph outside code fences (a list item or heading loses
 * its marker), removes markdown emphasis, masks secrets / emails / URL
 * queries / phone numbers, and cuts at 280 characters. Anything that is
 * markup (`<system-reminder>`), an interrupt notice, or empty after masking
 * gives null.
 *
 * @param raw - Text of a `text` block
 * @param secrets - Exact secret values to mask (backend env)
 * @returns The line, or null when nothing worth showing is left
 */
export function shortAgentLine(raw: unknown, secrets: readonly SecretEnvValue[] = []): string | null {
	if (typeof raw !== 'string') return null;
	let s = raw.length > 6000 ? raw.slice(0, 6000) : raw;
	s = s.replace(INVISIBLE, '').replace(ANSI, '');
	// Code is never a "short line": drop fenced blocks (an unclosed fence runs to the end)
	s = s.replace(/```[\s\S]*?(?:```|$)/g, '\n\n').replace(/~~~[\s\S]*?(?:~~~|$)/g, '\n\n');
	const paragraphs = s
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
	let first = paragraphs.find((p) => !/^(?:\||<|\[Request interrupted|No response requested|API Error)/i.test(p)) ?? '';
	// Soft-wrapped lines are one sentence; a list shows its first item
	const lines = first.split('\n').map((l) => l.trim()).filter(Boolean);
	first = /^(?:[-*+]|\d+[.)])\s/.test(lines[0] ?? '') ? (lines[0] ?? '') : lines.join(' ');
	first = first
		.replace(/^(?:#{1,6}|[-*+]|\d+[.)]|>)\s+/, '')
		.replace(/\[([^\]]{1,120})\]\(([^)\s]*)\)/g, '$1')
		.replace(/(\*\*|__|\*|_|`)/g, '');
	if (first.length < 2 || /^<[a-z/!]/i.test(first)) return null;
	const out = scrubText(maskCommon(redactSecrets(first, secrets).replace(REDACTED_MASK, REDACTED)).replace(PHONE, '[number]'), C.TEXT_MAX);
	if (!/[\p{L}\p{N}]/u.test(out.replace(/\[(?:redacted|email|number|query)\]/gi, ''))) return null;
	return out;
}

/**
 * Mask a terminal tail for the canvas: ANSI and control characters removed,
 * then secrets (by value, by `NAME=value`, by shape), emails, URL queries and
 * credentials, bearer tokens, password prompts and long token-like words.
 *
 * @param text - Raw tail (the PTY capture)
 * @param secrets - Exact secret values to mask (backend env)
 * @param maxLines - Keep this many lines from the end
 * @returns Lines, oldest first, each at most {@link CANVAS_CONSTANTS.TERMINAL_MAX_LINE_CHARS} characters
 */
export function maskTerminalText(text: string, secrets: readonly SecretEnvValue[] = [], maxLines: number = C.TERMINAL_TAIL_LINES): string[] {
	// Bound the work first: the patterns below are linear per line, but a single
	// megabyte-long line of letters would still cost seconds in the email pattern
	const bounded = (text.length > MAX_RAW_CHARS ? text.slice(-MAX_RAW_CHARS) : text)
		.split('\n')
		.slice(-(maxLines + 20))
		.map((l) => (l.length > MAX_RAW_LINE ? l.slice(0, MAX_RAW_LINE) : l));
	let s = bounded.join('\n').replace(/\r\n/g, '\n').replace(ANSI, '').replace(INVISIBLE, '');
	// A carriage return redraws the line: keep what was drawn last
	s = s
		.split('\n')
		.map((l) => {
			const drawn = l.includes('\r') ? (l.split('\r').filter(Boolean).pop() ?? '') : l;
			return drawn.length > MASK_LINE_CHARS ? drawn.slice(0, MASK_LINE_CHARS) : drawn;
		})
		.join('\n');
	// eslint-disable-next-line no-control-regex
	s = s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
	// Whole-text passes first: a private key block spans lines
	s = redactSecrets(s, secrets).replace(REDACTED_MASK, REDACTED);
	s = s.replace(PROMPT_SECRET, `$1${REDACTED}`);
	const lines = s.split('\n').map((line) => {
		let l = maskCommon(line);
		l = l.replace(PHONE, '[number]');
		l = l.replace(/[A-Za-z0-9_+=/-]{24,}/g, (w) => (looksSecretWord(w) ? REDACTED : w));
		return clip(l.replace(/\s+$/, ''), C.TERMINAL_MAX_LINE_CHARS);
	});
	while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
	return lines.slice(-maxLines);
}
