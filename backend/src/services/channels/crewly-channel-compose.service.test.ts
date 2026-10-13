/**
 * Tests for the orchestrator's channel composer: name resolution (local /
 * remote / unknown / ambiguous) and the Cloud room-join request.
 *
 * @module services/channels/crewly-channel-compose.service.test
 */

import { ChannelComposeService, resolveName } from './crewly-channel-compose.service.js';
import { CrewlyChannelError, type CrewlyChannelAgent } from './crewly-channel.service.js';

const LOCAL: CrewlyChannelAgent[] = [
  { sessionName: 'ce-owen', name: 'Owen', teamId: 't1', teamName: 'CE', isLead: false },
  { sessionName: 'ce-mia', name: 'Mia', teamId: 't1', teamName: 'CE', isLead: true },
];
const REMOTE = [
  { agentSession: 'wang-lead', name: 'Jordan', instanceId: 'inst-air', machine: 'Air', team: '王律师增长团队', isLeader: true },
  { agentSession: 'wang-sam', name: 'Sam', instanceId: 'inst-air', machine: 'Air', team: '王律师增长团队' },
  { agentSession: 'x-mia', name: 'Mia', instanceId: 'inst-air', machine: 'Air', team: 'Other' },
];

function channelDto(slack: boolean) {
  return { id: 'h1', name: 'ce-growth', origin: 'crewly', createdAt: 'now', slack: slack ? { channelId: 'C123', channelName: 'ce-growth' } : null, members: [] };
}

function make(opts: { remote?: typeof REMOTE | null; slack?: boolean; join?: jest.Mock } = {}) {
  const channels = {
    create: jest.fn(async () => channelDto(opts.slack ?? true)),
    get: jest.fn(async () => channelDto(opts.slack ?? true)),
    addMember: jest.fn(async () => ({ channel: channelDto(true), change: {} })),
  };
  const join = opts.join ?? jest.fn(async () => undefined);
  const service = new ChannelComposeService({
    channels: channels as never,
    listAgents: async () => LOCAL,
    listRemote: async () => (opts.remote === undefined ? REMOTE : opts.remote),
    requestRoomJoin: join,
  });
  return { service, channels, join };
}

describe('resolveName', () => {
  const all = [
    ...LOCAL.map((a) => ({ term: '', kind: 'local' as const, name: a.name, session: a.sessionName, team: a.teamName, machine: 'this machine', isLead: !!a.isLead })),
    ...REMOTE.map((r) => ({ term: '', kind: 'remote' as const, name: r.name, session: r.agentSession, team: r.team, machine: r.machine, instanceId: r.instanceId, isLead: !!r.isLeader })),
  ];

  it('matches a display name or session, case-insensitively', () => {
    expect(resolveName('owen', all).hit?.session).toBe('ce-owen');
    expect(resolveName('@wang-sam', all).hit?.session).toBe('wang-sam');
  });
  it('resolves "<team> Lead" to the team leader', () => {
    expect(resolveName('王律师增长团队 Lead', all).hit?.session).toBe('wang-lead');
    expect(resolveName('CE team lead', all).hit?.session).toBe('ce-mia');
  });
  it('reports two agents with one name as ambiguous and an unknown name as nothing', () => {
    expect(resolveName('Mia', all).ambiguous).toHaveLength(2);
    expect(resolveName('Nobody', all)).toEqual({});
  });
});

describe('ChannelComposeService.compose', () => {
  it('creates the channel with local members and asks the other machine through Cloud', async () => {
    const { service, channels, join } = make();
    const res = await service.compose({ name: 'ce-growth', members: ['Owen', '王律师增长团队 Lead'] });
    expect(channels.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'ce-growth', memberSessions: ['ce-owen'], allowNoLocalMembers: true }));
    expect(join).toHaveBeenCalledWith({ slackChannelId: 'C123', slackChannelName: 'ce-growth', targetInstanceId: 'inst-air', sessions: ['wang-lead'] });
    expect(res.added.map((a) => a.name)).toEqual(['Owen']);
    expect(res.requested.map((a) => a.name)).toEqual(['Jordan']);
    expect(res.notFound).toEqual([]);
  });

  it('reports unknown names instead of hanging, and still places the rest', async () => {
    const { service } = make();
    const res = await service.compose({ name: 'x', members: ['Owen', 'Nobody', 'Mia'] });
    expect(res.notFound).toEqual(['Nobody']);
    expect(res.ambiguous[0].term).toBe('Mia');
    expect(res.added.map((a) => a.name)).toEqual(['Owen']);
  });

  it('refuses when nothing could be placed (creates nothing)', async () => {
    const { service, channels } = make();
    await expect(service.compose({ name: 'x', members: ['Nobody'] })).rejects.toBeInstanceOf(CrewlyChannelError);
    expect(channels.create).not.toHaveBeenCalled();
  });

  it('says the directory is unavailable when Cloud cannot be read', async () => {
    const { service } = make({ remote: null });
    const res = await service.compose({ name: 'x', members: ['Owen', 'Jordan'] });
    expect(res.directoryUnavailable).toBe(true);
    expect(res.notFound).toEqual(['Jordan']);
  });

  it('reports a refused Cloud join per agent, and no join when the channel is not in Slack', async () => {
    const refused = make({ join: jest.fn(async () => { throw new Error('rate limited'); }) });
    const r1 = await refused.service.compose({ name: 'x', members: ['Owen', 'Jordan'] });
    expect(r1.failed[0]).toMatchObject({ name: 'Jordan' });
    expect(r1.failed[0].reason).toContain('rate limited');
    const noSlack = make({ slack: false });
    const r2 = await noSlack.service.compose({ name: 'x', members: ['Owen', 'Jordan'] });
    expect(noSlack.join).not.toHaveBeenCalled();
    expect(r2.failed[0].reason).toContain('not a Slack channel');
  });

  it('--add: extends an existing channel and an existing name is extended, not duplicated', async () => {
    const { service, channels, join } = make();
    const res = await service.compose({ channel: 'ce-growth', members: ['Owen', 'Jordan'] });
    expect(channels.create).not.toHaveBeenCalled();
    expect(channels.addMember).toHaveBeenCalledWith('h1', 'ce-owen');
    expect(join).toHaveBeenCalledTimes(1);
    expect(res.channel.created).toBe(false);
    const dup = make();
    dup.channels.create.mockRejectedValueOnce(new CrewlyChannelError('#x already exists', 409, 'conflict'));
    const r2 = await dup.service.compose({ name: 'ce-growth', members: ['Owen'] });
    expect(dup.channels.addMember).toHaveBeenCalledWith('h1', 'ce-owen');
    expect(r2.channel.created).toBe(false);
  });
});
