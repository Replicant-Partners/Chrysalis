/**
 * Chrysalis Integration Test Framework
 * 
 * Provides infrastructure for automated integration testing across:
 * - Agent morphing operations
 * - Memory system operations
 * - MCP server interactions
 * - Cross-service communication
 * 
 * @module tests/integration
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item H-3
 * 
 * Usage:
 *   npm run test:integration
 *   npm run test:integration -- --grep "morph"
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Test configuration
 */
export interface TestConfig {
  /** Test environment (local, ci, staging) */
  env: 'local' | 'ci' | 'staging';
  /** Timeout for async operations (ms) */
  timeout: number;
  /** Enable verbose logging */
  verbose: boolean;
  /** Skip slow tests */
  skipSlow: boolean;
  /** Mock external services */
  mockExternal: boolean;
}

/**
 * Default test configuration
 */
export const DEFAULT_TEST_CONFIG: TestConfig = {
  env: (process.env.TEST_ENV as TestConfig['env']) ?? 'local',
  timeout: parseInt(process.env.TEST_TIMEOUT ?? '30000', 10),
  verbose: process.env.TEST_VERBOSE === 'true',
  skipSlow: process.env.TEST_SKIP_SLOW === 'true',
  mockExternal: process.env.TEST_MOCK_EXTERNAL !== 'false',
};

/**
 * Test context passed to all tests
 */
export interface TestContext {
  config: TestConfig;
  /** Unique test run ID */
  runId: string;
  /** Test start time */
  startTime: Date;
  /** Cleanup functions to run after test */
  cleanups: (() => Promise<void>)[];
}

/**
 * Create a new test context
 */
export function createTestContext(config?: Partial<TestConfig>): TestContext {
  return {
    config: { ...DEFAULT_TEST_CONFIG, ...config },
    runId: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startTime: new Date(),
    cleanups: [],
  };
}

/**
 * Register a cleanup function
 */
export function registerCleanup(ctx: TestContext, cleanup: () => Promise<void>): void {
  ctx.cleanups.push(cleanup);
}

/**
 * Run all registered cleanups
 */
export async function runCleanups(ctx: TestContext): Promise<void> {
  for (const cleanup of ctx.cleanups.reverse()) {
    try {
      await cleanup();
    } catch (error) {
      console.error('[Test] Cleanup failed:', error);
    }
  }
  ctx.cleanups = [];
}

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Sample USA agent definition for testing
 */
export const SAMPLE_USA_AGENT = {
  id: 'test-agent-001',
  name: 'TestAgent',
  version: '1.0.0',
  capabilities: ['chat', 'code-analysis', 'memory'],
  memory: {
    working: [],
    core: {
      persona: 'A helpful test agent',
      user_facts: '',
    },
  },
  tools: [
    { name: 'search', description: 'Search for information' },
    { name: 'calculate', description: 'Perform calculations' },
  ],
};

/**
 * Sample ElizaOS agent for morph testing
 */
export const SAMPLE_ELIZAOS_AGENT = {
  name: 'ElizaTestAgent',
  description: 'An ElizaOS agent for testing',
  modelProvider: 'openai',
  clients: ['discord', 'telegram'],
  plugins: ['@elizaos/plugin-node'],
  character: {
    name: 'TestBot',
    bio: ['A test bot'],
    lore: ['Created for testing'],
  },
};

/**
 * Sample CrewAI agent for morph testing
 */
export const SAMPLE_CREWAI_AGENT = {
  role: 'Researcher',
  goal: 'Find relevant information',
  backstory: 'An expert researcher',
  tools: ['search', 'read'],
  verbose: true,
};

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;
  const interval = options?.interval ?? 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timeout after ${timeout}ms`);
}

/**
 * Retry an operation with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; baseDelay?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 100;

  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      await new Promise(resolve => 
        setTimeout(resolve, baseDelay * Math.pow(2, i))
      );
    }
  }

  throw lastError;
}

/**
 * Assert with custom message
 */
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message ?? 'Expected value to be defined');
  }
}

// =============================================================================
// Mock Services
// =============================================================================

/**
 * Mock LLM service for testing
 */
export class MockLLMService {
  private responses: Map<string, string> = new Map();
  private callCount = 0;

  /**
   * Set a canned response for a prompt pattern
   */
  setResponse(pattern: string, response: string): void {
    this.responses.set(pattern, response);
  }

  /**
   * Generate a mock completion
   */
  async complete(prompt: string): Promise<string> {
    this.callCount++;

    for (const [pattern, response] of this.responses) {
      if (prompt.includes(pattern)) {
        return response;
      }
    }

    return `Mock response for: ${prompt.slice(0, 50)}...`;
  }

  /**
   * Get call count
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.responses.clear();
    this.callCount = 0;
  }
}

/**
 * Mock embedding service for testing
 */
export class MockEmbeddingService {
  private dimensions: number;

  constructor(dimensions: number = 1536) {
    this.dimensions = dimensions;
  }

  /**
   * Generate a mock embedding
   */
  async embed(text: string): Promise<number[]> {
    // Generate deterministic embeddings based on text hash
    const hash = this.simpleHash(text);
    const embedding: number[] = [];
    
    for (let i = 0; i < this.dimensions; i++) {
      embedding.push(Math.sin(hash + i) * 0.5);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / norm);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

/**
 * Mock vector store for testing
 */
export class MockVectorStore {
  private entries: Map<string, { embedding: number[]; content: string }> = new Map();

  async store(id: string, embedding: number[], content: string): Promise<void> {
    this.entries.set(id, { embedding, content });
  }

  async search(queryEmbedding: number[], limit: number): Promise<Array<{
    id: string;
    content: string;
    score: number;
  }>> {
    const results: Array<{ id: string; content: string; score: number }> = [];

    for (const [id, entry] of this.entries) {
      const score = this.cosineSimilarity(queryEmbedding, entry.embedding);
      results.push({ id, content: entry.content, score });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }
}

// =============================================================================
// Test Suites
// =============================================================================

export { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect };

/**
 * Integration test suite marker
 */
export function integrationSuite(
  name: string,
  fn: (ctx: TestContext) => void
): void {
  describe(`[Integration] ${name}`, () => {
    const ctx = createTestContext();

    beforeAll(async () => {
      if (ctx.config.verbose) {
        console.log(`[Test] Starting suite: ${name}`);
      }
    });

    afterAll(async () => {
      await runCleanups(ctx);
      if (ctx.config.verbose) {
        console.log(`[Test] Completed suite: ${name}`);
      }
    });

    fn(ctx);
  });
}

/**
 * Skip test if in CI and slow
 */
export function skipIfSlow(ctx: TestContext): boolean {
  return ctx.config.skipSlow;
}