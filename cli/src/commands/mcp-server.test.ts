/**
 * Tests for the CLI mcp-server command.
 *
 * Validates that the command creates and starts a CrewlyMcpServer,
 * and registers shutdown handlers.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStart = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../backend/src/services/mcp-server.js', () => ({
  CrewlyMcpServer: jest.fn().mockImplementation(() => ({
    start: mockStart,
    stop: mockStop,
  })),
}));

import { mcpServerCommand } from './mcp-server.js';
import { CrewlyMcpServer } from '../../../backend/src/services/mcp-server.js';

const MockCrewlyMcpServer = CrewlyMcpServer as jest.MockedClass<typeof CrewlyMcpServer>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mcpServerCommand', () => {
  const originalProcessOn = process.on;
  let registeredHandlers: Record<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredHandlers = {};

    // Capture signal handlers without actually registering them
    process.on = jest.fn((event: string, handler: Function) => {
      registeredHandlers[event] = handler;
      return process;
    }) as unknown as typeof process.on;
  });

  afterEach(() => {
    process.on = originalProcessOn;
  });

  it('should create a CrewlyMcpServer and call start()', async () => {
    await mcpServerCommand();

    expect(MockCrewlyMcpServer).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('should register SIGINT and SIGTERM handlers', async () => {
    await mcpServerCommand();

    expect(registeredHandlers['SIGINT']).toBeDefined();
    expect(registeredHandlers['SIGTERM']).toBeDefined();
  });

  it('should call stop() on SIGINT', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await mcpServerCommand();
    await registeredHandlers['SIGINT']();

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });

  it('should call stop() on SIGTERM', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await mcpServerCommand();
    await registeredHandlers['SIGTERM']();

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });
});
