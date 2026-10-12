import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { defaultCategory, keywordsOf, matchCategory, NO_TICKET_CATEGORY, OTHER_CATEGORY, UnitClassifier } from './unit-classifier.js';
import type { CategoryDef } from './usage-categories.store.js';

const defs: CategoryDef[] = [
	{ name: 'self-media', description: 'Xiaohongshu, Substack, LinkedIn, videos' },
	{ name: 'book', keywords: ['chapter', 'manuscript'], teams: ['Writers'] },
];

describe('keywordsOf / matchCategory', () => {
	it('uses the comma separated phrases of a description when there are no keywords', () => {
		expect(keywordsOf(defs[0])).toEqual(['xiaohongshu', 'substack', 'linkedin', 'videos']);
		expect(keywordsOf(defs[1])).toEqual(['chapter', 'manuscript']);
	});

	it('matches by keyword, case-insensitively', () => {
		expect(matchCategory({ unitId: 'a', title: 'Draft a LinkedIn post' }, defs)).toBe('self-media');
		expect(matchCategory({ unitId: 'b', title: 'Rewrite chapter 3' }, defs)).toBe('book');
	});

	it('matches by team and project hints, which outweigh a single keyword', () => {
		expect(matchCategory({ unitId: 'a', title: 'weekly video plan', team: 'Writers' }, defs)).toBe('book');
		expect(matchCategory({ unitId: 'a', title: 'x', project: 'Site' }, [{ name: 'web', projects: ['site'] }])).toBe('web');
	});

	it('needs whole words for very short keywords', () => {
		const ai: CategoryDef[] = [{ name: 'ai', keywords: ['ai'] }];
		expect(matchCategory({ unitId: 'a', title: 'send email' }, ai)).toBeNull();
		expect(matchCategory({ unitId: 'a', title: 'AI roadmap' }, ai)).toBe('ai');
	});

	it('returns null when nothing matches', () => {
		expect(matchCategory({ unitId: 'a', title: 'fix the build' }, defs)).toBeNull();
	});
});

describe('UnitClassifier', () => {
	let dir: string;
	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-cls-'));
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	it('with no definitions the category is the team, else the project, else other', async () => {
		const c = new UnitClassifier(dir);
		const r = await c.classify(
			[
				{ unitId: 'a', team: 'Marketing', project: 'Site' },
				{ unitId: 'b', project: 'Site' },
				{ unitId: 'c' },
			],
			[],
		);
		expect([...r.categories]).toEqual([['a', 'Marketing'], ['b', 'Site'], ['c', OTHER_CATEGORY]]);
		expect(defaultCategory({ unitId: 'x', team: ' ' })).toBe(OTHER_CATEGORY);
		expect(NO_TICKET_CATEGORY).toBe('(no ticket)');
	});

	it('with definitions: deterministic matches first, "other" without a model', async () => {
		const c = new UnitClassifier(dir);
		const r = await c.classify([{ unitId: 'a', title: 'substack post' }, { unitId: 'b', title: 'fix build' }], defs);
		expect(r.categories.get('a')).toBe('self-media');
		expect(r.categories.get('b')).toBe(OTHER_CATEGORY);
		expect(r).toMatchObject({ llmClassified: 0, unclassified: 1 });
	});

	it('asks the model only for tickets nothing matched, and only accepts known categories', async () => {
		const llm = jest.fn(async () => '```json\n{"1":"Book","2":"nonsense"}\n```');
		const c = new UnitClassifier(dir, llm);
		const r = await c.classify([{ unitId: 'a', title: 'substack post' }, { unitId: 'b', title: 'talk about the manuscript-like thing' }, { unitId: 'c', title: 'fix build' }, { unitId: 'd', title: 'x' }], defs);
		expect(llm).toHaveBeenCalledTimes(1);
		const prompt = (llm.mock.calls[0] as unknown as [string])[0];
		expect(prompt).toContain('- book');
		expect(prompt).not.toContain('substack post');
		expect(r.categories.get('a')).toBe('self-media');
		expect(r.categories.get('b')).toBe('book');
		expect(r.categories.get('c')).toBe('book');
		expect(r.categories.get('d')).toBe(OTHER_CATEGORY);
	});

	it('caches per category set: no second model call, new set reclassifies', async () => {
		const llm = jest.fn(async () => '{"1":"book"}');
		const c = new UnitClassifier(dir, llm);
		const units = [{ unitId: 'z', title: 'something vague' }];
		await c.classify(units, defs);
		expect((await new UnitClassifier(dir, llm).classify(units, defs)).categories.get('z')).toBe('book');
		expect(llm).toHaveBeenCalledTimes(1);
		const changed: CategoryDef[] = [{ name: 'ops', keywords: ['vague'] }, ...defs];
		expect((await new UnitClassifier(dir, llm).classify(units, changed)).categories.get('z')).toBe('ops');
	});

	it('does not cache a fallback "other" that came from having no model', async () => {
		const none = new UnitClassifier(dir);
		await none.classify([{ unitId: 'z', title: 'something vague' }], defs);
		const llm = jest.fn(async () => '{"1":"book"}');
		const later = await new UnitClassifier(dir, llm).classify([{ unitId: 'z', title: 'something vague' }], defs);
		expect(later.categories.get('z')).toBe('book');
	});

	it('survives a failing model', async () => {
		const c = new UnitClassifier(dir, async () => {
			throw new Error('down');
		});
		expect((await c.classify([{ unitId: 'z', title: 'vague' }], defs)).categories.get('z')).toBe(OTHER_CATEGORY);
	});
});
