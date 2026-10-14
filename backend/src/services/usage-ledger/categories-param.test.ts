import { parseCategoriesParam } from './categories-param.js';

const stored = [{ name: 'book', keywords: ['chapter'] }, { name: 'self-media' }];

describe('parseCategoriesParam', () => {
	it('is empty for no text', () => {
		expect(parseCategoriesParam('  ', stored)).toEqual({});
	});

	it('names alone select stored categories', () => {
		expect(parseCategoriesParam('book, self-media', stored)).toEqual({ only: ['book', 'self-media'] });
		expect(parseCategoriesParam('nope', stored)).toMatch(/no stored category named nope/);
	});

	it('name:keywords makes ad-hoc categories', () => {
		const r = parseCategoriesParam('talks:keynote,panel;ops:deploy', stored);
		expect(r).toEqual({ defs: [{ name: 'talks', keywords: ['keynote', 'panel'] }, { name: 'ops', keywords: ['deploy'] }] });
	});

	it('mixes ad-hoc definitions with stored names', () => {
		const r = parseCategoriesParam('talks:keynote;book', stored);
		expect(r).toMatchObject({ defs: [{ name: 'talks' }, { name: 'book' }] });
	});

	it('reads a JSON array and reports bad JSON', () => {
		expect(parseCategoriesParam('[{"name":"x","keywords":["k"]}]', stored)).toEqual({ defs: [{ name: 'x', keywords: ['k'] }] });
		expect(parseCategoriesParam('[oops', stored)).toMatch(/JSON/);
		expect(parseCategoriesParam('[{"name":"other"}]', stored)).toMatch(/reserved/);
	});
});
