// Jest setup file

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.CREWLY_HOME = '/tmp/crewly-test';
process.env.WEB_PORT = '3000';
process.env.MCP_PORT = '3001';

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => {
    return {
      pragma: jest.fn(),
      exec: jest.fn(),
      prepare: jest.fn().mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 1 }),
        get: jest.fn(),
        all: jest.fn().mockReturnValue([]),
      }),
      close: jest.fn(),
    };
  });
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
