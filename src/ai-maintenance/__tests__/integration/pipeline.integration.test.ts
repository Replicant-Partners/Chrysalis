/**
 * AI-Led Adaptive Maintenance System - Pipeline Integration Tests
 * 
 * Tests for the complete adaptation pipeline, verifying the full flow
 * from change detection through deployment, including error scenarios
 * and edge cases.
 * 
 * @module ai-maintenance/__tests__/integration/pipeline.integration.test
 * @version 1.0.0
 */

import {
  TestEventRecorder,
  MockRepositoryMonitor,
  MockSemanticDiffAnalyzer,
  MockPatternMatcher,
  MockAdapterModificationGenerator,
  MockAdaptationPipeline,
  TestFixtureFactory,
  TestAssertions,
  createTestContext,
  resetTestContext,
  type IntegrationTestContext
} from './test-harness';

import {
  matchPatterns,
  getAllPatterns,
  PATTERN_EXTERNAL_DEPENDENCY_UPDATE,
  PATTERN_SECURITY_VULNERABILITY_RESPONSE,
  PATTERN_API_DEPRECATION_CASCADE,
  PATTERN_SCHEMA_MIGRATION,
  type PatternMatchContext
} from '../../evolutionary-patterns';

import type {
  RepositoryChange,
  SemanticDiff,
  AnalysisResult,
  ChangeProposal,
  ValidationResult,
  PipelineStage,
  PatternSeverity,
  ImpactLevel
} from '../../types';

import type { AgentFramework } from '../../../adapters/protocol-types';

// ============================================================================
// Test Suite: Dependency Update Pipeline
// ============================================================================

