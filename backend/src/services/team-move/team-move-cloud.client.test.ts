import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { TeamMoveCloudClient, TeamMoveCloudError } from './team-move-cloud.client.js';

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('TeamMoveCloudClient', () => {
  let token: string | null;
  let calls: Array<{ url: string; init: RequestInit }>;
  const make = (responses: Array<Response | Error>, extra: Partial<ConstructorParameters<typeof TeamMoveCloudClient>[0]['session']> = {}): TeamMoveCloudClient => {
    let i = 0;
    return new TeamMoveCloudClient({
      session: { getToken: () => token, getCloudUrl: () => 'https://cloud.test/', ...extra },
      getInstanceId: async () => 'inst-1',
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const r = responses[Math.min(i++, responses.length - 1)]!;
        if (r instanceof Error) throw r;
        return r.clone();
      }) as never,
      sleep: async () => undefined,
      retryBaseMs: 0,
    });
  };
  const header = (n: number, name: string): string | undefined => (calls[n]!.init.headers as Record<string, string>)[name];

  beforeEach(() => {
    token = 'tok';
    calls = [];
  });

  it('names the instance on every call and uses the account token', async () => {
    const c = make([json(200, { success: true, data: [] })]);
    await c.list();
    expect(calls[0]!.url).toBe('https://cloud.test/api/cloud/team-moves?instanceId=inst-1');
    expect(header(0, 'Authorization')).toBe('Bearer tok');
    expect(header(0, 'X-Crewly-Instance-Id')).toBe('inst-1');
  });

  it('reads lists and single moves from either envelope', async () => {
    expect(await make([json(200, { data: { moves: [{ moveId: 'm' }] } })]).list()).toEqual([{ moveId: 'm' }]);
    expect(await make([json(200, [{ moveId: 'n' }])]).list()).toEqual([{ moveId: 'n' }]);
    expect(await make([json(200, { success: true, data: { moveId: 'x', status: 'requested' } })]).get('x')).toMatchObject({ moveId: 'x' });
  });

  it('creates a move acting for the owner', async () => {
    const c = make([json(201, { success: true, data: { moveId: 'abc' } })]);
    expect(await c.create({ teamId: 't', sourceInstanceId: 's', targetInstanceId: 'd' })).toEqual({ moveId: 'abc' });
    expect(header(0, 'X-Crewly-Acting-For')).toBe('owner');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ teamId: 't', sourceInstanceId: 's', targetInstanceId: 'd' });
    await expect(make([json(201, { success: true, data: {} })]).create({ teamId: 't', sourceInstanceId: 's', targetInstanceId: 'd' })).rejects.toThrow(/move id/);
  });

  it('reads the preflight requests waiting for this machine and answers them', async () => {
    const request = { preflightId: 'pf-1', teamId: 't', teamName: 'T', role: 'source', action: 'preflight', options: { carryChanges: true } };
    const list = await make([json(200, { success: true, data: [request] })]).listPreflights();
    expect(list).toEqual([request]);
    expect(calls[0]!.url).toBe('https://cloud.test/api/cloud/team-moves/preflights?instanceId=inst-1');
    expect(await make([json(200, { success: true, data: request })]).getPreflight('pf-1')).toEqual(request);
    expect(calls[1]!.url).toBe('https://cloud.test/api/cloud/team-moves/preflights/pf-1');
    await make([json(200, { success: true, data: {} })]).postPreflightResult('pf-1', { ask: { ok: true, agents: ['Lena'] } });
    expect(calls[2]!.url).toBe('https://cloud.test/api/cloud/team-moves/preflights/pf-1/result');
    expect(calls[2]!.init.method).toBe('POST');
    expect(JSON.parse(calls[2]!.init.body as string)).toEqual({ ask: { ok: true, agents: ['Lena'] } });
    expect(header(2, 'X-Crewly-Instance-Id')).toBe('inst-1');
    expect(await make([json(200, { success: true, data: { nope: 1 } })]).listPreflights()).toEqual([]);
  });

  it('sends the owner\'s choices with the move', async () => {
    const c = make([json(201, { success: true, data: { moveId: 'abc' } })]);
    await c.create({ teamId: 't', sourceInstanceId: 's', targetInstanceId: 'd', options: { carryChanges: true, skipFlagged: true } });
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ teamId: 't', sourceInstanceId: 's', targetInstanceId: 'd', options: { carryChanges: true, skipFlagged: true } });
  });

  it('never follows a redirect: a 301 on the create POST is an error, not a list read as a move id', async () => {
    const c = make([new Response(null, { status: 301, headers: { Location: 'https://cloud.test/api/cloud/team-moves/' } })]);
    const error = await c.create({ teamId: 't', sourceInstanceId: 's', targetInstanceId: 'd' }).catch((e) => e);
    expect(error).toBeInstanceOf(TeamMoveCloudError);
    expect(error).toMatchObject({ status: 301, code: 'unexpected_redirect' });
    expect(error.message).toContain('redirected');
    expect(calls).toHaveLength(1); // not retried
    expect((calls[0]!.init as RequestInit).redirect).toBe('manual');
  });

  it('treats success:false in a 2xx answer as an error with Cloud code and message', async () => {
    const c = make([json(200, { success: false, code: 'move_in_progress', error: 'A move of this team is running' })]);
    await expect(c.create({ teamId: 't', sourceInstanceId: 's', targetInstanceId: 'd' })).rejects.toMatchObject({ code: 'move_in_progress', message: 'A move of this team is running' });
  });

  it('carries the code and message of a non-2xx answer', async () => {
    const c = make([json(409, { success: false, code: 'bad_state', error: 'Move is completed' })]);
    await expect(c.get('m')).rejects.toMatchObject({ status: 409, code: 'bad_state', message: 'Move is completed' });
  });

  it('asks for the recent moves with scope=recent', async () => {
    const c = make([json(200, { success: true, data: [{ moveId: 'old', status: 'completed' }] })]);
    expect(await c.listRecent()).toEqual([{ moveId: 'old', status: 'completed' }]);
    expect(calls[0]!.url).toBe('https://cloud.test/api/cloud/team-moves?instanceId=inst-1&scope=recent');
  });

  it('sends the key, init, chunks, completion, status and rollback to the contract paths', async () => {
    const c = make([json(200, { success: true, data: { uploadId: 'u', received: [0] } })]);
    await c.postTargetKey('m1', { publicKey: 'k', preflight: { crewlyVersion: '1', freeDiskBytes: 1, tools: {}, runtimes: {} } });
    expect(await c.packageInit('m1', { size: 1, sha256: 'x', chunks: 1, manifest: { noSecrets: true } as never })).toEqual({ uploadId: 'u', received: [0] });
    await c.putChunk('m1', 3, Buffer.from('abc'));
    await c.packageComplete('m1');
    await c.postStatus('m1', { status: 'imported', report: { a: 1 } });
    await c.rollback('m1');
    expect(calls.map((x) => `${x.init.method} ${x.url.replace('https://cloud.test/api/cloud/team-moves', '')}`)).toEqual([
      'POST /m1/target-key',
      'POST /m1/package/init',
      'PUT /m1/package/chunks/3',
      'POST /m1/package/complete',
      'POST /m1/status',
      'POST /m1/rollback',
    ]);
    expect(header(2, 'Content-Type')).toBe('application/octet-stream');
  });

  it('refreshes an expired token once and retries without counting it', async () => {
    const refresh = jest.fn().mockImplementation(async () => {
      token = 'fresh';
      return true;
    });
    const c = make([json(401, { error: 'expired' }), json(200, { data: [] })], { tryRefreshToken: refresh });
    await c.list();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(header(1, 'Authorization')).toBe('Bearer fresh');
  });

  it('retries server errors and network failures, but not client errors', async () => {
    expect(await make([json(503, { error: 'x' }), new Error('reset'), json(200, { data: [{ moveId: 'a' }] })]).list()).toHaveLength(1);
    expect(calls).toHaveLength(3);
    calls = [];
    await expect(make([json(409, { error: 'move_in_progress', code: 'move_in_progress' })]).create({ teamId: 't', sourceInstanceId: 's', targetInstanceId: 'd' })).rejects.toMatchObject({ status: 409, code: 'move_in_progress' });
    expect(calls).toHaveLength(1);
  });

  it('says clearly when Cloud has no storage', async () => {
    const err = await make([json(503, { error: 'storage_unavailable' })]).packageComplete('m1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TeamMoveCloudError);
    expect((err as Error).message).toMatch(/no storage for team moves/);
  });

  it('refuses to call without a login', async () => {
    token = null;
    await expect(make([json(200, {})]).list()).rejects.toMatchObject({ code: 'not_logged_in' });
    expect(make([]).isConnected()).toBe(false);
  });

  describe('download', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'move-dl-'));
    });
    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });
    const full = Buffer.from('0123456789');

    it('downloads the package', async () => {
      const dest = path.join(dir, 'p.enc');
      expect(await make([new Response(full, { status: 200 })]).downloadPackage('m1', dest, 10)).toBe(10);
      expect(await fs.readFile(dest)).toEqual(full);
    });

    it('resumes a partial file with a Range request', async () => {
      const dest = path.join(dir, 'p.enc');
      await fs.writeFile(dest, full.subarray(0, 4));
      const c = make([new Response(full.subarray(4), { status: 206 })]);
      expect(await c.downloadPackage('m1', dest, 10)).toBe(10);
      expect(header(0, 'Range')).toBe('bytes=4-');
      expect(await fs.readFile(dest)).toEqual(full);
    });

    it('starts over when Cloud answers a Range request with the whole file', async () => {
      const dest = path.join(dir, 'p.enc');
      await fs.writeFile(dest, full.subarray(0, 4));
      expect(await make([new Response(full, { status: 200 })]).downloadPackage('m1', dest, 10)).toBe(10);
      expect(await fs.readFile(dest)).toEqual(full);
    });

    it('fails when the size never matches', async () => {
      await expect(make([new Response(full.subarray(0, 3), { status: 200 })]).downloadPackage('m1', path.join(dir, 'x'), 10)).rejects.toThrow(/incomplete/);
    });
  });
});
