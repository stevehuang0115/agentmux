import { describe, expect, it } from 'vitest';
import * as server from './index.js';

describe('@crewly/embed/server exports', () => {
  it('exposes the spec API', () => {
    for (const name of [
      'signIdentityToken',
      'verifyHostToken',
      'defineOpsTool',
      'createOpsHandler',
      'toExpress',
      'signHostToken',
      'verifyIdentityToken',
      'validateParams',
      'createMemoryLimitStore',
    ] as const) {
      expect(typeof server[name]).toBe('function');
    }
    expect(server.OpsError).toBeDefined();
    expect(server.EmbedTokenError).toBeDefined();
  });
});
