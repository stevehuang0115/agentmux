/**
 * Redaction for the Owner Board (crewly#1247). Everything that leaves the
 * machine as board text goes through here first: query strings, tokens,
 * emails and phone numbers are removed, URLs are cut to host + path, commands
 * to executable + subcommand, file paths to project-relative, and every text
 * to at most {@link BOARD_CONSTANTS.MAX_TEXT} characters.
 *
 * Pure (no I/O). The functions never throw and never return their input
 * unchanged when it looks like a secret.
 *
 * @module services/board/board-redact
 */

import * as os from 'os';
import * as path from 'path';
import { BOARD_CONSTANTS } from '../../constants.js';

const MAX = BOARD_CONSTANTS.MAX_TEXT;

/** Placeholder for removed secrets. */
export const REDACTED = '[redacted]';

const URL_IN_TEXT = /\b(?:https?|ftp|wss?):\/\/[^\s<>"'`)\]]+/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const EMAIL_ONE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const BEARER = /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi;
/** `token=abc`, `password: abc`, `--api-key abc`, `"secret":"abc"` */
const SECRET_ASSIGNMENT = /((?:api[_-]?key|access[_-]?key|secret|token|passw(?:or)?d|pwd|auth(?:orization)?|credential|private[_-]?key|session)[\w-]*["']?\s*[=:]\s*["']?)[^\s"',;&]+/gi;
const SECRET_FLAG = /(--?(?:api[_-]?key|token|secret|passw(?:or)?d|pwd|auth|key|authorization)(?:=|\s+))[^\s]+/gi;
const KNOWN_PREFIX =
	/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}|\bgh[pousr]_[A-Za-z0-9]{16,}|\bgithub_pat_[A-Za-z0-9_]{16,}|\bxox[abprso]-[A-Za-z0-9-]{8,}|\bAKIA[0-9A-Z]{12,}|\bAIza[0-9A-Za-z_-]{20,}|\bya29\.[\w-]{10,}|\beyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]*|\bnpm_[A-Za-z0-9]{20,}|\bglpat-[\w-]{12,}/g;
/** Digits with separators, at least 9 digits in all (dates have 8). */
const PHONE = /(?<![\w.])\+?\d[\d\s().-]{7,}\d(?![\w])/g;
const LONG_TOKEN = /(?<![\w/.:-])[A-Za-z0-9_+=-]{24,}(?![\w])/g;
const HEX_LONG = /\b[0-9a-fA-F]{32,}\b/g;

/**
 * Whether a path segment or word looks like an identifier or a token, not a
 * human name: long with digits and letters, long hex, or a long number.
 *
 * @param s - Segment
 * @returns True when it should not be shown
 */
export function looksLikeToken(s: string): boolean {
	if (s.length >= 32 && /^[0-9a-fA-F-]+$/.test(s)) return true;
	if (/^\d{9,}$/.test(s)) return true;
	if (s.length >= 20 && /\d/.test(s) && /[A-Za-z]/.test(s) && /^[A-Za-z0-9_+=-]+$/.test(s)) return true;
	if (s.length >= 28 && /^[A-Za-z0-9_+=-]+$/.test(s) && /[A-Z]/.test(s) && /[a-z]/.test(s)) return true;
	return false;
}

/**
 * Cut a text to the board limit.
 *
 * @param s - Text
 * @param max - Limit (default 140)
 * @returns The text, ending with an ellipsis when cut
 */
