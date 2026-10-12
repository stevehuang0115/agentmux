import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { StorageService } from '../core/storage.service.js';
import type { Team } from '../../types/index.js';
import { generateTargetKeyPair } from './team-move-crypto.js';
import { buildEncryptedPackage } from './team-move-exporter.js';
import { StagingArea } from './team-move-fs.js';
import { TeamMoveImportError, TeamMoveImporter, projectsRoot, type ImportDeps } from './team-move-importer.js';
import type { TeamMoveManifest } from './team-move.types.js';

let counter = 0;

describe('projectsRoot', () => {
  it('honours the env override and defaults under the home folder', () => {
    expect(projectsRoot({ CREWLY_PROJECTS_ROOT: '/data/p' }, '/home/u')).toBe('/data/p');
    expect(projectsRoot({}, '/home/u')).toBe(path.join('/home/u', 'crewly-projects'));
  });
});

describe('TeamMoveImporter', () => {
  let root: string;
  let home: string;
  let storage: StorageService;
  let restoreCalls: Array<{ dest: string }>;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'move-importer-'));
    home = path.join(root, 'home');
    await fs.mkdir(home, { recursive: true });
    process.env['CREWLY_PROJECTS_ROOT'] = path.join(root, 'projects');
    storage = new StorageService(home);
    restoreCalls = [];
  });
  afterEach(async () => {
    delete process.env['CREWLY_PROJECTS_ROOT'];
    await fs.rm(root, { recursive: true, force: true });
  });

  const deps = (over: Partial<ImportDeps> = {}): ImportDeps => ({
    home,
    crewlyVersion: '9',
    storage,
    addWorkItems: async () => 0,
    addDecisions: async () => 0,
    adoptSlackMapping: async () => false,
    restoreRepo: async (dest) => (restoreCalls.push({ dest }), { ok: true, branch: 'main', headSha: 'abc', warnings: [] }),
    ...over,
  });

  /** Build an encrypted package from a hand-made staging dir. */
  async function pack(
    mutate: (m: TeamMoveManifest, s: StagingArea) => Promise<void> | void = () => undefined,
    options: { config?: Record<string, unknown> } = {},
  ) {
    const moveId = `move-importer-${String(++counter).padStart(5, '0')}`;
    const staging = new StagingArea(path.join(root, `stage-${Math.random().toString(36).slice(2)}`));
    await staging.init();
    await staging.writeJson('team/config.json', options.config ?? { id: 'team-1', name: 'T', members: [{ id: 'm1', name: 'A', sessionName: 's-a', role: 'developer', runtimeType: 'claude-code' }], projectIds: ['p1'], createdAt: 'x', updatedAt: 'x' });
    await staging.writeText('projects/p1/data/tickets/T-1.md', 'ticket at /src/p');
    const manifest: TeamMoveManifest = {
      kind: 'crewly-team-move',
      schemaVersion: 1,
      moveId,
      createdAt: 'x',
      crewlyVersion: '9',
      source: { instanceId: 'i', deviceName: 'd', homePath: '/src/home', platform: 'darwin' },
      team: { id: 'team-1', name: 'T', members: [{ id: 'm1', name: 'A', role: 'developer', sessionName: 's-a', runtimeType: 'claude-code' }], projectIds: ['p1'] },
      counts: { members: 1 },
      projects: [{ id: 'p1', name: 'P One', sourcePath: '/src/p', dataDir: '.crewly', files: 1, bytes: 1, skipped: [], sharedWithTeams: [] }],
      repos: [{ projectId: 'p1', projectName: 'P One', path: '/src/p', remoteUrl: 'git@x:y/z.git', branch: 'main', headSha: 'abc', dirty: false, unpushed: 0 }],
      requiredTools: [],
      requiredRuntimes: [],
      files: [],
      totalBytes: 1,
      noSecrets: true,
      secretScan: { filesScanned: 0, knownValuesChecked: 0, findings: 0, excludedFiles: 0 },
      notMoved: ['things'],
    };
    manifest.files = staging.files();
    await mutate(manifest, staging);
    await staging.writeJson('manifest.json', manifest);
    const key = generateTargetKeyPair();
    const file = path.join(root, `pkg-${Math.random().toString(36).slice(2)}.enc`);
    await buildEncryptedPackage(staging.root, file, key.publicKey, moveId);
    return { file, key, moveId };
  }

  const run = async (p: { file: string; key: { privateKey: string }; moveId: string }, d: ImportDeps = deps()) =>
    new TeamMoveImporter(d).run({ moveId: p.moveId, packageFile: p.file, privateKey: p.key.privateKey });

  it('imports a minimal package and relocates the project under the projects root', async () => {
    const report = await run(await pack());
    const [project] = await storage.getProjects();
    expect(project!.path).toBe(path.join(root, 'projects', 'p-one'));
    expect(await fs.readFile(path.join(project!.path, '.crewly', 'tickets', 'T-1.md'), 'utf8')).toBe(`ticket at ${project!.path}`);
    expect(restoreCalls).toEqual([{ dest: project!.path }]);
    expect(report.paths).toEqual([{ projectId: 'p1', name: 'P One', from: '/src/p', to: project!.path }]);
    expect(report.started).toEqual({ requested: false, ok: false });
    expect(report.notMoved).toEqual(['things']);
  });

  it('refuses a package without a manifest, with the wrong schema, kind, move or secret scan', async () => {
    await expect(run(await pack(async (_m, s) => s.remove('team/config.json')))).rejects.toThrow(/missing or altered/);
    await expect(run(await pack((m) => void (m.schemaVersion = 99)))).rejects.toMatchObject({ code: 'unsupported' });
    await expect(run(await pack((m) => void ((m as { kind: string }).kind = 'other')))).rejects.toThrow(/not a team move package/);
    await expect(run(await pack((m) => void ((m as { noSecrets: boolean }).noSecrets = false)))).rejects.toThrow(/not secret-scanned/);
    await expect(run(await pack((m) => void (m.moveId = 'move-other-0000001')))).rejects.toThrow(/another move/);
  });

  it('refuses altered, extra and unsafe files', async () => {
    await expect(run(await pack((m) => void (m.files[0]!.sha256 = '0'.repeat(64))))).rejects.toThrow(/missing or altered/);
    await expect(run(await pack(async (_m, s) => void (await s.writeText('extra.txt', 'x'))))).rejects.toThrow(/unexpected file/);
    await expect(run(await pack((m) => void (m.files[0]!.path = '../escape')))).rejects.toThrow(/unsafe path/);
  });

  it('refuses a session name that another team here already uses', async () => {
    await storage.saveTeam({ id: 'other', name: 'Other', members: [{ id: 'z', name: 'Z', sessionName: 's-a' }], projectIds: [], createdAt: 'x', updatedAt: 'x' } as unknown as Team);
    await expect(run(await pack())).rejects.toThrow(/already exists in team "Other"/);
  });

  it('replaces a team archived by an earlier move', async () => {
    await storage.saveTeam({ id: 'team-1', name: 'Old', moveArchive: { moveId: 'm' }, members: [], projectIds: [], createdAt: 'x', updatedAt: 'x' } as unknown as Team);
    await run(await pack());
    const teams = await storage.getTeams();
    expect(teams).toHaveLength(1);
    expect(teams[0]!.name).toBe('T');
  });

  it('puts a project whose folder is taken beside it with a suffix, and keeps an existing project as it is', async () => {
    await fs.mkdir(path.join(root, 'projects', 'p-one'), { recursive: true });
    await fs.writeFile(path.join(root, 'projects', 'p-one', 'foreign.txt'), 'x');
    await run(await pack());
    expect((await storage.getProjects())[0]!.path).toBe(path.join(root, 'projects', 'p-one-p1'));

    // A second machine state: the project exists here under the same id.
    const home2 = path.join(root, 'home2');
    await fs.mkdir(home2, { recursive: true });
    const storage2 = new StorageService(home2);
    const mine = path.join(root, 'mine');
    await storage2.saveProject({ id: 'p1', name: 'P One', path: mine, teams: {}, status: 'stopped', createdAt: 'x', updatedAt: 'x' } as never);
    restoreCalls = [];
    const p = await pack();
    const ok = await new TeamMoveImporter(deps({ home: home2, storage: storage2 })).run({ moveId: p.moveId, packageFile: p.file, privateKey: p.key.privateKey });
    expect(restoreCalls).toEqual([]);
    expect(ok.warnings.join(' ')).toMatch(/already exists on this machine/);
    expect(await fs.readFile(path.join(mine, '.crewly', 'tickets', 'T-1.md'), 'utf8')).toBe(`ticket at ${mine}`);
  });

  it('reports repositories it could not clone and non-git folders separately', async () => {
    const p = await pack((m) => {
      m.repos.push({ projectId: 'p2', projectName: 'Docs', path: '/src/docs', remoteUrl: null, branch: null, headSha: null, dirty: false, unpushed: 0, note: 'not a git repository — files are not moved, only Crewly data' });
      m.projects.push({ id: 'p2', name: 'Docs', sourcePath: '/src/docs', dataDir: '.crewly', files: 0, bytes: 0, skipped: [], sharedWithTeams: ['Other'] });
      m.team.projectIds.push('p2');
    });
    const report = await run(p, deps({ restoreRepo: async () => ({ ok: false, branch: null, headSha: null, warnings: [], error: 'Permission denied (publickey)' }) }));
    expect(report.repos.failed).toEqual([{ name: 'P One', reason: 'Permission denied (publickey)' }]);
    expect(report.reconnect.find((r) => r.kind === 'git')!.detail).toMatch(/publickey/);
    expect(report.warnings.join(' ')).toMatch(/Docs: not a git repository/);
    expect(report.warnings.join(' ')).toMatch(/also used by Other/);
  });

  it('does not start a paused team and reports a failed start', async () => {
    const paused = await pack(() => undefined, { config: { id: 'team-1', name: 'T', paused: { by: 'owner', pausedAt: 'x' }, members: [{ id: 'm1', name: 'A', sessionName: 's-a' }], projectIds: ['p1'], createdAt: 'x', updatedAt: 'x' } });
    const started = jest.fn().mockResolvedValue({ ok: true });
    const report = await run(paused, deps({ startTeam: started }));
    expect(started).not.toHaveBeenCalled();
    expect(report.started.error).toMatch(/paused/);

    await fs.rm(path.join(home, 'teams'), { recursive: true, force: true });
    const failing = await run(await pack(), deps({ startTeam: async () => ({ ok: false, error: 'no tmux' }), sleep: async () => undefined, startRetryDelaysMs: [] }));
    expect(failing.started).toEqual({ requested: true, ok: false, error: 'no tmux' });
    expect(failing.warnings[0]).toMatch(/The team did not start on this machine: no tmux/);
  });

  it('retries a failed start with backoff and reports the attempts when it finally works', async () => {
    const waits: number[] = [];
    const startTeam = jest.fn().mockResolvedValueOnce({ ok: false, error: 'Failed to initialize agent' }).mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ ok: true });
    const report = await run(await pack(), deps({ startTeam, sleep: async (ms) => void waits.push(ms), startRetryDelaysMs: [10, 20, 40] }));
    expect(startTeam).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([10, 20]);
    expect(report.started).toEqual({ requested: true, ok: true, attempts: 3 });
    expect(report.warnings.join(' ')).not.toMatch(/did not start/);
  });

  it('gives up after the last delay and says how often it tried', async () => {
    const startTeam = jest.fn().mockResolvedValue({ ok: false, error: 'No team member could start' });
    const report = await run(await pack(), deps({ startTeam, sleep: async () => undefined, startRetryDelaysMs: [1, 1] }));
    expect(startTeam).toHaveBeenCalledTimes(3);
    expect(report.started).toMatchObject({ requested: true, ok: false, attempts: 3, error: 'No team member could start' });
    expect(report.warnings[0]).toMatch(/tried 3 times/);
  });

  it('names the stand-in runtime and the machine in the reconnect checklist', async () => {
    const report = await run(
      await pack((m) => {
        m.requiredRuntimes = ['antigravity-cli', 'claude-code'];
      }),
      deps({
        startTeam: async () => ({ ok: true }),
        getStandIns: async () => [{ member: 'Ruth', configured: 'Antigravity', runningOn: 'Claude Code' }],
        machineName: () => 'iriss-air',
        runtimeLogins: async () => ({ 'antigravity-cli': false, 'claude-code': true }),
      }),
    );
    expect(report.started.fallbacks).toEqual([{ member: 'Ruth', configured: 'Antigravity', runningOn: 'Claude Code' }]);
    const item = report.reconnect.find((r) => r.kind === 'runtime')!;
    expect(item.label).toBe('Antigravity login on iriss-air');
    expect(item.detail).toContain('Ruth runs on Claude Code until Antigravity is logged in on iriss-air; it switches back automatically.');
    expect(report.reconnect.filter((r) => r.kind === 'runtime')).toHaveLength(1);
  });

  it('fails when there is not enough disk', async () => {
    await expect(run(await pack(), deps({ freeDisk: async () => 10 }))).rejects.toBeInstanceOf(TeamMoveImportError);
  });
});
