/**
 * Tests for Shared Channel Configuration
 *
 * @module components/Chat/channel-config.test
 */

import { CHANNEL_CONFIG } from './channel-config';

describe('CHANNEL_CONFIG', () => {
  it('should have entries for all channel types', () => {
    expect(CHANNEL_CONFIG).toHaveProperty('slack');
    expect(CHANNEL_CONFIG).toHaveProperty('crewly_chat');
    expect(CHANNEL_CONFIG).toHaveProperty('telegram');
    expect(CHANNEL_CONFIG).toHaveProperty('api');
  });

  it('should have icon, label, and className for each entry', () => {
    for (const [, config] of Object.entries(CHANNEL_CONFIG)) {
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('className');
      expect(typeof config.icon).toBe('string');
      expect(typeof config.label).toBe('string');
      expect(typeof config.className).toBe('string');
    }
  });

  it('should have unique class names', () => {
    const classNames = Object.values(CHANNEL_CONFIG).map(c => c.className);
    expect(new Set(classNames).size).toBe(classNames.length);
  });
});
