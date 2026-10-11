import type { Project, Team } from '../../types/index.js';
import { TeamRosterService, type TeamRosterDeps } from './team-roster.service.js';
import type { RosterTicket, RosterWorkItem } from './team-roster.builder.js';

const TEAM = {
	id: 't1',
	name: 'CE',
	description: 'CareerEngine: visa probability product and data pipeline.',
	members: [{ id: 'm1', name: 'Owen', role: 'tech-lead', agentId: 'owen-agent', sessionName: '' }],
	projectIds: ['p1'],
	leaderIds: ['m1'],
} as unknown as Team;
const PROJECT = { id: 'p1', name: 'CE', path: '/p/ce' } as Project;
const OTHER_PROJECT = { id: 'p2', name: 'Elsewhere', path: '/p/else' } as Project;

function deps(over: Partial<TeamRosterDeps> = {}): { deps: TeamRosterDeps; clock: { ms: number } } {
	const clock = { ms: Date.parse('2026-10-10T12:00:00.000Z') };
	return {
		clock,
		deps: {
			getTeams: jest.fn(async () => [TEAM]),
			getProjects: jest.fn(async () => [PROJECT, OTHER_PROJECT]),
			listTickets: jest.fn(async (projectPath: string): Promise<RosterTicket[]> =>
				projectPath === '/p/ce'
					? [{ id: 'CE-1', title: 'Fix login', status: 'in_progress', priority: 'P1', assignee: 'owen-agent', team: null, updatedAt: '2026-10-10T10:00:00.000Z', projectPath }]
					: [],
			),
			getWorkItems: jest.fn(async (): Promise<RosterWorkItem[]> => []),
			getChannels: jest.fn(async () => new Map([['t1', 'pro-ce']])),
			now: () => new Date(clock.ms),
			...over,
		},
	};
}

describe('TeamRosterService', () => {
	afterEach(() => TeamRosterService.resetInstance());

	it('builds the roster from every source', async () => {
		const { deps: d } = deps();
		const roster = await new TeamRosterService(d).getRoster();
		expect(roster).toHaveLength(1);
		expect(roster[0]).toMatchObject({ name: 'CE', channel: 'pro-ce', leads: ['Owen'] });
		expect(roster[0].open.map((w) => w.ref)).toEqual(['CE-1']);
		// Every project is scanned: tickets can belong to a team that lists no project.
		expect(d.listTickets).toHaveBeenCalledWith('/p/ce');
		expect(d.listTickets).toHaveBeenCalledWith('/p/else');
	});

	it('reuses the roster inside the TTL, rebuilds after it, on fresh, and after invalidate', async () => {
		const { deps: d, clock } = deps();
		const svc = new TeamRosterService(d);
		await svc.getRoster();
		await svc.getRoster();
		expect(d.getTeams).toHaveBeenCalledTimes(1);
		clock.ms += 61_000;
		await svc.getRoster();
		expect(d.getTeams).toHaveBeenCalledTimes(2);
		await svc.getRoster({ fresh: true });
		expect(d.getTeams).toHaveBeenCalledTimes(3);
		svc.invalidate();
		await svc.getRoster();
		expect(d.getTeams).toHaveBeenCalledTimes(4);
	});

	it('shares one build between concurrent readers', async () => {
		const { deps: d } = deps();
		const svc = new TeamRosterService(d);
		await Promise.all([svc.getRoster(), svc.getRoster(), svc.renderForPrompt()]);
		expect(d.getTeams).toHaveBeenCalledTimes(1);
	});

	it('keeps going when tickets, work items, projects or channels cannot be read', async () => {
		const { deps: d } = deps({
			getProjects: jest.fn(async () => { throw new Error('no projects'); }),
			listTickets: jest.fn(async () => { throw new Error('no tickets'); }),
			getWorkItems: jest.fn(async () => { throw new Error('no pool'); }),
			getChannels: jest.fn(async () => { throw new Error('no channels'); }),
		});
		const roster = await new TeamRosterService(d).getRoster();
		expect(roster[0]).toMatchObject({ name: 'CE', open: [], channel: undefined });
	});

	it('fails (and retries next time) when the teams themselves cannot be read', async () => {
		const getTeams = jest.fn().mockRejectedValueOnce(new Error('disk')).mockResolvedValue([TEAM]);
		const svc = new TeamRosterService(deps({ getTeams }).deps);
		await expect(svc.getRoster()).rejects.toThrow('disk');
		await expect(svc.getRoster()).resolves.toHaveLength(1);
	});

	it('renders the prompt section and ranks owners', async () => {
		const svc = new TeamRosterService(deps().deps);
		expect(await svc.renderForPrompt()).toContain('### CE — lead Owen · #pro-ce');
		expect((await svc.find('fix the login'))[0]).toMatchObject({ team: 'CE', handTo: 'Owen' });
	});

	it('returns an empty prompt section when there are no teams', async () => {
		const svc = new TeamRosterService(deps({ getTeams: jest.fn(async () => []) }).deps);
		expect(await svc.renderForPrompt()).toBe('');
	});
});
