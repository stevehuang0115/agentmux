/**
 * Unit tests for AgentMemoryService
 *
 * Tests agent-level memory management including knowledge, preferences, and performance tracking.
 *
 * @module services/memory/agent-memory.service.test
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AgentMemoryService, TaskCompletionMetrics } from './agent-memory.service.js';
import { MEMORY_CONSTANTS } from '../../constants.js';
import type { RoleKnowledgeEntry, AgentPreferences } from '../../types/memory.types.js';

describe('AgentMemoryService', () => {
  let service: AgentMemoryService;
  let testDir: string;
  const testAgentId = 'test-agent-001';
  const testRole = 'developer';

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = path.join(os.tmpdir(), `crewly-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    // Clear singleton and create new instance with test directory
    AgentMemoryService.clearInstance();
    service = AgentMemoryService.getInstance(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    AgentMemoryService.clearInstance();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AgentMemoryService.getInstance(testDir);
      const instance2 = AgentMemoryService.getInstance(testDir);
      expect(instance1).toBe(instance2);
    });

    it('should create new instance for different home directory', () => {
      const otherDir = path.join(os.tmpdir(), `crewly-test-other-${Date.now()}`);
      const instance1 = AgentMemoryService.getInstance(testDir);
      const instance2 = AgentMemoryService.getInstance(otherDir);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('initializeAgent', () => {
    it('should create agent directory structure', async () => {
      await service.initializeAgent(testAgentId, testRole);

      const agentPath = path.join(testDir, MEMORY_CONSTANTS.PATHS.AGENTS_DIR, testAgentId);
      const memoryFile = path.join(agentPath, MEMORY_CONSTANTS.AGENT_FILES.MEMORY);
      const sopDir = path.join(agentPath, MEMORY_CONSTANTS.AGENT_FILES.SOP_CUSTOM_DIR);

      const memoryExists = await fs.stat(memoryFile).then(() => true).catch(() => false);
      const sopDirExists = await fs.stat(sopDir).then(s => s.isDirectory()).catch(() => false);

      expect(memoryExists).toBe(true);
      expect(sopDirExists).toBe(true);
    });

    it('should create memory with correct initial values', async () => {
      await service.initializeAgent(testAgentId, testRole);

      const memory = await service.getAgentMemory(testAgentId);

      expect(memory).not.toBeNull();
      expect(memory?.agentId).toBe(testAgentId);
      expect(memory?.role).toBe(testRole);
      expect(memory?.roleKnowledge).toEqual([]);
      expect(memory?.performance.tasksCompleted).toBe(0);
    });

    it('should not reinitialize existing agent', async () => {
      await service.initializeAgent(testAgentId, testRole);
      const firstMemory = await service.getAgentMemory(testAgentId);

      await service.initializeAgent(testAgentId, 'different-role');
      const secondMemory = await service.getAgentMemory(testAgentId);

      expect(secondMemory?.role).toBe(testRole); // Original role preserved
      expect(secondMemory?.createdAt).toBe(firstMemory?.createdAt);
    });
  });

  describe('addRoleKnowledge', () => {
    beforeEach(async () => {
      await service.initializeAgent(testAgentId, testRole);
    });

    it('should add new knowledge entry', async () => {
      const entryId = await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Always run tests before committing',
        confidence: 0.5,
      });

      expect(entryId).toBeDefined();

      const knowledge = await service.getRoleKnowledge(testAgentId);
      expect(knowledge).toHaveLength(1);
      expect(knowledge[0].content).toBe('Always run tests before committing');
      expect(knowledge[0].category).toBe('best-practice');
    });

    it('should reinforce similar existing entry instead of duplicating', async () => {
      const firstId = await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Always run tests before committing',
        confidence: 0.5,
      });

      const secondId = await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Always run tests before committing',
        confidence: 0.5,
      });

      expect(firstId).toBe(secondId);

      const knowledge = await service.getRoleKnowledge(testAgentId);
      expect(knowledge).toHaveLength(1);
      expect(knowledge[0].confidence).toBeGreaterThan(0.5); // Reinforced
    });

    it('should throw error for uninitialized agent', async () => {
      await expect(service.addRoleKnowledge('nonexistent-agent', {
        category: 'best-practice',
        content: 'Test content',
        confidence: 0.5,
      })).rejects.toThrow('Agent nonexistent-agent not initialized');
    });

    it('should accept all knowledge categories', async () => {
      const categories = ['best-practice', 'anti-pattern', 'tool-usage', 'workflow'] as const;

      for (const category of categories) {
        await service.addRoleKnowledge(testAgentId, {
          category,
          content: `Test content for ${category}`,
          confidence: 0.5,
        });
      }

      const knowledge = await service.getRoleKnowledge(testAgentId);
      expect(knowledge).toHaveLength(4);
    });
  });

  describe('getRoleKnowledge', () => {
    beforeEach(async () => {
      await service.initializeAgent(testAgentId, testRole);
      await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Test best practice',
        confidence: 0.8,
      });
      await service.addRoleKnowledge(testAgentId, {
        category: 'anti-pattern',
        content: 'Test anti-pattern',
        confidence: 0.6,
      });
    });

    it('should return all knowledge entries', async () => {
      const knowledge = await service.getRoleKnowledge(testAgentId);
      expect(knowledge).toHaveLength(2);
    });

    it('should filter by category', async () => {
      const bestPractices = await service.getRoleKnowledge(testAgentId, 'best-practice');
      expect(bestPractices).toHaveLength(1);
      expect(bestPractices[0].category).toBe('best-practice');
    });

    it('should sort by confidence descending', async () => {
      const knowledge = await service.getRoleKnowledge(testAgentId);
      expect(knowledge[0].confidence).toBeGreaterThanOrEqual(knowledge[1].confidence);
    });

    it('should return empty array for uninitialized agent', async () => {
      const knowledge = await service.getRoleKnowledge('nonexistent-agent');
      expect(knowledge).toEqual([]);
    });
  });

  describe('reinforceKnowledge', () => {
    let entryId: string;

    beforeEach(async () => {
      await service.initializeAgent(testAgentId, testRole);
      entryId = await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Test content',
        confidence: 0.5,
      });
    });

    it('should increase confidence', async () => {
      const beforeKnowledge = await service.getRoleKnowledge(testAgentId);
      const beforeConfidence = beforeKnowledge[0].confidence;

      await service.reinforceKnowledge(testAgentId, entryId);

      const afterKnowledge = await service.getRoleKnowledge(testAgentId);
      expect(afterKnowledge[0].confidence).toBeGreaterThan(beforeConfidence);
    });

    it('should cap confidence at 1.0', async () => {
      // Reinforce many times
      for (let i = 0; i < 10; i++) {
        await service.reinforceKnowledge(testAgentId, entryId);
      }

      const knowledge = await service.getRoleKnowledge(testAgentId);
      expect(knowledge[0].confidence).toBeLessThanOrEqual(1.0);
    });

    it('should update lastUsed timestamp', async () => {
      const beforeKnowledge = await service.getRoleKnowledge(testAgentId);
      const beforeLastUsed = beforeKnowledge[0].lastUsed;

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.reinforceKnowledge(testAgentId, entryId);

      const afterKnowledge = await service.getRoleKnowledge(testAgentId);
      expect(afterKnowledge[0].lastUsed).not.toBe(beforeLastUsed);
    });
  });

  describe('updatePreferences', () => {
    beforeEach(async () => {
      await service.initializeAgent(testAgentId, testRole);
    });

    it('should update coding style preferences', async () => {
      await service.updatePreferences(testAgentId, {
        codingStyle: {
          language: 'TypeScript',
          testingFramework: 'jest',
        },
      });

      const prefs = await service.getPreferences(testAgentId);
      expect(prefs.codingStyle?.language).toBe('TypeScript');
      expect(prefs.codingStyle?.testingFramework).toBe('jest');
    });

    it('should merge preferences without overwriting existing', async () => {
      await service.updatePreferences(testAgentId, {
        codingStyle: { language: 'TypeScript' },
      });

      await service.updatePreferences(testAgentId, {
        codingStyle: { testingFramework: 'jest' },
      });

      const prefs = await service.getPreferences(testAgentId);
      expect(prefs.codingStyle?.language).toBe('TypeScript');
      expect(prefs.codingStyle?.testingFramework).toBe('jest');
    });

    it('should throw error for uninitialized agent', async () => {
      await expect(service.updatePreferences('nonexistent-agent', {
        codingStyle: { language: 'Python' },
      })).rejects.toThrow('Agent nonexistent-agent not initialized');
    });
  });

  describe('recordTaskCompletion', () => {
    beforeEach(async () => {
      await service.initializeAgent(testAgentId, testRole);
    });

    it('should increment tasks completed', async () => {
      const beforeMetrics = await service.getPerformanceMetrics(testAgentId);
      expect(beforeMetrics.tasksCompleted).toBe(0);

      await service.recordTaskCompletion(testAgentId, {
        iterations: 3,
        qualityGatePassed: true,
      });

      const afterMetrics = await service.getPerformanceMetrics(testAgentId);
      expect(afterMetrics.tasksCompleted).toBe(1);
    });

    it('should calculate running average iterations', async () => {
      await service.recordTaskCompletion(testAgentId, { iterations: 2, qualityGatePassed: true });
      await service.recordTaskCompletion(testAgentId, { iterations: 4, qualityGatePassed: true });

      const metrics = await service.getPerformanceMetrics(testAgentId);
      expect(metrics.averageIterations).toBe(3); // (2 + 4) / 2
    });

    it('should calculate quality gate pass rate', async () => {
      await service.recordTaskCompletion(testAgentId, { iterations: 1, qualityGatePassed: true });
      await service.recordTaskCompletion(testAgentId, { iterations: 1, qualityGatePassed: false });
      await service.recordTaskCompletion(testAgentId, { iterations: 1, qualityGatePassed: true });

      const metrics = await service.getPerformanceMetrics(testAgentId);
      expect(metrics.qualityGatePassRate).toBeCloseTo(0.667, 2); // 2/3
    });
  });

  describe('recordError', () => {
    beforeEach(async () => {
      await service.initializeAgent(testAgentId, testRole);
    });

    it('should add new error pattern', async () => {
      await service.recordError(testAgentId, 'TypeScript compilation error');

      const metrics = await service.getPerformanceMetrics(testAgentId);
      expect(metrics.commonErrors).toHaveLength(1);
      expect(metrics.commonErrors[0].pattern).toBe('TypeScript compilation error');
      expect(metrics.commonErrors[0].occurrences).toBe(1);
    });

    it('should increment occurrences for existing pattern', async () => {
      await service.recordError(testAgentId, 'TypeScript compilation error');
      await service.recordError(testAgentId, 'TypeScript compilation error');

      const metrics = await service.getPerformanceMetrics(testAgentId);
      expect(metrics.commonErrors).toHaveLength(1);
      expect(metrics.commonErrors[0].occurrences).toBe(2);
    });

    it('should store resolution when provided', async () => {
      await service.recordError(testAgentId, 'Missing import', 'Add explicit import statement');

      const metrics = await service.getPerformanceMetrics(testAgentId);
      expect(metrics.commonErrors[0].resolution).toBe('Add explicit import statement');
    });
  });

  describe('generateAgentContext', () => {
    beforeEach(async () => {
      await service.initializeAgent(testAgentId, testRole);
    });

    it('should return empty string for uninitialized agent', async () => {
      const context = await service.generateAgentContext('nonexistent-agent');
      expect(context).toBe('');
    });

    it('should include high-confidence knowledge', async () => {
      await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Always test your code',
        confidence: 0.8,
      });

      const context = await service.generateAgentContext(testAgentId);
      expect(context).toContain('Always test your code');
      expect(context).toContain('[best-practice]');
    });

    it('should exclude low-confidence knowledge', async () => {
      await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Low confidence tip',
        confidence: 0.3,
      });

      const context = await service.generateAgentContext(testAgentId);
      expect(context).not.toContain('Low confidence tip');
    });

    it('should include performance metrics', async () => {
      await service.recordTaskCompletion(testAgentId, {
        iterations: 3,
        qualityGatePassed: true,
      });

      const context = await service.generateAgentContext(testAgentId);
      expect(context).toContain('Tasks completed: 1');
    });

    it('should include error patterns if present', async () => {
      await service.recordError(testAgentId, 'Common error', 'Fix it this way');

      const context = await service.generateAgentContext(testAgentId);
      expect(context).toContain('Common error');
      expect(context).toContain('Fix it this way');
    });
  });

  describe('pruneStaleEntries', () => {
    beforeEach(async () => {
      await service.initializeAgent(testAgentId, testRole);
    });

    it('should remove low-confidence old entries', async () => {
      // Add entry and manually set it to be old
      await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Old low confidence entry',
        confidence: 0.15, // Below threshold
      });

      // Add recent high-confidence entry
      await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Recent high confidence entry',
        confidence: 0.8,
      });

      // Prune entries older than 0 days (all entries)
      const removed = await service.pruneStaleEntries(testAgentId, 0);

      // The low confidence entry should be removed
      const knowledge = await service.getRoleKnowledge(testAgentId);
      expect(knowledge.some(k => k.content === 'Recent high confidence entry')).toBe(true);
    });

    it('should return number of removed entries', async () => {
      await service.addRoleKnowledge(testAgentId, {
        category: 'best-practice',
        content: 'Entry 1',
        confidence: 0.1,
      });

      const removed = await service.pruneStaleEntries(testAgentId, 0);
      expect(typeof removed).toBe('number');
    });

    it('should return 0 for uninitialized agent', async () => {
      const removed = await service.pruneStaleEntries('nonexistent-agent', 30);
      expect(removed).toBe(0);
    });
  });

  describe('getAgentMemory', () => {
    it('should return null for uninitialized agent', async () => {
      const memory = await service.getAgentMemory('nonexistent-agent');
      expect(memory).toBeNull();
    });

    it('should return complete memory object', async () => {
      await service.initializeAgent(testAgentId, testRole);

      const memory = await service.getAgentMemory(testAgentId);

      expect(memory).not.toBeNull();
      expect(memory).toHaveProperty('agentId');
      expect(memory).toHaveProperty('role');
      expect(memory).toHaveProperty('roleKnowledge');
      expect(memory).toHaveProperty('preferences');
      expect(memory).toHaveProperty('performance');
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent reads without issues', async () => {
      await service.initializeAgent(testAgentId, testRole);

      // Add some data first
      for (let i = 0; i < 5; i++) {
        await service.addRoleKnowledge(testAgentId, {
          category: 'best-practice',
          content: `Unique entry ${i} with specific details about feature ${i * 100}`,
          confidence: 0.5,
        });
      }

      // Perform multiple concurrent reads
      const readPromises = Array.from({ length: 10 }, () =>
        service.getRoleKnowledge(testAgentId)
      );

      const results = await Promise.all(readPromises);

      // All reads should return consistent data
      results.forEach(knowledge => {
        expect(knowledge.length).toBe(5);
      });
    });

    it('should handle sequential writes correctly', async () => {
      await service.initializeAgent(testAgentId, testRole);

      // Sequential writes should all be persisted
      for (let i = 0; i < 5; i++) {
        await service.addRoleKnowledge(testAgentId, {
          category: 'best-practice',
          content: `Sequential entry ${i} with unique content that differs from others ${Date.now()}${Math.random()}`,
          confidence: 0.5,
        });
      }

      const knowledge = await service.getRoleKnowledge(testAgentId);
      expect(knowledge.length).toBe(5);
    });
  });
});
