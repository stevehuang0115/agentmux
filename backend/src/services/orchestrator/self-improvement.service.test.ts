/**
 * Tests for Self-Improvement Service
 *
 * @module services/orchestrator/self-improvement.service.test
 */

// Jest globals are available automatically
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  SelfImprovementService,
  getSelfImprovementService,
  resetSelfImprovementService,
} from './self-improvement.service.js';
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

describe('SelfImprovementService', () => {
  let testDir: string;
  let markerDir: string;
  let service: SelfImprovementService;
  let markerService: ImprovementMarkerService;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `self-improvement-test-${Date.now()}`);
    markerDir = path.join(testDir, 'markers');

    await fs.mkdir(testDir, { recursive: true });

    service = new SelfImprovementService(testDir);
    markerService = new ImprovementMarkerService(markerDir);
    await markerService.initialize();

    // Mock the marker service
    jest.spyOn(
      require('./improvement-marker.service.js'),
      'getImprovementMarkerService'
    ).mockReturnValue(markerService);
  });

  afterEach(async () => {
    resetSelfImprovementService();
    resetImprovementMarkerService();
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    jest.restoreAllMocks();
  });

  describe('planImprovement', () => {
    it('should create a plan with marker', async () => {
      const plan = await service.planImprovement({
        description: 'Fix login bug',
        targetFiles: ['src/auth.ts'],
        changes: [
          {
            file: 'src/auth.ts',
            type: 'modify',
            description: 'Fix authentication logic',
          },
        ],
      });

      expect(plan.id).toMatch(/^si-\d+$/);
      expect(plan.description).toBe('Fix login bug');
      expect(plan.targetFiles).toEqual(['src/auth.ts']);
      expect(plan.riskLevel).toBe('low');

      // Verify marker was created
      const marker = await markerService.getPendingImprovement();
      expect(marker).not.toBeNull();
      expect(marker?.phase).toBe('planning');
    });

    it('should reject if another improvement is pending', async () => {
      await service.planImprovement({
        description: 'First improvement',
        targetFiles: ['src/test.ts'],
        changes: [],
      });

      await expect(
        service.planImprovement({
          description: 'Second improvement',
          targetFiles: ['src/other.ts'],
          changes: [],
        })
      ).rejects.toThrow('Another improvement is already pending');
    });

    it('should analyze risk level correctly', async () => {
      // High risk - index.ts
      const highRiskPlan = await service.planImprovement({
        description: 'Modify index',
        targetFiles: ['backend/src/index.ts'],
        changes: [],
      });
      expect(highRiskPlan.riskLevel).toBe('high');

      // Clean up for next test
      await markerService.deleteMarker();

      // Medium risk - service file
      const mediumRiskPlan = await service.planImprovement({
        description: 'Modify service',
        targetFiles: ['backend/src/services/test.service.ts'],
        changes: [],
      });
      expect(mediumRiskPlan.riskLevel).toBe('medium');

      // Clean up for next test
      await markerService.deleteMarker();

      // Low risk - regular file
      const lowRiskPlan = await service.planImprovement({
        description: 'Modify utils',
        targetFiles: ['src/utils/helpers.ts'],
        changes: [],
      });
      expect(lowRiskPlan.riskLevel).toBe('low');
    });
  });

  describe('cancelImprovement', () => {
    it('should cancel a planned improvement', async () => {
      await service.planImprovement({
        description: 'Test improvement',
        targetFiles: ['test.ts'],
        changes: [],
      });

      await service.cancelImprovement();

      const marker = await markerService.getPendingImprovement();
      expect(marker).toBeNull();
    });

    it('should do nothing if no improvement is pending', async () => {
      await expect(service.cancelImprovement()).resolves.not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return null when no improvement is pending', async () => {
      const status = await service.getStatus();
      expect(status).toBeNull();
    });

    it('should return marker when improvement is pending', async () => {
      await service.planImprovement({
        description: 'Test',
        targetFiles: ['test.ts'],
        changes: [],
      });

      const status = await service.getStatus();
      expect(status).not.toBeNull();
      expect(status?.description).toBe('Test');
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no history', async () => {
      const history = await service.getHistory();
      expect(history).toEqual([]);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetSelfImprovementService();
      const instance1 = getSelfImprovementService();
      const instance2 = getSelfImprovementService();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      resetSelfImprovementService();
      const instance1 = getSelfImprovementService();
      resetSelfImprovementService();
      const instance2 = getSelfImprovementService();
      expect(instance1).not.toBe(instance2);
    });
  });
});