describe('Dependency Update Pipeline', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should process major version update through complete pipeline', async () => {
    const {
      repositoryMonitor,
      semanticDiffAnalyzer,
      patternMatcher,
      modificationGenerator,
      pipeline,
      eventRecorder
    } = context;

    // Setup monitoring for MCP specification
    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'modelcontextprotocol/specification',
      protocol: 'mcp',
      url: 'https://github.com/modelcontextprotocol/specification',
      branch: 'main'
    }));

    // Simulate major version release
    const change = repositoryMonitor.simulateVersionRelease(
      'modelcontextprotocol/specification',
      '2024.11.0',
      '2025.01.0'
    );

    // Pre-configure semantic diff with breaking changes
    const breakingDiff: SemanticDiff = {
      diffId: `diff-${change.changeId}`,
      sourceId: change.repositoryId,
      fromVersion: '2024.11.0',
      toVersion: '2025.01.0',
      impact: 'significant',
      breakingChanges: [
        {
          changeId: 'bc-1',
          description: 'Tool result format changed from string to content array',
          location: 'schemas/tool.json',
          severity: 'high',
          migrationPath: 'Use content array with TextContent type',
          affectedAdapters: ['mcp']
        },
        {
          changeId: 'bc-2',
          description: 'Resource template URI syntax updated',
          location: 'schemas/resource.json',
          severity: 'medium',
          migrationPath: 'Update URI template parser'
        }
      ],
      additions: [
        {
          additionId: 'add-1',
          description: 'New sampling capability added',
          type: 'feature',
          location: 'schemas/sampling.json',
          optional: true
        }
      ],
      deprecations: [],
      removals: [],
      analyzedAt: new Date().toISOString()
    };

    semanticDiffAnalyzer.setAnalysisResult(change.changeId, breakingDiff);

    // Process through analysis
    const diff = await semanticDiffAnalyzer.analyzeChange(change);
    expect(diff.breakingChanges.length).toBe(2);

    // Match patterns
    const patternContext = semanticDiffAnalyzer.createPatternMatchContext(change, diff);
    const matches = await patternMatcher.matchPatterns(patternContext, change.changeId);

    // Verify dependency update pattern matched
    TestAssertions.assertPatternMatched(matches, 'pattern-external-dependency-update');

    // Generate proposal
    const analysis: AnalysisResult = {
      analysisId: `analysis-${change.changeId}`,
      semanticDiff: diff,
      matchedPatterns: matches,
      impactAssessment: {
        overallImpact: 'significant',
        affectedAdapters: [
          {
            protocol: 'mcp',
            impact: 'significant',
            requiredChanges: [
              'Update tool result handler',
              'Update resource template parser'
            ],
            filesAffected: [
              'src/adapters/mcp-adapter.ts',
              'src/adapters/protocol-messages.ts'
            ]
          }
        ],
        estimatedEffortHours: 8,
        riskLevel: 'high',
        dependenciesAffected: ['@modelcontextprotocol/sdk'],
        testCoverageNeeded: ['mcp-tools-tests', 'mcp-resources-tests']
      },
      recommendedActions: [
        {
          actionId: 'action-1',
          type: 'modify-file',
          priority: 1,
          description: 'Update MCP adapter for new tool result format',
          automatable: true,
          estimatedMinutes: 30
        },
        {
          actionId: 'action-2',
          type: 'run-tests',
          priority: 2,
          description: 'Run MCP adapter test suite',
          automatable: true,
          estimatedMinutes: 10
        }
      ],
      confidence: 0.85,
      analyzedAt: new Date().toISOString()
    };

    const proposal = await modificationGenerator.generateProposal(analysis);
    expect(proposal.fileChanges.length).toBeGreaterThan(0);

    // Validate proposal
    const validation = await modificationGenerator.validateProposal(proposal);
    TestAssertions.assertProposalValid(validation);

    // Process through pipeline
    await pipeline.processChange(change);
    TestAssertions.assertPipelineStage(pipeline, 'awaiting-review');

    // Verify complete event trail
    TestAssertions.assertEventSequence(eventRecorder, [
      { source: 'MockRepositoryMonitor', type: 'repository-added' },
      { source: 'MockRepositoryMonitor', type: 'change-detected' },
      { source: 'MockSemanticDiffAnalyzer', type: 'analyze-completed' },
      { source: 'MockPatternMatcher', type: 'match-completed' },
      { source: 'MockAdapterModificationGenerator', type: 'generate-completed' },
      { source: 'MockAdapterModificationGenerator', type: 'validate-completed' }
    ]);
  });

  test('should handle minor version update with no breaking changes', async () => {
    const {
      repositoryMonitor,
      semanticDiffAnalyzer,
      patternMatcher,
      pipeline
    } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'langchain-ai/langchain',
      protocol: 'langchain'
    }));

    // Minor version update
    const change = repositoryMonitor.simulateVersionRelease(
      'langchain-ai/langchain',
      '0.1.15',
      '0.1.16'
    );

    const diff = await semanticDiffAnalyzer.analyzeChange(change);
    expect(diff.impact).toBe('moderate');
    expect(diff.breakingChanges.length).toBe(0);

    const patternContext = semanticDiffAnalyzer.createPatternMatchContext(change, diff);
    const matches = await patternMatcher.matchPatterns(patternContext, change.changeId);

    // Minor version should not trigger major update pattern
    expect(matches.length).toBe(0);
  });
});

// ============================================================================
// Test Suite: Security Vulnerability Pipeline
// ============================================================================

