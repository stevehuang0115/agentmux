/**
 * Tests for terminal output utilities.
 *
 * Covers ANSI code stripping (critical for [CHAT_RESPONSE] marker detection),
 * response hash generation, and deduplication logic.
 *
 * @module terminal-output-utils.test
 */

import { stripAnsiCodes, generateResponseHash, ResponseDeduplicator } from './terminal-output.utils.js';

describe('stripAnsiCodes', () => {
	describe('color codes', () => {
		it('should remove basic color codes', () => {
			expect(stripAnsiCodes('\x1b[31mred text\x1b[0m')).toBe('red text');
		});

		it('should remove multi-parameter color codes', () => {
			expect(stripAnsiCodes('\x1b[1;33mBold Yellow\x1b[0m')).toBe('Bold Yellow');
		});

		it('should remove 256-color codes', () => {
			expect(stripAnsiCodes('\x1b[38;5;202morange\x1b[0m')).toBe('orange');
		});
	});

	describe('cursor movement', () => {
		it('should replace cursor forward with space', () => {
			expect(stripAnsiCodes('hello\x1b[5Cworld')).toBe('hello world');
		});

		it('should replace cursor forward (zero digits) with space', () => {
			// \x1b[C (no digits) is still matched by \d* in the first pass
			expect(stripAnsiCodes('hello\x1b[Cworld')).toBe('hello world');
		});

		it('should remove cursor up/down sequences', () => {
			expect(stripAnsiCodes('line1\x1b[1Aup')).toBe('line1up');
		});
	});

	describe('CHAT_RESPONSE marker preservation (critical)', () => {
		it('should NOT strip [C from [CHAT_RESPONSE]', () => {
			const input = '[CHAT_RESPONSE]Hello world[/CHAT_RESPONSE]';
			const result = stripAnsiCodes(input);
			expect(result).toContain('[CHAT_RESPONSE]');
			expect(result).toContain('[/CHAT_RESPONSE]');
		});

		it('should NOT strip [C from [/CHAT_RESPONSE]', () => {
			const input = 'some text [/CHAT_RESPONSE]';
			const result = stripAnsiCodes(input);
			expect(result).toContain('[/CHAT_RESPONSE]');
		});

		it('should strip orphaned [1C but preserve [CHAT_RESPONSE]', () => {
			// This is the critical test case: orphaned CSI artifacts with digits
			// must not break the CHAT_RESPONSE markers
			const input = 'about[1Cyour [CHAT_RESPONSE]message here[/CHAT_RESPONSE]';
			const result = stripAnsiCodes(input);
			expect(result).toContain('[CHAT_RESPONSE]');
			expect(result).toContain('[/CHAT_RESPONSE]');
			expect(result).toContain('about your'); // [1C replaced with space
		});

		it('should handle CHAT_RESPONSE with ANSI codes inside', () => {
			const input = '[CHAT_RESPONSE]\x1b[1mBold\x1b[0m response[/CHAT_RESPONSE]';
			const result = stripAnsiCodes(input);
			expect(result).toBe('[CHAT_RESPONSE]Bold response[/CHAT_RESPONSE]');
		});

		it('should handle content with [H markers (cursor home) without breaking', () => {
			// [H should not be matched by orphaned CSI pattern (no digits before H)
			const input = '[CHAT_RESPONSE]content[/CHAT_RESPONSE]';
			const result = stripAnsiCodes(input);
			expect(result).toContain('[CHAT_RESPONSE]');
		});
	});

	describe('orphaned CSI fragments', () => {
		it('should replace [1C with space (cursor forward orphan)', () => {
			expect(stripAnsiCodes('word[1Cnext')).toBe('word next');
		});

		it('should replace [22m (orphaned color reset)', () => {
			expect(stripAnsiCodes('text[22mbold')).toBe('textbold');
		});

		it('should not match [C without digits (could be part of marker text)', () => {
			// \[\d+C requires at least one digit, so bare [C is NOT replaced
			const result = stripAnsiCodes('[CHAT_RESPONSE]');
			expect(result).toBe('[CHAT_RESPONSE]');
		});
	});

	describe('OSC sequences', () => {
		it('should remove title change sequences', () => {
			expect(stripAnsiCodes('\x1b]0;My Terminal\x07text')).toBe('text');
		});

		it('should remove hyperlink sequences', () => {
			expect(stripAnsiCodes('\x1b]8;id=123;https://example.com\x07link\x1b]8;;\x07')).toBe('link');
		});
	});

	describe('line ending normalization', () => {
		it('should normalize CR+LF to LF', () => {
			expect(stripAnsiCodes('line1\r\nline2')).toBe('line1\nline2');
		});

		it('should normalize bare CR to LF', () => {
			expect(stripAnsiCodes('line1\rline2')).toBe('line1\nline2');
		});

		it('should keep existing LF unchanged', () => {
			expect(stripAnsiCodes('line1\nline2')).toBe('line1\nline2');
		});
	});

	describe('control characters', () => {
		it('should remove null bytes', () => {
			expect(stripAnsiCodes('hel\x00lo')).toBe('hello');
		});

		it('should keep tabs', () => {
			expect(stripAnsiCodes('col1\tcol2')).toBe('col1\tcol2');
		});

		it('should keep newlines', () => {
			expect(stripAnsiCodes('line1\nline2')).toBe('line1\nline2');
		});

		it('should remove DEL character', () => {
			expect(stripAnsiCodes('hel\x7Flo')).toBe('hello');
		});
	});

	describe('complex real-world examples', () => {
		it('should clean typical Claude Code output', () => {
			const input = '\x1b[1m\x1b[32m⏺\x1b[0m Ready for tasks.\x1b[0m\r\n';
			const result = stripAnsiCodes(input);
			expect(result).toContain('Ready for tasks.');
		});

		it('should handle mixed ANSI and CHAT_RESPONSE markers', () => {
			const input = '\x1b[2K\x1b[1G[CHAT_RESPONSE]\x1b[1mProject Created\x1b[0m\ntest-project has been set up\n[/CHAT_RESPONSE]\x1b[0m';
			const result = stripAnsiCodes(input);
			expect(result).toContain('[CHAT_RESPONSE]');
			expect(result).toContain('[/CHAT_RESPONSE]');
			expect(result).toContain('Project Created');
		});
	});
});

