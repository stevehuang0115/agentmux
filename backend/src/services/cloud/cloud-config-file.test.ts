/**
 * Tests for the cloud config file module (path, read with repair, atomic writes).
 *
 * @module services/cloud/cloud-config-file.test
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getCloudConfigPath,
  readCloudConfigFile,
  validateCloudConfig,
  writeCloudConfigFile,
  writeCloudConfigFileSync,
  type PersistedCloudConfig,
} from './cloud-config-file.js';

const cfg = (n: number, extra: Partial<PersistedCloudConfig> = {}): PersistedCloudConfig => ({
  cloudUrl: 'https://api.example.test',
  token: 't'.repeat(n),
  tier: 'pro',
  connectedAt: '2026-10-10T12:31:00.000Z',
  ...extra,
});

let home: string;
let prevHome: string | undefined;
beforeEach(() => {
  prevHome = process.env.CREWLY_HOME;
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-cfg-'));
  process.env.CREWLY_HOME = home;
});
afterEach(() => {
  if (prevHome === undefined) delete process.env.CREWLY_HOME;
  else process.env.CREWLY_HOME = prevHome;
  fs.rmSync(home, { recursive: true, force: true });
});

describe('cloud config file', () => {
  it('lives under CREWLY_HOME/cloud/config.json', () => {
    expect(getCloudConfigPath()).toBe(path.join(home, 'cloud', 'config.json'));
  });

  it('validates the required fields', () => {
    expect(validateCloudConfig(cfg(5))).toBeNull();
    expect(validateCloudConfig({ cloudUrl: 'x', token: '', tier: 'free' })).toMatch(/token/);
    expect(validateCloudConfig([])).toMatch(/object/);
  });

  it('reads missing, then round-trips an atomic owner-only write', async () => {
    expect(readCloudConfigFile()).toEqual({ status: 'missing' });
    await writeCloudConfigFile(cfg(20, { refreshToken: 'r' }));
    expect(fs.statSync(getCloudConfigPath()).mode & 0o777).toBe(0o600);
    expect(readCloudConfigFile()).toEqual({ status: 'ok', config: cfg(20, { refreshToken: 'r' }), repaired: false });
  });

  it('overlapping persists of different sizes leave one complete config', async () => {
    const writes = Array.from({ length: 30 }, (_, i) =>
      writeCloudConfigFile(cfg(i % 2 ? 900 : 30, { relayToken: i % 2 ? 'r'.repeat(900) : undefined })),
    );
    await Promise.all(writes);
    const r = readCloudConfigFile();
    expect(r).toMatchObject({ status: 'ok', repaired: false });
    expect(r.status === 'ok' && r.config.token.length).toBe(900);
  });

  it('repairs the 2026-10-11 damage: complete object + stale tail', () => {
    writeCloudConfigFileSync(cfg(12, { refreshToken: 'rr', relayToken: 'rl' }));
    const file = getCloudConfigPath();
    fs.appendFileSync(file, 'Ky1zMzyf1B8bLH0W5I"\n}');
    const warn = jest.fn();
    const r = readCloudConfigFile({ warn });
    expect(r).toMatchObject({ status: 'ok', repaired: true });
    expect(warn).toHaveBeenCalled();
    expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).toEqual(cfg(12, { refreshToken: 'rr', relayToken: 'rl' }));
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it('reports an unusable file as damaged and keeps a .corrupt backup', () => {
    const file = getCloudConfigPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"cloudUrl":"https://x"'); // truncated
    const r = readCloudConfigFile();
    expect(r.status).toBe('damaged');
    expect(fs.readdirSync(path.dirname(file)).some((n) => n.startsWith('config.json.corrupt-'))).toBe(true);
    expect(fs.readFileSync(file, 'utf-8')).toBe('{"cloudUrl":"https://x"');
  });
});
