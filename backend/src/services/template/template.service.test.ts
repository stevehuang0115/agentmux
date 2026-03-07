/**
 * Tests for Template Service
 *
 * @module services/template/template.test
 */

import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TemplateService } from './template.service.js';
import type { TeamTemplate } from '../../types/team-template.types.js';
import { CloudClientService } from '../cloud/cloud-client.service.js';

// =============================================================================
// Mocks
// =============================================================================

jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}));

const mockIsConnected = jest.fn<boolean, []>();
const mockGetTemplates = jest.fn();
const mockGetTemplateDetail = jest.fn();

jest.mock('../cloud/cloud-client.service.js', () => ({
  CloudClientService: {
    getInstance: () => ({
      isConnected: mockIsConnected,
      getTemplates: mockGetTemplates,
      getTemplateDetail: mockGetTemplateDetail,
    }),
    resetInstance: jest.fn(),
  },
}));

// =============================================================================
// Test data helpers
// =============================================================================

function createValidTemplateJson(): TeamTemplate {
  return {
    id: 'test-dev',
    name: 'Test Dev Team',
    description: 'TL + 2 devs for testing',
    category: 'development',
    version: '1.0.0',
    hierarchical: true,
    roles: [
      {
        role: 'team-leader',
        label: 'Lead Developer',
        defaultName: 'TL',
        count: 1,
        hierarchyLevel: 1,
        canDelegate: true,
        reportsTo: undefined,
        defaultSkills: ['verify-output', 'delegate-task'],
      },
      {
        role: 'developer',
        label: 'Developer',
        defaultName: 'Dev',
        count: 2,
        hierarchyLevel: 2,
        canDelegate: false,
        reportsTo: 'team-leader',
        defaultSkills: ['complete-task'],
      },
    ],
    defaultRuntime: 'claude-code',
    verificationPipeline: {
      name: 'Dev Pipeline',
      steps: [
        {
          id: 'build',
          name: 'Build Check',
          description: 'Verify the project builds',
          method: 'quality_gates',
          critical: true,
          config: { command: 'npm run build' },
        },
        {
          id: 'tests',
          name: 'Test Suite',
          description: 'Run test suite',
          method: 'quality_gates',
          critical: true,
          config: { command: 'npm test' },
        },
      ],
      passPolicy: 'all',
      maxRetries: 2,
    },
  };
}

function createLegacyTemplateJson() {
  return {
    id: 'legacy-team',
    name: 'Legacy Web Team',
    description: 'A simple web development team',
    members: [
      { name: 'Frontend Dev', role: 'frontend-developer', systemPrompt: 'You are a frontend dev.' },
      { name: 'Backend Dev', role: 'backend-developer', systemPrompt: 'You are a backend dev.' },
    ],
  };
}

function createCloudTemplates() {
  return [
    { id: 'cloud-tiktok', name: 'TikTok Ops', description: 'TikTok team', requiredTier: 'pro', category: 'social' },
    { id: 'cloud-sap', name: 'SAP Integration', description: 'SAP team', requiredTier: 'enterprise', category: 'enterprise' },
  ];
}

// =============================================================================
// Tests
// =============================================================================