describe('generateResponseHash', () => {
	it('should generate hash with conversation ID prefix', () => {
		const hash = generateResponseHash('conv-1', 'Hello world');
		expect(hash).toStartWith('conv-1:');
	});

	it('should normalize whitespace', () => {
		const hash1 = generateResponseHash('conv-1', 'Hello   world');
		const hash2 = generateResponseHash('conv-1', 'Hello world');
		expect(hash1).toBe(hash2);
	});

	it('should trim content', () => {
		const hash1 = generateResponseHash('conv-1', '  Hello  ');
		const hash2 = generateResponseHash('conv-1', 'Hello');
		expect(hash1).toBe(hash2);
	});

	it('should truncate long content', () => {
		const longContent = 'a'.repeat(500);
		const hash = generateResponseHash('conv-1', longContent);
		// "conv-1:" + 200 chars = 207 max length
		expect(hash.length).toBeLessThanOrEqual(207);
	});

	it('should differentiate different conversations', () => {
		const hash1 = generateResponseHash('conv-1', 'same content');
		const hash2 = generateResponseHash('conv-2', 'same content');
		expect(hash1).not.toBe(hash2);
	});

	it('should differentiate different content', () => {
		const hash1 = generateResponseHash('conv-1', 'content A');
		const hash2 = generateResponseHash('conv-1', 'content B');
		expect(hash1).not.toBe(hash2);
	});
});

describe('ResponseDeduplicator', () => {
	let dedup: ResponseDeduplicator;

	beforeEach(() => {
		dedup = new ResponseDeduplicator(3);
	});

	it('should return false for new hashes', () => {
		expect(dedup.isDuplicate('hash-1')).toBe(false);
	});

	it('should return true for duplicate hashes', () => {
		dedup.isDuplicate('hash-1');
		expect(dedup.isDuplicate('hash-1')).toBe(true);
	});

	it('should track size correctly', () => {
		dedup.isDuplicate('hash-1');
		dedup.isDuplicate('hash-2');
		expect(dedup.size).toBe(2);
	});

	it('should evict oldest hash when over limit', () => {
		dedup.isDuplicate('hash-1');
		dedup.isDuplicate('hash-2');
		dedup.isDuplicate('hash-3');
		dedup.isDuplicate('hash-4'); // This should evict hash-1

		expect(dedup.size).toBe(3);
		// hash-1 was evicted, so it should be treated as new
		expect(dedup.isDuplicate('hash-1')).toBe(false);
	});

	it('should not evict when at limit', () => {
		dedup.isDuplicate('hash-1');
		dedup.isDuplicate('hash-2');
		dedup.isDuplicate('hash-3');

		expect(dedup.size).toBe(3);
		expect(dedup.isDuplicate('hash-1')).toBe(true); // Still tracked
	});

	it('should clear all hashes', () => {
		dedup.isDuplicate('hash-1');
		dedup.isDuplicate('hash-2');
		dedup.clear();

		expect(dedup.size).toBe(0);
		expect(dedup.isDuplicate('hash-1')).toBe(false);
	});

	it('should use default max size of 20', () => {
		const defaultDedup = new ResponseDeduplicator();
		for (let i = 0; i < 25; i++) {
			defaultDedup.isDuplicate(`hash-${i}`);
		}
		expect(defaultDedup.size).toBe(20);
	});
});

// Custom matcher for string prefix
expect.extend({
	toStartWith(received: string, prefix: string) {
		const pass = received.startsWith(prefix);
		return {
			message: () => `expected "${received}" to start with "${prefix}"`,
			pass,
		};
	},
});

declare global {
	namespace jest {
		interface Matchers<R> {
			toStartWith(prefix: string): R;
		}
	}
}
