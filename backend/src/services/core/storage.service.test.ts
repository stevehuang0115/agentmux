import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from './storage.service.js';
import { Team, Project } from '../../types/index.js';
import { AGENTMUX_CONSTANTS } from '../../constants.js';

// Mock filesystem
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  watch: jest.fn(() => ({ close: jest.fn() })),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  appendFile: jest.fn(),
  open: jest.fn(),
  rename: jest.fn(),
  copyFile: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsPromises = require('fs/promises');

describe('StorageService', () => {
  let storageService: StorageService;
  const testHome = '/tmp/agentmux-test';

  beforeEach(() => {
    jest.clearAllMocks();
    StorageService.clearInstance();
    storageService = StorageService.getInstance(testHome);
    mockFs.existsSync.mockReturnValue(true);
    
    // Setup default mocks for atomic write operations
    mockFsPromises.open.mockResolvedValue({
      sync: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    });
    mockFsPromises.rename.mockResolvedValue(undefined);
    mockFsPromises.unlink.mockResolvedValue(undefined);
  });

  describe('Team Management', () => {
    test('should save and retrieve teams', async () => {
      const testTeam: Team = {
        id: 'test-id',
        name: 'Test Team',
        description: 'Test team description',
        members: [
          {
            id: 'member-1',
            name: 'Test Developer',
            sessionName: 'test-session',
            role: 'developer',
            systemPrompt: 'Test prompt',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            runtimeType: 'claude-code',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          }
        ],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const initialData = { teams: [], orchestrator: { sessionName: 'agentmux-orc', agentStatus: 'inactive', workingStatus: 'idle', runtimeType: 'claude-code', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };

      // Mock file operations
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(initialData));
      mockFsPromises.writeFile.mockResolvedValue(undefined);

      await storageService.saveTeam(testTeam);

      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/teams\.json\.tmp\.\d+\.[a-z0-9]+$/),
        expect.stringContaining('"teams"'),
        'utf8'
      );
    });

    test('should update existing team', async () => {
      const existingTeam: Team = {
        id: 'test-id',
        name: 'Test Team',
        description: 'Test team description',
        members: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const initialData = {
        teams: [existingTeam],
        orchestrator: { sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, agentStatus: 'activating', workingStatus: 'idle', runtimeType: 'claude-code', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      };
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(initialData));

      const updatedTeam = { ...existingTeam, name: 'Updated Team' };
      await storageService.saveTeam(updatedTeam);

      expect(mockFsPromises.writeFile).toHaveBeenCalled();
      const writeCall = mockFsPromises.writeFile.mock.calls[0];
      const parsedContent = JSON.parse(writeCall[1]);
      expect(parsedContent.teams[0].name).toBe('Updated Team');
    });
  });

  describe('Project Management', () => {
    test('should add new project', async () => {
      const projectPath = '/test/project';

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify([]));
      mockFsPromises.writeFile.mockResolvedValue(undefined);
      mockFs.existsSync.mockReturnValue(false); // .agentmux dir doesn't exist
      mockFs.mkdirSync.mockReturnValue(undefined);

      const project = await storageService.addProject(projectPath);

      expect(project.name).toBe('project');
      expect(project.path).toBe(projectPath);
      expect(project.status).toBe('stopped');
      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('Ticket Management', () => {
    test('should parse ticket YAML correctly', async () => {
      const ticketContent = `---\nid: ticket-1\ntitle: Test Ticket\nstatus: open\npriority: high\n---\n\n## Description\n\nThis is a test ticket.`;

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readdir.mockResolvedValue(['ticket-1.yaml']);
      mockFsPromises.readFile.mockResolvedValue(ticketContent);

      const tickets = await storageService.getTickets('/test/project');

      expect(tickets).toHaveLength(1);
      expect(tickets[0].id).toBe('ticket-1');
      expect(tickets[0].title).toBe('Test Ticket');
      expect(tickets[0].status).toBe('open');
      expect(tickets[0].priority).toBe('high');
    });

    test('should filter tickets by criteria', async () => {
      const tickets = [
        { assignedTo: 'dev-1', status: 'open', priority: 'high' },
        { assignedTo: 'dev-2', status: 'in_progress', priority: 'low' },
        { assignedTo: 'dev-1', status: 'done', priority: 'medium' },
      ];

      // Mock file system to return test tickets
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readdir.mockResolvedValue(['t1.yaml', 't2.yaml', 't3.yaml']);
      
      tickets.forEach((ticket, index) => {
        const content = `---\nid: t${index + 1}\nassignedTo: ${ticket.assignedTo}\nstatus: ${ticket.status}\npriority: ${ticket.priority}\n---\n\nTest content`;
        mockFsPromises.readFile.mockResolvedValueOnce(content);
      });

      const filtered = await storageService.getTickets('/test/project', {
        status: 'open',
        assignedTo: 'dev-1'
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].status).toBe('open');
      expect(filtered[0].assignedTo).toBe('dev-1');
    });
  });

  describe('Atomic File Operations', () => {
    test('should use atomic writes for teams.json operations', async () => {
      const testTeam: Team = {
        id: 'test-id',
        name: 'Test Team',
        description: 'Test team description',
        members: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify({ teams: [], orchestrator: { sessionName: 'agentmux-orc', agentStatus: 'inactive', workingStatus: 'idle', runtimeType: 'claude-code', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }));

      await storageService.saveTeam(testTeam);

      // Verify atomic write was used (writeFile to temp, then rename)
      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/teams\.json\.tmp\.\d+\.[a-z0-9]+$/),
        expect.stringContaining('"test-id"'),
        'utf8'
      );
      expect(mockFsPromises.rename).toHaveBeenCalledWith(
        expect.stringMatching(/teams\.json\.tmp\.\d+\.[a-z0-9]+$/),
        path.join(testHome, 'teams.json')
      );
    });

    test('should handle concurrent writes without race conditions', async () => {
      const team1: Team = {
        id: 'team-1',
        name: 'Team 1',
        description: 'Team 1 description',
        members: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const team2: Team = {
        id: 'team-2',
        name: 'Team 2',
        description: 'Team 2 description',
        members: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify({ teams: [], orchestrator: { sessionName: 'agentmux-orc', agentStatus: 'inactive', workingStatus: 'idle', runtimeType: 'claude-code', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }));

      // Start concurrent writes
      const write1 = storageService.saveTeam(team1);
      const write2 = storageService.saveTeam(team2);

      await Promise.all([write1, write2]);

      // Both operations should complete successfully with atomic writes
      expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(2);
      expect(mockFsPromises.rename).toHaveBeenCalledTimes(2);
    });

    test('should clean up temporary files on write failure', async () => {
      const testTeam: Team = {
        id: 'test-id',
        name: 'Test Team',
        description: 'Test team description',
        members: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      // Mock rename to fail
      mockFsPromises.rename.mockRejectedValue(new Error('Rename failed'));
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify({ teams: [], orchestrator: { sessionName: 'agentmux-orc', agentStatus: 'inactive', workingStatus: 'idle', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }));

      await expect(storageService.saveTeam(testTeam)).rejects.toThrow('Rename failed');

      // Verify temp file cleanup was attempted
      expect(mockFsPromises.unlink).toHaveBeenCalledWith(
        expect.stringMatching(/teams\.json\.tmp\.\d+\.[a-z0-9]+$/)
      );
    });
  });

  describe('Data Protection', () => {
    test('should not overwrite non-empty data with empty defaults', async () => {
      const existingProjects: Project[] = [
        {
          id: 'existing-project',
          name: 'Existing Project',
          path: '/test/existing',
          status: 'stopped',
          teams: {},
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
      ];

      // File exists with valid content
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(existingProjects));

      const projects = await storageService.getProjects();

      expect(projects.length).toBe(1);
      expect(projects[0].id).toBe('existing-project');
      // ensureFile should NOT have written empty defaults
      // The only write call should be for the atomic write temp pattern if any
      const writeCallsWithDefaults = mockFsPromises.writeFile.mock.calls.filter(
        (call: unknown[]) => call[1] === JSON.stringify([], null, 2)
      );
      expect(writeCallsWithDefaults.length).toBe(0);
    });

    test('should backup corrupted/empty file before reinitializing', async () => {
      // File exists but is empty (which causes JSON parse to fail)
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue('');
      mockFsPromises.copyFile.mockResolvedValue(undefined);

      await storageService.getProjects();

      // Should have attempted to backup the corrupted/empty file
      expect(mockFsPromises.copyFile).toHaveBeenCalledWith(
        path.join(testHome, 'projects.json'),
        expect.stringMatching(/projects\.json\.backup\.\d+$/)
      );
    });
  });
});