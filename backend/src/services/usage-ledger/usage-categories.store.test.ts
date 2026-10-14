import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { categorySetId, normalizeCategory, UsageCategoriesStore } from './usage-categories.store.js';

describe('UsageCategoriesStore', () => {
	let dir: string;
	let store: UsageCategoriesStore;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-cat-'));
		store = new UsageCategoriesStore(path.join(dir, 'l'));
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	it('starts empty (no categories are required)', async () => {
		expect(await store.list()).toMatchObject({ version: 0, setId: 'default', categories: [] });
	});

	it('adds, replaces by name (case-insensitive) and bumps the version each time', async () => {
		await store.set({ name: 'Self-media', description: 'Xiaohongshu, Substack', keywords: [' substack ', 'substack', 'videos'] });
		await store.set({ name: 'book', teams: ['Writers'] });
		const r = await store.set({ name: 'self-media', keywords: ['linkedin'] });
		expect(r).toMatchObject({ version: 3 });
		const { categories, setId } = await store.list();
		expect(categories.map((c) => c.name)).toEqual(['book', 'self-media']);
		expect(categories[1].keywords).toEqual(['linkedin']);
		expect(setId).toBe(categorySetId(categories));
	});

	it('replaces the whole set and clears it', async () => {
		await store.set({ name: 'a' });
		expect(await store.replaceAll([{ name: 'x', keywords: ['k'] }, { name: 'y' }])).toMatchObject({ version: 2 });
		expect((await store.list()).categories.map((c) => c.name)).toEqual(['x', 'y']);
		await store.replaceAll([]);
		expect((await store.list()).setId).toBe('default');
	});

	it('removes a category', async () => {
		await store.set({ name: 'a' });
		expect(await store.remove('A')).toMatchObject({ categories: [] });
		expect(await store.remove('a')).toBeNull();
	});

	it('rejects bad input, including the reserved name "other"', async () => {
		expect(await store.set({ name: '  ' })).toMatch(/name/);
		expect(await store.set({ name: 'Other' })).toMatch(/reserved/);
		expect(await store.set('x')).toMatch(/object/);
		expect(await store.replaceAll([{ name: 'ok' }, 5])).toMatch(/object/);
	});

	it('survives a corrupt file', async () => {
		fs.mkdirSync(store.dir, { recursive: true });
		fs.writeFileSync(path.join(store.dir, 'categories.json'), '{nope');
		expect((await store.list()).categories).toEqual([]);
	});
});

describe('categorySetId', () => {
	it('is stable for equal definitions and changes with any hint', () => {
		const a = [{ name: 'Book', keywords: ['chapter'] }];
		expect(categorySetId(a)).toBe(categorySetId([{ name: 'book', keywords: ['chapter'] }]));
		expect(categorySetId(a)).not.toBe(categorySetId([{ name: 'Book', keywords: ['chapter', 'bible'] }]));
		expect(categorySetId([])).toBe('default');
	});
});

describe('normalizeCategory', () => {
	it('trims and drops empty hint lists', () => {
		expect(normalizeCategory({ name: ' Book ', keywords: [], teams: [' W '] })).toEqual({ name: 'Book', teams: ['W'] });
	});
});
