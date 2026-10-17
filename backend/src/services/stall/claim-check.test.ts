/**
 * Tests for the "X is doing it" claim detector (crewly#1362).
 *
 * @module services/stall/claim-check.test
 */

import { claimNudgeText, claimPatternsFor, detectTeammateClaims } from './claim-check.js';

const members = [
	{ name: 'Pia', session: 'flopost-pia' },
	{ name: 'Dana', session: 'flopost-dana' },
	{ name: 'Ella', session: 'flopost-ella' },
	{ name: '小龙', session: 'flopost-xiaolong' },
];
const speaker = 'flopost-ella';

describe('detectTeammateClaims', () => {
	it('finds the 2026-10-16 claim (Ella: 视频已经是 Pia 在做了)', () => {
		const claims = detectTeammateClaims('对，视频已经是 Pia 在做了，录屏 + AI 配音，75 秒。这三样好了我先看一遍再发你。', members, speaker);
		expect(claims).toEqual([{ member: 'flopost-pia', memberName: 'Pia', sentence: expect.stringContaining('Pia 在做了') }]);
	});

	it.each([
		['交给 Pia 了，今天出。', 'flopost-pia'],
		['让 Dana 去做录屏。', 'flopost-dana'],
		['小龙负责这块。', 'flopost-xiaolong'],
		['Pia is already on it.', 'flopost-pia'],
		['Dana is working on the screen recording.', 'flopost-dana'],
		["Pia's making the full version now.", 'flopost-pia'],
		['I handed it to Dana this morning.', 'flopost-dana'],
		['Assigned the stills to Pia.', 'flopost-pia'],
	])('%j names %s', (text, member) => {
		expect(detectTeammateClaims(text, members, speaker).map((c) => c.member)).toEqual([member]);
	});

	it.each([
		'让 Pia 做可以吗？',
		'Should Pia take it?',
		'不是 Pia 在做，是我在做。',
		'Pia is not on it yet.',
		'Pia 的视频昨天发过了。',
		'I will do it myself now.',
		'Pianist videos are trending.',
		'',
	])('does not claim from %j', (text) => {
		expect(detectTeammateClaims(text, members, speaker)).toEqual([]);
	});

	it('never claims about the speaker, and ignores names outside the team', () => {
		expect(detectTeammateClaims('Ella is doing it.', members, speaker)).toEqual([]);
		expect(detectTeammateClaims('Rex 在做。', members, speaker)).toEqual([]);
		expect(detectTeammateClaims('Rex 在做。', [], speaker)).toEqual([]);
	});

	it('reports each teammate once, in order', () => {
		const claims = detectTeammateClaims('Pia 在做视频。Dana 在做录屏。Pia 还在做配音。', members, speaker);
		expect(claims.map((c) => c.member)).toEqual(['flopost-pia', 'flopost-dana']);
	});

	it('escapes regex characters in names', () => {
		expect(claimPatternsFor('A.J. (Ops)')).toHaveLength(4);
		expect(detectTeammateClaims('A.J. (Ops) is handling it.', [{ name: 'A.J. (Ops)', session: 'aj' }], speaker).map((c) => c.member)).toEqual(['aj']);
	});
});

describe('claimNudgeText', () => {
	it('names the teammate, quotes the sentence and asks for a delegation or a correction', () => {
		const text = claimNudgeText('Pia', '视频已经是 Pia 在做了');
		expect(text).toMatch(/^\[CLAIM-CHECK\] You told the owner Pia is doing it/);
		expect(text).toContain('nothing is assigned to Pia');
		expect(text).toMatch(/Delegate it now, or correct the thread\.$/);
	});
});
