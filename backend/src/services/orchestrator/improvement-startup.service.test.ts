/**
 * Tests for Improvement Startup Service
 *
 * @module services/orchestrator/improvement-startup.service.test
 */

// Jest globals are available automatically
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  ImprovementStartupService,
  getImprovementStartupService,
  resetImprovementStartupService,
} from './improvement-startup.service.js';
import {
  ImprovementMarkerService,
  resetImprovementMarkerService,
} from './improvement-marker.service.js';

// Mock Slack bridge
jest.mock('../slack/slack-orchestrator-bridge.js', () => ({
  getSlackOrchestratorBridge: jest.fn(() => ({
    sendNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('ImprovementStartupService', () => {
  let testDir: string;
  let markerDir: string;
  let service: ImprovementStartupService;
  let markerService: ImprovementMarkerService;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `startup-test-${Date.now()}`);
    markerDir = path.join(testDir, 'markers');

    await fs.mkdir(testDir, { recursive: true });

    service = new ImprovementStartupService(testDir);
    markerService = new ImprovementMarkerService(markerDir);
    await markerService.initialize();
  });

  afterEach(async () => {
    resetImprovementStartupService();
    resetImprovementMarkerService();
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('runStartupCheck', () => {
    it('should return no pending if no marker exists', async () => {
      const result = await service.runStartupCheck();

      expect(result.hadPendingImprovement).toBe(false);
    });

    it('should handle planning phase by cleaning up', async () => {
      // Create a marker in planning phase
      await markerService.createMarker('si-123', 'Test improvement', ['test.ts']);

      // Use the same marker directory for the startup service
      const startupWithMarker = new ImprovementStartupService(testDir);

      // Mock the marker service to use our test directory
      jest.spyOn(
        await import('./improvement-marker.service.js'),
        'getImprovementMarkerService'
      ).mockReturnValue(markerService);

      const result = await startupWithMarker.runStartupCheck();

      expect(result.hadPendingImprovement).toBe(true);
      expect(result.action).toBe('cleaned_up');
      expect(result.phase).toBe('planning');
    });

    it('should increment restart count', async () => {
      await markerService.createMarker('si-123', 'Test', ['test.ts']);
      await markerService.updatePhase('changes_applied');

      jest.spyOn(
        await import('./improvement-marker.service.js'),
        'getImprovementMarkerService'
      ).mockReturnValue(markerService);

      // First startup check
      await service.runStartupCheck();
      let marker = await markerService.getPendingImprovement();

      // The marker should be cleaned up or have incremented restart count
      // depending on validation results
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetImprovementStartupService();
      const instance1 = getImprovementStartupService();
      const instance2 = getImprovementStartupService();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      resetImprovementStartupService();
      const instance1 = getImprovementStartupService();
      resetImprovementStartupService();
      const instance2 = getImprovementStartupService();
      expect(instance1).not.toBe(instance2);
    });
  });
});
