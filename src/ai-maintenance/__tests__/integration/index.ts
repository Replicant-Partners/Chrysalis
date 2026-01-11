/**
 * AI-Led Adaptive Maintenance System - Integration Tests
 * 
 * Exports for integration test utilities and fixtures.
 * 
 * @module ai-maintenance/__tests__/integration
 * @version 1.0.0
 */

// ============================================================================
// Test Harness Exports
// ============================================================================

export {
  // Event Recording
  TestEventRecorder,
  type RecordedEvent,
  
  // Mock Components
  MockRepositoryMonitor,
  MockSemanticDiffAnalyzer,
  MockPatternMatcher,
  MockAdapterModificationGenerator,
  MockAdaptationPipeline,
  
  // Test Fixtures
  TestFixtureFactory,
  
  // Assertions
  TestAssertions,
  
  // Test Context
  createTestContext,
  resetTestContext,
  type IntegrationTestContext
} from './test-harness';

// ============================================================================
// Test Suites
// ============================================================================

/**
 * Integration test suite structure:
 * 
 * 1. component-interaction.test.ts
 *    - RepositoryMonitor ↔ SemanticDiffAnalyzer Interaction
 *    - SemanticDiffAnalyzer ↔ Evolutionary Patterns Matching
 *    - AdapterModificationGenerator ↔ Proposal Validation
 *    - Pipeline Stage Transitions
 *    - Full Component Interaction Flow
 *    - Error Handling and Recovery
 *    - Actual Pattern Registry Integration
 *    - Event Recording and Audit Trail
 *    - Test Fixture Factory
 * 
 * 2. pipeline.integration.test.ts
 *    - Dependency Update Pipeline
 *    - Security Vulnerability Pipeline
 *    - API Deprecation Pipeline
 *    - Schema Migration Pipeline
 *    - Multi-Protocol Impact
 *    - Pipeline Error Handling
 *    - Real Pattern Registry Integration
 *    - Protocol-Specific Scenarios
 *    - Concurrent Pipeline Operations
 */

// ============================================================================
// Test Categories
// ============================================================================

/**
 * Test category definitions for filtering and organization.
 */
export const TEST_CATEGORIES = {
  COMPONENT_INTERACTION: 'component-interaction',
  PIPELINE_INTEGRATION: 'pipeline-integration',
  PATTERN_MATCHING: 'pattern-matching',
  ERROR_HANDLING: 'error-handling',
  PROTOCOL_SPECIFIC: 'protocol-specific',
  CONCURRENT_OPERATIONS: 'concurrent-operations'
} as const;

/**
 * Test priority levels.
 */
export const TEST_PRIORITIES = {
  CRITICAL: 1,    // Must pass for any release
  HIGH: 2,        // Should pass for stable release
  MEDIUM: 3,      // Should pass for feature release
  LOW: 4          // Nice to have
} as const;

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Default test configuration.
 */
export const TEST_CONFIG = {
  /** Default timeout for async tests (ms) */
  defaultTimeout: 5000,
  
  /** Maximum events to record before cleanup */
  maxRecordedEvents: 10000,
  
  /** Enable verbose logging during tests */
  verboseLogging: false,
  
  /** Protocols to include in tests */
  enabledProtocols: [
    'mcp', 'a2a', 'anp', 'langchain', 'openai', 'autogen'
  ]
} as const;

// ============================================================================
// Default Export
// ============================================================================

export default {
  TEST_CATEGORIES,
  TEST_PRIORITIES,
  TEST_CONFIG
};