export function clip(s: string, max: number = MAX): string {
	if (s.length <= max) return s;
	return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * A URL as host + path: no scheme, credentials, port, query or fragment;
 * path segments that look like ids or tokens become `:id`.
 *
 * @param raw - URL or `host/path`
 * @returns `host/path` (at most 100 characters), or `[redacted]` when unparseable
 */
export function redactUrl(raw: string): string {
	const trimmed = raw.trim().replace(/[.,;:!?)\]]+$/, '');
	if (!trimmed) return REDACTED;
	let url: URL;
	try {
		url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
	} catch {
		return REDACTED;
	}
	const host = url.hostname.toLowerCase();
	if (!host || /[^a-z0-9.-]/.test(host)) return REDACTED;
	const segments = url.pathname
		.split('/')
		.filter(Boolean)
		.map((seg) => {
			let s = seg;
			try {
				s = decodeURIComponent(seg);
			} catch {
				// keep raw
			}
			if (looksLikeToken(s) || EMAIL_ONE.test(s) || s.length > 40) return ':id';
			return s.replace(/[^\w.~:@!$&'()*+,=-]/g, '');
		});
	const out = segments.length > 0 ? `${host}/${segments.join('/')}` : host;
	return clip(out, 100);
}

/**
 * A free text made safe: one line, URLs reduced, secrets / emails / phone
 * numbers removed, at most 140 characters.
 *
 * @param input - Any text
 * @param max - Limit (default 140)
 * @returns Safe text (possibly empty)
 */
export function scrubText(input: unknown, max: number = MAX): string {
	if (typeof input !== 'string' || input.length === 0) return '';
	let s = input.length > 4000 ? input.slice(0, 4000) : input;
	// eslint-disable-next-line no-control-regex
	s = s.replace(/[\u0000-\u001f\u007f]+/g, ' ');
	s = s.replace(URL_IN_TEXT, (u) => redactUrl(u));
	s = s.replace(EMAIL, '[email]');
	s = s.replace(BEARER, REDACTED);
	s = s.replace(SECRET_ASSIGNMENT, `$1${REDACTED}`);
	s = s.replace(SECRET_FLAG, `$1${REDACTED}`);
	s = s.replace(KNOWN_PREFIX, REDACTED);
	s = s.replace(HEX_LONG, REDACTED);
	s = s.replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 9 ? '[number]' : m));
	s = s.replace(LONG_TOKEN, (m) => (looksLikeToken(m) ? REDACTED : m));
	s = s.replace(/\s+/g, ' ').trim();
	return clip(s, max);
}

/** Home directory prefixes shown as `~`. */
const HOME_PATTERN = /^(?:\/Users|\/home)\/[^/]+(?=\/|$)/;

/**
 * A file path relative to the project it is in, so no absolute path, user
 * name or machine layout leaves the machine.
 *
 * @param file - Absolute or relative path
 * @param roots - Project roots to make it relative to (longest match wins)
 * @returns `repo/relative/path`, `~/…`, or `…/last/segments`; at most 100 characters
 */
