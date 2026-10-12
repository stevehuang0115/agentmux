import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { extract } from 'tar';
import { createDecryptStream, generateTargetKeyPair } from './team-move-crypto.js';
import { buildEncryptedPackage, packagePaths, sanitizeTeamForMove, summarize } from './team-move-exporter.js';
import { createReadStream } from 'node:fs';
import type { TeamMoveManifest } from './team-move.types.js';

describe('team-move-exporter helpers', () => {
  it('clears runtime state of a team config for the target', () => {
    const raw = {
      id: 't',
      archived: true,
      archivedAt: 'x',
      members: [{ id: 'm', agentStatus: 'active', workingStatus: 'in_progress', readyAt: 'x', lastStartError: { reason: 'r' }, dropoutReason: 'crash', name: 'Keep' }],
    };
    const out = sanitizeTeamForMove(raw) as { archived?: boolean; members: Array<Record<string, unknown>> };
    expect(out.archived).toBeUndefined();
    expect(out.members[0]).toEqual({ id: 'm', agentStatus: 'inactive', workingStatus: 'idle', name: 'Keep' });
    expect(raw.members[0]!.agentStatus).toBe('active');
    expect(sanitizeTeamForMove({ id: 'x' })).toEqual({ id: 'x', members: [] });
  });

  it('summarizes a manifest without file names or people', () => {
    const m = {
      kind: 'crewly-team-move',
      schemaVersion: 1,
      crewlyVersion: '1',
      team: { id: 't', name: 'CE', members: [{ name: 'Secretive' }], projectIds: [] },
      counts: { members: 1 },
      repos: [{ dirty: true, unpushed: 0 }, { dirty: false, unpushed: 2 }, { dirty: false, unpushed: 0 }],
      requiredTools: ['ffmpeg'],
      requiredRuntimes: ['claude-code'],
      files: [{ path: 'agents/secret-name/memory.json' }],
      totalBytes: 42,
    } as unknown as TeamMoveManifest;
    const s = summarize(m);
    expect(s).toMatchObject({ team: { id: 't', name: 'CE', members: 1 }, repos: 3, reposDirty: 2, uncompressedBytes: 42, totalBytes: 42, noSecrets: true });
    expect(JSON.stringify(s)).not.toContain('Secretive');
    expect(JSON.stringify(s)).not.toContain('secret-name');
    expect(packagePaths([{ path: 'b', sha256: '', bytes: 0 }, { path: 'a', sha256: '', bytes: 0 }])).toEqual(['a', 'b']);
  });

  it('builds a package only the target can open, with size, hash and chunk count', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'move-pack-'));
    try {
      await fs.mkdir(path.join(dir, 'staging', 'team'), { recursive: true });
      await fs.writeFile(path.join(dir, 'staging', 'team', 'a.md'), 'hello package');
      const key = generateTargetKeyPair();
      const out = path.join(dir, 'p.enc');
      const enc = await buildEncryptedPackage(path.join(dir, 'staging'), out, key.publicKey, 'move-pack-000001');
      expect(enc).toMatchObject({ file: out, chunks: 1 });
      expect(enc.size).toBe((await fs.stat(out)).size);
      // Decrypt + untar gives the files back.
      const dest = path.join(dir, 'unpacked');
      await fs.mkdir(dest);
      await pipeline(createReadStream(out), createDecryptStream({ privateKey: key.privateKey, moveId: 'move-pack-000001' }), extract({ cwd: dest }));
      expect(await fs.readFile(path.join(dest, 'team', 'a.md'), 'utf8')).toBe('hello package');
      // Another key cannot.
      const other = generateTargetKeyPair();
      await expect(
        pipeline(createReadStream(out), createDecryptStream({ privateKey: other.privateKey, moveId: 'move-pack-000001' }), new Writable({ write: (_c, _e, cb) => cb() })),
      ).rejects.toThrow();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
