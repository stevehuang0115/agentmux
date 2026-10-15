import { describe, expect, it } from 'vitest';
import { EMBED_CONSTANTS } from './constants.js';

describe('EMBED_CONSTANTS', () => {
  it('pins the contract values the Cloud side relies on', () => {
    expect(EMBED_CONSTANTS.JWT.ALG).toBe('HS256');
    expect(EMBED_CONSTANTS.JWT.IDENTITY_TTL_SECONDS).toBe(600);
    expect(EMBED_CONSTANTS.JWT.HOST_TOKEN_MAX_LIFETIME_SECONDS).toBe(300);
    expect(EMBED_CONSTANTS.JWT.HOST_AUDIENCE_PREFIX).toBe('host:');
    expect(EMBED_CONSTANTS.JWT.SCOPE_SELF).toBe('self');
    expect(EMBED_CONSTANTS.OPS.DEFAULT_WRITES_PER_DAY).toBe(5);
    expect(EMBED_CONSTANTS.CLIENT.DEFAULT_SCRIPT_URL).toBe('https://apps.crewlyai.com/embed/v1/embed.js');
  });
});
