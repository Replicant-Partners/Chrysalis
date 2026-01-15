/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