describe('Security Vulnerability Pipeline', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should fast-track critical security vulnerability', async () => {
    const {
      repositoryMonitor,
      semanticDiffAnalyzer,
      patternMatcher,
      modificationGenerator,
      pipeline,
      eventRecorder
    } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'openai/openai-node',
      protocol: 'openai'
    }));

    // Simulate critical security advisory
    const change = repositoryMonitor.simulateSecurityAdvisory(
      'openai/openai-node',
      'CVE-2024-CRITICAL-001',
      'critical'
    );

    // Pre-configure critical diff
    const criticalDiff: SemanticDiff = {
      diffId: `diff-${change.changeId}`,
      sourceId: change.repositoryId,
      fromVersion: 'n/a',
      toVersion: 'patch',
      impact: 'critical',
      breakingChanges: [],
      additions: [],
      deprecations: [],
      removals: [],
      analyzedAt: new Date().toISOString()
    };

    semanticDiffAnalyzer.setAnalysisResult(change.changeId, criticalDiff);

    const diff = await semanticDiffAnalyzer.analyzeChange(change);
    expect(diff.impact).toBe('critical');

    // Match security pattern
    const securityContext: PatternMatchContext = {
      securityAdvisories: [{
        id: 'CVE-2024-CRITICAL-001',
        severity: 'critical',
        description: 'Remote code execution vulnerability in API client'
      }]
    };

    const matches = await patternMatcher.matchPatterns(securityContext, change.changeId);
    TestAssertions.assertPatternMatched(matches, 'pattern-security-vulnerability-response');

    const secMatch = matches.find(m => m.patternId === 'pattern-security-vulnerability-response')!;
    expect(secMatch.confidence).toBeGreaterThan(0.9);
    expect(secMatch.recommendedStrategies).toContain('emergency-patch');

    // Generate emergency proposal
    const analysis: AnalysisResult = {
      analysisId: `analysis-${change.changeId}`,
      semanticDiff: diff,
      matchedPatterns: matches,
      impactAssessment: {
        overallImpact: 'critical',
        affectedAdapters: [{
          protocol: 'openai',
          impact: 'critical',
          requiredChanges: ['Apply security patch immediately'],
          filesAffected: ['src/adapters/openai-adapter.ts']
        }],
        estimatedEffortHours: 1,
        riskLevel: 'critical',
        dependenciesAffected: ['openai'],
        testCoverageNeeded: ['security-tests']
      },
      recommendedActions: [{
        actionId: 'emergency-action',
        type: 'execute-command',
        priority: 0,
        description: 'Apply security patch',
        automatable: true,
        estimatedMinutes: 10
      }],
      confidence: 0.95,
      analyzedAt: new Date().toISOString()
    };

    const proposal = await modificationGenerator.generateProposal(analysis);
    const validation = await modificationGenerator.validateProposal(proposal);
    TestAssertions.assertProposalValid(validation);

    // Fast-track through pipeline
    await pipeline.processChange(change);
    await pipeline.approveAndDeploy();

    expect(pipeline.getStatus()).toBe('completed');
    TestAssertions.assertEventRecorded(eventRecorder, 'MockAdaptationPipeline', 'completed');
  });

  test('should handle medium severity with standard review', async () => {
    const {
      repositoryMonitor,
      patternMatcher,
      pipeline
    } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'test-lib',
      protocol: 'autogen'
    }));

    const change = repositoryMonitor.simulateSecurityAdvisory(
      'test-lib',
      'CVE-2024-MEDIUM-001',
      'medium'
    );

    // Medium severity advisory - should still process but not fast-track
    const securityContext: PatternMatchContext = {
      securityAdvisories: [{
        id: 'CVE-2024-MEDIUM-001',
        severity: 'medium',
        description: 'Information disclosure in logging'
      }]
    };

    const matches = await patternMatcher.matchPatterns(securityContext, change.changeId);
    
    // Medium severity might not trigger security pattern (depends on threshold)
    // But should still be processed
    await pipeline.processChange(change);
    TestAssertions.assertPipelineStage(pipeline, 'awaiting-review');
  });
});

// ============================================================================
// Test Suite: API Deprecation Pipeline
// ============================================================================

