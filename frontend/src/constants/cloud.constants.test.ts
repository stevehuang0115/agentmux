/**
 * Cloud Constants Tests
 *
 * Verifies that cloud constants are exported correctly and have expected values.
 *
 * @module constants/cloud.constants.test
 */

import { describe, it, expect } from 'vitest';
import { CLOUD_API_BASE, CLOUD_TOKEN_KEY } from './cloud.constants';

describe('cloud.constants', () => {
  it('should export CLOUD_API_BASE as a valid URL', () => {
    expect(CLOUD_API_BASE).toBe('https://api.crewlyai.com/api');
    expect(CLOUD_API_BASE).toMatch(/^https:\/\//);
  });

  it('should export CLOUD_TOKEN_KEY as a non-empty string', () => {
    expect(CLOUD_TOKEN_KEY).toBe('crewly_cloud_token');
    expect(CLOUD_TOKEN_KEY.length).toBeGreaterThan(0);
  });
});
