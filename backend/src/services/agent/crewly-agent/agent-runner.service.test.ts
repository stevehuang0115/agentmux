import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AgentRunnerService } from './agent-runner.service.js';
import { ModelManager } from './model-manager.js';
import { CrewlyApiClient } from './api-client.js';
import type { CrewlyAgentConfig } from './types.js';

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

      // Next run triggers compaction
      mockGenerateText.mockResolvedValueOnce({
        text: 'Compacted result',
        steps: [],
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: 'stop',
      });
      await r.run('After compact');

      const state = r.getState();
      // Compaction: 2 old messages → 1 summary, keep 10 recent, +1 user +1 assistant = 13
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
