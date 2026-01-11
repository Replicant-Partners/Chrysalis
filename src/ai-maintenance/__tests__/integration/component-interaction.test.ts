/**
 * AI-Led Adaptive Maintenance System - Component Interaction Tests
 * 
 * Tests for component interactions within the AI maintenance system,
 * verifying proper communication, data flow, and coordination between
 * system components.
 * 
 * @module ai-maintenance/__tests__/integration/component-interaction.test
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
  getPattern,
  getAllPatterns,
  patternRegistry,
  type PatternMatchContext
} from '../../evolutionary-patterns';

import type {
  RepositoryChange,
  SemanticDiff,
  PatternMatch,
  AnalysisResult,
  ChangeProposal,
  ValidationResult,
  ImpactLevel
} from '../../types';

// ============================================================================
// Test Suite: RepositoryMonitor ↔ SemanticDiffAnalyzer Interaction
// ============================================================================

describe('RepositoryMonitor ↔ SemanticDiffAnalyzer Interaction', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should trigger analysis when change is detected', async () => {
    const { repositoryMonitor, semanticDiffAnalyzer, eventRecorder } = context;

    // Setup: Add repository
    const repo = TestFixtureFactory.createWatchedRepository({
      repositoryId: 'mcp-spec',
      protocol: 'mcp'
    });
    repositoryMonitor.addRepository(repo);

    // Simulate version release
    const change = repositoryMonitor.simulateVersionRelease('mcp-spec', '1.0.0', '2.0.0');

    // Analyze the change
    const diff = await semanticDiffAnalyzer.analyzeChange(change);

    // Verify event sequence
    TestAssertions.assertEventSequence(eventRecorder, [
      { source: 'MockRepositoryMonitor', type: 'change-detected' },
      { source: 'MockSemanticDiffAnalyzer', type: 'analyze-started' },
      { source: 'MockSemanticDiffAnalyzer', type: 'analyze-completed' }
    ]);

    // Verify diff result
    expect(diff.diffId).toBeDefined();
    expect(diff.fromVersion).toBe('1.0.0');
    expect(diff.toVersion).toBe('2.0.0');
    expect(diff.impact).toBe('significant'); // Major version change
    expect(diff.breakingChanges.length).toBeGreaterThan(0);
  });

  test('should propagate repository metadata through analysis', async () => {
    const { repositoryMonitor, semanticDiffAnalyzer } = context;

    const repo = TestFixtureFactory.createWatchedRepository({
      repositoryId: 'a2a-protocol',
      protocol: 'a2a',
      name: 'A2A Protocol'
    });
    repositoryMonitor.addRepository(repo);

    const change = repositoryMonitor.simulateVersionRelease('a2a-protocol', '0.9.0', '1.0.0');
    const diff = await semanticDiffAnalyzer.analyzeChange(change);

    expect(diff.sourceId).toBe('a2a-protocol');
    expect(diff.toVersion).toBe('1.0.0');
  });

  test('should handle security advisory changes', async () => {
    const { repositoryMonitor, semanticDiffAnalyzer, eventRecorder } = context;

    const repo = TestFixtureFactory.createWatchedRepository({
      repositoryId: 'langchain',
      protocol: 'langchain'
    });
    repositoryMonitor.addRepository(repo);

    const change = repositoryMonitor.simulateSecurityAdvisory('langchain', 'CVE-2024-12345', 'critical');
    const diff = await semanticDiffAnalyzer.analyzeChange(change);

    expect(diff.impact).toBe('critical');
    
    TestAssertions.assertEventRecorded(eventRecorder, 'MockRepositoryMonitor', 'change-detected');
    TestAssertions.assertEventRecorded(eventRecorder, 'MockSemanticDiffAnalyzer', 'analyze-completed');
  });

  test('should handle multiple simultaneous changes', async () => {
    const { repositoryMonitor, semanticDiffAnalyzer, eventRecorder } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'repo1',
      protocol: 'mcp'
    }));
    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'repo2',
      protocol: 'a2a'
    }));

    const change1 = repositoryMonitor.simulateVersionRelease('repo1', '1.0.0', '1.1.0');
    const change2 = repositoryMonitor.simulateVersionRelease('repo2', '2.0.0', '3.0.0');

    const [diff1, diff2] = await Promise.all([
      semanticDiffAnalyzer.analyzeChange(change1),
      semanticDiffAnalyzer.analyzeChange(change2)
    ]);

    expect(diff1.sourceId).toBe('repo1');
    expect(diff2.sourceId).toBe('repo2');
    expect(diff1.impact).toBe('moderate'); // Minor version
    expect(diff2.impact).toBe('significant'); // Major version
  });
});

// ============================================================================
// Test Suite: SemanticDiffAnalyzer ↔ Evolutionary Patterns Matching
// ============================================================================

describe('SemanticDiffAnalyzer ↔ Evolutionary Patterns Matching', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should match dependency update pattern on major version change', async () => {
    const { semanticDiffAnalyzer, patternMatcher, eventRecorder } = context;

    const change = TestFixtureFactory.createRepositoryChange({
      changeType: 'version-release',
      previousVersion: '1.9.0',
      currentVersion: '2.0.0'
    });

    const diff = await semanticDiffAnalyzer.analyzeChange(change);
    const patternContext = semanticDiffAnalyzer.createPatternMatchContext(change, diff);
    const matches = await patternMatcher.matchPatterns(patternContext, change.changeId);

    // Verify pattern was matched
    expect(matches.length).toBeGreaterThan(0);
    TestAssertions.assertPatternMatched(matches, 'pattern-external-dependency-update');

    // Verify confidence
    const depMatch = matches.find(m => m.patternId === 'pattern-external-dependency-update')!;
    TestAssertions.assertConfidenceAbove(depMatch, 0.7);

    // Verify events
    TestAssertions.assertEventRecorded(eventRecorder, 'MockPatternMatcher', 'match-completed');
  });

  test('should match security vulnerability pattern on security advisory', async () => {
    const { patternMatcher, eventRecorder } = context;

    const securityContext: PatternMatchContext = {
      securityAdvisories: [{
        id: 'CVE-2024-99999',
        severity: 'critical',
        description: 'Remote code execution vulnerability'
      }]
    };

    const matches = await patternMatcher.matchPatterns(securityContext);

    expect(matches.length).toBeGreaterThan(0);
    TestAssertions.assertPatternMatched(matches, 'pattern-security-vulnerability-response');

    const secMatch = matches.find(m => m.patternId === 'pattern-security-vulnerability-response')!;
    TestAssertions.assertConfidenceAbove(secMatch, 0.9);
    expect(secMatch.recommendedStrategies).toContain('emergency-patch');
  });

  test('should match deprecation pattern when deprecations detected', async () => {
    const { patternMatcher } = context;

    const deprecationContext: PatternMatchContext = {
      deprecations: [
        { element: 'oldAPI()', replacement: 'newAPI()' },
        { element: 'legacyMethod()', replacement: 'modernMethod()' }
      ]
    };

    const matches = await patternMatcher.matchPatterns(deprecationContext);

    TestAssertions.assertPatternMatched(matches, 'pattern-api-deprecation-cascade');
  });

  test('should not match patterns when no relevant context', async () => {
    const { patternMatcher } = context;

    const emptyContext: PatternMatchContext = {};
    const matches = await patternMatcher.matchPatterns(emptyContext);

    expect(matches.length).toBe(0);
  });

  test('should match multiple patterns when context has multiple triggers', async () => {
    const { patternMatcher } = context;

    const complexContext: PatternMatchContext = {
      versionChange: { from: '1.0.0', to: '2.0.0' },
      deprecations: [{ element: 'oldAPI()' }],
      securityAdvisories: [{ id: 'CVE-2024-1', severity: 'high', description: 'Vulnerability' }]
    };

    const matches = await patternMatcher.matchPatterns(complexContext);

    expect(matches.length).toBeGreaterThanOrEqual(2);
    
    // Should match both dependency update and security patterns
    const patternIds = matches.map(m => m.patternId);
    expect(patternIds).toContain('pattern-external-dependency-update');
    expect(patternIds).toContain('pattern-security-vulnerability-response');
  });
});

// ============================================================================
// Test Suite: AdapterModificationGenerator ↔ Proposal Validation
// ============================================================================

describe('AdapterModificationGenerator ↔ Proposal Validation', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should generate and validate proposal from analysis', async () => {
    const { modificationGenerator, eventRecorder } = context;

    const analysis = TestFixtureFactory.createAnalysisResult({
      matchedPatterns: [TestFixtureFactory.createPatternMatch()],
      impactAssessment: {
        overallImpact: 'moderate',
        affectedAdapters: [{
          protocol: 'mcp',
          impact: 'moderate',
          requiredChanges: ['Update message handler'],
          filesAffected: ['src/adapters/mcp-adapter.ts']
        }],
        estimatedEffortHours: 4,
        riskLevel: 'medium',
        dependenciesAffected: [],
        testCoverageNeeded: ['mcp-adapter-tests']
      }
    });

    const proposal = await modificationGenerator.generateProposal(analysis);

    // Verify proposal structure
    expect(proposal.proposalId).toBeDefined();
    expect(proposal.status).toBe('draft');
    expect(proposal.fileChanges.length).toBeGreaterThan(0);
    expect(proposal.rollbackProcedure).toBeDefined();

    // Validate the proposal
    const validation = await modificationGenerator.validateProposal(proposal);

    expect(validation.valid).toBe(true);
    expect(validation.contractCompliance.protocolTypesCompliant).toBe(true);
    expect(validation.issues.length).toBe(0);

    // Verify event sequence
    TestAssertions.assertEventSequence(eventRecorder, [
      { source: 'MockAdapterModificationGenerator', type: 'generate-started' },
      { source: 'MockAdapterModificationGenerator', type: 'generate-completed' },
      { source: 'MockAdapterModificationGenerator', type: 'validate-started' },
      { source: 'MockAdapterModificationGenerator', type: 'validate-completed' }
    ]);
  });

  test('should generate file changes for affected adapters', async () => {
    const { modificationGenerator } = context;

    const analysis = TestFixtureFactory.createAnalysisResult({
      impactAssessment: {
        overallImpact: 'significant',
        affectedAdapters: [
          { protocol: 'mcp', impact: 'significant', requiredChanges: [], filesAffected: [] },
          { protocol: 'a2a', impact: 'moderate', requiredChanges: [], filesAffected: [] }
        ],
        estimatedEffortHours: 8,
        riskLevel: 'high',
        dependenciesAffected: [],
        testCoverageNeeded: []
      }
    });

    const proposal = await modificationGenerator.generateProposal(analysis);

    // Should have changes for both adapters
    expect(proposal.fileChanges.length).toBeGreaterThanOrEqual(2);
    
    const filePaths = proposal.fileChanges.map(c => c.filePath);
    expect(filePaths.some(p => p.includes('mcp'))).toBe(true);
    expect(filePaths.some(p => p.includes('a2a'))).toBe(true);
  });

  test('should use pre-configured proposal when available', async () => {
    const { modificationGenerator, eventRecorder } = context;

    const customProposal = TestFixtureFactory.createChangeProposal({
      title: 'Custom Pre-configured Proposal',
      fileChanges: [{
        filePath: 'src/custom/file.ts',
        type: 'create',
        newContent: '// Custom content',
        rationale: 'Custom change'
      }]
    });

    const analysis = TestFixtureFactory.createAnalysisResult({
      analysisId: 'custom-analysis'
    });

    modificationGenerator.setProposal('custom-analysis', customProposal);

    const proposal = await modificationGenerator.generateProposal(analysis);

    expect(proposal.title).toBe('Custom Pre-configured Proposal');
    expect(proposal.fileChanges[0].filePath).toBe('src/custom/file.ts');
  });

  test('should handle proposal with no affected adapters', async () => {
    const { modificationGenerator } = context;

    const analysis = TestFixtureFactory.createAnalysisResult({
      impactAssessment: {
        overallImpact: 'minimal',
        affectedAdapters: [],
        estimatedEffortHours: 1,
        riskLevel: 'low',
        dependenciesAffected: [],
        testCoverageNeeded: []
      }
    });

    const proposal = await modificationGenerator.generateProposal(analysis);

    // Should still have at least one change (capability matrix update)
    expect(proposal.fileChanges.length).toBeGreaterThan(0);
    expect(proposal.fileChanges[0].filePath).toContain('protocol-capabilities');
  });
});

// ============================================================================
// Test Suite: Pipeline Stage Transitions
// ============================================================================

describe('Pipeline Stage Transitions', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should transition through all stages during change processing', async () => {
    const { pipeline, eventRecorder } = context;

    const change = TestFixtureFactory.createRepositoryChange();

    await pipeline.processChange(change);

    // Verify stage transitions
    TestAssertions.assertEventSequence(eventRecorder, [
      { type: 'stage-transition' }, // to analyzing
      { type: 'stage-transition' }, // to generating
      { type: 'stage-transition' }, // to validating
      { type: 'stage-transition' }, // to awaiting-review
      { type: 'awaiting-review' }
    ]);

    TestAssertions.assertPipelineStage(pipeline, 'awaiting-review');
  });

  test('should complete pipeline after approval', async () => {
    const { pipeline, eventRecorder } = context;

    const change = TestFixtureFactory.createRepositoryChange();
    await pipeline.processChange(change);

    // Approve and deploy
    await pipeline.approveAndDeploy();

    TestAssertions.assertPipelineStage(pipeline, 'completed');
    expect(pipeline.getStatus()).toBe('completed');
    
    TestAssertions.assertEventRecorded(eventRecorder, 'MockAdaptationPipeline', 'completed');
  });

  test('should fail pipeline on rejection', async () => {
    const { pipeline, eventRecorder } = context;

    const change = TestFixtureFactory.createRepositoryChange();
    await pipeline.processChange(change);

    // Reject the change
    await pipeline.reject('Changes do not meet quality standards');

    expect(pipeline.getStatus()).toBe('failed');
    TestAssertions.assertPipelineStage(pipeline, 'failed');
    TestAssertions.assertEventRecorded(eventRecorder, 'MockAdaptationPipeline', 'rejected');
  });

  test('should emit events on stage transitions', async () => {
    const { pipeline } = context;

    const transitions: Array<{ from: string; to: string }> = [];
    pipeline.on('stage-transition', (t) => transitions.push(t));

    await pipeline.transitionTo('analyzing');
    await pipeline.transitionTo('generating');
    await pipeline.transitionTo('validating');

    expect(transitions.length).toBe(3);
    expect(transitions[0]).toEqual({ from: 'monitoring', to: 'analyzing' });
    expect(transitions[1]).toEqual({ from: 'analyzing', to: 'generating' });
    expect(transitions[2]).toEqual({ from: 'generating', to: 'validating' });
  });
});

// ============================================================================
// Test Suite: Full Component Interaction Flow
// ============================================================================

describe('Full Component Interaction Flow', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should process change through complete flow', async () => {
    const {
      repositoryMonitor,
      semanticDiffAnalyzer,
      patternMatcher,
      modificationGenerator,
      pipeline,
      eventRecorder
    } = context;

    // 1. Setup repository
    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'test-protocol',
      protocol: 'mcp'
    }));

    // 2. Detect change
    const change = repositoryMonitor.simulateVersionRelease('test-protocol', '1.0.0', '2.0.0');
    expect(change.status).toBe('detected');

    // 3. Analyze change
    const diff = await semanticDiffAnalyzer.analyzeChange(change);
    expect(diff.impact).toBe('significant');

    // 4. Match patterns
    const patternContext = semanticDiffAnalyzer.createPatternMatchContext(change, diff);
    const matches = await patternMatcher.matchPatterns(patternContext, change.changeId);
    expect(matches.length).toBeGreaterThan(0);

    // 5. Generate proposal
    const analysis = TestFixtureFactory.createAnalysisResult({
      semanticDiff: diff,
      matchedPatterns: matches
    });
    const proposal = await modificationGenerator.generateProposal(analysis);
    expect(proposal.status).toBe('draft');

    // 6. Validate proposal
    const validation = await modificationGenerator.validateProposal(proposal);
    expect(validation.valid).toBe(true);

    // 7. Process through pipeline
    await pipeline.processChange(change);
    TestAssertions.assertPipelineStage(pipeline, 'awaiting-review');

    // 8. Approve and deploy
    await pipeline.approveAndDeploy();
    expect(pipeline.getStatus()).toBe('completed');

    // Verify complete event trail
    const allEvents = eventRecorder.getEvents();
    expect(allEvents.length).toBeGreaterThan(10);
    
    // Key events in order
    TestAssertions.assertEventSequence(eventRecorder, [
      { source: 'MockRepositoryMonitor', type: 'repository-added' },
      { source: 'MockRepositoryMonitor', type: 'change-detected' },
      { source: 'MockSemanticDiffAnalyzer', type: 'analyze-started' },
      { source: 'MockSemanticDiffAnalyzer', type: 'analyze-completed' },
      { source: 'MockPatternMatcher', type: 'match-started' },
      { source: 'MockPatternMatcher', type: 'match-completed' },
      { source: 'MockAdapterModificationGenerator', type: 'generate-started' },
      { source: 'MockAdapterModificationGenerator', type: 'generate-completed' },
      { source: 'MockAdaptationPipeline', type: 'completed' }
    ]);
  });

  test('should handle security vulnerability end-to-end', async () => {
    const {
      repositoryMonitor,
      semanticDiffAnalyzer,
      patternMatcher,
      modificationGenerator,
      pipeline,
      eventRecorder
    } = context;

    // Detect security advisory
    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'vulnerable-lib',
      protocol: 'langchain'
    }));

    const change = repositoryMonitor.simulateSecurityAdvisory('vulnerable-lib', 'CVE-2024-CRITICAL', 'critical');

    // Analyze
    const diff = await semanticDiffAnalyzer.analyzeChange(change);
    expect(diff.impact).toBe('critical');

    // Match patterns with security advisory context
    const securityContext: PatternMatchContext = {
      securityAdvisories: [{
        id: 'CVE-2024-CRITICAL',
        severity: 'critical',
        description: 'Critical security vulnerability'
      }]
    };
    
    const matches = await patternMatcher.matchPatterns(securityContext, change.changeId);
    TestAssertions.assertPatternMatched(matches, 'pattern-security-vulnerability-response');

    // Generate and validate proposal
    const analysis = TestFixtureFactory.createAnalysisResult({
      semanticDiff: diff,
      matchedPatterns: matches,
      impactAssessment: {
        overallImpact: 'critical',
        affectedAdapters: [{ protocol: 'langchain', impact: 'critical', requiredChanges: ['Patch vulnerability'], filesAffected: [] }],
        estimatedEffortHours: 2,
        riskLevel: 'critical',
        dependenciesAffected: ['langchain'],
        testCoverageNeeded: ['security-tests']
      }
    });

    const proposal = await modificationGenerator.generateProposal(analysis);
    const validation = await modificationGenerator.validateProposal(proposal);
    expect(validation.valid).toBe(true);

    // Fast-track through pipeline
    await pipeline.processChange(change);
    await pipeline.approveAndDeploy();

    expect(pipeline.getStatus()).toBe('completed');
  });

  test('should handle minor version update with minimal changes', async () => {
    const {
      repositoryMonitor,
      semanticDiffAnalyzer,
      patternMatcher,
      eventRecorder
    } = context;

    repositoryMonitor.addRepository(TestFixtureFactory.createWatchedRepository({
      repositoryId: 'stable-lib',
      protocol: 'openai'
    }));

    // Minor version update
    const change = repositoryMonitor.simulateVersionRelease('stable-lib', '4.1.0', '4.2.0');
    const diff = await semanticDiffAnalyzer.analyzeChange(change);

    expect(diff.impact).toBe('moderate');
    expect(diff.breakingChanges.length).toBe(0);

    const patternContext = semanticDiffAnalyzer.createPatternMatchContext(change, diff);
    const matches = await patternMatcher.matchPatterns(patternContext, change.changeId);

    // Minor version should not trigger major pattern
    expect(matches.length).toBe(0);
  });
});

// ============================================================================
// Test Suite: Error Handling and Recovery
// ============================================================================

describe('Error Handling and Recovery', () => {
  let context: IntegrationTestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    resetTestContext(context);
  });

  test('should handle analyzer failure gracefully', async () => {
    const { semanticDiffAnalyzer, eventRecorder } = context;

    // Create change with missing required data
    const invalidChange = TestFixtureFactory.createRepositoryChange({
      changeId: 'invalid-change',
      previousVersion: undefined, // Missing previous version
      currentVersion: '1.0.0'
    });

    // Should still produce a result (with defaults)
    const diff = await semanticDiffAnalyzer.analyzeChange(invalidChange);
    
    expect(diff.fromVersion).toBe('0.0.0');
    expect(diff.impact).toBeDefined();
  });

  test('should handle pattern matcher with empty registry', async () => {
    const { patternMatcher } = context;

    const context1: PatternMatchContext = {
      versionChange: { from: '1.0.0', to: '2.0.0' }
    };

    // Should return matches from internal logic even without registered patterns
    const matches = await patternMatcher.matchPatterns(context1);
    expect(Array.isArray(matches)).toBe(true);
  });

  test('should recover pipeline state after rejection', async () => {
    const { pipeline } = context;

    const change = TestFixtureFactory.createRepositoryChange();
    await pipeline.processChange(change);
    
    // Reject
    await pipeline.reject('Quality issue');
    expect(pipeline.getStatus()).toBe('failed');

    // Create new pipeline instance for new change
    const newPipeline = new MockAdaptationPipeline();
    expect(newPipeline.getStatus()).toBe('active');
    expect(newPipeline.getStage()).toBe('monitoring');
  });
});

// ============================================================================
// Test Suite: Actual Pattern Registry Integration
// ============================================================================

describe('Actual Pattern Registry Integration', () => {
  test('should access real pattern registry', () => {
    const patterns = getAllPatterns();
    
    expect(patterns.length).toBeGreaterThanOrEqual(6);
    
    // Verify specific patterns exist
    const dependencyPattern = getPattern('pattern-external-dependency-update');
    expect(dependencyPattern).toBeDefined();
    expect(dependencyPattern!.category).toBe('dependency-management');
    
    const securityPattern = getPattern('pattern-security-vulnerability-response');
    expect(securityPattern).toBeDefined();
    expect(securityPattern!.severity).toBe('critical');
  });

  test('should match patterns using real registry', () => {
    const versionContext: PatternMatchContext = {
      versionChange: { from: '1.0.0', to: '2.0.0' },
      changelog: 'This release contains breaking changes in the API'
    };

    const matches = matchPatterns(versionContext);
    
    expect(matches.length).toBeGreaterThan(0);
    
    // Should match dependency update pattern
    const depMatch = matches.find(m => m.patternId === 'pattern-external-dependency-update');
    expect(depMatch).toBeDefined();
    expect(depMatch!.confidence).toBeGreaterThan(0.5);
  });

  test('should match security pattern with real registry', () => {
    const securityContext: PatternMatchContext = {
      securityAdvisories: [{
        id: 'CVE-2024-TEST',
        severity: 'critical',
        description: 'Test vulnerability'
      }]
    };

    const matches = matchPatterns(securityContext);
    
    const secMatch = matches.find(m => m.patternId === 'pattern-security-vulnerability-response');
    expect(secMatch).toBeDefined();
    expect(secMatch!.confidence).toBeGreaterThan(0.9);
  });

  test('should match schema migration pattern', () => {
    const schemaContext: PatternMatchContext = {
      schemaChanges: [
        { type: 'field-removed', fieldPath: 'oldField' },
        { type: 'type-changed', fieldPath: 'dataField', requiredChange: true }
      ]
    };

    const matches = matchPatterns(schemaContext);
    
    const schemaMatch = matches.find(m => m.patternId === 'pattern-schema-migration');
    expect(schemaMatch).toBeDefined();
  });
});

// ============================================================================
// Test Suite: Event Recording and Audit Trail
// ============================================================================

describe('Event Recording and Audit Trail', () => {
  test('should maintain complete event sequence', () => {
    const recorder = new TestEventRecorder();
    
    recorder.record('Component1', 'event-a', { data: 'a' });
    recorder.record('Component2', 'event-b', { data: 'b' });
    recorder.record('Component1', 'event-c', { data: 'c' });
    
    const events = recorder.getEvents();
    expect(events.length).toBe(3);
    expect(events[0].sequence).toBe(0);
    expect(events[1].sequence).toBe(1);
    expect(events[2].sequence).toBe(2);
  });

  test('should filter events by source', () => {
    const recorder = new TestEventRecorder();
    
    recorder.record('Source1', 'event1', {});
    recorder.record('Source2', 'event2', {});
    recorder.record('Source1', 'event3', {});
    
    const source1Events = recorder.getEventsBySource('Source1');
    expect(source1Events.length).toBe(2);
    expect(source1Events[0].type).toBe('event1');
    expect(source1Events[1].type).toBe('event3');
  });

  test('should filter events by type', () => {
    const recorder = new TestEventRecorder();
    
    recorder.record('A', 'change-detected', {});
    recorder.record('B', 'analyze-completed', {});
    recorder.record('C', 'change-detected', {});
    
    const changeEvents = recorder.getEventsByType('change-detected');
    expect(changeEvents.length).toBe(2);
  });

  test('should verify event sequences', () => {
    const recorder = new TestEventRecorder();
    
    recorder.record('Monitor', 'start', {});
    recorder.record('Monitor', 'change-detected', {});
    recorder.record('Analyzer', 'analyze-started', {});
    recorder.record('Analyzer', 'analyze-completed', {});
    
    // Valid sequence
    expect(recorder.assertEventSequence([
      { type: 'start' },
      { type: 'change-detected' },
      { type: 'analyze-completed' }
    ])).toBe(true);
    
    // Invalid sequence (wrong order)
    expect(recorder.assertEventSequence([
      { type: 'analyze-completed' },
      { type: 'change-detected' }
    ])).toBe(false);
  });

  test('should clear recorded events', () => {
    const recorder = new TestEventRecorder();
    
    recorder.record('A', 'event', {});
    recorder.record('B', 'event', {});
    expect(recorder.getEvents().length).toBe(2);
    
    recorder.clear();
    expect(recorder.getEvents().length).toBe(0);
  });
});

// ============================================================================
// Test Suite: Test Fixture Factory
// ============================================================================

describe('Test Fixture Factory', () => {
  test('should create watched repository with defaults', () => {
    const repo = TestFixtureFactory.createWatchedRepository();
    
    expect(repo.repositoryId).toBeDefined();
    expect(repo.type).toBe('git');
    expect(repo.active).toBe(true);
    expect(repo.branch).toBe('main');
  });

  test('should create watched repository with overrides', () => {
    const repo = TestFixtureFactory.createWatchedRepository({
      protocol: 'a2a',
      branch: 'develop',
      active: false
    });
    
    expect(repo.protocol).toBe('a2a');
    expect(repo.branch).toBe('develop');
    expect(repo.active).toBe(false);
  });

  test('should create repository change with defaults', () => {
    const change = TestFixtureFactory.createRepositoryChange();
    
    expect(change.changeId).toBeDefined();
    expect(change.changeType).toBe('version-release');
    expect(change.status).toBe('detected');
  });

  test('should create semantic diff with defaults', () => {
    const diff = TestFixtureFactory.createSemanticDiff();
    
    expect(diff.diffId).toBeDefined();
    expect(diff.impact).toBe('moderate');
    expect(diff.breakingChanges).toEqual([]);
  });

  test('should create analysis result with nested defaults', () => {
    const analysis = TestFixtureFactory.createAnalysisResult();
    
    expect(analysis.analysisId).toBeDefined();
    expect(analysis.semanticDiff).toBeDefined();
    expect(analysis.impactAssessment).toBeDefined();
    expect(analysis.confidence).toBe(0.8);
  });

  test('should create version change context', () => {
    const context = TestFixtureFactory.createVersionChangeContext('1.0.0', '2.0.0');
    
    expect(context.versionChange).toEqual({ from: '1.0.0', to: '2.0.0' });
  });

  test('should create security advisory context', () => {
    const context = TestFixtureFactory.createSecurityAdvisoryContext('CVE-2024-1', 'high');
    
    expect(context.securityAdvisories).toHaveLength(1);
    expect(context.securityAdvisories![0].id).toBe('CVE-2024-1');
    expect(context.securityAdvisories![0].severity).toBe('high');
  });
});
