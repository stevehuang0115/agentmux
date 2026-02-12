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
 * Handles color codes, cursor movements, OSC sequences, and other control
 * characters. Cursor forward movements are replaced with spaces to preserve
 * word boundaries in rendered output.
 *
 * @param content - Raw PTY output containing ANSI codes
 * @returns Clean text with ANSI codes removed
 */
export function stripAnsiCodes(content: string): string {
	return content
		// Replace cursor forward movements with a space (\d* is safe here because \x1b prefix
		// prevents false matches with text like [CHAT_RESPONSE]; orphaned CSI below uses \d+)
		.replace(/\x1b\[\d*C/g, ' ')
		// Remove other CSI sequences (colors, cursor positioning, etc.)
		.replace(/\x1b\[[0-9;]*[A-Za-zH]/g, '')
		// Remove OSC sequences (title changes, hyperlinks, etc.)
		.replace(/\x1b\][^\x07]*\x07/g, '')
		// Remove other escape sequences
		.replace(/\x1b[^[\]].?/g, '')
		// Clean orphaned CSI fragments from PTY buffer boundary splits.
		// When ESC char lands in one chunk and the CSI params in the next,
		// artifacts like "[1C", "[22m", or "[38;2;249;226;175m" appear mid-word.
		// Note: \d+ (one or more digits) required to avoid matching [C in [CHAT_RESPONSE]
		.replace(/\[\d+C/g, ' ')
		.replace(/\[\d+(?:;\d+)*[A-BJKHfm]/g, '')
		// Replace carriage returns with newline (CR/LF normalization)
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		// Remove remaining control characters but keep tabs and newlines
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
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
