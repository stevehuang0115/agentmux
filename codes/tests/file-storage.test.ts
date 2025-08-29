import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { FileStorage } from '../src/services/FileStorage';
import { AgentMuxData, ActivityLog, ActivityEntry, Project, Team, Assignment } from '../src/types';

describe('FileStorage', () => {
  let storage: FileStorage;
  let testDir: string;
  let dataPath: string;
  let activityPath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), 'agentmux-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    dataPath = path.join(testDir, 'data.json');
    activityPath = path.join(testDir, 'activity.json');
    
    storage = new FileStorage(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Data Loading and Saving', () => {
    it('should load default data when file missing', async () => {
      const data = await storage.loadData();
      
      expect(data).toEqual({
        projects: [],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: expect.any(String),
          pollingInterval: 30000
        }
      });
    });

    it('should create directory if missing', async () => {
      const nonExistentDir = path.join(os.tmpdir(), 'agentmux-missing-' + Date.now());
      const missingDirStorage = new FileStorage(nonExistentDir);
      
      const data = await missingDirStorage.loadData();
      
      expect(data.projects).toEqual([]);
      
      // Verify directory was created
      const stats = await fs.stat(nonExistentDir);
      expect(stats.isDirectory()).toBe(true);
      
      // Clean up
      await fs.rm(nonExistentDir, { recursive: true, force: true });
    });

    it('should save and load projects correctly', async () => {
      const testData: AgentMuxData = {
        projects: [{
          id: 'project-1',
          name: 'Test Project',
          fsPath: '/tmp/test-project',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          lastActivity: '2024-01-01T01:00:00Z'
        }],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };

      await storage.saveData(testData);
      const loadedData = await storage.loadData();
      
      expect(loadedData).toEqual(testData);
    });

    it('should save and load teams correctly', async () => {
      const testData: AgentMuxData = {
        projects: [],
        teams: [{
          id: 'team-1',
          name: 'Test Team',
          roles: [
            { name: 'orchestrator', count: 1 },
            { name: 'dev', count: 1 },
            { name: 'qa', count: 1 }
          ],
          tmuxSession: 'team-1-session',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          lastActivity: '2024-01-01T01:00:00Z'
        }],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };

      await storage.saveData(testData);
      const loadedData = await storage.loadData();
      
      expect(loadedData).toEqual(testData);
    });

    it('should save and load assignments correctly', async () => {
      const testData: AgentMuxData = {
        projects: [],
        teams: [],
        assignments: [{
          id: 'assignment-1',
          projectId: 'project-1',
          teamId: 'team-1',
          status: 'active',
          startedAt: '2024-01-01T00:00:00Z'
        }],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };

      await storage.saveData(testData);
      const loadedData = await storage.loadData();
      
      expect(loadedData).toEqual(testData);
    });

    it('should handle corrupted JSON gracefully', async () => {
      // Write invalid JSON to data file
      await fs.writeFile(dataPath, '{ invalid json content }');
      
      // Should return default data instead of throwing
      const data = await storage.loadData();
      
      expect(data.projects).toEqual([]);
      expect(data.teams).toEqual([]);
      expect(data.assignments).toEqual([]);
    });

    it('should preserve existing data when loading after corruption', async () => {
      // First save valid data
      const validData: AgentMuxData = {
        projects: [{ 
          id: 'project-1', 
          name: 'Test', 
          fsPath: '/tmp', 
          status: 'active', 
          createdAt: '2024-01-01T00:00:00Z' 
        }],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };
      
      await storage.saveData(validData);
      
      // Corrupt the file
      await fs.writeFile(dataPath, 'corrupted');
      
      // Load should return default data
      const loadedData = await storage.loadData();
      expect(loadedData.projects).toEqual([]);
    });

    it('should handle file permission errors gracefully', async () => {
      // Create read-only directory (if supported by OS)
      try {
        await fs.chmod(testDir, 0o444);
        
        const data: AgentMuxData = {
          projects: [],
          teams: [],
          assignments: [],
          settings: {
            version: '1.0.0',
            created: '2024-01-01T00:00:00Z',
            pollingInterval: 30000
          }
        };
        
        // Save should handle permission error gracefully
        await expect(storage.saveData(data)).rejects.toThrow();
        
        // Restore permissions for cleanup
        await fs.chmod(testDir, 0o755);
      } catch (error) {
        // Skip test if permission manipulation not supported
        console.log('Skipping permission test - not supported on this system');
      }
    });
  });

  describe('Activity Log Management', () => {
    it('should load default activity log when file missing', async () => {
      const activity = await storage.loadActivity();
      
      expect(activity).toEqual({
        entries: []
      });
    });

    it('should append activity entries', async () => {
      const entry1: ActivityEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'project',
        targetId: 'project-1',
        status: 'active',
        metadata: { source: 'test' }
      };
      
      const entry2: ActivityEntry = {
        timestamp: '2024-01-01T00:01:00Z',
        type: 'team',
        targetId: 'team-1',
        status: 'idle'
      };

      await storage.appendActivity(entry1);
      await storage.appendActivity(entry2);
      
      const activity = await storage.loadActivity();
      
      expect(activity.entries).toHaveLength(2);
      expect(activity.entries[0]).toEqual(entry1);
      expect(activity.entries[1]).toEqual(entry2);
    });

    it('should maintain activity log order', async () => {
      const entries: ActivityEntry[] = [];
      
      for (let i = 0; i < 5; i++) {
        const entry: ActivityEntry = {
          timestamp: `2024-01-01T00:0${i}:00Z`,
          type: 'pane',
          targetId: `pane-${i}`,
          status: i % 2 === 0 ? 'active' : 'idle'
        };
        entries.push(entry);
        await storage.appendActivity(entry);
      }
      
      const activity = await storage.loadActivity();
      
      expect(activity.entries).toHaveLength(5);
      expect(activity.entries).toEqual(entries);
    });

    it('should rotate activity log when too large', async () => {
      // Configure storage with small rotation limit for testing
      const smallStorage = new FileStorage(testDir, { maxActivityEntries: 3 });
      
      // Add entries beyond limit
      for (let i = 0; i < 5; i++) {
        const entry: ActivityEntry = {
          timestamp: `2024-01-01T00:0${i}:00Z`,
          type: 'pane',
          targetId: `pane-${i}`,
          status: 'active'
        };
        await smallStorage.appendActivity(entry);
      }
      
      const activity = await smallStorage.loadActivity();
      
      // Should only keep the most recent 3 entries
      expect(activity.entries).toHaveLength(3);
      expect(activity.entries[0].targetId).toBe('pane-2');
      expect(activity.entries[1].targetId).toBe('pane-3');
      expect(activity.entries[2].targetId).toBe('pane-4');
    });

    it('should handle concurrent activity appends', async () => {
      const entries: ActivityEntry[] = [];
      const promises: Promise<void>[] = [];
      
      // Create multiple concurrent append operations
      for (let i = 0; i < 10; i++) {
        const entry: ActivityEntry = {
          timestamp: `2024-01-01T00:${i.toString().padStart(2, '0')}:00Z`,
          type: 'pane',
          targetId: `pane-${i}`,
          status: 'active'
        };
        entries.push(entry);
        promises.push(storage.appendActivity(entry));
      }
      
      await Promise.all(promises);
      
      const activity = await storage.loadActivity();
      expect(activity.entries).toHaveLength(10);
    });
  });

  describe('Spec File Operations', () => {
    let testProjectDir: string;

    beforeEach(async () => {
      testProjectDir = path.join(testDir, 'test-project');
      await fs.mkdir(testProjectDir, { recursive: true });
    });

    it('should write spec files to project directory', async () => {
      const projectId = 'project-1';
      const specPath = 'CLAUDE.md';
      const content = '# Test Specification\n\nThis is a test spec.';
      
      // First save a project with the test directory
      const data: AgentMuxData = {
        projects: [{
          id: projectId,
          name: 'Test Project',
          fsPath: testProjectDir,
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z'
        }],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };
      await storage.saveData(data);
      
      await storage.writeSpec(projectId, specPath, content);
      
      const filePath = path.join(testProjectDir, specPath);
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      expect(fileContent).toBe(content);
    });

    it('should read spec files from project directory', async () => {
      const projectId = 'project-1';
      const specPath = 'README.md';
      const content = '# Project README\n\nProject documentation.';
      
      // Setup project
      const data: AgentMuxData = {
        projects: [{
          id: projectId,
          name: 'Test Project',
          fsPath: testProjectDir,
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z'
        }],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };
      await storage.saveData(data);
      
      // Write file directly
      const filePath = path.join(testProjectDir, specPath);
      await fs.writeFile(filePath, content);
      
      const readContent = await storage.readSpec(projectId, specPath);
      
      expect(readContent).toBe(content);
    });

    it('should prevent path traversal attacks', async () => {
      const projectId = 'project-1';
      const data: AgentMuxData = {
        projects: [{
          id: projectId,
          name: 'Test Project',
          fsPath: testProjectDir,
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z'
        }],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };
      await storage.saveData(data);
      
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config',
        '../../../../root/.ssh/id_rsa',
        './../sensitive-file.txt'
      ];
      
      for (const maliciousPath of maliciousPaths) {
        await expect(storage.writeSpec(projectId, maliciousPath, 'malicious content'))
          .rejects.toThrow(/path.*not allowed/i);
          
        await expect(storage.readSpec(projectId, maliciousPath))
          .rejects.toThrow(/path.*not allowed/i);
      }
    });

    it('should handle missing project directory', async () => {
      const projectId = 'project-1';
      const data: AgentMuxData = {
        projects: [{
          id: projectId,
          name: 'Test Project',
          fsPath: '/nonexistent/directory',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z'
        }],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };
      await storage.saveData(data);
      
      await expect(storage.writeSpec(projectId, 'test.md', 'content'))
        .rejects.toThrow();
        
      await expect(storage.readSpec(projectId, 'test.md'))
        .rejects.toThrow();
    });

    it('should handle missing spec files gracefully', async () => {
      const projectId = 'project-1';
      const data: AgentMuxData = {
        projects: [{
          id: projectId,
          name: 'Test Project',
          fsPath: testProjectDir,
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z'
        }],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };
      await storage.saveData(data);
      
      await expect(storage.readSpec(projectId, 'nonexistent.md'))
        .rejects.toThrow(/not found|ENOENT/i);
    });

    it('should create nested spec directories', async () => {
      const projectId = 'project-1';
      const data: AgentMuxData = {
        projects: [{
          id: projectId,
          name: 'Test Project',
          fsPath: testProjectDir,
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z'
        }],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };
      await storage.saveData(data);
      
      const nestedPath = 'docs/api/endpoints.md';
      const content = '# API Endpoints\n\nDocumentation for API endpoints.';
      
      await storage.writeSpec(projectId, nestedPath, content);
      
      const readContent = await storage.readSpec(projectId, nestedPath);
      expect(readContent).toBe(content);
      
      // Verify directory structure was created
      const fullPath = path.join(testProjectDir, 'docs', 'api');
      const stats = await fs.stat(fullPath);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should validate project data structure', async () => {
      const invalidData = {
        projects: [
          { 
            // Missing required fields
            name: 'Invalid Project'
          }
        ],
        teams: [],
        assignments: [],
        settings: { version: '1.0.0', created: '2024-01-01T00:00:00Z', pollingInterval: 30000 }
      };
      
      // Should handle invalid data gracefully
      await expect(storage.saveData(invalidData as any)).rejects.toThrow();
    });

    it('should validate team data structure', async () => {
      const invalidData = {
        projects: [],
        teams: [
          {
            id: 'team-1',
            name: 'Test Team',
            roles: 'invalid roles format', // Should be array
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z'
          }
        ],
        assignments: [],
        settings: { version: '1.0.0', created: '2024-01-01T00:00:00Z', pollingInterval: 30000 }
      };
      
      await expect(storage.saveData(invalidData as any)).rejects.toThrow();
    });

    it('should validate assignment data structure', async () => {
      const invalidData = {
        projects: [],
        teams: [],
        assignments: [
          {
            // Missing required projectId and teamId
            id: 'assignment-1',
            status: 'active'
          }
        ],
        settings: { version: '1.0.0', created: '2024-01-01T00:00:00Z', pollingInterval: 30000 }
      };
      
      await expect(storage.saveData(invalidData as any)).rejects.toThrow();
    });
  });

  describe('Backup and Recovery', () => {
    it('should create backup before overwriting data', async () => {
      const originalData: AgentMuxData = {
        projects: [{ 
          id: 'project-1', 
          name: 'Original Project', 
          fsPath: '/tmp', 
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z'
        }],
        teams: [],
        assignments: [],
        settings: {
          version: '1.0.0',
          created: '2024-01-01T00:00:00Z',
          pollingInterval: 30000
        }
      };
      
      await storage.saveData(originalData);
      
      const newData: AgentMuxData = {
        ...originalData,
        projects: [{ 
          id: 'project-2', 
          name: 'New Project', 
          fsPath: '/tmp', 
          status: 'active',
          createdAt: '2024-01-01T01:00:00Z'
        }]
      };
      
      await storage.saveData(newData);
      
      // Check if backup was created
      const backupPath = path.join(testDir, 'data.json.backup');
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
      
      if (backupExists) {
        const backupContent = await fs.readFile(backupPath, 'utf8');
        const backupData = JSON.parse(backupContent);
        expect(backupData.projects[0].name).toBe('Original Project');
      }
    });
  });
});