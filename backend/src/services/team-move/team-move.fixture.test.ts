import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FIXTURE, buildSourceFixture, buildTargetPaths } from './team-move.fixture.js';

describe('team move fixture', () => {
  it('builds a source machine with a team, a decoy, agents, a repo and records', async () => {
    const fx = await buildSourceFixture();
    try {
      for (const rel of [`teams/${FIXTURE.teamId}/config.json`, `teams/${FIXTURE.decoyTeamId}/config.json`, 'projects.json', 'task-pool/pool.json', 'owner-decisions.json', 'slack-team-channels.json', 'chat.db', `agents/${FIXTURE.leadSession}/memory.json`]) {
        expect((await fs.stat(path.join(fx.home, rel))).isFile()).toBe(true);
      }
      expect((await fs.stat(path.join(fx.projectDir, '.git'))).isDirectory()).toBe(true);
      const target = await buildTargetPaths(fx.root);
      expect((await fs.stat(target.home)).isDirectory()).toBe(true);
    } finally {
      await fx.cleanup();
    }
    await expect(fs.stat(fx.root)).rejects.toThrow();
  });
});
