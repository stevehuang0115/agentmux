import { fetchMachines, selectMachines, updateHints, type CloudInstanceRow } from './team-move-machines.js';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const ago = (min: number): string => new Date(NOW - min * 60_000).toISOString();
const row = (instanceId: string, deviceName: string, min: number, extra: Partial<CloudInstanceRow> = {}): CloudInstanceRow => ({
  instanceId,
  deviceName,
  lastSeenAt: ago(min),
  crewlyVersion: '1.20.304',
  capabilities: ['teamMove:1'],
  ...extra,
});

describe('selectMachines', () => {
  it('keeps live remote machines only, de-duplicated by name, freshest first', () => {
    const rows = [
      row('local', 'macbookpro.lan', 1),
      row('old-mbp', 'macbookpro.lan', 400),
      row('air-old', 'iriss-air.lan', 3, { capabilities: [] }),
      row('air-new', 'iriss-air.lan', 1),
      row('', 'nameless', 1),
      row('abc', '', 1),
      row('crewly-cloud-slack', 'Cloud Slack', 0),
      row('stale', 'Stale', 30),
    ];
    const out = selectMachines(rows, 'local', NOW);
    expect(out.map((m) => m.instanceId)).toEqual(['air-new']);
    expect(out[0]).toMatchObject({ name: 'iriss-air.lan', online: true, isLocal: false, canReceive: true, crewlyVersion: '1.20.304' });
  });

  it('reports canReceive from the teamMove:1 capability and hints to update the rest', () => {
    const out = selectMachines([row('a', 'Air', 1), row('b', 'Old', 2, { capabilities: undefined, crewlyVersion: '1.20.100' })], 'me', NOW);
    expect(out.map((m) => [m.name, m.canReceive])).toEqual([['Air', true], ['Old', false]]);
    expect(updateHints(out)).toEqual([expect.stringMatching(/Update Crewly on Old \(now 1\.20\.100/)]);
  });

  it('lets a fresher local row win the name, so its stale twin does not show up', () => {
    expect(selectMachines([row('local', 'mbp', 1), row('twin', 'mbp', 4)], 'local', NOW)).toEqual([]);
  });
});

describe('fetchMachines', () => {
  const session = { getToken: () => 't', getCloudUrl: () => 'https://cloud.example/' };

  it('reads the registry with the account token', async () => {
    const f = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [row('a', 'Air', 1)] }) });
    const out = await fetchMachines(session, 'me', f as never, NOW);
    expect(out).toHaveLength(1);
    expect(f.mock.calls[0]![0]).toBe('https://cloud.example/api/cloud/slack/instances');
    expect(f.mock.calls[0]![1].headers.Authorization).toBe('Bearer t');
  });

  it('fails clearly when signed out or when Cloud refuses', async () => {
    await expect(fetchMachines({ getToken: () => null, getCloudUrl: () => null }, null, jest.fn() as never, NOW)).rejects.toThrow(/Not signed in/);
    await expect(fetchMachines(session, null, jest.fn().mockResolvedValue({ ok: false, status: 500 }) as never, NOW)).rejects.toThrow(/HTTP 500/);
  });
});