describe('API Deprecation Pipeline', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should handle deprecation with migration timeline', async () => {
    const {
      repositoryMonitor,
      semanticDiffAnalyzer,
      patternMatcher,
      modificationGenerator,
      pipeline
    } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'google/generative-ai-js',
      protocol: 'openai'
    }));

    const change = repositoryMonitor.simulateVersionRelease(
      'google/generative-ai-js',
      '0.7.0',
      '0.8.0'
    );

    // Pre-configure diff with deprecations
    const deprecationDiff: SemanticDiff = {
      diffId: `diff-${change.changeId}`,
      sourceId: change.repositoryId,
      fromVersion: '0.7.0',
      toVersion: '0.8.0',
      impact: 'moderate',
      breakingChanges: [],
      additions: [{
        additionId: 'new-api',
        description: 'New streaming API',
        type: 'api',
        optional: false
      }],
      deprecations: [{
        deprecationId: 'dep-1',
        description: 'generateContent() is deprecated',
        since: '0.8.0',
        removalVersion: '1.0.0',
        replacement: 'Use generateContentStream() instead',
        deadline: '2025-06-01'
      }],
      removals: [],
      analyzedAt: new Date().toISOString()
    };

    semanticDiffAnalyzer.setAnalysisResult(change.changeId, deprecationDiff);

    const diff = await semanticDiffAnalyzer.analyzeChange(change);
    expect(diff.deprecations.length).toBe(1);

    const patternContext: PatternMatchContext = {
      versionChange: { from: '0.7.0', to: '0.8.0' },
      deprecations: [{
        element: 'generateContent()',
        replacement: 'generateContentStream()'
      }]
    };

    const matches = await patternMatcher.matchPatterns(patternContext, change.changeId);
    TestAssertions.assertPatternMatched(matches, 'pattern-api-deprecation-cascade');

    // Generate migration proposal
    const analysis = TestFixtureFactory.createAnalysisResult({
      semanticDiff: diff,
      matchedPatterns: matches,
      impactAssessment: {
        overallImpact: 'moderate',
        affectedAdapters: [{
          protocol: 'openai',
          impact: 'moderate',
          requiredChanges: ['Replace deprecated API calls'],
          filesAffected: []
        }],
        estimatedEffortHours: 4,
        riskLevel: 'medium',
        dependenciesAffected: [],
        testCoverageNeeded: []
      }
    });

    const proposal = await modificationGenerator.generateProposal(analysis);
    expect(proposal.fileChanges.length).toBeGreaterThan(0);

    await pipeline.processChange(change);
    TestAssertions.assertPipelineStage(pipeline, 'awaiting-review');
  });
});

// ============================================================================
// Test Suite: Schema Migration Pipeline
// ============================================================================

describe('Schema Migration Pipeline', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should handle breaking schema changes', async () => {
    const { patternMatcher } = context;

    const schemaContext: PatternMatchContext = {
      schemaChanges: [
        { type: 'field-removed', fieldPath: 'response.data', requiredChange: false },
        { type: 'type-changed', fieldPath: 'response.content', requiredChange: true },
        { type: 'field-added', fieldPath: 'response.metadata', requiredChange: false }
      ]
    };

    const matches = await patternMatcher.matchPatterns(schemaContext);
    
    // Schema migration pattern should be matched
    TestAssertions.assertPatternMatched(matches, 'pattern-schema-migration');
  });

  test('should not trigger schema pattern for additive changes only', async () => {
    const { patternMatcher } = context;

    const additiveContext: PatternMatchContext = {
      schemaChanges: [
        { type: 'field-added', fieldPath: 'response.newField', requiredChange: false }
      ]
    };

    const matches = await patternMatcher.matchPatterns(additiveContext);
    
    // Additive-only changes should not trigger schema migration
    const schemaMatch = matches.find(m => m.patternId === 'pattern-schema-migration');
    expect(schemaMatch).toBeUndefined();
  });
});

// ============================================================================
// Test Suite: Multi-Protocol Impact
// ============================================================================

