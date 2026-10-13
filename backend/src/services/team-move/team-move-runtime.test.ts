import { StorageService } from '../core/storage.service.js';
import { TeamMoveDriver } from './team-move-driver.service.js';
import { createTeamMoveDriver } from './team-move-runtime.js';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('createTeamMoveDriver', () => {
  it('composes a driver from the backend singletons; not signed in, it has nothing to poll', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'move-runtime-'));
    try {
      const driver = createTeamMoveDriver({ storage: new StorageService(home), relay: new EventEmitter() as never, home });
      expect(driver).toBeInstanceOf(TeamMoveDriver);
      expect(await driver.poll()).toBe(0);
      expect(await driver.listMoves()).toEqual([]);
      expect(await driver.housekeeping()).toEqual([]);
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });
});
