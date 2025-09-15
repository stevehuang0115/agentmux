import { TaskFolderService } from './task-folder.service';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));
jest.mock('path');

describe('TaskFolderService', () => {
  let service: TaskFolderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaskFolderService();
    
    // Setup default path mocking
    (path.join as jest.Mock).mockImplementation((...parts) => parts.join('/'));
    (path.dirname as jest.Mock).mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
    (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop() || '');
  });

  describe('createMilestoneStatusFolders', () => {
    it('should create all status folders', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      
      await service.createMilestoneStatusFolders('/project/tasks/milestone1');
      
      expect(fs.mkdir).toHaveBeenCalledTimes(4);
      expect(fs.mkdir).toHaveBeenCalledWith('/project/tasks/milestone1/open', { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith('/project/tasks/milestone1/in_progress', { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith('/project/tasks/milestone1/done', { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith('/project/tasks/milestone1/blocked', { recursive: true });
    });

    it('should handle mkdir errors', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      
      await expect(service.createMilestoneStatusFolders('/project/tasks/milestone1'))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('createM0DefininingProjectMilestone', () => {
    it('should create m0_defining_project milestone with status folders', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      const createStatusFoldersSpy = jest.spyOn(service, 'createMilestoneStatusFolders').mockResolvedValue();
      
      const result = await service.createM0DefininingProjectMilestone('/project');
      
      expect(fs.mkdir).toHaveBeenCalledWith('/project/.agentmux/tasks/m0_defining_project', { recursive: true });
      expect(createStatusFoldersSpy).toHaveBeenCalledWith('/project/.agentmux/tasks/m0_defining_project');
      expect(result).toBe('/project/.agentmux/tasks/m0_defining_project');
    });
  });

  describe('ensureStatusFoldersForProject', () => {
    it('should return early if tasks path does not exist', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      
      await service.ensureStatusFoldersForProject('/project');
      
      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('should ensure status folders for existing milestone folders', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockResolvedValue(['m1_design', 'm2_implementation', 'other_folder', 'file.txt']);
      (fs.stat as jest.Mock).mockImplementation((itemPath) => {
        const item = itemPath.split('/').pop();
        return Promise.resolve({
          isDirectory: () => item?.startsWith('m') && item.includes('_')
        });
      });
      const createStatusFoldersSpy = jest.spyOn(service, 'createMilestoneStatusFolders').mockResolvedValue();
      
      await service.ensureStatusFoldersForProject('/project');
      
      expect(fs.readdir).toHaveBeenCalledWith('/project/.agentmux/tasks');
      expect(createStatusFoldersSpy).toHaveBeenCalledWith('/project/.agentmux/tasks/m1_design');
      expect(createStatusFoldersSpy).toHaveBeenCalledWith('/project/.agentmux/tasks/m2_implementation');
      expect(createStatusFoldersSpy).toHaveBeenCalledTimes(2);
    });

    it('should skip non-milestone folders', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockResolvedValue(['regular_folder', 'file.txt']);
      (fs.stat as jest.Mock).mockImplementation(() => Promise.resolve({ isDirectory: () => false }));
      const createStatusFoldersSpy = jest.spyOn(service, 'createMilestoneStatusFolders').mockResolvedValue();
      
      await service.ensureStatusFoldersForProject('/project');
      
      expect(createStatusFoldersSpy).not.toHaveBeenCalled();
    });
  });

  describe('moveTaskToStatus', () => {
    it('should move task file to new status folder', async () => {
      (path.basename as jest.Mock).mockReturnValue('task001.md');
      (path.dirname as jest.Mock).mockImplementation((p) => {
        if (p === '/project/tasks/milestone1/open/task001.md') return '/project/tasks/milestone1/open';
        if (p === '/project/tasks/milestone1/open') return '/project/tasks/milestone1';
        if (p === '/project/tasks/milestone1/in_progress/task001.md') return '/project/tasks/milestone1/in_progress';
        return p;
      });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.rename as jest.Mock).mockResolvedValue(undefined);
      
      const result = await service.moveTaskToStatus(
        '/project/tasks/milestone1/open/task001.md',
        'in_progress'
      );
      
      expect(fs.mkdir).toHaveBeenCalledWith('/project/tasks/milestone1/in_progress', { recursive: true });
      expect(fs.rename).toHaveBeenCalledWith(
        '/project/tasks/milestone1/open/task001.md',
        '/project/tasks/milestone1/in_progress/task001.md'
      );
      expect(result).toBe('/project/tasks/milestone1/in_progress/task001.md');
    });

    it('should handle file move errors', async () => {
      (path.basename as jest.Mock).mockReturnValue('task001.md');
      (path.dirname as jest.Mock).mockReturnValue('/project/tasks/milestone1');
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.rename as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      await expect(service.moveTaskToStatus('/project/tasks/milestone1/open/task001.md', 'done'))
        .rejects.toThrow('File not found');
    });
  });

  describe('createTaskFile', () => {
    it('should create task file in specified status folder', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      const result = await service.createTaskFile(
        '/project/tasks/milestone1',
        'task001.md',
        '# Task Content',
        'open'
      );
      
      expect(fs.mkdir).toHaveBeenCalledWith('/project/tasks/milestone1/open', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/project/tasks/milestone1/open/task001.md',
        '# Task Content',
        'utf-8'
      );
      expect(result).toBe('/project/tasks/milestone1/open/task001.md');
    });

    it('should default to open status', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      await service.createTaskFile(
        '/project/tasks/milestone1',
        'task001.md',
        '# Task Content'
      );
      
      expect(fs.mkdir).toHaveBeenCalledWith('/project/tasks/milestone1/open', { recursive: true });
    });
  });

  describe('getTasksInStatus', () => {
    it('should return empty array if status folder does not exist', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = await service.getTasksInStatus('/project/tasks/milestone1', 'open');
      
      expect(result).toEqual([]);
    });

    it('should return markdown files from status folder', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockResolvedValue([
        'task001.md',
        'task002.md',
        'not_markdown.txt',
        'task003.md'
      ]);
      
      const result = await service.getTasksInStatus('/project/tasks/milestone1', 'done');
      
      expect(fs.readdir).toHaveBeenCalledWith('/project/tasks/milestone1/done');
      expect(result).toEqual(['task001.md', 'task002.md', 'task003.md']);
    });
  });

  describe('findTaskFile', () => {
    it('should find task file in status folders', async () => {
      (fsSync.existsSync as jest.Mock).mockImplementation((filePath) => {
        return filePath === '/project/tasks/milestone1/in_progress/task001.md';
      });
      
      const result = await service.findTaskFile('/project/tasks/milestone1', 'task001.md');
      
      expect(result).toBe('/project/tasks/milestone1/in_progress/task001.md');
    });

    it('should return null if task file not found', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = await service.findTaskFile('/project/tasks/milestone1', 'nonexistent.md');
      
      expect(result).toBeNull();
    });

    it('should check all status folders in order', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      
      await service.findTaskFile('/project/tasks/milestone1', 'task001.md');
      
      expect(fsSync.existsSync).toHaveBeenCalledWith('/project/tasks/milestone1/open/task001.md');
      expect(fsSync.existsSync).toHaveBeenCalledWith('/project/tasks/milestone1/in_progress/task001.md');
      expect(fsSync.existsSync).toHaveBeenCalledWith('/project/tasks/milestone1/done/task001.md');
      expect(fsSync.existsSync).toHaveBeenCalledWith('/project/tasks/milestone1/blocked/task001.md');
    });
  });

  describe('getTaskStatus', () => {
    it('should return correct status when task is found', async () => {
      (fsSync.existsSync as jest.Mock).mockImplementation((filePath) => {
        return filePath === '/project/tasks/milestone1/done/task001.md';
      });
      
      const result = await service.getTaskStatus('/project/tasks/milestone1', 'task001.md');
      
      expect(result).toBe('done');
    });

    it('should return not_found when task is not found', async () => {
      (fsSync.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = await service.getTaskStatus('/project/tasks/milestone1', 'nonexistent.md');
      
      expect(result).toBe('not_found');
    });

    it('should return first matching status', async () => {
      (fsSync.existsSync as jest.Mock).mockImplementation((filePath) => {
        return filePath.includes('/open/') || filePath.includes('/in_progress/');
      });
      
      const result = await service.getTaskStatus('/project/tasks/milestone1', 'task001.md');
      
      expect(result).toBe('open'); // First status checked
    });
  });

  describe('generateTaskFileContent', () => {
    const mockStep = {
      id: 'step-001',
      name: 'Create Initial Setup',
      targetRole: 'developer',
      delayMinutes: 30,
      conditional: 'none',
      verification: {
        type: 'file_exists',
        path: '{PROJECT_PATH}/setup.js'
      },
      prompts: [
        'Create the initial setup for {PROJECT_NAME}',
        'Initialize the project structure in {PROJECT_PATH}',
        'Set up the basic configuration for {PROJECT_ID}'
      ]
    };

    it('should generate task file content with all placeholders replaced', async () => {
      const result = await service.generateTaskFileContent(
        mockStep,
        'Test Project',
        '/test/project',
        'test-project-id',
        'Build awesome app',
        'User can sign up and create posts'
      );
      
      expect(result).toContain('targetRole: developer');
      expect(result).toContain('stepId: step-001');
      expect(result).toContain('delayMinutes: 30');
      expect(result).toContain('conditional: none');
      expect(result).toContain('# Create Initial Setup');
      expect(result).toContain('Create the initial setup for Test Project');
      expect(result).toContain('Initialize the project structure in /test/project');
      expect(result).toContain('Set up the basic configuration for test-project-id');
      expect(result).toContain('"path": "/test/project/setup.js"');
    });

    it('should handle missing optional parameters with defaults', async () => {
      const stepWithGoalVar = {
        ...mockStep,
        prompts: [
          'Create the initial setup for {PROJECT_NAME}',
          'Goal: {INITIAL_GOAL}',
          'Journey: {USER_JOURNEY}'
        ]
      };

      const result = await service.generateTaskFileContent(
        stepWithGoalVar,
        'Test Project',
        '/test/project',
        'test-project-id'
      );

      expect(result).toContain('See project specifications');
    });

    it('should include verification JSON', async () => {
      const result = await service.generateTaskFileContent(
        mockStep,
        'Test Project',
        '/test/project',
        'test-project-id'
      );
      
      expect(result).toContain('```json');
      expect(result).toContain('"type": "file_exists"');
      expect(result).toContain('"path": "/test/project/setup.js"');
    });

    it('should handle conditional dependencies', async () => {
      const stepWithDependency = {
        ...mockStep,
        conditional: 'previous-step-completed'
      };

      const result = await service.generateTaskFileContent(
        stepWithDependency,
        'Test Project',
        '/test/project',
        'test-project-id'
      );
      
      expect(result).toContain('Previous step must be completed: previous-step-completed');
    });

    it('should include file movement instructions', async () => {
      const result = await service.generateTaskFileContent(
        mockStep,
        'Test Project',
        '/test/project',
        'test-project-id'
      );
      
      expect(result).toContain("Move this file to 'in_progress/' folder when starting work");
      expect(result).toContain("Move to 'done/' folder when completed");
      expect(result).toContain("Move to 'blocked/' folder if unable to proceed");
    });

    it('should include acceptance criteria checklist', async () => {
      const result = await service.generateTaskFileContent(
        mockStep,
        'Test Project',
        '/test/project',
        'test-project-id'
      );
      
      expect(result).toContain('- [ ] Task completed according to verification criteria');
      expect(result).toContain('- [ ] All deliverables created and validated');
      expect(result).toContain("- [ ] Task moved to 'done' folder upon completion");
    });

    it('should handle multiple prompts correctly', async () => {
      const result = await service.generateTaskFileContent(
        mockStep,
        'Test Project',
        '/test/project',
        'test-project-id'
      );
      
      const lines = result.split('\n');
      const objectiveIndex = lines.findIndex(line => line.includes('## Objective'));
      const detailedIndex = lines.findIndex(line => line.includes('## Detailed Instructions'));
      
      expect(objectiveIndex).toBeGreaterThan(-1);
      expect(detailedIndex).toBeGreaterThan(-1);
      expect(detailedIndex).toBeGreaterThan(objectiveIndex);
    });

    it('should handle step with no prompts', async () => {
      const stepWithoutPrompts = {
        ...mockStep,
        prompts: []
      };

      const result = await service.generateTaskFileContent(
        stepWithoutPrompts,
        'Test Project',
        '/test/project',
        'test-project-id'
      );
      
      expect(result).toContain('Create Initial Setup'); // Should fall back to step name
    });
  });
});