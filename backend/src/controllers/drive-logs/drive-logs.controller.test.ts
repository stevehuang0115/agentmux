/**
 * GET /api/drive-logs and /api/drive-logs/:id over a temp directory.
 */

import { mkdtemp, rm } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import express from 'express';
import request from 'supertest';
import { DriveLogStore, setDriveLogStore } from '../../services/drive/drive-log.store.js';
import { createDriveLogsRouter } from './drive-logs.controller.js';

let dir: string;
let app: express.Express;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'drive-logs-api-'));
  const store = new DriveLogStore(dir);
  await store.save('2026-10-11-drv_abc12345', '# Drive session drv_abc12345\n', '{"type":"session"}\n');
  setDriveLogStore(store);
  app = express();
  app.use('/api/drive-logs', createDriveLogsRouter());
});
afterEach(async () => {
  setDriveLogStore(null);
  await rm(dir, { recursive: true, force: true });
});

describe('drive logs API', () => {
  it('lists, reads markdown by file base or session id, reads jsonl', async () => {
    const list = await request(app).get('/api/drive-logs');
    expect(list.body.data).toMatchObject([{ id: '2026-10-11-drv_abc12345', sessionId: 'drv_abc12345' }]);
    expect((await request(app).get('/api/drive-logs/2026-10-11-drv_abc12345')).body.data).toMatch(/^# Drive session/);
    expect((await request(app).get('/api/drive-logs/drv_abc12345?format=jsonl')).body.data).toBe('{"type":"session"}\n');
  });

  it('404 for an unknown log, and a path is never followed', async () => {
    expect((await request(app).get('/api/drive-logs/2026-10-11-drv_zzzzzzzz')).status).toBe(404);
    expect((await request(app).get('/api/drive-logs/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
  });
});
