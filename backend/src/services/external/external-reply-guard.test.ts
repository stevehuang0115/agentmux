import { checkExternalReply, EXTERNAL_REPLY_REASON_HINTS } from './external-reply-guard.js';

const ctx = { otherAskers: ['Wang Lei', 'teacher-205', 'li@school.cn'], internalSessions: ['steamfun-portal-team-avery-member-1'], envs: [{ SLACK_BOT_TOKEN: 'hexsecretvalue1234567890' }] };

describe('checkExternalReply', () => {
	it('passes an ordinary answer', () => {
		expect(checkExternalReply('Your Thursday class has 12 students; 2 were absent last week.', ctx)).toEqual({ ok: true, reasons: [] });
	});

	it('blocks an empty reply', () => {
		expect(checkExternalReply('   ', ctx).reasons).toEqual(['empty']);
	});

	it('blocks secrets known by value and by shape', () => {
		expect(checkExternalReply('use hexsecretvalue1234567890', ctx).reasons).toContain('secret');
		expect(checkExternalReply('key sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345', ctx).reasons).toContain('secret');
	});

	it('blocks tool markup, paths, local addresses and internal ids', () => {
		expect(checkExternalReply('ok <invoke name="Bash">ls</invoke>', ctx).reasons).toContain('tool_markup');
		expect(checkExternalReply('saved to /Users/steve/report.pdf', ctx).reasons).toContain('internal_path');
		expect(checkExternalReply('see ~/.crewly/teams.json', ctx).reasons).toContain('internal_path');
		expect(checkExternalReply('open http://localhost:8787', ctx).reasons).toContain('local_address');
		expect(checkExternalReply('filed as TKT-523', ctx).reasons).toContain('internal_id');
		expect(checkExternalReply('asked steamfun-portal-team-avery-member-1', ctx).reasons).toContain('internal_id');
	});

	it('blocks another asker by name, id or email, as a whole word', () => {
		expect(checkExternalReply('Wang Lei also asked this', ctx).reasons).toEqual(['other_asker']);
		expect(checkExternalReply('like teacher-205 did', ctx).reasons).toEqual(['other_asker']);
		expect(checkExternalReply('mail li@school.cn', ctx).reasons).toEqual(['other_asker']);
		expect(checkExternalReply('Wang Leiming is your student', ctx).ok).toBe(true);
	});

	it('does not block public URLs', () => {
		expect(checkExternalReply('See https://steamfun.cn/help', ctx).ok).toBe(true);
	});

	it('has a hint for every reason', () => {
		expect(Object.keys(EXTERNAL_REPLY_REASON_HINTS)).toHaveLength(8);
	});
});
