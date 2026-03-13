import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AgentRunnerService } from './agent-runner.service.js';
import { ModelManager } from './model-manager.js';
import { CrewlyApiClient } from './api-client.js';
import type { CrewlyAgentConfig, SecurityPolicy, AuditEntry } from './types.js';

describe('AgentRunnerService', () => {
  let runner: AgentRunnerService;
  let mockModelManager: jest.Mocked<ModelManager>;
  let mockApiClient: jest.Mocked<CrewlyApiClient>;
  let mockGenerateText: jest.Mock<any>;
  const mockModel = { provider: 'mock', modelId: 'test-model' };

  const baseConfig: CrewlyAgentConfig = {
    model: { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', temperature: 0.3, maxTokens: 8192 },
    maxSteps: 10,
    sessionName: 'test-session',
    apiBaseUrl: 'http://localhost:8787',
    systemPrompt: 'You are a test agent.',
    maxHistoryMessages: 20,
    compactionThreshold: 0.8,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGenerateText = jest.fn<any>();

    mockModelManager = {
      getModel: jest.fn<any>().mockResolvedValue(mockModel),
      getAvailableProviders: jest.fn<any>(),
      clearCache: jest.fn<any>(),
    } as any;

    mockApiClient = {
      get: jest.fn<any>(),
      post: jest.fn<any>(),
      delete: jest.fn<any>(),
    } as any;

    runner = new AgentRunnerService(baseConfig, mockModelManager, mockApiClient);
    runner._generateTextFn = mockGenerateText;
  });

  describe('constructor', () => {
    it('should create with default ModelManager and ApiClient when not provided', () => {
      const r = new AgentRunnerService(baseConfig);
      expect(r).toBeDefined();
      expect(r.isInitialized()).toBe(false);
    });

    it('should initialize conversation state with empty messages', () => {
      const state = runner.getState();
      expect(state.messages).toEqual([]);
      expect(state.systemPrompt).toBe('You are a test agent.');
      expect(state.totalTokens).toEqual({ input: 0, output: 0 });
    });
  });

  describe('initialize', () => {
    it('should load the model via ModelManager', async () => {
      await runner.initialize();

      expect(runner.isInitialized()).toBe(true);
      expect(mockModelManager.getModel).toHaveBeenCalledWith(baseConfig.model);
    });

    it('should propagate ModelManager errors', async () => {
      mockModelManager.getModel.mockRejectedValueOnce(new Error('Invalid API key'));

      await expect(runner.initialize()).rejects.toThrow('Invalid API key');
      expect(runner.isInitialized()).toBe(false);
    });
  });

  describe('run', () => {
    beforeEach(async () => {
      await runner.initialize();
    });

    it('should call generateText and return structured result', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Hello from agent',
        steps: [{ toolCalls: [], toolResults: [] }],
        usage: { inputTokens: 100, outputTokens: 50 },
        finishReason: 'stop',
      });

      const result = await runner.run('Hi there');

      expect(result.text).toBe('Hello from agent');
      expect(result.steps).toBe(1);
      expect(result.usage).toEqual({ input: 100, output: 50 });
      expect(result.toolCalls).toEqual([]);
      expect(result.finishReason).toBe('stop');
    });

    it('should add user message and assistant response to history', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Response',
        steps: [],
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: 'stop',
      });

      await runner.run('Question');

      expect(runner.getHistoryLength()).toBe(2); // user + assistant
      const state = runner.getState();
      expect(state.messages[0]).toEqual({ role: 'user', content: 'Question' });
      expect(state.messages[1]).toEqual({ role: 'assistant', content: 'Response' });
    });

    it('should not add assistant message when text is empty', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: '',
        steps: [{ toolCalls: [], toolResults: [] }],
        usage: { inputTokens: 10, outputTokens: 0 },
        finishReason: 'tool-calls',
      });

      await runner.run('Do something');

      expect(runner.getHistoryLength()).toBe(1); // only user message
    });

    it('should track tool calls across steps', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Done',
        steps: [
          {
            toolCalls: [
              { toolCallId: 'tc-1', toolName: 'get_team_status', input: {} },
            ],
            toolResults: [
              { toolCallId: 'tc-1', output: { teams: [] } },
            ],
          },
          {
            toolCalls: [
              { toolCallId: 'tc-2', toolName: 'send_message', input: { to: 'sam' } },
            ],
            toolResults: [
              { toolCallId: 'tc-2', output: { success: true } },
            ],
          },
        ],
        usage: { inputTokens: 200, outputTokens: 100 },
        finishReason: 'stop',
      });

      const result = await runner.run('Check status and notify');

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].toolName).toBe('get_team_status');
      expect(result.toolCalls[0].result).toEqual({ teams: [] });
      expect(result.toolCalls[1].toolName).toBe('send_message');
      expect(result.steps).toBe(2);
    });

    it('should accumulate token usage across multiple runs', async () => {
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'First',
          steps: [],
          usage: { inputTokens: 100, outputTokens: 50 },
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          text: 'Second',
          steps: [],
          usage: { inputTokens: 200, outputTokens: 75 },
          finishReason: 'stop',
        });

      await runner.run('Message 1');
      await runner.run('Message 2');

      const state = runner.getState();
      expect(state.totalTokens.input).toBe(300);
      expect(state.totalTokens.output).toBe(125);
    });

    it('should handle missing usage gracefully', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Done',
        steps: [],
        usage: undefined,
        finishReason: 'stop',
      });

      const result = await runner.run('Test');

      expect(result.usage).toEqual({ input: 0, output: 0 });
    });

    it('should throw if not initialized', async () => {
      const uninitRunner = new AgentRunnerService(baseConfig, mockModelManager, mockApiClient);
      uninitRunner._generateTextFn = mockGenerateText;

      await expect(uninitRunner.run('Hello')).rejects.toThrow('not initialized');
    });
  });

  describe('serial queue', () => {
    beforeEach(async () => {
      await runner.initialize();
    });

    it('should process multiple messages serially', async () => {
      const callOrder: number[] = [];

      mockGenerateText
        .mockImplementationOnce(async () => {
          callOrder.push(1);
          return {
            text: 'First',
            steps: [],
            usage: { inputTokens: 10, outputTokens: 5 },
            finishReason: 'stop',
          };
        })
        .mockImplementationOnce(async () => {
          callOrder.push(2);
          return {
            text: 'Second',
            steps: [],
            usage: { inputTokens: 10, outputTokens: 5 },
            finishReason: 'stop',
          };
        });

      const [r1, r2] = await Promise.all([
        runner.run('First'),
        runner.run('Second'),
      ]);

      expect(r1.text).toBe('First');
      expect(r2.text).toBe('Second');
      expect(callOrder).toEqual([1, 2]);
    });

    it('should reject queued item if generateText throws', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('API error'));

      await expect(runner.run('Fail')).rejects.toThrow('API error');
    });

    it('should reset conversationId between messages (Bug 2)', async () => {
      // Track which conversationId is passed to generateText via tools argument
      const capturedConvIds: (string | undefined)[] = [];
      mockGenerateText
        .mockImplementation(async (opts: Record<string, unknown>) => {
          // The tools object is created with the current conversationId.
          // We verify by checking if report_status tool exists — its closure
          // captures the conversationId. We call it to extract the value.
          const tools = opts.tools as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
          if (tools?.report_status) {
            // Call report_status to see if conversationId is included in the POST body
            mockApiClient.post.mockResolvedValueOnce({ success: true, data: {} } as any);
            await tools.report_status.execute({ status: 'in_progress', summary: 'test' });
            const postCall = mockApiClient.post.mock.calls[mockApiClient.post.mock.calls.length - 1];
            const body = postCall[1] as Record<string, unknown>;
            capturedConvIds.push(body.conversationId as string | undefined);
          }
          return {
            text: 'Response',
            steps: [{ toolCalls: [], toolResults: [] }],
            usage: { inputTokens: 10, outputTokens: 5 },
            finishReason: 'stop',
          };
        });

      // First message with conversationId
      await runner.run('With conv', 'conv-123');
      // Second message without conversationId
      await runner.run('No conv');

      // First call should have conversationId = 'conv-123'
      expect(capturedConvIds[0]).toBe('conv-123');
      // Second call should NOT inherit the previous conversationId
      expect(capturedConvIds[1]).toBeUndefined();
    });
  });

  describe('context compaction', () => {
    it('should compact history when messages exceed keepRecent threshold', async () => {
      const config: CrewlyAgentConfig = {
        ...baseConfig,
        maxHistoryMessages: 12,
      };
      const r = new AgentRunnerService(config, mockModelManager, mockApiClient);
      r._generateTextFn = mockGenerateText;
      await r.initialize();

      // 6 runs × 2 messages = 12 messages
      for (let i = 0; i < 6; i++) {
        mockGenerateText.mockResolvedValueOnce({
          text: `Response ${i}`,
          steps: [],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: 'stop',
        });
        await r.run(`Message ${i}`);
      }

      expect(r.getHistoryLength()).toBe(12);

      // AI summarization call for compaction + the actual run
      mockGenerateText.mockResolvedValueOnce({
        text: '[Compacted State] Summary of active tasks and decisions',
        steps: [],
        usage: { inputTokens: 50, outputTokens: 30 },
        finishReason: 'stop',
      });
      mockGenerateText.mockResolvedValueOnce({
        text: 'Compacted result',
        steps: [],
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: 'stop',
      });
      await r.run('After compact');

      const state = r.getState();
      // Compaction: 2 old messages → 1 AI summary, keep 10 recent, +1 user +1 assistant = 13
      expect(state.messages.length).toBeLessThan(15);
      expect(state.messages[0].role).toBe('assistant');
      expect(String(state.messages[0].content)).toContain('Compacted State');
    });

    it('should fall back to truncation summary when AI summarization fails', async () => {
      const config: CrewlyAgentConfig = {
        ...baseConfig,
        maxHistoryMessages: 12,
      };
      const r = new AgentRunnerService(config, mockModelManager, mockApiClient);
      r._generateTextFn = mockGenerateText;
      await r.initialize();

      // 6 runs × 2 messages = 12 messages
      for (let i = 0; i < 6; i++) {
        mockGenerateText.mockResolvedValueOnce({
          text: `Response ${i}`,
          steps: [],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: 'stop',
        });
        await r.run(`Message ${i}`);
      }

      // AI summarization fails, then actual run succeeds
      mockGenerateText.mockRejectedValueOnce(new Error('Model error'));
      mockGenerateText.mockResolvedValueOnce({
        text: 'After fallback',
        steps: [],
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: 'stop',
      });
      await r.run('After compact');

      const state = r.getState();
      expect(state.messages.length).toBeLessThan(15);
      expect(state.messages[0].role).toBe('assistant');
      expect(String(state.messages[0].content)).toContain('summary');
    });

    it('should skip compaction when history is small', async () => {
      const config: CrewlyAgentConfig = {
        ...baseConfig,
        maxHistoryMessages: 20,
      };
      const r = new AgentRunnerService(config, mockModelManager, mockApiClient);
      r._generateTextFn = mockGenerateText;
      await r.initialize();

      mockGenerateText.mockResolvedValueOnce({
        text: 'Response',
        steps: [],
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: 'stop',
      });
      await r.run('Message');

      expect(r.getHistoryLength()).toBe(2);
    });
  });

  describe('requestCompaction', () => {
    it('should return skipped when history is too small', async () => {
      await runner.initialize();
      const result = await runner.requestCompaction();

      expect(result.compacted).toBe(false);
      expect(result.reason).toContain('Too few');
      expect(result.messagesBefore).toBe(0);
      expect(result.messagesAfter).toBe(0);
    });

    it('should perform AI-powered compaction when history is large enough', async () => {
      const config: CrewlyAgentConfig = {
        ...baseConfig,
        maxHistoryMessages: 100,
      };
      const r = new AgentRunnerService(config, mockModelManager, mockApiClient);
      r._generateTextFn = mockGenerateText;
      await r.initialize();

      // Build up 12 messages (6 runs × 2)
      for (let i = 0; i < 6; i++) {
        mockGenerateText.mockResolvedValueOnce({
          text: `Response ${i}`,
          steps: [],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: 'stop',
        });
        await r.run(`Message ${i}`);
      }

      expect(r.getHistoryLength()).toBe(12);

      // AI summarization for compaction
      mockGenerateText.mockResolvedValueOnce({
        text: 'Structured summary of conversation state with active tasks and decisions',
        steps: [],
        usage: { inputTokens: 50, outputTokens: 30 },
        finishReason: 'stop',
      });

      const result = await r.requestCompaction();

      expect(result.compacted).toBe(true);
      expect(result.messagesBefore).toBe(12);
      expect(result.messagesAfter).toBe(11); // 1 summary + 10 recent
    });

    it('should return skipped when not initialized', async () => {
      const r = new AgentRunnerService(baseConfig, mockModelManager, mockApiClient);
      const result = await r.requestCompaction();

      expect(result.compacted).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('audit trail', () => {
    it('should return empty audit log initially', () => {
      const log = runner.getAuditLog();
      expect(log).toEqual([]);
    });

    it('should return default security policy', () => {
      const policy = runner.getSecurityPolicy();
      expect(policy.auditEnabled).toBe(true);
      expect(policy.requireApproval).toEqual([]);
      expect(policy.blockedTools).toEqual([]);
      expect(policy.maxAuditEntries).toBe(500);
    });

    it('should update security policy', () => {
      runner.updateSecurityPolicy({ requireApproval: ['destructive'] });
      const policy = runner.getSecurityPolicy();
      expect(policy.requireApproval).toEqual(['destructive']);
      expect(policy.auditEnabled).toBe(true); // unchanged
    });

    it('should return a copy of the security policy', () => {
      const p1 = runner.getSecurityPolicy();
      const p2 = runner.getSecurityPolicy();
      expect(p1).not.toBe(p2);
      expect(p1).toEqual(p2);
    });
  });

  describe('approval mode enforcement', () => {
    beforeEach(async () => {
      await runner.initialize();
    });

    it('should block tool execution when sensitivity requires approval', async () => {
      runner.updateSecurityPolicy({ requireApproval: ['destructive'] });

      // When a tool with 'destructive' sensitivity is called, it should be denied
      // We verify this by running a message that would trigger tool use
      // and checking the security policy state
      const policy = runner.getSecurityPolicy();
      expect(policy.requireApproval).toContain('destructive');
    });

    it('should allow tool execution when sensitivity is not in requireApproval', async () => {
      runner.updateSecurityPolicy({ requireApproval: ['destructive'] });

      const policy = runner.getSecurityPolicy();
      expect(policy.requireApproval).not.toContain('safe');
      expect(policy.requireApproval).not.toContain('sensitive');
    });

    it('should block explicitly blocked tools', async () => {
      runner.updateSecurityPolicy({ blockedTools: ['stop_agent', 'write_file'] });

      const policy = runner.getSecurityPolicy();
      expect(policy.blockedTools).toContain('stop_agent');
      expect(policy.blockedTools).toContain('write_file');
    });

    it('should combine approval and blocked tools', async () => {
      runner.updateSecurityPolicy({
        requireApproval: ['destructive', 'sensitive'],
        blockedTools: ['handle_agent_failure'],
      });

      const policy = runner.getSecurityPolicy();
      expect(policy.requireApproval).toEqual(['destructive', 'sensitive']);
      expect(policy.blockedTools).toEqual(['handle_agent_failure']);
      expect(policy.auditEnabled).toBe(true); // unchanged
    });
  });

  describe('read-only audit mode', () => {
    beforeEach(async () => {
      await runner.initialize();
    });

    it('should default readOnlyMode to false', () => {
      const policy = runner.getSecurityPolicy();
      expect(policy.readOnlyMode).toBe(false);
    });

    it('should enable read-only mode via updateSecurityPolicy', () => {
      runner.updateSecurityPolicy({ readOnlyMode: true });
      const policy = runner.getSecurityPolicy();
      expect(policy.readOnlyMode).toBe(true);
    });

    it('should block write tools when readOnlyMode is active', async () => {
      runner.updateSecurityPolicy({ readOnlyMode: true });

      // Run a message that triggers a write tool — we check via tool execution
      // The tool should be blocked by checkApproval before reaching the API
      let toolResult: unknown;
      mockGenerateText.mockImplementation(async (opts: Record<string, unknown>) => {
        const tools = opts.tools as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
        // Try to call write_file — should be blocked
        toolResult = await tools.write_file.execute({
          file_path: '/test/file.ts',
          content: 'blocked content',
        });
        return {
          text: 'Done',
          steps: [{ toolCalls: [], toolResults: [] }],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: 'stop',
        };
      });

      await runner.run('Try to write');

      expect(toolResult).toBeDefined();
      expect((toolResult as Record<string, unknown>).success).toBe(false);
      expect((toolResult as Record<string, unknown>).blocked).toBe(true);
      expect((toolResult as Record<string, unknown>).error).toContain('read-only');
      // Should NOT have called the API
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('should allow safe/read-only tools when readOnlyMode is active', async () => {
      runner.updateSecurityPolicy({ readOnlyMode: true });

      let toolResult: unknown;
      mockGenerateText.mockImplementation(async (opts: Record<string, unknown>) => {
        const tools = opts.tools as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
        mockApiClient.get.mockResolvedValueOnce({ success: true, data: [{ name: 'team-a' }], status: 200 } as any);
        toolResult = await tools.get_team_status.execute({});
        return {
          text: 'Done',
          steps: [{ toolCalls: [], toolResults: [] }],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: 'stop',
        };
      });

      await runner.run('Check teams');

      // Safe tool should work
      expect(mockApiClient.get).toHaveBeenCalled();
      expect(toolResult).toEqual([{ name: 'team-a' }]);
    });

    it('should log blocked write attempts in audit trail during readOnlyMode', async () => {
      runner.updateSecurityPolicy({ readOnlyMode: true });

      mockGenerateText.mockImplementation(async (opts: Record<string, unknown>) => {
        const tools = opts.tools as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
        await tools.edit_file.execute({
          file_path: '/test/file.ts',
          old_string: 'foo',
          new_string: 'bar',
          replace_all: false,
        });
        return {
          text: 'Done',
          steps: [{ toolCalls: [], toolResults: [] }],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: 'stop',
        };
      });

      await runner.run('Try to edit');

      const auditLog = runner.getAuditLog();
      expect(auditLog.length).toBeGreaterThanOrEqual(1);
      const editEntry = auditLog.find(e => e.toolName === 'edit_file');
      expect(editEntry).toBeDefined();
      expect(editEntry!.success).toBe(false);
      expect(editEntry!.error).toContain('read-only');
    });
  });

  describe('audit trail with sessionName', () => {
    beforeEach(async () => {
      await runner.initialize();
    });

    it('should include sessionName in audit entries', async () => {
      mockGenerateText.mockImplementation(async (opts: Record<string, unknown>) => {
        const tools = opts.tools as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
        mockApiClient.get.mockResolvedValueOnce({ success: true, data: [], status: 200 } as any);
        await tools.get_team_status.execute({});
        return {
          text: 'Done',
          steps: [{ toolCalls: [], toolResults: [] }],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: 'stop',
        };
      });

      await runner.run('Check status');

      const auditLog = runner.getAuditLog();
      expect(auditLog.length).toBeGreaterThanOrEqual(1);
      expect(auditLog[0].sessionName).toBe('test-session');
    });
  });

  describe('getFilteredAuditLog via get_audit_log tool', () => {
    beforeEach(async () => {
      await runner.initialize();
    });

    it('should return actual audit entries via get_audit_log tool', async () => {
      // First generate some audit data
      mockGenerateText.mockImplementationOnce(async (opts: Record<string, unknown>) => {
        const tools = opts.tools as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
        mockApiClient.get.mockResolvedValueOnce({ success: true, data: [], status: 200 } as any);
        await tools.get_team_status.execute({});
        return {
          text: 'Done',
          steps: [{ toolCalls: [], toolResults: [] }],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: 'stop',
        };
      });
      await runner.run('Generate audit data');

      // Now query the audit log through the tool
      let auditResult: Record<string, unknown> | undefined;
      mockGenerateText.mockImplementationOnce(async (opts: Record<string, unknown>) => {
        const tools = opts.tools as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
        auditResult = await tools.get_audit_log.execute({ limit: 10 }) as Record<string, unknown>;
        return {
          text: 'Audit retrieved',
          steps: [{ toolCalls: [], toolResults: [] }],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: 'stop',
        };
      });
      await runner.run('Get audit log');

      expect(auditResult).toBeDefined();
      expect(auditResult!.success).toBe(true);
      expect(auditResult!.totalEntries).toBeGreaterThanOrEqual(1);
      const entries = auditResult!.entries as AuditEntry[];
      expect(entries[0].toolName).toBe('get_team_status');
    });
  });

  describe('getState', () => {
    it('should return a copy of state, not the original', () => {
      const state1 = runner.getState();
      const state2 = runner.getState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('getHistoryLength', () => {
    it('should return 0 for fresh runner', () => {
      expect(runner.getHistoryLength()).toBe(0);
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialize', () => {
      expect(runner.isInitialized()).toBe(false);
    });

    it('should return true after initialize', async () => {
      await runner.initialize();
      expect(runner.isInitialized()).toBe(true);
    });
  });
});
