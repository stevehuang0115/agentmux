export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/backend/src', '<rootDir>/mcp-server/src'],
  testMatch: [
    '**/(backend|mcp-server)/src/**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'CommonJS',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true
      }
    }],
  },
  moduleNameMapper: {
    '^@backend/(.*)$': '<rootDir>/backend/src/$1',
    '^@mcp/(.*)$': '<rootDir>/mcp-server/src/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol)/)',
  ],
  collectCoverageFrom: [
    'backend/src/**/*.ts',
    'mcp-server/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/*.test.ts'
  ],
  coverageDirectory: 'coverage-unit',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests serially to avoid port conflicts
};