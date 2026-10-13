import { checkTools, commandOnPath, freeDiskBytes, hasRoomFor, isVersionCompatible, runPreflight } from './team-move-preflight.js';

describe('team-move-preflight', () => {
  it('reports version, disk, tools and runtimes', async () => {
    const result = await runPreflight(
      { crewlyVersion: '1.2.3', diskPath: '/x', freeDisk: async () => 1234, hasCommand: (b) => b === 'ffmpeg', runtimeLogins: async () => ({ 'claude-code': true }) },
      ['ffmpeg', 'docker'],
    );
    expect(result).toEqual({ crewlyVersion: '1.2.3', freeDiskBytes: 1234, tools: { ffmpeg: true, docker: false }, runtimes: { 'claude-code': true } });
  });

  it('survives unreadable disk and failing runtime probes', async () => {
    const result = await runPreflight({ crewlyVersion: '1', diskPath: '/x', freeDisk: async () => null, hasCommand: () => false, runtimeLogins: async () => Promise.reject(new Error('x')) }, ['git']);
    expect(result.freeDiskBytes).toBe(0);
    expect(result.runtimes).toEqual({});
  });

  it('maps tool names to binaries', () => {
    const seen: string[] = [];
    checkTools(['imagemagick', 'node', 'unknown-tool'], (b) => (seen.push(b), true));
    expect(seen).toEqual(['convert', 'node', 'unknown-tool']);
  });

  it('finds real commands and real disk space', async () => {
    expect(commandOnPath('node')).toBe(true);
    expect(commandOnPath('definitely-not-a-command-xyz')).toBe(false);
    expect(await freeDiskBytes('/definitely/not/here')).toBeGreaterThan(0);
  });

  it('checks versions and room', () => {
    expect(isVersionCompatible('1.20.304')).toBe(true);
    expect(isVersionCompatible('1.20.303')).toBe(false);
    expect(isVersionCompatible('2.0.0')).toBe(true);
    expect(isVersionCompatible('unknown')).toBe(false);
    expect(hasRoomFor(10 * 1024 ** 3, 1024, 1024)).toBe(true);
    expect(hasRoomFor(1024, 1024, 1024)).toBe(false);
  });
});
