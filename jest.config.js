/** @type {import('jest').Config} */
module.exports = {
  // Core TypeScript tests only - UI tests use Vitest (see ui/vitest.config.ts)
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/shared/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/mcp-servers/', // run these with node --test via npm run test:mcp
    '/ui/', // UI tests use Vitest
    '/tests/integration/morph.test.ts', // Uses Vitest
    '/tests/integration/adapters.test.ts' // Uses Vitest
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.optional.js']
};