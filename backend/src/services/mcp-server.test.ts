/**
 * Tests for the Crewly MCP Server Service.
 *
 * Validates tool registration, tool call routing, and each tool handler's
 * behavior including success paths, error handling, and edge cases.
 */

import {
  CrewlyMcpServer,
  MCP_SERVER_CONSTANTS,
} from './mcp-server.js';
import type { Team, TeamMember } from '../types/index.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockServerConnect = jest.fn().mockResolvedValue(undefined);
const mockServerClose = jest.fn().mockResolvedValue(undefined);
const mockSetRequestHandler = jest.fn();

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    connect: mockServerConnect,
    close: mockServerClose,
    setRequestHandler: mockSetRequestHandler,
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock types schemas (imported by the service)
jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: { method: 'tools/list' },
  CallToolRequestSchema: { method: 'tools/call' },
}));

const mockGetTeams = jest.fn();
const mockSaveTeam = jest.fn();

jest.mock('./core/storage.service.js', () => ({
  StorageService: {
    getInstance: jest.fn(() => ({
      getTeams: mockGetTeams,
      saveTeam: mockSaveTeam,
    })),
  },
}));

const mockRecall = jest.fn();

jest.mock('./memory/memory.service.js', () => ({
  MemoryService: {
    getInstance: jest.fn(() => ({
      recall: mockRecall,
    })),
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Creates a test team fixture.
 */
function createTestTeam(overrides?: Partial<Team>): Team {
  const now = new Date().toISOString();
  return {
    id: 'team-1',
    name: 'Test Team',
    description: 'A test team',
    members: [
      createTestMember({ id: 'member-1', name: 'Alice', role: 'developer' }),
      createTestMember({ id: 'member-2', name: 'Bob', role: 'qa' }),
    ],
    projectIds: ['proj-1'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a test team member fixture.
 */
function createTestMember(overrides?: Partial<TeamMember>): TeamMember {
  const now = new Date().toISOString();
  return {
    id: 'member-1',
    name: 'Alice',
    sessionName: 'test-team-alice-12345678',
    role: 'developer',
    systemPrompt: '',
    agentStatus: 'active',
    workingStatus: 'idle',
    runtimeType: 'claude-code',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Extract registered handlers from the mock.
 * Returns a map of method string -> handler function.
 * Uses the schema's `method` property for lookup since Map uses reference equality.
 */
function getRegisteredHandlers(): Map<string, Function> {
  const handlers = new Map<string, Function>();
  for (const call of mockSetRequestHandler.mock.calls) {
    const schema = call[0] as { method: string };
    handlers.set(schema.method, call[1]);
  }
  return handlers;
}

/**
 * Invoke the CallTool handler with the given tool name and arguments.
 */
async function callTool(
  handlers: Map<string, Function>,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const handler = handlers.get('tools/call');
  if (!handler) {
    throw new Error('CallTool handler not registered');
  }
  return handler({ params: { name, arguments: args } });
}

/**
 * Parse the JSON text content from a tool result.
 */
function parseResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrewlyMcpServer', () => {
  let mcpServer: CrewlyMcpServer;
  let handlers: Map<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTeams.mockResolvedValue([]);
    mockSaveTeam.mockResolvedValue(undefined);
    mockRecall.mockResolvedValue({
      agentMemories: [],
      projectMemories: [],
      combined: '',
      knowledgeDocuments: [],
    });

    mcpServer = new CrewlyMcpServer();
    handlers = getRegisteredHandlers();
  });

  // ========================= Initialization =========================

  describe('initialization', () => {
    it('should create server with correct info', () => {
      expect(MCP_SERVER_CONSTANTS.SERVER_INFO.NAME).toBe('crewly-mcp-server');
      expect(MCP_SERVER_CONSTANTS.SERVER_INFO.VERSION).toBe('1.0.0');
    });

    it('should register two request handlers', () => {
      // tools/list and tools/call
      expect(mockSetRequestHandler).toHaveBeenCalledTimes(2);
    });

    it('should expose getServer()', () => {
      const server = mcpServer.getServer();
      expect(server).toBeDefined();
    });
  });

  // ========================= Lifecycle =========================

  describe('lifecycle', () => {
    it('should start on stdio transport', async () => {
      await mcpServer.start();
      expect(mockServerConnect).toHaveBeenCalledTimes(1);
    });

    it('should stop cleanly', async () => {
      await mcpServer.start();
      await mcpServer.stop();
      expect(mockServerClose).toHaveBeenCalledTimes(1);
    });
  });

  // ========================= tools/list =========================

  describe('tools/list', () => {
    it('should return all 6 tools', async () => {
      const handler = handlers.get('tools/list');
      expect(handler).toBeDefined();

      const result = await handler!({});
      expect(result.tools).toHaveLength(6);
    });

    it('should include expected tool names', async () => {
      const handler = handlers.get('tools/list');
      const result = await handler!({});

      const toolNames = result.tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain('crewly_get_teams');
      expect(toolNames).toContain('crewly_create_team');
      expect(toolNames).toContain('crewly_assign_task');
      expect(toolNames).toContain('crewly_get_status');
      expect(toolNames).toContain('crewly_recall_memory');
      expect(toolNames).toContain('crewly_send_message');
    });

    it('should include descriptions and input schemas for all tools', async () => {
      const handler = handlers.get('tools/list');
      const result = await handler!({});

      for (const tool of result.tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  // ========================= crewly_get_teams =========================

  describe('crewly_get_teams', () => {
    it('should return empty array when no teams exist', async () => {
      const result = await callTool(handlers, 'crewly_get_teams');
      const data = parseResult(result) as unknown[];
      expect(data).toEqual([]);
      expect(result.isError).toBeUndefined();
    });

    it('should return all teams with member details', async () => {
      const team = createTestTeam();
      mockGetTeams.mockResolvedValue([team]);

      const result = await callTool(handlers, 'crewly_get_teams');
      const data = parseResult(result) as Array<{ id: string; members: unknown[] }>;

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('team-1');
      expect(data[0].members).toHaveLength(2);
    });

    it('should filter by teamId', async () => {
      const team1 = createTestTeam({ id: 'team-1', name: 'Team 1' });
      const team2 = createTestTeam({ id: 'team-2', name: 'Team 2' });
      mockGetTeams.mockResolvedValue([team1, team2]);

      const result = await callTool(handlers, 'crewly_get_teams', { teamId: 'team-2' });
      const data = parseResult(result) as Array<{ id: string }>;

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('team-2');
    });

    it('should return error for non-existent teamId', async () => {
      mockGetTeams.mockResolvedValue([]);

      const result = await callTool(handlers, 'crewly_get_teams', { teamId: 'nonexistent' });
      expect(result.isError).toBe(true);
      const data = parseResult(result) as { error: string };
      expect(data.error).toContain('Team not found');
    });
  });

  // ========================= crewly_create_team =========================

  describe('crewly_create_team', () => {
    it('should create a team with members', async () => {
      const result = await callTool(handlers, 'crewly_create_team', {
        name: 'Dev Team',
        members: [
          { name: 'Alice', role: 'developer' },
          { name: 'Bob', role: 'qa' },
        ],
      });

      expect(result.isError).toBeUndefined();
      const data = parseResult(result) as { teamId: string; members: unknown[] };
      expect(data.teamId).toBe('test-uuid-1234');
      expect(data.members).toHaveLength(2);
      expect(mockSaveTeam).toHaveBeenCalledTimes(1);
    });

    it('should default runtimeType to claude-code', async () => {
      await callTool(handlers, 'crewly_create_team', {
        name: 'Test Team',
        members: [{ name: 'Charlie', role: 'developer' }],
      });

      const savedTeam = mockSaveTeam.mock.calls[0][0] as Team;
      expect(savedTeam.members[0].runtimeType).toBe('claude-code');
    });

    it('should accept custom runtimeType', async () => {
      await callTool(handlers, 'crewly_create_team', {
        name: 'Test Team',
        members: [{ name: 'Charlie', role: 'developer', runtimeType: 'gemini-cli' }],
      });

      const savedTeam = mockSaveTeam.mock.calls[0][0] as Team;
      expect(savedTeam.members[0].runtimeType).toBe('gemini-cli');
    });

    it('should return error when name is missing', async () => {
      const result = await callTool(handlers, 'crewly_create_team', {
        members: [{ name: 'Alice', role: 'developer' }],
      });
      expect(result.isError).toBe(true);
    });

    it('should return error when members is empty', async () => {
      const result = await callTool(handlers, 'crewly_create_team', {
        name: 'Empty Team',
        members: [],
      });
      expect(result.isError).toBe(true);
    });

    it('should include description when provided', async () => {
      await callTool(handlers, 'crewly_create_team', {
        name: 'Described Team',
        description: 'A team with a description',
        members: [{ name: 'Dan', role: 'developer' }],
      });

      const savedTeam = mockSaveTeam.mock.calls[0][0] as Team;
      expect(savedTeam.description).toBe('A team with a description');
    });
  });

  // ========================= crewly_assign_task =========================

  describe('crewly_assign_task', () => {
    it('should assign a task to a member', async () => {
      const team = createTestTeam();
      mockGetTeams.mockResolvedValue([team]);

      const result = await callTool(handlers, 'crewly_assign_task', {
        teamId: 'team-1',
        memberId: 'member-1',
        task: 'Build the login page',
      });

      expect(result.isError).toBeUndefined();
      const data = parseResult(result) as { ticketId: string; task: string };
      expect(data.ticketId).toMatch(/^mcp-task-/);
      expect(data.task).toBe('Build the login page');
      expect(mockSaveTeam).toHaveBeenCalled();
    });

    it('should return error for non-existent team', async () => {
      mockGetTeams.mockResolvedValue([]);

      const result = await callTool(handlers, 'crewly_assign_task', {
        teamId: 'bad-team',
        memberId: 'member-1',
        task: 'Something',
      });
      expect(result.isError).toBe(true);
    });

    it('should return error for non-existent member', async () => {
      const team = createTestTeam();
      mockGetTeams.mockResolvedValue([team]);

      const result = await callTool(handlers, 'crewly_assign_task', {
        teamId: 'team-1',
        memberId: 'nonexistent',
        task: 'Something',
      });
      expect(result.isError).toBe(true);
    });

    it('should return error when required params are missing', async () => {
      const result = await callTool(handlers, 'crewly_assign_task', {
        teamId: 'team-1',
      });
      expect(result.isError).toBe(true);
    });
  });

  // ========================= crewly_get_status =========================

  describe('crewly_get_status', () => {
    it('should return summary for all teams', async () => {
      const team1 = createTestTeam({ id: 'team-1', name: 'Team 1' });
      const team2 = createTestTeam({ id: 'team-2', name: 'Team 2' });
      mockGetTeams.mockResolvedValue([team1, team2]);

      const result = await callTool(handlers, 'crewly_get_status');
      const data = parseResult(result) as { teams: unknown[]; totalTeams: number };

      expect(data.totalTeams).toBe(2);
      expect(data.teams).toHaveLength(2);
    });

    it('should return team details when teamId is provided', async () => {
      const team = createTestTeam();
      mockGetTeams.mockResolvedValue([team]);

      const result = await callTool(handlers, 'crewly_get_status', { teamId: 'team-1' });
      const data = parseResult(result) as { team: { name: string }; members: unknown[] };

      expect(data.team.name).toBe('Test Team');
      expect(data.members).toHaveLength(2);
    });

    it('should return member details when teamId and memberId are provided', async () => {
      const team = createTestTeam();
      mockGetTeams.mockResolvedValue([team]);

      const result = await callTool(handlers, 'crewly_get_status', {
        teamId: 'team-1',
        memberId: 'member-1',
      });
      const data = parseResult(result) as { member: { name: string; role: string } };

      expect(data.member.name).toBe('Alice');
      expect(data.member.role).toBe('developer');
    });

    it('should return error for non-existent team', async () => {
      mockGetTeams.mockResolvedValue([]);

      const result = await callTool(handlers, 'crewly_get_status', { teamId: 'bad' });
      expect(result.isError).toBe(true);
    });

    it('should return error for non-existent member', async () => {
      const team = createTestTeam();
      mockGetTeams.mockResolvedValue([team]);

      const result = await callTool(handlers, 'crewly_get_status', {
        teamId: 'team-1',
        memberId: 'bad-member',
      });
      expect(result.isError).toBe(true);
    });
  });

  // ========================= crewly_recall_memory =========================

  describe('crewly_recall_memory', () => {
    it('should search memory with query', async () => {
      mockRecall.mockResolvedValue({
        agentMemories: ['Found memory 1'],
        projectMemories: ['Found memory 2'],
        combined: 'Combined results',
        knowledgeDocuments: [
          {
            id: 'doc-1',
            title: 'Deployment Guide',
            category: 'SOP',
            preview: 'How to deploy...',
          },
        ],
      });

      const result = await callTool(handlers, 'crewly_recall_memory', {
        query: 'deployment process',
      });

      expect(result.isError).toBeUndefined();
      const data = parseResult(result) as {
        agentMemories: string[];
        projectMemories: string[];
        knowledgeDocuments: Array<{ title: string }>;
      };
      expect(data.agentMemories).toHaveLength(1);
      expect(data.projectMemories).toHaveLength(1);
      expect(data.knowledgeDocuments).toHaveLength(1);
    });

    it('should use default scope "both" and agentId "mcp-client"', async () => {
      await callTool(handlers, 'crewly_recall_memory', {
        query: 'test',
      });

      expect(mockRecall).toHaveBeenCalledWith({
        agentId: 'mcp-client',
        context: 'test',
        scope: 'both',
        projectPath: undefined,
      });
    });

    it('should pass custom scope and agentId', async () => {
      await callTool(handlers, 'crewly_recall_memory', {
        query: 'patterns',
        agentId: 'dev-001',
        scope: 'project',
        projectPath: '/my/project',
      });

      expect(mockRecall).toHaveBeenCalledWith({
        agentId: 'dev-001',
        context: 'patterns',
        scope: 'project',
        projectPath: '/my/project',
      });
    });

    it('should return error when query is missing', async () => {
      const result = await callTool(handlers, 'crewly_recall_memory', {});
      expect(result.isError).toBe(true);
    });
  });

  // ========================= crewly_send_message =========================

  describe('crewly_send_message', () => {
    it('should accept a message and return confirmation', async () => {
      const result = await callTool(handlers, 'crewly_send_message', {
        message: 'Hello orchestrator',
      });

      expect(result.isError).toBeUndefined();
      const data = parseResult(result) as { content: string; conversationId: string };
      expect(data.content).toBe('Hello orchestrator');
      expect(data.conversationId).toMatch(/^mcp-/);
    });

    it('should use provided conversationId', async () => {
      const result = await callTool(handlers, 'crewly_send_message', {
        message: 'Follow-up',
        conversationId: 'conv-123',
      });

      const data = parseResult(result) as { conversationId: string };
      expect(data.conversationId).toBe('conv-123');
    });

    it('should return error when message is missing', async () => {
      const result = await callTool(handlers, 'crewly_send_message', {});
      expect(result.isError).toBe(true);
    });
  });

  // ========================= Error handling =========================

  describe('error handling', () => {
    it('should return error for unknown tool name', async () => {
      const result = await callTool(handlers, 'unknown_tool');
      expect(result.isError).toBe(true);
      const data = parseResult(result) as { error: string };
      expect(data.error).toContain('Unknown tool');
    });

    it('should catch and return errors thrown by storage', async () => {
      mockGetTeams.mockRejectedValue(new Error('Storage unavailable'));

      const result = await callTool(handlers, 'crewly_get_teams');
      expect(result.isError).toBe(true);
      const data = parseResult(result) as { error: string };
      expect(data.error).toContain('Storage unavailable');
    });

    it('should catch and return errors thrown by memory service', async () => {
      mockRecall.mockRejectedValue(new Error('Memory service down'));

      const result = await callTool(handlers, 'crewly_recall_memory', {
        query: 'test',
      });
      expect(result.isError).toBe(true);
      const data = parseResult(result) as { error: string };
      expect(data.error).toContain('Memory service down');
    });
  });
});
