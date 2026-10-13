import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';
import {
  FileHandoffService,
  extractPathCandidates,
  findMarkerIds,
  formatMarker,
  formatSize,
  getFileStreamed,
  isSecretPath,
  putFileStreamed,
  type HandoffApi,
} from './file-handoff.service.js';

const ID = 'hf_' + 'A'.repeat(22);
const ID2 = 'hf_' + 'B'.repeat(22);

describe('markers', () => {
  it('formats a human-readable marker line', () => {
    expect(formatMarker('report.pdf', 2.1 * 1024 * 1024, ID)).toBe(`📎 report.pdf (2.1 MB) · crewly-file:${ID}`);
  });

  it('formats sizes', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(300 * 1024 * 1024)).toBe('300 MB');
  });

  it('finds marker ids once, in order', () => {
    const text = `see 📎 a.txt (1 KB) · crewly-file:${ID}\nand crewly-file:${ID2} and again crewly-file:${ID}`;
    expect(findMarkerIds(text)).toEqual([ID, ID2]);
    expect(findMarkerIds('no markers, crewly-file:hf_short')).toEqual([]);
  });
});

describe('extractPathCandidates', () => {
  it('finds absolute and ./relative paths and trims prose punctuation', () => {
    const text = 'Done: /Users/x/proj/out/report.pdf, and (./notes/a.md). Also "/tmp/x y" and http://example.com/a/b.';
    expect(extractPathCandidates(text)).toEqual(['/Users/x/proj/out/report.pdf', './notes/a.md', '/tmp/x']);
  });

  it('ignores URLs and bare words', () => {
    expect(extractPathCandidates('see https://a.com/b/c and out/report.pdf')).toEqual([]);
  });
});

describe('isSecretPath', () => {
  it.each(['.env', '.env.production', 'cert.pem', 'server.key', 'id_rsa', 'id_ed25519', 'a/.ssh/config', 'x/.aws/credentials', '.npmrc', 'credentials.json'])('flags %s', (p) => {
    expect(isSecretPath(p)).toBe(true);
  });
  it.each(['report.pdf', 'out/data.csv', 'environment.md', 'keynote.pptx'])('allows %s', (p) => {
    expect(isSecretPath(p)).toBe(false);
  });
});

