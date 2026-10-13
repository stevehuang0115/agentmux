import { cleanText, cut, titleFromSummary } from './excerpt.js';

describe('excerpt', () => {
	it('strips routing tags and the harness note', () => {
		const raw = '<UG94JLNGK@#ce> [TICKET:TKT-072 622a1227-b5e3] (Crewly internal record TKT-072, for you only) write the chapter outline';
		expect(cleanText('[CHAT:abc:123] ' + raw)).toBe('write the chapter outline');
	});

	it('cuts on a character boundary', () => {
		expect(cut('abcdef', 4)).toBe('abc…');
		expect(cut('abc', 4)).toBe('abc');
		expect(Array.from(cut('小红书小红书', 4))).toHaveLength(4);
	});

	it('takes a title from a trace summary without the ticket prefix', () => {
		expect(titleFromSummary('TKT-213: [Request] check the replies')).toBe('[Request] check the replies');
		expect(titleFromSummary('CE-7: fix the site')).toBe('fix the site');
		expect(titleFromSummary('no prefix here')).toBe('no prefix here');
	});
});
