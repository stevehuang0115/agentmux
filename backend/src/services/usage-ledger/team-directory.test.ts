import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TeamDirectory } from './team-directory.js';

describe('TeamDirectory', () => {
	let home: string;
	beforeEach(() => {
		home = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-dir-'));
		fs.writeFileSync(path.join(home, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Book' }]));
		fs.mkdirSync(path.join(home, 'teams', 't1'), { recursive: true });
		fs.writeFileSync(
			path.join(home, 'teams', 't1', 'config.json'),
			JSON.stringify({ name: 'Writers', projectIds: ['p1'], members: [{ sessionName: 'writers-ann-1', agentId: 'writers-ann-1' }] }),
		);
		fs.mkdirSync(path.join(home, 'teams', 'broken'), { recursive: true });
		fs.writeFileSync(path.join(home, 'teams', 'broken', 'config.json'), '{');
	});
	afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

	it('finds the team and project of a session', async () => {
		const d = new TeamDirectory(home);
		await d.ready();
		expect(d.lookup('writers-ann-1')).toEqual({ team: 'Writers', project: 'Book' });
		expect(d.projectName('p1')).toBe('Book');
		expect(d.lookup('stranger')).toBeNull();
	});

	it('names the orchestrator', async () => {
		const d = new TeamDirectory(home);
		await d.ready();
		expect(d.lookup('crewly-orc')).toEqual({ team: 'Orchestrator' });
	});

	it('refreshes a stale cache in the background', async () => {
		let now = 1_000_000;
		const d = new TeamDirectory(home, () => now);
		await d.ready();
		fs.writeFileSync(path.join(home, 'teams', 't1', 'config.json'), JSON.stringify({ name: 'Authors', members: [{ sessionName: 'writers-ann-1' }] }));
		expect(d.lookup('writers-ann-1')?.team).toBe('Writers');
		now += 61_000;
		d.lookup('writers-ann-1');
		await d.refresh();
		expect(d.lookup('writers-ann-1')?.team).toBe('Authors');
	});

	it('copes with a missing home', async () => {
		const d = new TeamDirectory(path.join(home, 'nope'));
		await d.ready();
		expect(d.lookup('x')).toBeNull();
	});
});
