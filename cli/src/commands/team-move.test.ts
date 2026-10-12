import { teamMachinesCommand, teamMoveCommand, teamMoveRollbackCommand, teamMovesCommand } from './team-move.js';

jest.mock('chalk', () => ({
  __esModule: true,
  default: new Proxy({}, { get: () => (s: string) => s }),
}));

const reply = (status: number, json: unknown): Response => ({ ok: status < 400, status, json: async () => json }) as unknown as Response;

describe('crewly team move', () => {
  let lines: string[];
  const print = (l: string): void => void lines.push(l);
  beforeEach(() => {
    lines = [];
  });

  it('asks for a target', async () => {
    expect(await teamMoveCommand('CE', {}, print, jest.fn())).toBe(1);
    expect(lines[0]).toMatch(/--to <machine>/);
  });

  it('starts a move by team name and machine name', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(202, { success: true, data: { moveId: 'move-1', target: 'Air' } }));
    expect(await teamMoveCommand('CE', { to: 'Air', allowDirty: true }, print, fetchImpl as never)).toBe(0);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toMatch(/\/api\/team-moves$/);
    expect(JSON.parse(init.body)).toMatchObject({ teamName: 'CE', targetName: 'Air', allowDirty: true });
    expect(lines.join('\n')).toContain('Moving CE to Air');
  });

  it('uses the team id when given one', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(202, { success: true, data: { moveId: 'move-1' } }));
    await teamMoveCommand('5ad0642a-66dd-46b7-9744-c968123c1691', { to: 'Air' }, print, fetchImpl as never);
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).teamId).toBe('5ad0642a-66dd-46b7-9744-c968123c1691');
  });

  it('tells the owner what to push when work is unpushed', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(409, { success: false, error: 'Push this work', code: 'unpushed_work', repos: ['App (/p): 2 commits not pushed on main'] }));
    expect(await teamMoveCommand('CE', { to: 'Air' }, print, fetchImpl as never)).toBe(1);
    expect(lines.join('\n')).toMatch(/2 commits not pushed/);
    expect(lines.join('\n')).toMatch(/--allow-dirty/);
  });

  it('says so when Crewly is not running', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await teamMoveCommand('CE', { to: 'Air' }, print, fetchImpl as never)).toBe(1);
    expect(lines[0]).toMatch(/not running/);
  });

  it('lists moves, machines and rolls back', async () => {
    const moves = jest.fn().mockResolvedValue(reply(200, { success: true, data: { moves: [{ moveId: 'm1', teamName: 'CE', source: { name: 'Mac' }, target: { name: 'Air' }, status: 'completed', canRollback: true }] } }));
    expect(await teamMovesCommand({}, print, moves as never)).toBe(0);
    expect(lines.join('\n')).toMatch(/m1 +completed +CE: Mac -> Air/);
    lines = [];
    const machines = jest.fn().mockResolvedValue(reply(200, { success: true, data: { machines: [{ instanceId: 'a', name: 'Air', online: true, isLocal: false }] } }));
    expect(await teamMachinesCommand(print, machines as never)).toBe(0);
    expect(lines[0]).toMatch(/Air/);
    const rb = jest.fn().mockResolvedValue(reply(200, { success: true, data: { moveId: 'm1' } }));
    expect(await teamMoveRollbackCommand('m1', print, rb as never)).toBe(0);
    expect(rb.mock.calls[0]![0]).toMatch(/\/m1\/rollback$/);
  });

  it('prints JSON on request', async () => {
    const moves = jest.fn().mockResolvedValue(reply(200, { success: true, data: { moves: [] } }));
    await teamMovesCommand({ json: true }, print, moves as never);
    expect(JSON.parse(lines[0]!)).toEqual([]);
  });
});