export function relativePath(file: string, roots: readonly string[] = []): string {
	let p = file.trim().replace(/\\/g, '/');
	if (!p) return '';
	const ordered = [...roots].map((r) => r.replace(/\\/g, '/').replace(/\/+$/, '')).filter(Boolean).sort((a, b) => b.length - a.length);
	let out: string | null = null;
	for (const root of ordered) {
		if (p === root) {
			out = path.posix.basename(root);
			break;
		}
		if (p.startsWith(`${root}/`)) {
			out = `${path.posix.basename(root)}/${p.slice(root.length + 1)}`;
			break;
		}
	}
	if (out === null) {
		const home = os.homedir().replace(/\\/g, '/');
		if (home && home !== '/' && (p === home || p.startsWith(`${home}/`))) p = `~${p.slice(home.length)}`;
		else if (HOME_PATTERN.test(p)) p = p.replace(HOME_PATTERN, '~');
		if (p.startsWith('/')) {
			const parts = p.split('/').filter(Boolean);
			p = parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : parts.join('/');
		} else if (p.startsWith('~/')) {
			const parts = p.split('/');
			if (parts.length > 5) p = `~/…/${parts.slice(-3).join('/')}`;
		}
		out = p;
	}
	const cleaned = out
		.split('/')
		.map((seg) => (looksLikeToken(seg) ? ':id' : seg))
		.join('/');
	const scrubbed = scrubText(cleaned, 400);
	if (scrubbed.length <= 100) return scrubbed;
	return `…${scrubbed.slice(scrubbed.length - 99)}`;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** Tools whose first plain word is a subcommand worth showing (`git push`). */
const SUBCOMMAND_TOOLS = new Set([
	'git', 'npm', 'pnpm', 'yarn', 'bun', 'npx', 'docker', 'docker-compose', 'gh', 'kubectl', 'cargo', 'brew', 'pip', 'pip3', 'go', 'make',
	'systemctl', 'pm2', 'aws', 'gcloud', 'vercel', 'wrangler', 'terraform', 'tmux', 'apt', 'apt-get', 'jest', 'tsc', 'crewly',
]);
/** Interpreters: the script name is shown. */
const INTERPRETERS = new Set(['python', 'python3', 'node', 'tsx', 'ts-node', 'ruby', 'bash', 'sh', 'zsh', 'deno', 'perl', 'php']);
/** Leading words that run something else. */
const WRAPPERS = new Set(['sudo', 'env', 'time', 'nohup', 'nice', 'command', 'exec', 'builtin', 'stdbuf', 'caffeinate', 'xargs']);
/** Segments that only set the scene. */
const SCENE_SETTERS = new Set(['cd', 'export', 'set', 'unset', 'source', '.', 'pushd', 'popd', 'true', 'false', ':', 'shopt', 'umask', 'trap', 'ulimit', 'alias']);

const SUB_WORD = /^[a-z][a-z0-9:_-]{0,30}$/;
const SCRIPT_FILE = /\.(?:py|js|mjs|cjs|ts|tsx|sh|rb|pl|php)$/i;
const EXECUTABLE = /^[A-Za-z0-9._+-]{1,40}$/;
const SKILL_SCRIPT = /\/skills\/(?:[\w.-]+\/)*([\w-]+)\/execute\.sh$/;

/**
 * Split a shell command into segments of words (quotes removed). Separators
 * `&&`, `||`, `;`, `|`, `&` and newlines end a segment. Not a full parser; it
 * only needs to find the first words of each segment safely.
 *
 * @param command - Shell command
 * @returns Segments
 */
export function splitCommand(command: string): string[][] {
	const segments: string[][] = [];
	let words: string[] = [];
	let cur = '';
	let has = false;
	let quote: '"' | "'" | null = null;
	const endWord = (): void => {
		if (has) words.push(cur);
		cur = '';
		has = false;
	};
	const endSegment = (): void => {
		endWord();
		if (words.length > 0) segments.push(words);
		words = [];
	};
	const s = command.length > 4000 ? command.slice(0, 4000) : command;
	for (let i = 0; i < s.length; i += 1) {
		const c = s[i];
		if (quote) {
			if (c === quote) quote = null;
			else if (c === '\\' && quote === '"' && i + 1 < s.length) cur += s[(i += 1)];
			else cur += c;
			continue;
		}
		if (c === '"' || c === "'") {
			quote = c;
			has = true;
		} else if (c === '\\' && i + 1 < s.length) {
			cur += s[(i += 1)];
			has = true;
		} else if (c === '\n' || c === ';' || c === '|' || c === '&') {
			// `2>&1` and `&>` are redirections, not separators
			if (c === '&' && (s[i - 1] === '>' || s[i + 1] === '>' || /\d/.test(s[i - 1] ?? ''))) {
				cur += c;
				has = true;
				continue;
			}
			endSegment();
			if ((c === '&' || c === '|') && s[i + 1] === c) i += 1;
		} else if (c === ' ' || c === '\t') {
			endWord();
		} else {
			cur += c;
			has = true;
		}
	}
	endSegment();
	return segments;
}

/** The result of reducing a command. */
export interface ReducedCommand {
	/** `git push`, `npm run build`, `python build.py`, `ffmpeg` */
	label: string;
	/** Executable name alone */
	executable: string;
	/** Skill name when the command runs a Crewly skill script */
	skill?: string;
	/** Words of the segment after the executable (not shown; for the normalizer's own parsing) */
	args: string[];
}

/**
 * Reduce a shell command to the executable and subcommand. Arguments are
 * never part of the label, so tokens, URLs and prompts in them cannot leak.
 *
 * @param command - Shell command
 * @returns The reduced command, or null when nothing recognisable is in it
 *
 * @example
 * ```typescript
 * reduceCommand('cd app && GIT_TOKEN=abc git -C x push origin main'); // label: 'git push'
 * ```
 */
export function reduceCommand(command: string): ReducedCommand | null {
	for (const original of splitCommand(command)) {
		const words = [...original];
		// Leading assignments and wrappers
		for (;;) {
			const w = words[0];
			if (w === undefined) break;
			if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) {
				words.shift();
				continue;
			}
			const base = path.posix.basename(w);
			if (WRAPPERS.has(base)) {
				words.shift();
				// `timeout 30 cmd`, `nice -n 5 cmd`, `env -i cmd`
				while (words[0] !== undefined && (words[0].startsWith('-') || /^\d+$/.test(words[0]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]))) words.shift();
				continue;
			}
			if (base === 'timeout') {
				words.shift();
				while (words[0] !== undefined && (words[0].startsWith('-') || /^\d+[smhd]?$/.test(words[0]))) words.shift();
				continue;
			}
			break;
		}
		const head = words[0];
		if (head === undefined) continue;
		const exe = path.posix.basename(head);
		if (SCENE_SETTERS.has(exe) || exe.startsWith('#')) continue;
		const skillMatch = SKILL_SCRIPT.exec(head.replace(/\\/g, '/')) ?? (INTERPRETERS.has(exe) && words[1] ? SKILL_SCRIPT.exec(words[1].replace(/\\/g, '/')) : null);
		if (skillMatch) {
			return { label: `skill ${skillMatch[1]}`, executable: 'bash', skill: skillMatch[1], args: words.slice(INTERPRETERS.has(exe) ? 2 : 1) };
		}
		if (!EXECUTABLE.test(exe) || looksLikeToken(exe)) return { label: 'shell command', executable: 'shell', args: [] };
		const args = words.slice(1);
		if (SUBCOMMAND_TOOLS.has(exe)) {
			const rest = [...args];
			let sub: string | undefined;
			while (rest.length > 0) {
				const w = rest.shift() as string;
				if (exe === 'git' && (w === '-C' || w === '-c' || w === '--git-dir' || w === '--work-tree')) {
					rest.shift();
					continue;
				}
				if (w.startsWith('-')) continue;
				if (SUB_WORD.test(w)) sub = w;
				break;
			}
			let label = sub ? `${exe} ${sub}` : exe;
			if (sub && (sub === 'run' || sub === 'run-script') && (exe === 'npm' || exe === 'pnpm' || exe === 'yarn' || exe === 'bun')) {
				const script = rest.find((w) => !w.startsWith('-'));
				if (script && SUB_WORD.test(script)) label = `${exe} run ${script}`;
			}
			return { label, executable: exe, args };
		}
		if (INTERPRETERS.has(exe)) {
			const first = args.find((w) => !w.startsWith('-'));
			const inline = args.some((w) => w === '-c' || w === '-e' || w === '--eval' || w === '-p');
			const module = args[0] === '-m' && args[1] && /^[A-Za-z_][\w.]{0,40}$/.test(args[1]) ? args[1] : null;
			if (module) return { label: `${exe} -m ${module}`, executable: exe, args };
			if (inline) return { label: `${exe} (inline script)`, executable: exe, args };
			if (first && SCRIPT_FILE.test(first)) {
				const file = path.posix.basename(first);
				if (/^[\w.-]{1,50}$/.test(file) && !looksLikeToken(file.replace(/\.[^.]+$/, ''))) return { label: `${exe} ${file}`, executable: exe, args };
			}
			return { label: exe, executable: exe, args };
		}
		return { label: exe, executable: exe, args };
	}
	return null;
}
