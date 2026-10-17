/**
 * Tests for listTicketPrefixes (crewly#1340).
 *
 * @module services/project-tickets/ticket-prefixes.test
 */

import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { listTicketPrefixes } from './ticket-prefixes.js';

describe('listTicketPrefixes', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-ticket-prefixes-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  async function project(name: string, counter: unknown): Promise<string> {
    const root = path.join(tmp, name);
    await fs.mkdir(path.join(root, 'tickets'), { recursive: true });
    if (counter !== undefined) await fs.writeFile(path.join(root, 'tickets', '.counter.json'), JSON.stringify(counter));
    return root;
  }

  const ticketsDir = (root: string) => path.join(root, 'tickets');

  it('returns TKT plus every project counter prefix, upper case and unique', async () => {
    const a = await project('crewly', { prefix: 'CREW', next: 728 });
    const b = await project('ce', { prefix: 'ce', next: 3 });
    const c = await project('copy', { prefix: 'CREW', next: 5 });
    const prefixes = await listTicketPrefixes({ listProjectPaths: async () => [a, b, c], ticketsDir });
    expect(prefixes.sort()).toEqual(['CE', 'CREW', 'TKT']);
  });

  it('skips projects without tickets or with a corrupt counter, and never throws', async () => {
    const none = await project('none', undefined);
    const bad = await project('bad', { prefix: 'no spaces allowed' });
    expect(await listTicketPrefixes({ listProjectPaths: async () => [none, bad, path.join(tmp, 'missing')], ticketsDir })).toEqual(['TKT']);
    expect(
      await listTicketPrefixes({
        listProjectPaths: async () => {
          throw new Error('storage down');
        },
        ticketsDir,
      }),
    ).toEqual(['TKT']);
  });
});
