import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const getTeams = jest.fn();
const getProjects = jest.fn();
jest.mock('../core/storage.service.js', () => ({ StorageService: { getInstance: () => ({ getTeams, getProjects }) } }));
jest.mock('../apps/apps.wiring.js', () => ({ getAppsParts: jest.fn() }));
const findByChatChannelId = jest.fn();
jest.mock('../slack/slack-team-channel.service.js', () => ({ getSlackTeamChannelService: () => ({ findByChatChannelId }) }));
const list = jest.fn();
jest.mock('../slack/slack-directory.service.js', () => ({ getSlackDirectoryService: () => ({ list }) }));

import { inboxRootFor, projectDirForAgent, roomHasRemoteColleague } from './file-handoff.wiring.js';

describe('file-handoff wiring', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fh-wiring-')));
    jest.clearAllMocks();
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  describe('projectDirForAgent', () => {
    it("uses the agent's team project, ignoring a wider hint", async () => {
      getTeams.mockResolvedValue([{ projectIds: ['p1'], members: [{ sessionName: 'ella' }] }]);
      getProjects.mockResolvedValue([{ id: 'p1', path: dir }]);
      expect(await projectDirForAgent('ella', '/')).toBe(dir);
    });

    it('falls back to the reported path when the agent has no team project', async () => {
      getTeams.mockResolvedValue([]);
      expect(await projectDirForAgent('crewly-orc', dir)).toBe(dir);
      expect(await projectDirForAgent('crewly-orc', 'relative/path')).toBeNull();
      expect(await projectDirForAgent(undefined)).toBeNull();
    });
  });

  it('inboxRootFor puts the inbox under the project data directory', () => {
    expect(inboxRootFor(dir)).toBe(path.join(dir, '.crewly', 'inbox'));
  });

  describe('roomHasRemoteColleague', () => {
    it('is true only for a Slack-mapped room with an agent of this account on another machine', async () => {
      findByChatChannelId.mockReturnValue({ slackChannelId: 'C1' });
      list.mockResolvedValue([
        { kind: 'agent', inChannel: true, source: 'this-machine' },
        { kind: 'human', inChannel: true, source: 'channel' },
      ]);
      expect(await roomHasRemoteColleague('chat-1')).toBe(false);
      list.mockResolvedValue([{ kind: 'agent', inChannel: true, source: 'this-account' }]);
      expect(await roomHasRemoteColleague('chat-1')).toBe(true);
      list.mockResolvedValue([{ kind: 'agent', inChannel: false, source: 'this-account' }]);
      expect(await roomHasRemoteColleague('chat-1')).toBe(false);
    });

    it('is false for a room with no Slack mapping and when lookups fail', async () => {
      findByChatChannelId.mockReturnValue(null);
      expect(await roomHasRemoteColleague('dm-1')).toBe(false);
      findByChatChannelId.mockImplementation(() => {
        throw new Error('x');
      });
      expect(await roomHasRemoteColleague('dm-1')).toBe(false);
    });
  });
});
