import { describe, expect, it } from 'vitest';
import { readDemoEnv } from './server.js';

describe('readDemoEnv', () => {
  it('applies defaults', () => {
    expect(readDemoEnv({})).toEqual({ port: 4600, embedId: '', secret: '', roles: ['admin', 'teacher'] });
  });

  it('reads every variable', () => {
    expect(
      readDemoEnv({ PORT: '5000', EMBED_ID: 'emb_1', EMBED_SECRET: 's', EMBED_ROLES: ' admin , ', EMBED_SCRIPT_URL: 'http://x/e.js' }),
    ).toEqual({ port: 5000, embedId: 'emb_1', secret: 's', roles: ['admin'], scriptUrl: 'http://x/e.js' });
  });

  it('refuses a bad port', () => {
    expect(() => readDemoEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
