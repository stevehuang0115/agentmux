import type { Request, Response } from 'express';
import { findTeamOwner, getTeamRoster } from './team-roster.controller.js';
import { TeamRosterService } from '../../services/team-roster/team-roster.service.js';
import type { RosterTeam } from '../../services/team-roster/team-roster.builder.js';

const ROW = {
	id: 't1', name: 'CE', charter: 'Owns CE.', charterSource: 'lead', leads: ['Owen'],
	members: [{ name: 'Owen', role: 'tech-lead', isLead: true, specialties: [], session: 'owen', about: '' }],
	projects: ['CE'], paused: false, open: [], recentDone: [], routineRuns: 0, backlog: 0, history: [],
} as RosterTeam;

function run(handler: (req: Request, res: Response) => Promise<void>, query: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
	return new Promise((resolve) => {
		const out = { status: 200, body: {} as Record<string, unknown> };
		const res = {
			status(c: number) { out.status = c; return this; },
			json(b: Record<string, unknown>) { out.body = b; resolve(out); return this; },
		} as unknown as Response;
		void handler({ query } as unknown as Request, res);
	});
}

describe('team roster controller', () => {
	let getRoster: jest.SpyInstance;
	beforeEach(() => {
		getRoster = jest.spyOn(TeamRosterService.prototype, 'getRoster').mockResolvedValue([ROW]);
	});
	afterEach(() => jest.restoreAllMocks());

	it('serves the roster as markdown by default and as data on request', async () => {
		const md = await run(getTeamRoster, {});
		expect(md.status).toBe(200);
		expect(String(md.body.data)).toContain('### CE — lead Owen');
		const json = await run(getTeamRoster, { format: 'json' });
		expect(json.body.data).toEqual([ROW]);
	});

	it('rebuilds on ?fresh=1', async () => {
		await run(getTeamRoster, { fresh: '1' });
		expect(getRoster).toHaveBeenCalledWith({ fresh: true });
		await run(getTeamRoster, {});
		expect(getRoster).toHaveBeenLastCalledWith({ fresh: false });
	});

	it('answers 500 with the reason when the roster cannot be built', async () => {
		getRoster.mockRejectedValue(new Error('disk'));
		const r = await run(getTeamRoster, {});
		expect(r.status).toBe(500);
		expect(r.body).toMatchObject({ success: false, error: 'disk' });
	});

	it('ranks owners for ?q= and rejects a missing q', async () => {
		const r = await run(findTeamOwner, { q: 'owns CE' });
		expect(r.status).toBe(200);
		expect((r.body.data as Array<{ team: string }>)[0].team).toBe('CE');
		expect((await run(findTeamOwner, {})).status).toBe(400);
		expect((await run(findTeamOwner, { q: '   ' })).status).toBe(400);
	});
});