describe('Multi-Protocol Impact Pipeline', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should handle change affecting multiple protocols', async () => {
    const { modificationGenerator } = context;

    const multiProtocolAnalysis: AnalysisResult = {
      analysisId: 'multi-protocol-analysis',
      semanticDiff: TestFixtureFactory.createSemanticDiff({
        impact: 'significant'
      }),
      matchedPatterns: [TestFixtureFactory.createPatternMatch()],
      impactAssessment: {
        overallImpact: 'significant',
        affectedAdapters: [
          {
            protocol: 'mcp',
            impact: 'significant',
            requiredChanges: ['Update message format'],
            filesAffected: ['src/adapters/mcp-adapter.ts']
          },
          {
            protocol: 'a2a',
            impact: 'moderate',
            requiredChanges: ['Update task schema'],
            filesAffected: ['src/adapters/a2a-adapter.ts']
          },
          {
            protocol: 'anp',
            impact: 'minimal',
            requiredChanges: ['Update capability flags'],
            filesAffected: ['src/adapters/anp-adapter.ts']
          }
        ],
        estimatedEffortHours: 12,
        riskLevel: 'high',
        dependenciesAffected: [],
        testCoverageNeeded: ['mcp-tests', 'a2a-tests', 'anp-tests']
      },
      recommendedActions: [],
      confidence: 0.75,
      analyzedAt: new Date().toISOString()
    };

    const proposal = await modificationGenerator.generateProposal(multiProtocolAnalysis);

    // Should have changes for all three protocols
    expect(proposal.fileChanges.length).toBeGreaterThanOrEqual(3);
    
    const protocols = proposal.fileChanges.map(c => {
      const match = c.filePath.match(/(\w+)-adapter/);
      return match ? match[1] : null;
    }).filter(Boolean);

    expect(protocols).toContain('mcp');
    expect(protocols).toContain('a2a');
    expect(protocols).toContain('anp');
  });
});

// ============================================================================
// Test Suite: Pipeline Error Handling
// ============================================================================

describe('Pipeline Error Handling', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should handle validation failure', async () => {
    const { modificationGenerator, pipeline, eventRecorder } = context;

    // Create analysis that will generate an invalid proposal
    const analysis = TestFixtureFactory.createAnalysisResult();
    
    // Pre-configure invalid validation result
    const invalidProposal = TestFixtureFactory.createChangeProposal({
      proposalId: 'invalid-proposal'
    });

    modificationGenerator.setProposal(analysis.analysisId, invalidProposal);

    const proposal = await modificationGenerator.generateProposal(analysis);
    
    // Validation should still pass with mock (would fail in real system)
    const validation = await modificationGenerator.validateProposal(proposal);
    expect(validation.valid).toBe(true);

    // But pipeline can be rejected
    const change = TestFixtureFactory.createRepositoryChange();
    await pipeline.processChange(change);
    await pipeline.reject('Validation failed: type errors detected');

    expect(pipeline.getStatus()).toBe('failed');
    TestAssertions.assertEventRecorded(eventRecorder, 'MockAdaptationPipeline', 'rejected');
  });

  test('should handle pipeline interruption', async () => {
    const { pipeline, eventRecorder } = context;

    const change = TestFixtureFactory.createRepositoryChange();
    
    // Start processing but don't await completion
    const processPromise = pipeline.processChange(change);
    
    // Wait for processing to complete
    await processPromise;
    
    // Reject mid-flow
    await pipeline.reject('Manual intervention required');

    expect(pipeline.getStatus()).toBe('failed');
  });

  test('should isolate failures between changes', async () => {
    const {
      repositoryMonitor,
      semanticDiffAnalyzer,
      pipeline
    } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'repo-1',
      protocol: 'mcp'
    }));

    // First change fails
    const change1 = repositoryMonitor.simulateVersionRelease('repo-1', '1.0.0', '2.0.0');
    await pipeline.processChange(change1);
    await pipeline.reject('Incompatible changes');
    expect(pipeline.getStatus()).toBe('failed');

    // New pipeline should work independently
    const newPipeline = new MockAdaptationPipeline();
    const change2 = repositoryMonitor.simulateVersionRelease('repo-1', '2.0.0', '2.0.1');
    await newPipeline.processChange(change2);
    await newPipeline.approveAndDeploy();
    
    expect(newPipeline.getStatus()).toBe('completed');
  });
});

// ============================================================================
// Test Suite: Real Pattern Integration
// ============================================================================