describe('FileHandoffService', () => {
  let root: string;
  let project: string;
  let crewlyHome: string;
  let calls: Array<{ method: string; path: string; body?: unknown }>;
  let api: HandoffApi;
  let putFile: jest.Mock;
  let counter: number;
  let service: FileHandoffService;

  const idFor = (n: number): string => 'hf_' + String(n).padStart(22, 'x');

  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-')));
    project = path.join(root, 'proj');
    crewlyHome = path.join(root, 'home', '.crewly');
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(crewlyHome, { recursive: true });
    calls = [];
    counter = 0;
    api = {
      request: async <T>(method: string, p: string, opts?: { body?: unknown }): Promise<T> => {
        calls.push({ method, path: p, body: opts?.body });
        if (method === 'POST' && p === '/handoffs') {
          counter += 1;
          return { handoffId: idFor(counter), upload: { url: 'http://storage.test/put', headers: { 'x-h': '1' } } } as T;
        }
        return {} as T;
      },
    };
    putFile = jest.fn().mockResolvedValue(undefined);
    service = new FileHandoffService({ api: () => api, crewlyHomes: () => [crewlyHome], putFile });
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const write = (rel: string, content = 'hello world'): string => {
    const p = path.join(project, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    return p;
  };

  describe('vetFile', () => {
    it('accepts a regular file inside the project', () => {
      const f = write('out/report.txt');
      expect(service.vetFile(f, project)).toMatchObject({ ok: true, size: 11 });
    });

    it('resolves ./relative against the project', () => {
      write('out/report.txt');
      expect(service.vetFile('./out/report.txt', project).ok).toBe(true);
    });

    it('refuses symlinks, outside-project files, Crewly home, secrets, empties and directories', () => {
      const real = write('a.txt');
      fs.symlinkSync(real, path.join(project, 'link.txt'));
      const outside = path.join(root, 'outside.txt');
      fs.writeFileSync(outside, 'x');
      const inHome = path.join(crewlyHome, 'cfg.txt');
      fs.writeFileSync(inHome, 'x');
      write('.env', 'FOO=bar');
      write('empty.txt', '');
      fs.mkdirSync(path.join(project, 'dir'));
      const reason = (f: string): string => {
        const v = service.vetFile(f, project);
        return v.ok ? 'OK' : v.reason;
      };
      expect(reason(path.join(project, 'link.txt'))).toMatch(/symbolic link/);
      expect(reason(outside)).toMatch(/outside your project/);
      expect(reason(path.join(project, '.env'))).toMatch(/secret/);
      expect(reason(path.join(project, 'empty.txt'))).toMatch(/empty/);
      expect(reason(path.join(project, 'dir'))).toMatch(/not a regular file/);
      expect(reason(path.join(project, 'missing.txt'))).toMatch(/not found/);
      // A project that contains Crewly's home still cannot send from it.
      const nested = new FileHandoffService({ api: () => api, crewlyHomes: () => [crewlyHome], putFile });
      expect(nested.vetFile(inHome, root)).toMatchObject({ ok: false, reason: expect.stringMatching(/Crewly's home/) });
    });

    it('refuses a text file that contains a secret assignment', () => {
      const f = write('config.txt', 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz0123456789\n');
      expect(service.vetFile(f, project)).toMatchObject({ ok: false, reason: expect.stringMatching(/secret/) });
    });

    it('refuses a symlinked parent that escapes the project', () => {
      const outsideDir = path.join(root, 'elsewhere');
      fs.mkdirSync(outsideDir);
      fs.writeFileSync(path.join(outsideDir, 'f.txt'), 'x');
      fs.symlinkSync(outsideDir, path.join(project, 'sneaky'));
      expect(service.vetFile(path.join(project, 'sneaky', 'f.txt'), project)).toMatchObject({ ok: false, reason: expect.stringMatching(/outside/) });
    });
  });

  describe('attachToMessage', () => {
    it('uploads an explicit file and appends the marker line', async () => {
      write('out/report.txt');
      const r = await service.attachToMessage({ content: 'Here you go', explicit: ['./out/report.txt'], projectDir: project, agent: 'sam' });
      expect(r.failed).toEqual([]);
      expect(r.attached).toEqual([{ fileName: 'report.txt', sizeBytes: 11, handoffId: idFor(1) }]);
      expect(r.content).toBe(`Here you go\n📎 report.txt (11 B) · crewly-file:${idFor(1)}`);
      expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /handoffs', `POST /handoffs/${idFor(1)}/complete`]);
      expect(putFile).toHaveBeenCalledWith({ url: 'http://storage.test/put', headers: { 'x-h': '1' } }, expect.stringContaining('report.txt'), 11, expect.any(Number));
    });

    it('auto-attaches paths written in the text, leaving the text as it is', async () => {
      const f = write('out/report.txt');
      const text = `Report is at ${f} - please review`;
      const r = await service.attachToMessage({ content: text, auto: true, projectDir: project });
      expect(r.attached).toHaveLength(1);
      expect(r.content.startsWith(text + '\n📎 report.txt')).toBe(true);
    });

    it('does not read paths from the text unless auto is on', async () => {
      const f = write('out/report.txt');
      const r = await service.attachToMessage({ content: `at ${f}`, projectDir: project });
      expect(r.attached).toEqual([]);
      expect(r.content).toBe(`at ${f}`);
      expect(calls).toEqual([]);
    });

    it('silently skips unsendable paths in prose but reports unsendable explicit files', async () => {
      write('.env', 'A=1');
      const r = await service.attachToMessage({ content: 'see /etc/hosts and ./.env', explicit: ['./.env'], auto: true, projectDir: project });
      expect(r.attached).toEqual([]);
      expect(r.failed).toEqual([{ file: './.env', reason: expect.stringMatching(/secret/) }]);
      expect(r.content).toBe('see /etc/hosts and ./.env');
    });

    it('sends at most five files per message', async () => {
      const paths = Array.from({ length: 7 }, (_, i) => write(`f${i}.txt`, `data ${i}`));
      const r = await service.attachToMessage({ content: paths.join(' '), auto: true, projectDir: project });
      expect(r.attached).toHaveLength(5);
      const explicit = await service.attachToMessage({ content: 'x', explicit: paths, projectDir: project });
      expect(explicit.attached).toHaveLength(5);
      expect(explicit.failed).toHaveLength(2);
    });

    it('still returns the text when the upload fails, and withdraws the half-made handoff', async () => {
      write('a.txt');
      putFile.mockRejectedValueOnce(new Error('upload failed (HTTP 403)'));
      const r = await service.attachToMessage({ content: 'hi', explicit: ['./a.txt'], projectDir: project });
      expect(r.content).toBe('hi');
      expect(r.attached).toEqual([]);
      expect(r.failed).toEqual([{ file: './a.txt', reason: 'upload failed (HTTP 403)' }]);
      expect(calls.some((c) => c.method === 'DELETE' && c.path === `/handoffs/${idFor(1)}`)).toBe(true);
    });

    it('reports a Cloud failure (not signed in) without throwing', async () => {
      write('a.txt');
      api = { request: async () => { throw new Error('This machine is not signed in to Crewly Cloud.'); } };
      const r = await service.attachToMessage({ content: 'hi', explicit: ['./a.txt'], projectDir: project });
      expect(r.attached).toEqual([]);
      expect(r.failed[0]!.reason).toMatch(/not signed in/);
    });

    it('does not attach the same file twice', async () => {
      const f = write('a.txt');
      const r = await service.attachToMessage({ content: `${f} and again ${f}`, explicit: [f], auto: true, projectDir: project });
      expect(r.attached).toHaveLength(1);
    });
  });

  describe('inbound', () => {
    let inbox: string;
    let getFile: jest.Mock;
    let receiver: FileHandoffService;
    let rcalls: string[];

    beforeEach(() => {
      inbox = path.join(project, '.crewly', 'inbox');
      rcalls = [];
      getFile = jest.fn(async (_url: string, dest: string) => fs.writeFileSync(dest, 'hello world'));
      const rapi: HandoffApi = {
        request: async <T>(method: string, p: string): Promise<T> => {
          rcalls.push(`${method} ${p}`);
          if (method === 'GET') return { status: 'ready', fileName: '../../evil/report.pdf', sizeBytes: 11, download: { url: 'http://storage.test/get' } } as T;
          return {} as T;
        },
      };
      receiver = new FileHandoffService({ api: () => rapi, crewlyHomes: () => [crewlyHome], getFile });
    });

    it('downloads into <inbox>/<id>/<name> with a sanitised name and acks', async () => {
      const f = await receiver.downloadToInbox(ID, inbox, 'ella');
      expect(f.path).toBe(path.join(inbox, ID, 'report.pdf'));
      expect(fs.readFileSync(f.path, 'utf8')).toBe('hello world');
      expect(rcalls).toEqual([`GET /handoffs/${ID}`, `POST /handoffs/${ID}/ack`]);
      expect(fs.readdirSync(path.join(inbox, ID))).toEqual(['report.pdf']);
    });

    it('rewrites markers to local paths', async () => {
      const text = `Here is the report\n📎 report.pdf (11 B) · crewly-file:${ID}\nthanks`;
      const out = await receiver.expandInbound(text, 'Sam', inbox, 'ella');
      expect(out).toBe(`Here is the report\nFile from Sam: ${path.join(inbox, ID, 'report.pdf')}\nthanks`);
    });

    it('leaves a text without markers untouched and makes no calls', async () => {
      expect(await receiver.expandInbound('plain', 'Sam', inbox)).toBe('plain');
      expect(rcalls).toEqual([]);
    });

    it('delivers anyway with a note and the manual command when the download fails', async () => {
      getFile.mockRejectedValueOnce(new Error('download timed out'));
      const out = await receiver.expandInbound(`📎 a.pdf (1 KB) · crewly-file:${ID}`, 'Sam', inbox);
      expect(out).toContain('File from Sam could not be fetched (download timed out)');
      expect(out).toContain(`receive-file --id ${ID}`);
      expect(rcalls.some((c) => c.includes('/ack'))).toBe(false);
      expect(fs.readdirSync(path.join(inbox, ID))).toEqual([]);
    });

    it('rejects a size mismatch and removes the partial file', async () => {
      getFile.mockImplementationOnce(async (_u: string, dest: string) => fs.writeFileSync(dest, 'short'));
      await expect(receiver.downloadToInbox(ID, inbox, undefined)).rejects.toThrow(/size mismatch/);
      expect(fs.readdirSync(path.join(inbox, ID))).toEqual([]);
    });

    it('still delivers when the ack fails', async () => {
      const rapi: HandoffApi = {
        request: async <T>(method: string, p: string): Promise<T> => {
          if (method === 'GET') return { status: 'ready', fileName: 'a.txt', sizeBytes: 11, download: { url: 'http://s/g' } } as T;
          if (p.endsWith('/ack')) throw new Error('boom');
          return {} as T;
        },
      };
      const r = new FileHandoffService({ api: () => rapi, getFile });
      const out = await r.expandInbound(`crewly-file:${ID}`, 'Sam', inbox);
      expect(out).toBe(`File from Sam: ${path.join(inbox, ID, 'a.txt')}`);
    });

    it('treats a not-ready handoff as a failure with the manual command', async () => {
      const rapi: HandoffApi = { request: async <T>(): Promise<T> => ({ status: 'uploading' }) as T };
      const r = new FileHandoffService({ api: () => rapi, getFile });
      const out = await r.expandInbound(`crewly-file:${ID}`, 'Sam', inbox);
      expect(out).toMatch(/not finished uploading/);
    });
  });

  describe('streaming transport', () => {
    let server: http.Server;
    let base: string;
    let received: { method?: string; length?: string; header?: string; body: Buffer };

    beforeEach(async () => {
      received = { body: Buffer.alloc(0) };
      server = http.createServer((req, res) => {
        if (req.method === 'PUT') {
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            received = { method: req.method, length: req.headers['content-length'], header: req.headers['x-h'] as string, body: Buffer.concat(chunks) };
            res.statusCode = req.url === '/deny' ? 403 : 200;
            res.end();
          });
        } else {
          res.statusCode = req.url === '/gone' ? 404 : 200;
          res.end('file-bytes');
        }
      });
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterEach(() => new Promise<void>((r) => server.close(() => r())));

    it('PUTs a file with its exact length and the signed headers', async () => {
      const f = write('up.bin', 'twelve bytes');
      await putFileStreamed({ url: `${base}/ok`, headers: { 'x-h': 'sig' } }, f, 12, 5000);
      expect(received).toMatchObject({ method: 'PUT', length: '12', header: 'sig' });
      expect(received.body.toString()).toBe('twelve bytes');
    });

    it('rejects a non-200 upload', async () => {
      const f = write('up.bin', 'x');
      await expect(putFileStreamed({ url: `${base}/deny`, headers: {} }, f, 1, 5000)).rejects.toThrow(/HTTP 403/);
    });

    it('GETs into a file and rejects a non-200 download', async () => {
      const dest = path.join(root, 'down.bin');
      await getFileStreamed(`${base}/ok`, dest, 5000);
      expect(fs.readFileSync(dest, 'utf8')).toBe('file-bytes');
      await expect(getFileStreamed(`${base}/gone`, path.join(root, 'x.bin'), 5000)).rejects.toThrow(/HTTP 404/);
    });
  });
});
