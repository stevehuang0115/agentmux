/**
 * Event Bus Barrel Export Tests
 *
 * @module services/event-bus/index.test
 */

import { EventBusService } from './index.js';

describe('Event Bus barrel export', () => {
  it('should export EventBusService', () => {
    expect(EventBusService).toBeDefined();
    expect(typeof EventBusService).toBe('function');
  });

  it('should create an instance of EventBusService', () => {
    const service = new EventBusService();
    expect(service).toBeDefined();
  });
});
