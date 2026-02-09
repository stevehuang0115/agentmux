/**
 * Messaging Barrel Export Tests
 *
 * @module services/messaging/index.test
 */

import { MessageQueueService, QueueProcessorService, ResponseRouterService } from './index.js';

describe('Messaging barrel export', () => {
  it('should export MessageQueueService', () => {
    expect(MessageQueueService).toBeDefined();
    expect(typeof MessageQueueService).toBe('function');
  });

  it('should export QueueProcessorService', () => {
    expect(QueueProcessorService).toBeDefined();
    expect(typeof QueueProcessorService).toBe('function');
  });

  it('should export ResponseRouterService', () => {
    expect(ResponseRouterService).toBeDefined();
    expect(typeof ResponseRouterService).toBe('function');
  });
});