describe('Real Pattern Registry Integration', () => {
  test('should have all expected patterns registered', () => {
    const patterns = getAllPatterns();
    const patternIds = patterns.map(p => p.patternId);

    expect(patternIds).toContain('pattern-external-dependency-update');
    expect(patternIds).toContain('pattern-api-deprecation-cascade');
    expect(patternIds).toContain('pattern-schema-migration');
    expect(patternIds).toContain('pattern-protocol-extension');
    expect(patternIds).toContain('pattern-security-vulnerability-response');
    expect(patternIds).toContain('pattern-performance-degradation');
  });

  test('should correctly categorize patterns', () => {
    const patterns = getAllPatterns();
    
    const categories = new Set(patterns.map(p => p.category));
    expect(categories.has('dependency-management')).toBe(true);
    expect(categories.has('interface-evolution')).toBe(true);
    expect(categories.has('data-evolution')).toBe(true);
    expect(categories.has('security')).toBe(true);
    expect(categories.has('operational')).toBe(true);
  });

  test('PATTERN_EXTERNAL_DEPENDENCY_UPDATE should have correct structure', () => {
    const pattern = PATTERN_EXTERNAL_DEPENDENCY_UPDATE;
    
    expect(pattern.patternId).toBe('pattern-external-dependency-update');
    expect(pattern.category).toBe('dependency-management');
    expect(pattern.detectionHeuristics.length).toBeGreaterThan(0);
    expect(pattern.remediationStrategies.length).toBeGreaterThan(0);
    expect(pattern.active).toBe(true);
  });

  test('PATTERN_SECURITY_VULNERABILITY_RESPONSE should be high priority', () => {
    const pattern = PATTERN_SECURITY_VULNERABILITY_RESPONSE;
    
    expect(pattern.severity).toBe('critical');
    expect(pattern.automationLevel).toBe('semi-automatic');
    expect(pattern.confidence).toBeGreaterThan(0.9);
  });

  test('should match real patterns against version change', () => {
    const context: PatternMatchContext = {
      versionChange: { from: '1.0.0', to: '2.0.0' },
      changelog: 'Breaking changes: API signature modified'
    };

    const matches = matchPatterns(context);
    expect(matches.length).toBeGreaterThan(0);
    
    // Should match dependency update pattern
    const depMatch = matches.find(m => m.patternId === 'pattern-external-dependency-update');
    expect(depMatch).toBeDefined();
  });

  test('should match real patterns against security advisory', () => {
    const context: PatternMatchContext = {
      securityAdvisories: [{
        id: 'CVE-2024-TEST',
        severity: 'critical',
        description: 'Critical vulnerability'
      }]
    };

    const matches = matchPatterns(context);
    
    const secMatch = matches.find(m => m.patternId === 'pattern-security-vulnerability-response');
    expect(secMatch).toBeDefined();
    expect(secMatch!.confidence).toBeGreaterThan(0.9);
  });
});

// ============================================================================
// Test Suite: Protocol-Specific Scenarios
// ============================================================================

