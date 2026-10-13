import { describe, it, expect } from '@jest/globals';
import { redactedScreenExcerpt, looksLikeShellPrompt, SCREEN_EXCERPT_MAX_ROWS, SCREEN_EXCERPT_MAX_CHARS } from './screen-excerpt.js';

describe('redactedScreenExcerpt', () => {
	it('keeps the bottom non-empty rows, readable', () => {
		const out = redactedScreenExcerpt(['top', '', ' Do you want to proceed?', ' ❯ 1. Yes', '   2. No', '', '']);
		expect(out).toBe('top\nDo you want to proceed?\n❯ 1. Yes\n2. No');
	});

	it('caps the number of rows', () => {
		const lines = Array.from({ length: 20 }, (_, i) => `row ${i}`);
		const out = redactedScreenExcerpt(lines).split('\n');
		expect(out).toHaveLength(SCREEN_EXCERPT_MAX_ROWS);
		expect(out[out.length - 1]).toBe('row 19');
	});

	it('masks tokens, secret assignments, URL credentials and long opaque runs', () => {
		const out = redactedScreenExcerpt([
			'export OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz0123456789',
			'git clone https://bob:hunter2pass@github.com/x/y.git',
			'id ABCDEFGHIJKLMNOPQRSTUVWXYZ012345 done',
		]);
		expect(out).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789');
		expect(out).not.toContain('hunter2pass');
		expect(out).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ012345');
		expect(out).toContain('done');
	});

	it('caps total and per-row length', () => {
		const out = redactedScreenExcerpt(Array.from({ length: 6 }, () => 'word '.repeat(60)));
		expect(out.length).toBeLessThanOrEqual(SCREEN_EXCERPT_MAX_CHARS);
	});

	it('is empty for a blank screen', () => {
		expect(redactedScreenExcerpt(['', '  ', ''])).toBe('');
	});
});

describe('looksLikeShellPrompt', () => {
	it('recognises a bare zsh prompt', () => {
		expect(looksLikeShellPrompt('some output\nuser@host project %')).toBe(true);
		expect(looksLikeShellPrompt('$')).toBe(true);
	});
	it('does not take a dialog for a shell', () => {
		expect(looksLikeShellPrompt('Do you want to proceed?\n❯ 1. Yes\n2. No')).toBe(false);
		expect(looksLikeShellPrompt('')).toBe(false);
	});
});
