import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { openChatDatabase } from '../chat-v2/sqlite/chat-db.js';
import { applyTeamChat, readTeamChat, setChannelsArchived } from './team-move-chat.js';
import { identityOf } from './team-move-select.js';

describe('team-move-chat', () => {
  let a: string;
  let b: string;
  const id = identityOf({ id: 't1', name: 'CE', members: [{ id: 'm1', sessionName: 's1' }, { id: 'm2', sessionName: 's2' }] } as never);

  beforeEach(async () => {
    a = await fs.mkdtemp(path.join(os.tmpdir(), 'move-chat-a-'));
    b = await fs.mkdtemp(path.join(os.tmpdir(), 'move-chat-b-'));
    const db = openChatDatabase({ dbPath: path.join(a, 'chat.db'), skipIntegrityCheck: true });
    const ins = db.prepare('INSERT INTO chat_channels (id, agent_session, owner_user_id, name, created_at, type, team_id, archived_at) VALUES (?,?,?,?,?,?,?,?)');
    ins.run('c-team', '', 'o', 'team', 1, 'channel', 't1', null);
    ins.run('c-huddle', '', 'o', 'room', 1, 'huddle', null, null);
    ins.run('c-mixed', '', 'o', 'mixed', 1, 'huddle', null, null);
    ins.run('c-dm', 's1', 'o', 'dm', 1, 'dm', null, null);
    ins.run('c-dm-other', 'zz', 'o', 'dm2', 1, 'dm', null, null);
    ins.run('c-old', '', 'o', 'old', 1, 'channel', 't1', 5);
    const mem = db.prepare('INSERT INTO chat_channel_members (channel_id, member_session, joined_at) VALUES (?,?,?)');
    mem.run('c-huddle', 's1', 1);
    mem.run('c-huddle', 's2', 1);
    mem.run('c-mixed', 's1', 1);
    mem.run('c-mixed', 'outsider', 1);
    db.close();
  });
  afterEach(async () => {
    await fs.rm(a, { recursive: true, force: true });
    await fs.rm(b, { recursive: true, force: true });
  });

  it('selects the team channel, rooms of only team members and the members DMs, not archived or foreign ones', () => {
    const r = readTeamChat(a, id);
    expect(r.channels.map((c) => c['id']).sort()).toEqual(['c-dm', 'c-huddle', 'c-team']);
    expect(r.members.map((m) => `${m.channel_id}:${m.member_session}`).sort()).toEqual(['c-huddle:s1', 'c-huddle:s2']);
  });

  it('returns nothing for a machine without a chat store', () => {
    expect(readTeamChat(b, id)).toEqual({ channels: [], members: [] });
  });

  it('applies records once and reports what already existed', () => {
    const records = readTeamChat(a, id);
    expect(applyTeamChat(b, records)).toEqual({ channelsAdded: 3, channelsExisting: 0, membersAdded: 2 });
    expect(applyTeamChat(b, records)).toEqual({ channelsAdded: 0, channelsExisting: 3, membersAdded: 0 });
    expect(applyTeamChat(b, { channels: [], members: [] })).toEqual({ channelsAdded: 0, channelsExisting: 0, membersAdded: 0 });
  });

  it('archives and unarchives channels', () => {
    expect(setChannelsArchived(a, ['c-team', 'c-dm'], true, 99)).toBe(2);
    expect(setChannelsArchived(a, ['c-team'], true, 99)).toBe(0);
    expect(readTeamChat(a, id).channels.map((c) => c['id'])).toEqual(['c-huddle']);
    expect(setChannelsArchived(a, ['c-team', 'c-dm'], false)).toBe(2);
    expect(readTeamChat(a, id).channels).toHaveLength(3);
    expect(setChannelsArchived(b, ['x'], true)).toBe(0);
    expect(setChannelsArchived(a, [], true)).toBe(0);
  });
});