describe('TemplateService', () => {
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    TemplateService.clearInstance();
    tempDir = join(tmpdir(), `crewly-template-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    mockIsConnected.mockReturnValue(false);
  });

  afterEach(() => {
    TemplateService.clearInstance();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = TemplateService.getInstance(tempDir);
      const b = TemplateService.getInstance(tempDir);
      expect(a).toBe(b);
    });

    it('should return new instance after clearInstance', () => {
      const a = TemplateService.getInstance(tempDir);
      TemplateService.clearInstance();
      const b = TemplateService.getInstance(tempDir);
      expect(a).not.toBe(b);
    });
  });

  describe('loadTemplates', () => {
    it('should return 0 when templates directory does not exist', () => {
      const service = TemplateService.getInstance('/nonexistent/path');
      expect(service.loadTemplates()).toBe(0);
    });

    it('should load new-format template from subdirectory', () => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));

      const service = TemplateService.getInstance(tempDir);
      const count = service.loadTemplates();
      expect(count).toBe(1);
    });

    it('should load legacy flat JSON template', () => {
      writeFileSync(join(tempDir, 'legacy-team.json'), JSON.stringify(createLegacyTemplateJson()));

      const service = TemplateService.getInstance(tempDir);
      const count = service.loadTemplates();
      expect(count).toBe(1);
    });

    it('should load both new and legacy templates', () => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));
      writeFileSync(join(tempDir, 'legacy-team.json'), JSON.stringify(createLegacyTemplateJson()));

      const service = TemplateService.getInstance(tempDir);
      const count = service.loadTemplates();
      expect(count).toBe(2);
    });

    it('should skip invalid JSON files gracefully', () => {
      writeFileSync(join(tempDir, 'broken.json'), 'not valid json {{{');

      const service = TemplateService.getInstance(tempDir);
      expect(service.loadTemplates()).toBe(0);
    });

    it('should skip non-JSON files', () => {
      writeFileSync(join(tempDir, 'readme.md'), '# Not a template');

      const service = TemplateService.getInstance(tempDir);
      expect(service.loadTemplates()).toBe(0);
    });
  });

  describe('listTemplates', () => {
    it('should return summaries with source "local"', () => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));

      const service = TemplateService.getInstance(tempDir);
      const list = service.listTemplates();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('test-dev');
      expect(list[0].name).toBe('Test Dev Team');
      expect(list[0].category).toBe('development');
      expect(list[0].hierarchical).toBe(true);
      expect(list[0].roleCount).toBe(2);
      expect(list[0].source).toBe('local');
    });

    it('should auto-load templates if not loaded', () => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));

      const service = TemplateService.getInstance(tempDir);
      // Don't call loadTemplates — listTemplates should auto-load
      const list = service.listTemplates();
      expect(list).toHaveLength(1);
    });
  });

  // =========================================================================
  // Cloud integration tests
  // =========================================================================

  describe('listAllTemplates', () => {
    it('should return only local templates when not connected to cloud', async () => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));

      mockIsConnected.mockReturnValue(false);

      const service = TemplateService.getInstance(tempDir);
      const result = await service.listAllTemplates();

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('local');
      expect(mockGetTemplates).not.toHaveBeenCalled();
    });

    it('should merge local and cloud templates when connected', async () => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));

      mockIsConnected.mockReturnValue(true);
      mockGetTemplates.mockResolvedValue(createCloudTemplates());

      const service = TemplateService.getInstance(tempDir);
      const result = await service.listAllTemplates();

      expect(result).toHaveLength(3); // 1 local + 2 cloud
      expect(result[0].source).toBe('local');
      expect(result[0].id).toBe('test-dev');
      expect(result[1].source).toBe('cloud');
      expect(result[1].id).toBe('cloud-tiktok');
      expect(result[1].requiredTier).toBe('pro');
      expect(result[2].source).toBe('cloud');
      expect(result[2].id).toBe('cloud-sap');
      expect(result[2].requiredTier).toBe('enterprise');
    });

    it('should deduplicate cloud templates that share IDs with local', async () => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));

      // Cloud returns a template with the same ID as a local one
      mockIsConnected.mockReturnValue(true);
      mockGetTemplates.mockResolvedValue([
        { id: 'test-dev', name: 'Cloud Test Dev', description: 'dup', requiredTier: 'pro', category: 'dev' },
        { id: 'cloud-unique', name: 'Unique', description: 'unique', requiredTier: 'pro', category: 'dev' },
      ]);

      const service = TemplateService.getInstance(tempDir);
      const result = await service.listAllTemplates();

      expect(result).toHaveLength(2); // local 'test-dev' + cloud 'cloud-unique'
      expect(result[0].id).toBe('test-dev');
      expect(result[0].source).toBe('local'); // local takes precedence
      expect(result[1].id).toBe('cloud-unique');
      expect(result[1].source).toBe('cloud');
    });

    it('should gracefully degrade when cloud fetch fails', async () => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));

      mockIsConnected.mockReturnValue(true);
      mockGetTemplates.mockRejectedValue(new Error('Network timeout'));

      const service = TemplateService.getInstance(tempDir);
      const result = await service.listAllTemplates();

      // Should return local templates only, no error thrown
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('local');
    });

    it('should return empty array when no local and no cloud connection', async () => {
      mockIsConnected.mockReturnValue(false);

      const service = TemplateService.getInstance(tempDir);
      const result = await service.listAllTemplates();

      expect(result).toEqual([]);
    });

    it('should return only cloud templates when no local templates exist', async () => {
      mockIsConnected.mockReturnValue(true);
      mockGetTemplates.mockResolvedValue(createCloudTemplates());

      const service = TemplateService.getInstance(tempDir);
      const result = await service.listAllTemplates();

      expect(result).toHaveLength(2);
      expect(result.every(t => t.source === 'cloud')).toBe(true);
    });
  });

  describe('getCloudTemplateDetail', () => {
    it('should return null when not connected', async () => {
      mockIsConnected.mockReturnValue(false);

      const service = TemplateService.getInstance(tempDir);
      const result = await service.getCloudTemplateDetail('cloud-tiktok');

      expect(result).toBeNull();
      expect(mockGetTemplateDetail).not.toHaveBeenCalled();
    });

    it('should return template detail from cloud when connected', async () => {
      const detail = {
        id: 'cloud-tiktok',
        name: 'TikTok Ops',
        description: 'Full TikTok ops team',
        requiredTier: 'pro',
        category: 'social',
        roles: [{ role: 'content-writer', prompt: 'Write TikTok scripts' }],
        orchestration: { strategy: 'parallel' },
      };
      mockIsConnected.mockReturnValue(true);
      mockGetTemplateDetail.mockResolvedValue(detail);

      const service = TemplateService.getInstance(tempDir);
      const result = await service.getCloudTemplateDetail('cloud-tiktok');

      expect(result).toEqual(detail);
      expect(mockGetTemplateDetail).toHaveBeenCalledWith('cloud-tiktok');
    });

    it('should return null when cloud fetch fails', async () => {
      mockIsConnected.mockReturnValue(true);
      mockGetTemplateDetail.mockRejectedValue(new Error('Template not found: xyz'));

      const service = TemplateService.getInstance(tempDir);
      const result = await service.getCloudTemplateDetail('xyz');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Existing tests (unchanged)
  // =========================================================================

  describe('getTemplate', () => {
    it('should return template by ID', () => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));

      const service = TemplateService.getInstance(tempDir);
      const template = service.getTemplate('test-dev');
      expect(template).not.toBeNull();
      expect(template!.id).toBe('test-dev');
      expect(template!.roles).toHaveLength(2);
    });

    it('should return null for non-existent template', () => {
      const service = TemplateService.getInstance(tempDir);
      expect(service.getTemplate('nonexistent')).toBeNull();
    });
  });

  describe('createTeamFromTemplate', () => {
    beforeEach(() => {
      const templateDir = join(tempDir, 'test-dev');
      mkdirSync(templateDir);
      writeFileSync(join(templateDir, 'template.json'), JSON.stringify(createValidTemplateJson()));
    });

    it('should return null for non-existent template', () => {
      const service = TemplateService.getInstance(tempDir);
      expect(service.createTeamFromTemplate('nonexistent', 'My Team')).toBeNull();
    });

    it('should create a team with correct structure', () => {
      const service = TemplateService.getInstance(tempDir);
      const result = service.createTeamFromTemplate('test-dev', 'FE Team');

      expect(result).not.toBeNull();
      expect(result!.templateId).toBe('test-dev');
      expect(result!.team.name).toBe('FE Team');
      expect(result!.team.hierarchical).toBe(true);
      expect(result!.team.templateId).toBe('test-dev');
    });

    it('should create correct number of members', () => {
      const service = TemplateService.getInstance(tempDir);
      const result = service.createTeamFromTemplate('test-dev', 'FE Team');

      // 1 TL + 2 devs = 3 members
      expect(result!.memberCount).toBe(3);
      expect(result!.team.members).toHaveLength(3);
    });

    it('should set hierarchy fields on members', () => {
      const service = TemplateService.getInstance(tempDir);
      const result = service.createTeamFromTemplate('test-dev', 'FE Team');
      const members = result!.team.members;

      // TL
      const tl = members.find(m => m.role === 'team-leader');
      expect(tl).toBeDefined();
      expect(tl!.hierarchyLevel).toBe(1);
      expect(tl!.canDelegate).toBe(true);

      // Devs
      const devs = members.filter(m => m.role === 'developer');
      expect(devs).toHaveLength(2);
      for (const dev of devs) {
        expect(dev.hierarchyLevel).toBe(2);
        expect(dev.canDelegate).toBe(false);
        expect(dev.parentMemberId).toBe(tl!.id);
      }
    });

    it('should wire up subordinateIds on TL', () => {
      const service = TemplateService.getInstance(tempDir);
      const result = service.createTeamFromTemplate('test-dev', 'FE Team');
      const members = result!.team.members;

      const tl = members.find(m => m.role === 'team-leader');
      expect(tl!.subordinateIds).toHaveLength(2);

      const devIds = members.filter(m => m.role === 'developer').map(m => m.id);
      expect(tl!.subordinateIds).toEqual(expect.arrayContaining(devIds));
    });

    it('should set leaderId on team', () => {
      const service = TemplateService.getInstance(tempDir);
      const result = service.createTeamFromTemplate('test-dev', 'FE Team');

      const tl = result!.team.members.find(m => m.role === 'team-leader');
      expect(result!.team.leaderId).toBe(tl!.id);
    });

    it('should use name overrides when provided', () => {
      const service = TemplateService.getInstance(tempDir);
      const result = service.createTeamFromTemplate('test-dev', 'FE Team', {
        'team-leader': 'Alice',
      });

      const tl = result!.team.members.find(m => m.role === 'team-leader');
      expect(tl!.name).toBe('Alice');
    });

    it('should number multiple members of same role', () => {
      const service = TemplateService.getInstance(tempDir);
      const result = service.createTeamFromTemplate('test-dev', 'FE Team');
      const devs = result!.team.members.filter(m => m.role === 'developer');

      expect(devs[0].name).toBe('Dev1');
      expect(devs[1].name).toBe('Dev2');
    });

    it('should set all members to inactive initially', () => {
      const service = TemplateService.getInstance(tempDir);
      const result = service.createTeamFromTemplate('test-dev', 'FE Team');

      for (const member of result!.team.members) {
        expect(member.agentStatus).toBe('inactive');
        expect(member.workingStatus).toBe('idle');
      }
    });
  });

  describe('legacy template conversion', () => {
    it('should convert legacy template to TeamTemplate format', () => {
      writeFileSync(join(tempDir, 'legacy-team.json'), JSON.stringify(createLegacyTemplateJson()));

      const service = TemplateService.getInstance(tempDir);
      service.loadTemplates();

      const template = service.getTemplate('legacy-team');
      expect(template).not.toBeNull();
      expect(template!.name).toBe('Legacy Web Team');
      expect(template!.category).toBe('custom');
      expect(template!.hierarchical).toBe(false);
      expect(template!.roles).toHaveLength(2);
      expect(template!.verificationPipeline.steps[0].method).toBe('manual_review');
    });

    it('should create team from legacy template', () => {
      writeFileSync(join(tempDir, 'legacy-team.json'), JSON.stringify(createLegacyTemplateJson()));

      const service = TemplateService.getInstance(tempDir);
      const result = service.createTeamFromTemplate('legacy-team', 'My Legacy Team');

      expect(result).not.toBeNull();
      expect(result!.memberCount).toBe(2);
      expect(result!.team.hierarchical).toBe(false);
    });
  });
});