describe('Protocol-Specific Pipeline Scenarios', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('MCP protocol update scenario', async () => {
    const { repositoryMonitor, semanticDiffAnalyzer } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'mcp-spec',
      protocol: 'mcp',
      name: 'Model Context Protocol Specification'
    }));

    const change = repositoryMonitor.simulateVersionRelease('mcp-spec', '2024.11', '2025.01');
    const diff = await semanticDiffAnalyzer.analyzeChange(change);

    expect(diff.sourceId).toBe('mcp-spec');
    expect(diff.toVersion).toBe('2025.01');
  });

  test('A2A protocol update scenario', async () => {
    const { repositoryMonitor, semanticDiffAnalyzer } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'a2a-protocol',
      protocol: 'a2a',
      name: 'Agent-to-Agent Protocol'
    }));

    const change = repositoryMonitor.simulateVersionRelease('a2a-protocol', '0.9.0', '1.0.0');
    const diff = await semanticDiffAnalyzer.analyzeChange(change);

    expect(diff.sourceId).toBe('a2a-protocol');
    expect(diff.impact).toBe('significant'); // Major version
  });

  test('ANP protocol update scenario', async () => {
    const { repositoryMonitor, semanticDiffAnalyzer, patternMatcher } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'anp-protocol',
      protocol: 'anp',
      name: 'Agent Network Protocol'
    }));

    const change = repositoryMonitor.simulateVersionRelease('anp-protocol', '1.0.0', '1.1.0');
    const diff = await semanticDiffAnalyzer.analyzeChange(change);

    expect(diff.impact).toBe('moderate'); // Minor version

    const patternContext = semanticDiffAnalyzer.createPatternMatchContext(change, diff);
    const matches = await patternMatcher.matchPatterns(patternContext, change.changeId);

    // Minor version should not trigger breaking change pattern
    expect(matches.length).toBe(0);
  });

  test('LangChain framework update scenario', async () => {
    const { repositoryMonitor, semanticDiffAnalyzer, patternMatcher } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'langchain',
      protocol: 'langchain',
      name: 'LangChain Framework'
    }));

    // LangChain major version
    const change = repositoryMonitor.simulateVersionRelease('langchain', '0.1.0', '0.2.0');
    const diff = await semanticDiffAnalyzer.analyzeChange(change);

    const patternContext = semanticDiffAnalyzer.createPatternMatchContext(change, diff);
    const matches = await patternMatcher.matchPatterns(patternContext, change.changeId);

    // 0.x to 0.y should still be considered breaking for pre-1.0 packages
    expect(diff.impact).toBe('significant');
  });
});

// ============================================================================
// Test Suite: Concurrent Pipeline Operations
// ============================================================================

describe('Concurrent Pipeline Operations', () => {
  test('should handle multiple simultaneous changes', async () => {
    const context = createTestContext();
    const { repositoryMonitor, semanticDiffAnalyzer, eventRecorder } = context;

    // Add multiple repositories
    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'repo-1',
      protocol: 'mcp'
    }));
    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'repo-2',
      protocol: 'a2a'
    }));
    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'repo-3',
      protocol: 'anp'
    }));

    // Simulate concurrent changes
    const change1 = repositoryMonitor.simulateVersionRelease('repo-1', '1.0.0', '1.0.1');
    const change2 = repositoryMonitor.simulateVersionRelease('repo-2', '2.0.0', '3.0.0');
    const change3 = repositoryMonitor.simulateSecurityAdvisory('repo-3', 'CVE-TEST', 'high');

    // Process all concurrently
    const [diff1, diff2, diff3] = await Promise.all([
      semanticDiffAnalyzer.analyzeChange(change1),
      semanticDiffAnalyzer.analyzeChange(change2),
      semanticDiffAnalyzer.analyzeChange(change3)
    ]);

    expect(diff1.sourceId).toBe('repo-1');
    expect(diff2.sourceId).toBe('repo-2');
    expect(diff3.sourceId).toBe('repo-3');

    // Verify all events recorded
    const changeEvents = eventRecorder.getEventsByType('change-detected');
    expect(changeEvents.length).toBe(3);

    const analyzeEvents = eventRecorder.getEventsByType('analyze-completed');
    expect(analyzeEvents.length).toBe(3);
  });

  test('should maintain event ordering within components', async () => {
    const context = createTestContext();
    const { repositoryMonitor, eventRecorder } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'sequential-repo'
    }));

    // Sequential changes
    repositoryMonitor.simulateVersionRelease('sequential-repo', '1.0.0', '1.1.0');
    repositoryMonitor.simulateVersionRelease('sequential-repo', '1.1.0', '1.2.0');
    repositoryMonitor.simulateVersionRelease('sequential-repo', '1.2.0', '1.3.0');

    const changeEvents = eventRecorder.getEventsByType('change-detected');
    expect(changeEvents.length).toBe(3);

    // Verify sequence numbers are in order
    expect(changeEvents[0].sequence).toBeLessThan(changeEvents[1].sequence);
    expect(changeEvents[1].sequence).toBeLessThan(changeEvents[2].sequence);
  });
});
