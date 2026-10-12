import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { StagingArea } from './team-move-fs.js';
import { TeamMoveSecretScanError, isSkippableFinding, scanStaging } from './team-move-secret-scan.js';

// Fake credentials are assembled at run time so secret scanners do not flag this file.
const FAKE_SLACK = ['xoxb', '123456789012', '123456789012', 'abcdefghijklmnop'].join('-');
const FAKE_ANTHROPIC = ['sk', 'ant', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('-');
const FAKE_OPENAI = ['sk', 'abcdefghijklmnopqrstuvwxyz012345'].join('-');
const FAKE_BEARER = ['Bearer', 'abcdefghijklmnopqrstuvwxyz0123456789'].join(' ');
const FAKE_PEM = ['-----BEGIN PRIVATE KEY-----', 'abc', '-----END PRIVATE KEY-----'].join('\n');

describe('team-move-secret-scan', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'move-scan-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function stage(files: Record<string, string | Buffer>): Promise<StagingArea> {
    const s = new StagingArea(dir);
    await s.init();
    for (const [rel, content] of Object.entries(files)) await s.writeText(rel, content.toString('latin1'));
    return s;
  }

  it('finds token shapes, secret assignments and known values, and reports paths only', async () => {
    const s = await stage({
      'clean.md': 'nothing here, TOKEN_COUNT=5',
      'slack.md': FAKE_SLACK,
      'env.md': 'export ANTHROPIC_API_KEY=abc123def456ghi789',
      'known.md': 'the secret is 0123456789abcdef0123456789abcdef today',
      'bearer.md': `Authorization: ${FAKE_BEARER}`,
      'pem.md': FAKE_PEM,
    });
    const result = await scanStaging(s, s.files(), [{ name: 'SIGNING', value: '0123456789abcdef0123456789abcdef' }]);
    expect(result.filesScanned).toBe(6);
    expect(result.findings.map((f) => f.path).sort()).toEqual(['bearer.md', 'env.md', 'known.md', 'pem.md', 'slack.md']);
    expect(JSON.stringify(result)).not.toContain('abcdefghijklmnop');
  });

  it('does not scan binary files and sees a secret across a window boundary', async () => {
    const s = new StagingArea(dir);
    await s.init();
    await fs.writeFile(path.join(dir, 'bin.dat'), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(FAKE_SLACK)]));
    const filler = 'a '.repeat(512 * 1024 - 10);
    await s.writeText('big.md', `${filler}${FAKE_SLACK} tail`);
    const entries = [{ path: 'bin.dat', sha256: '', bytes: 0 }, ...s.files()];
    const result = await scanStaging(s, entries);
    expect(result.findings.map((f) => f.path)).toEqual(['big.md']);
    expect(result.filesScanned).toBe(1);
  });

  it('builds an error that names files, not values', () => {
    const e = new TeamMoveSecretScanError(Array.from({ length: 12 }, (_, i) => ({ path: `f${i}.md`, matches: 1 })));
    expect(e.message).toMatch(/12 files/);
    expect(e.message).toMatch(/f0\.md/);
    expect(e.message).toMatch(/\.\.\.$/);
  });

  it('allows skipping notes and project files but never core records', () => {
    for (const p of ['projects/p/data/x.md', 'handover/a.md', 'agents/s/sessions/1.md', 'team/wiki/a.md', 'team/norms/n.md']) expect(isSkippableFinding(p)).toBe(true);
    for (const p of ['team/config.json', 'records/task-pool.json', 'agents/s/memory.json', 'manifest.json', 'team/prompts/a.md']) expect(isSkippableFinding(p)).toBe(false);
  });
});
