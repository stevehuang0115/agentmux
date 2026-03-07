/**
 * Tests for Plugin System Types
 *
 * @module services/plugin/plugin.types.test
 */

import { HOOK_NAMES } from './plugin.types.js';

describe('Plugin Type Constants', () => {
  it('should have all expected hook names', () => {
    expect(HOOK_NAMES).toEqual([
      'onAgentBoot',
      'onTaskVerify',
      'onSkillExecute',
      'onDashboardRender',
    ]);
  });

  it('should have exactly 4 hook names', () => {
    expect(HOOK_NAMES).toHaveLength(4);
  });
});
