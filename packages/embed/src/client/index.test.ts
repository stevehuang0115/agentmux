import { describe, expect, it } from 'vitest';
import * as client from './index.js';

describe('@crewly/embed/client exports', () => {
  it('exposes loadCrewlyEmbed, which is a no-op without a DOM', async () => {
    expect(typeof client.loadCrewlyEmbed).toBe('function');
    await expect(client.loadCrewlyEmbed({ embedId: 'emb_x', tokenUrl: '/t' })).resolves.toBeNull();
  });
});
