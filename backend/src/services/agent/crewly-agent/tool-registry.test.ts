import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTools, getToolNames } from './tool-registry.js';
import { CrewlyApiClient } from './api-client.js';

describe('Tool Registry', () => {
  let mockClient: jest.Mocked<CrewlyApiClient>;
  let tools: ReturnType<typeof createTools>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn<any>(),
      post: jest.fn<any>(),
      delete: jest.fn<any>(),
    } as any;
    tools = createTools(mockClient, 'crewly-orc');
  });

  describe('getToolNames', () => {
    it('should return all 21 tool names', () => {
      const names = getToolNames();
      expect(names).toHaveLength(21);
      expect(names).toContain('delegate_task');
      expect(names).toContain('send_message');
      expect(names).toContain('get_agent_status');
      expect(names).toContain('get_team_status');
      expect(names).toContain('get_agent_logs');
      expect(names).toContain('reply_slack');
      expect(names).toContain('schedule_check');
      expect(names).toContain('cancel_schedule');
      expect(names).toContain('start_agent');
      expect(names).toContain('stop_agent');
      expect(names).toContain('subscribe_event');
      expect(names).toContain('recall_memory');
      expect(names).toContain('remember');
      expect(names).toContain('heartbeat');
      expect(names).toContain('get_tasks');
      expect(names).toContain('complete_task');
      expect(names).toContain('broadcast');
      expect(names).toContain('handle_agent_failure');
      expect(names).toContain('edit_file');
      expect(names).toContain('read_file');
      expect(names).toContain('write_file');
    });
  });

  describe('createTools', () => {
    it('should create all 21 tools with descriptions and parameters', () => {
      const toolNames = Object.keys(tools);
      expect(toolNames).toHaveLength(21);
      for (const name of toolNames) {
        const t = tools[name] as any;
        expect(t).toBeDefined();
      }
    });
  });

  describe('delegate_task', () => {
    it('should deliver task message and create tracking entry', async () => {
      mockClient.post.mockResolvedValueOnce({ success: true, data: {}, status: 200 }); // deliver
      mockClient.post.mockResolvedValueOnce({ success: true, data: { taskId: 'task-1' }, status: 201 }); // task create
      mockClient.post.mockResolvedValueOnce({ success: true, data: { id: 'sub-1' }, status: 201 }); // subscribe

      const result = await (tools.delegate_task as any).execute({
        to: 'agent-sam',
        task: 'Build feature X',
        priority: 'high',
        projectPath: '/path/to/project',
      });

      expect(result.success).toBe(true);
      expect(result.delegatedTo).toBe('agent-sam');
      expect(result.taskId).toBe('task-1');
      expect(mockClient.post).toHaveBeenCalledTimes(3);
    });

    it('should fall back to force delivery on initial failure', async () => {
      mockClient.post
        .mockResolvedValueOnce({ success: false, error: 'not ready', status: 503 }) // deliver fails
        .mockResolvedValueOnce({ success: true, data: {}, status: 200 }) // force deliver
        .mockResolvedValueOnce({ success: true, data: {}, status: 201 }); // subscribe (no projectPath)

      const result = await (tools.delegate_task as any).execute({
        to: 'agent-sam',
        task: 'Build feature X',
        priority: 'normal',
      });

      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalledTimes(3);
    });

    it('should return error if both delivery attempts fail', async () => {
      mockClient.post
        .mockResolvedValueOnce({ success: false, error: 'not ready', status: 503 })
        .mockResolvedValueOnce({ success: false, error: 'session gone', status: 404 });

      const result = await (tools.delegate_task as any).execute({
        to: 'agent-sam',
        task: 'Build feature X',
        priority: 'normal',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('agent-sam');
    });
  });

  describe('send_message', () => {
    it('should deliver message with waitForReady', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: {}, status: 200 });

      const result = await (tools.send_message as any).execute({
        sessionName: 'agent-sam',
        message: 'Hello',
        force: false,
      });

      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/terminal/agent-sam/deliver',
        expect.objectContaining({ message: 'Hello', waitForReady: true }),
      );
    });

    it('should force deliver when force=true', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: {}, status: 200 });

      await (tools.send_message as any).execute({
        sessionName: 'agent-sam',
        message: 'Urgent',
        force: true,
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/terminal/agent-sam/deliver',
        expect.objectContaining({ message: 'Urgent', force: true }),
      );
    });
  });

  describe('get_agent_status', () => {
    it('should find agent in team members', async () => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: [
          { members: [{ sessionName: 'agent-sam', status: 'active' }] },
        ],
        status: 200,
      });

      const result = await (tools.get_agent_status as any).execute({
        sessionName: 'agent-sam',
      });

      expect(result.sessionName).toBe('agent-sam');
      expect(result.status).toBe('active');
    });

    it('should return error when agent not found', async () => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: [{ members: [] }],
        status: 200,
      });

      const result = await (tools.get_agent_status as any).execute({
        sessionName: 'nonexistent',
      });

      expect(result.error).toBe('Agent not found');
    });
  });

  describe('get_team_status', () => {
    it('should return all teams', async () => {
      mockClient.get.mockResolvedValue({ success: true, data: [{ name: 'Team A' }], status: 200 });

      const result = await (tools.get_team_status as any).execute({});

      expect(result).toEqual([{ name: 'Team A' }]);
    });
  });

  describe('get_agent_logs', () => {
    it('should fetch terminal output', async () => {
      mockClient.get.mockResolvedValue({ success: true, data: 'line 1\nline 2', status: 200 });

      const result = await (tools.get_agent_logs as any).execute({
        sessionName: 'agent-sam',
        lines: 20,
      });

      expect(result).toBe('line 1\nline 2');
      expect(mockClient.get).toHaveBeenCalledWith('/terminal/agent-sam/output?lines=20');
    });
  });

  describe('reply_slack', () => {
    it('should send slack message with thread', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: {}, status: 200 });

      const result = await (tools.reply_slack as any).execute({
        channelId: 'C123',
        text: 'Hello team',
        threadTs: '123.456',
      });

      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalledWith('/slack/send', {
        channelId: 'C123',
        text: 'Hello team',
        threadTs: '123.456',
      });
    });

    it('should send without threadTs', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: {}, status: 200 });

      await (tools.reply_slack as any).execute({
        channelId: 'C123',
        text: 'Hello',
      });

      expect(mockClient.post).toHaveBeenCalledWith('/slack/send', {
        channelId: 'C123',
        text: 'Hello',
      });
    });
  });

  describe('schedule_check', () => {
    it('should schedule a one-time check', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: { checkId: 'sched-1' }, status: 201 });

      const result = await (tools.schedule_check as any).execute({
        minutes: 10,
        message: 'Check progress',
        recurring: false,
      });

      expect(result.checkId).toBe('sched-1');
      expect(mockClient.post).toHaveBeenCalledWith('/schedule', expect.objectContaining({
        targetSession: 'crewly-orc',
        minutes: 10,
        message: 'Check progress',
      }));
    });

    it('should schedule a recurring check', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: { checkId: 'sched-2' }, status: 201 });

      await (tools.schedule_check as any).execute({
        minutes: 5,
        message: 'Recurring check',
        recurring: true,
        maxOccurrences: 3,
      });

      expect(mockClient.post).toHaveBeenCalledWith('/schedule', expect.objectContaining({
        isRecurring: true,
        intervalMinutes: 5,
        maxOccurrences: 3,
      }));
    });
  });

  describe('heartbeat', () => {
    it('should fetch teams, projects, and queue in parallel', async () => {
      mockClient.get
        .mockResolvedValueOnce({ success: true, data: [{ name: 'Team A' }], status: 200 })
        .mockResolvedValueOnce({ success: true, data: [{ name: 'Project 1' }], status: 200 })
        .mockResolvedValueOnce({ success: true, data: { pending: 0 }, status: 200 });

      const result = await (tools.heartbeat as any).execute({});

      expect(result.status).toBe('ok');
      expect(result.teams).toEqual([{ name: 'Team A' }]);
      expect(result.projects).toEqual([{ name: 'Project 1' }]);
      expect(result.queue).toEqual({ pending: 0 });
    });

    it('should handle partial failures gracefully', async () => {
      mockClient.get
        .mockResolvedValueOnce({ success: true, data: [], status: 200 })
        .mockResolvedValueOnce({ success: false, error: 'unavailable', status: 500 })
        .mockResolvedValueOnce({ success: true, data: {}, status: 200 });

      const result = await (tools.heartbeat as any).execute({});

      expect(result.status).toBe('ok');
      expect(result.projects).toBe('unavailable');
    });
  });

  describe('start_agent', () => {
    it('should start agent via API', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: { started: true }, status: 200 });

      const result = await (tools.start_agent as any).execute({
        teamId: 'team-1',
        memberId: 'member-1',
      });

      expect(result.started).toBe(true);
      expect(mockClient.post).toHaveBeenCalledWith('/teams/team-1/members/member-1/start', {});
    });
  });

  describe('stop_agent', () => {
    it('should stop agent via API', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: { stopped: true }, status: 200 });

      const result = await (tools.stop_agent as any).execute({
        teamId: 'team-1',
        memberId: 'member-1',
      });

      expect(result.stopped).toBe(true);
    });
  });

  describe('handle_agent_failure', () => {
    it('should restart agent by stopping then starting', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: {}, status: 200 });

      const result = await (tools.handle_agent_failure as any).execute({
        teamId: 'team-1',
        memberId: 'member-1',
        sessionName: 'agent-sam',
        action: 'restart',
      });

      expect(result.action).toBe('restarted');
      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalledTimes(2); // stop + start
    });

    it('should handle escalation', async () => {
      const result = await (tools.handle_agent_failure as any).execute({
        teamId: 'team-1',
        memberId: 'member-1',
        sessionName: 'agent-sam',
        action: 'escalate',
        reason: 'Agent stuck',
      });

      expect(result.action).toBe('escalated');
      expect(result.reason).toBe('Agent stuck');
    });
  });

  describe('recall_memory', () => {
    it('should call memory recall API', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: { memories: [] }, status: 200 });

      const result = await (tools.recall_memory as any).execute({
        context: 'deployment process',
        scope: 'project',
      });

      expect(result.memories).toEqual([]);
      expect(mockClient.post).toHaveBeenCalledWith('/memory/recall', {
        agentId: 'crewly-orc',
        context: 'deployment process',
        scope: 'project',
      });
    });
  });

  describe('remember', () => {
    it('should store knowledge via API', async () => {
      mockClient.post.mockResolvedValue({ success: true, data: { id: 'mem-1' }, status: 201 });

      const result = await (tools.remember as any).execute({
        content: 'Always use async/await',
        category: 'pattern',
        scope: 'project',
      });

      expect(result.id).toBe('mem-1');
    });
  });

  describe('get_tasks', () => {
    it('should fetch tasks with project path', async () => {
      mockClient.get.mockResolvedValue({ success: true, data: [], status: 200 });

      await (tools.get_tasks as any).execute({
        projectPath: '/path/to/project',
        status: 'in_progress',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/task-management/tasks?projectPath=%2Fpath%2Fto%2Fproject&status=in_progress',
      );
    });
  });

  describe('broadcast', () => {
    it('should send message to all sessions except self', async () => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: [{ name: 'agent-sam' }, { name: 'agent-leo' }, { name: 'crewly-orc' }],
        status: 200,
      });
      mockClient.post.mockResolvedValue({ success: true, data: {}, status: 200 });

      const result = await (tools.broadcast as any).execute({ message: 'Hello all' });

      expect(result.sent).toBe(2); // sam + leo, skip crewly-orc (self)
      expect(result.failed).toBe(0);
    });
  });

  describe('edit_file', () => {
    let mockReadFile: jest.SpiedFunction<typeof import('fs').promises.readFile>;
    let mockWriteFile: jest.SpiedFunction<typeof import('fs').promises.writeFile>;

    beforeEach(async () => {
      const fs = await import('fs');
      mockReadFile = jest.spyOn(fs.promises, 'readFile') as any;
      mockWriteFile = jest.spyOn(fs.promises, 'writeFile') as any;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should replace unique string in file', async () => {
      mockReadFile.mockResolvedValue('Hello World\nGoodbye World' as any);
      mockWriteFile.mockResolvedValue(undefined as any);

      const result = await (tools.edit_file as any).execute({
        file_path: '/test/file.ts',
        old_string: 'Hello World',
        new_string: 'Hi World',
        replace_all: false,
      });

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(1);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/file.ts',
        'Hi World\nGoodbye World',
        'utf8',
      );
    });

    it('should fail when old_string not found', async () => {
      mockReadFile.mockResolvedValue('Hello World' as any);

      const result = await (tools.edit_file as any).execute({
        file_path: '/test/file.ts',
        old_string: 'Not Found',
        new_string: 'Replacement',
        replace_all: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when old_string has multiple matches', async () => {
      mockReadFile.mockResolvedValue('foo bar foo baz foo' as any);

      const result = await (tools.edit_file as any).execute({
        file_path: '/test/file.ts',
        old_string: 'foo',
        new_string: 'qux',
        replace_all: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('3 times');
      expect(result.occurrences).toBe(3);
    });

    it('should handle file not found error', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

      const result = await (tools.edit_file as any).execute({
        file_path: '/nonexistent/file.ts',
        old_string: 'foo',
        new_string: 'bar',
        replace_all: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('read_file', () => {
    let mockReadFile: jest.SpiedFunction<typeof import('fs').promises.readFile>;

    beforeEach(async () => {
      const fs = await import('fs');
      mockReadFile = jest.spyOn(fs.promises, 'readFile') as any;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should read entire file with line numbers', async () => {
      mockReadFile.mockResolvedValue('line 1\nline 2\nline 3' as any);

      const result = await (tools.read_file as any).execute({
        file_path: '/test/file.ts',
      });

      expect(result.success).toBe(true);
      expect(result.totalLines).toBe(3);
      expect(result.content).toContain('1\tline 1');
      expect(result.content).toContain('3\tline 3');
    });

    it('should support offset and limit', async () => {
      mockReadFile.mockResolvedValue('a\nb\nc\nd\ne' as any);

      const result = await (tools.read_file as any).execute({
        file_path: '/test/file.ts',
        offset: 2,
        limit: 2,
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('2\tb');
      expect(result.content).toContain('3\tc');
      expect(result.content).not.toContain('4\td');
    });

    it('should handle file not found', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await (tools.read_file as any).execute({
        file_path: '/nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('write_file', () => {
    let mockWriteFile: jest.SpiedFunction<typeof import('fs').promises.writeFile>;
    let mockMkdir: jest.SpiedFunction<typeof import('fs').promises.mkdir>;

    beforeEach(async () => {
      const fs = await import('fs');
      mockWriteFile = jest.spyOn(fs.promises, 'writeFile') as any;
      mockMkdir = jest.spyOn(fs.promises, 'mkdir') as any;
      mockWriteFile.mockResolvedValue(undefined as any);
      mockMkdir.mockResolvedValue(undefined as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should write file and return byte count', async () => {
      const result = await (tools.write_file as any).execute({
        file_path: '/test/new-file.ts',
        content: 'export const x = 1;\n',
      });

      expect(result.success).toBe(true);
      expect(result.file).toBe('/test/new-file.ts');
      expect(result.bytes).toBeGreaterThan(0);
      expect(mockMkdir).toHaveBeenCalledWith('/test', { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith('/test/new-file.ts', 'export const x = 1;\n', 'utf8');
    });

    it('should handle write errors', async () => {
      mockWriteFile.mockRejectedValue(new Error('EACCES'));

      const result = await (tools.write_file as any).execute({
        file_path: '/protected/file.ts',
        content: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('EACCES');
    });
  });
});
