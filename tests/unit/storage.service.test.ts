import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../../backend/src/services/storage.service';
import { Team, Project } from '../../backend/src/types';

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
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsPromises = require('fs/promises');

describe('StorageService', () => {
  let storageService: StorageService;
  const testHome = '/tmp/agentmux-test';

  beforeEach(() => {
    jest.clearAllMocks();
    storageService = new StorageService(testHome);
    mockFs.existsSync.mockReturnValue(true);
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
            status: 'idle',
            agentStatus: 'inactive',
            workingStatus: 'idle',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          }
        ],
        status: 'working',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      // Mock file operations
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify([]));
      mockFsPromises.writeFile.mockResolvedValue(undefined);

      await storageService.saveTeam(testTeam);

      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        path.join(testHome, 'teams.json'),
        expect.stringContaining('"teams"')
      );
      
      // Verify the content structure has teams array and orchestrator
      const writeCall = mockFsPromises.writeFile.mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.teams).toEqual([testTeam]);
      expect(savedData.orchestrator).toBeDefined();
    });

    test('should update team status', async () => {
      const existingTeam: Team = {
        id: 'test-id',
        name: 'Test Team',
        description: 'Test team description',
        members: [],
        status: 'idle',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const initialData = {
        teams: [existingTeam],
        orchestrator: { sessionId: 'agentmux-orc', status: 'activating', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      };
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(initialData));
      mockFsPromises.writeFile.mockResolvedValue(undefined);

      await storageService.updateTeamStatus('test-id', 'working');

      expect(mockFsPromises.writeFile).toHaveBeenCalled();
      const writeCall = mockFsPromises.writeFile.mock.calls[0];
      const updatedData = JSON.parse(writeCall[1]);
      expect(updatedData.teams[0].status).toBe('working');
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
      expect(project.status).toBe('active');
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
});