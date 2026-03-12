/**
 * Terminal output utilities for processing PTY output.
 *
 * Provides functions for stripping ANSI escape codes and deduplicating
 * chat responses from orchestrator terminal output.
 *
 * @module terminal-output-utils
 */

/**
 * Strip ANSI escape codes from PTY output for reliable pattern matching.
 *
 * Delegates to the regex-free state-machine implementation in terminal-string-ops.
 * Handles color codes, cursor movements, OSC sequences, and other control
 * characters. Cursor forward movements are replaced with spaces to preserve
 * word boundaries in rendered output.
 *
 * @param content - Raw PTY output containing ANSI codes
 * @returns Clean text with ANSI codes removed
 */
import { stripAnsiCodes } from './terminal-string-ops.js';
export { stripAnsiCodes };

/** Braille spinner characters used by Claude Code TUI */
const SPINNER_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

/** Block / progress bar characters */
const PROGRESS_CHARS = '▀▄▌▐█░▒▓';

/** TUI status lines that should be stripped from chat replies */
const TUI_STATUS_LINES = [
	// Claude Code TUI
	'Configure terminal keybindings',
	'Press Escape to interrupt',
	'Thinking…',
	'⏺ ',
	// Gemini CLI TUI
	'Use ripgrep for faster file',
	'Type your message or @path/to/file',
	'esc to cancel',
	'Press Ctrl+O to show more lines',
	'of the last response',
	'press tab twice for more',
	'List your saved chat checkpoints',
	'YOLO',
	'w sandbox',
	'no sandbox',
	'View and edit settings with',
	'/settings editor',
	'/model',
];

/**
 * Regex patterns for Gemini CLI TUI artifacts that may appear inline
 * (not as complete lines but embedded within content).
 */
const TUI_INLINE_PATTERNS = [
	// ORDER MATTERS: parenthesized groups first, then their inner fragments
	// "esc to cancel" captures the whole (...) group including timer and Ctrl+O inside
	/\(esc to cancel[^)]*\)/g,
	// Timer countdowns: "11s)", "12s)", etc. from Gemini CLI status bar
	/\b\d{1,3}s\)\s*/g,
	// Gemini CLI prompt bullets: "• Type your message..."
	/•\s*Type your message[^\n]*/g,
	// "Press Ctrl+O..." fragments inline
	/Press Ctrl\+O[^\n]*/g,
	// "Use ripgrep..." fragments inline
	/Use ripgrep for faster file[^\n]*/g,
	// Gemini CLI keybinding hints: "Ctrl+Y", "Ctrl-Y"
	/\bCtrl[+-][A-Z]\b/g,
	// Gemini model/sandbox status line fragments
	/\b(?:no\s+)?sandbox\s+gemini-[^\n]*/gi,
	// F12 error indicators
	/\d+\s*error\s*\(F12 for deta[^\n]*/gi,
];

/**
 * Clean raw PTY/terminal output for sending as a Google Chat reply.
 *
 * Strips ANSI escape codes, TUI spinner/progress characters, and
 * status lines. Content is expected to already have NOTIFY blocks
 * extracted by upstream parsing (parseNotifyContent / terminal gateway).
 *
 * @param raw - Response text (may contain terminal artifacts)
 * @returns Cleaned text suitable for Google Chat
 */
export function cleanGoogleChatResponse(raw: string): string {
	// Step 1: Strip ANSI escape codes
	let cleaned = stripAnsiCodes(raw);

	// Step 2: Remove spinner characters
	for (const ch of SPINNER_CHARS) {
		cleaned = cleaned.split(ch).join('');
	}

	// Step 3: Remove progress bar characters
	for (const ch of PROGRESS_CHARS) {
		cleaned = cleaned.split(ch).join('');
	}

	// Step 4: Remove TUI status lines
	const lines = cleaned.split('\n');
	const filteredLines = lines.filter((line: string) => {
		const trimmed = line.trim();
		if (!trimmed) return true; // keep blank lines
		for (const status of TUI_STATUS_LINES) {
			if (trimmed.startsWith(status)) return false;
		}
		// Also filter lines that are ONLY TUI artifacts (e.g. just a timer like "11s)")
		if (/^\d{1,3}s\)\s*$/.test(trimmed)) return false;
		return true;
	});
	cleaned = filteredLines.join('\n');

	// Step 5: Remove inline TUI artifacts (Gemini CLI status fragments embedded in content)
	for (const pattern of TUI_INLINE_PATTERNS) {
		cleaned = cleaned.replace(pattern, '');
	}

	// Step 6: Collapse excessive blank lines (3+ → 2)
	cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

	return cleaned.trim();
}

/**
 * Generate a hash key for a chat response to detect duplicates.
 *
 * Normalizes whitespace and truncates to create a consistent key
 * for the same logical response content.
 *
 * @param conversationId - The conversation this response belongs to
 * @param content - The response content to hash
 * @returns A string key for deduplication
 */
export function generateResponseHash(conversationId: string, content: string): string {
	const normalized = content.replace(/\s+/g, ' ').trim();
	return `${conversationId}:${normalized.substring(0, 200)}`;
}

/**
 * Manages a set of recent response hashes for deduplication.
 * Uses a circular eviction strategy to bound memory usage.
 */
export class ResponseDeduplicator {
	private recentHashes = new Set<string>();
	private readonly maxSize: number;

	/**
	 * @param maxSize - Maximum number of hashes to track before evicting oldest
	 */
	constructor(maxSize: number = 20) {
		this.maxSize = maxSize;
	}

	/**
	 * Check if a response is a duplicate and track it if not.
	 *
	 * @param hash - The response hash to check
	 * @returns true if the response is a duplicate, false if it's new
	 */
	isDuplicate(hash: string): boolean {
		if (this.recentHashes.has(hash)) {
			return true;
		}
		this.recentHashes.add(hash);
		if (this.recentHashes.size > this.maxSize) {
			const first = this.recentHashes.values().next().value;
			if (first !== undefined) {
				this.recentHashes.delete(first);
			}
		}
		return false;
	}

	/** Clear all tracked hashes */
	clear(): void {
		this.recentHashes.clear();
	}

	/** Current number of tracked hashes */
	get size(): number {
		return this.recentHashes.size;
	}
}
