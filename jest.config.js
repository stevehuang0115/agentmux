export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/backend/src', '<rootDir>/cli/src', '<rootDir>/config'],
  testMatch: [
    '**/tests/**/?(*.)+(spec|test).ts',
    '**/backend/src/**/?(*.)+(spec|test).ts',
    '**/cli/src/**/?(*.)+(spec|test).ts',
    '**/config/**/?(*.)+(spec|test).ts'
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
'^@types/(.*)$': '<rootDir>/types/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'tests/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests serially to avoid port conflicts
};