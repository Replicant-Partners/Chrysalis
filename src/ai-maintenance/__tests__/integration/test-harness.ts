/**
 * AI-Led Adaptive Maintenance System - Integration Test Harness
 * 
 * Core testing framework providing mock implementations, test utilities,
 * and assertions for integration testing the AI maintenance system components.
 * 
 * @module ai-maintenance/__tests__/integration/test-harness
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import type {
  RepositoryChange,
  SemanticDiff,
  ChangeProposal,
  ValidationResult,
  EvolutionaryPattern,
  PatternMatch,
  WatchedRepository,
  AnalysisResult,
  ImpactLevel,
  PipelineStage,
  PipelineStatus,
  FileChange,
  PatternCategory,
  PatternSeverity,
  ChangeStatus,
  ChangeType,
} from '../../types';
import type { PatternMatchContext } from '../../evolutionary-patterns';
import type { AgentFramework } from '../../../adapters/protocol-types';

// ============================================================================
// Test Event Recording
// ============================================================================

/**
 * Event type recorded during test execution.
 */
export interface RecordedEvent {
  /** Event timestamp */
  timestamp: Date;
  /** Event source component */
  source: string;
  /** Event type/name */
  type: string;
  /** Event data payload */
  data: unknown;
  /** Sequence number for ordering */
  sequence: number;
}

/**
 * Test event recorder for capturing system events during integration tests.
 */
export class TestEventRecorder {
  private events: RecordedEvent[] = [];
  private sequence = 0;

  /**
   * Record an event.
   */
  record(source: string, type: string, data: unknown): void {
    this.events.push({
      timestamp: new Date(),
      source,
      type,
      data,
      sequence: this.sequence++
    });
  }

  /**
   * Get all recorded events.
   */
  getEvents(): RecordedEvent[] {
    return [...this.events];
  }

  /**
   * Get events from specific source.
   */
  getEventsBySource(source: string): RecordedEvent[] {
    return this.events.filter(e => e.source === source);
  }

  /**
   * Get events of specific type.
   */
  getEventsByType(type: string): RecordedEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get events matching predicate.
   */
  findEvents(predicate: (event: RecordedEvent) => boolean): RecordedEvent[] {
    return this.events.filter(predicate);
  }

  /**
   * Assert event sequence occurred in order.
   */
  assertEventSequence(expectedSequence: Array<{ source?: string; type: string }>): boolean {
    let eventIdx = 0;
    for (const expected of expectedSequence) {
      while (eventIdx < this.events.length) {
        const event = this.events[eventIdx];
        const sourceMatch = !expected.source || event.source === expected.source;
        const typeMatch = event.type === expected.type;
        
        if (sourceMatch && typeMatch) {
          eventIdx++;
          break;
        }
        eventIdx++;
      }
      
      if (eventIdx >= this.events.length) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clear all recorded events.
   */
  clear(): void {
    this.events = [];
    this.sequence = 0;
  }
}

// ============================================================================
// Mock Repository Monitor
// ============================================================================

/**
 * Mock repository monitor for testing.
 */
export class MockRepositoryMonitor extends EventEmitter {
  private repositories: Map<string, WatchedRepository> = new Map();
  private pendingChanges: RepositoryChange[] = [];
  private eventRecorder?: TestEventRecorder;

  constructor(eventRecorder?: TestEventRecorder) {
    super();
    this.eventRecorder = eventRecorder;
  }

  /**
   * Add a mock repository to watch.
   */
  addRepository(repo: WatchedRepository): void {
    this.repositories.set(repo.repositoryId, repo);
    this.eventRecorder?.record('MockRepositoryMonitor', 'repository-added', repo);
  }

  /**
   * Get watched repositories.
   */
  getRepositories(): WatchedRepository[] {
    return Array.from(this.repositories.values());
  }

  /**
   * Simulate detecting a change.
   */
  simulateChange(change: RepositoryChange): void {
    this.pendingChanges.push(change);
    this.eventRecorder?.record('MockRepositoryMonitor', 'change-detected', change);
    this.emit('change', change);
  }

  /**
   * Simulate version release.
   */
  simulateVersionRelease(repositoryId: string, fromVersion: string, toVersion: string): RepositoryChange {
    const change: RepositoryChange = {
      changeId: `change-${Date.now()}`,
      repositoryId,
      changeType: 'version-release',
      previousVersion: fromVersion,
      currentVersion: toVersion,
      detectedAt: new Date().toISOString(),
      summary: `Version ${toVersion} released (from ${fromVersion})`,
      status: 'detected'
    };
    this.simulateChange(change);
    return change;
  }

  /**
   * Simulate security advisory.
   */
  simulateSecurityAdvisory(repositoryId: string, cveId: string, severity: 'critical' | 'high' | 'medium' | 'low'): RepositoryChange {
    const change: RepositoryChange = {
      changeId: `change-${Date.now()}`,
      repositoryId,
      changeType: 'security-advisory',
      currentVersion: 'n/a',
      detectedAt: new Date().toISOString(),
      summary: `Security advisory ${cveId} (${severity})`,
      details: `CVE ${cveId} detected with ${severity} severity`,
      status: 'detected'
    };
    this.simulateChange(change);
    return change;
  }

  /**
   * Get pending changes.
   */
  getPendingChanges(): RepositoryChange[] {
    return [...this.pendingChanges];
  }

  /**
   * Clear pending changes.
   */
  clearPendingChanges(): void {
    this.pendingChanges = [];
  }

  /**
   * Start monitoring (mock).
   */
  async start(): Promise<void> {
    this.eventRecorder?.record('MockRepositoryMonitor', 'started', {});
    this.emit('started');
  }

  /**
   * Stop monitoring (mock).
   */
  async stop(): Promise<void> {
    this.eventRecorder?.record('MockRepositoryMonitor', 'stopped', {});
    this.emit('stopped');
  }
}

// ============================================================================
// Mock Semantic Diff Analyzer
// ============================================================================

/**
 * Mock semantic diff analyzer for testing.
 */
export class MockSemanticDiffAnalyzer {
  private analysisResults: Map<string, SemanticDiff> = new Map();
  private eventRecorder?: TestEventRecorder;

  constructor(eventRecorder?: TestEventRecorder) {
    this.eventRecorder = eventRecorder;
  }

  /**
   * Pre-configure analysis result for a change.
   */
  setAnalysisResult(changeId: string, diff: SemanticDiff): void {
    this.analysisResults.set(changeId, diff);
  }

  /**
   * Analyze a repository change.
   */
  async analyzeChange(change: RepositoryChange): Promise<SemanticDiff> {
    this.eventRecorder?.record('MockSemanticDiffAnalyzer', 'analyze-started', { changeId: change.changeId });

    // Check for pre-configured result
    const configured = this.analysisResults.get(change.changeId);
    if (configured) {
      this.eventRecorder?.record('MockSemanticDiffAnalyzer', 'analyze-completed', configured);
      return configured;
    }

    // Generate default mock analysis
    const diff: SemanticDiff = {
      diffId: `diff-${change.changeId}`,
      sourceId: change.repositoryId,
      fromVersion: change.previousVersion || '0.0.0',
      toVersion: change.currentVersion,
      impact: this.determineImpact(change),
      breakingChanges: [],
      additions: [],
      deprecations: [],
      removals: [],
      analyzedAt: new Date().toISOString()
    };

    // Add breaking changes for major version bumps
    if (change.changeType === 'version-release' && change.previousVersion) {
      const fromMajor = parseInt(change.previousVersion.split('.')[0].replace('v', ''));
      const toMajor = parseInt(change.currentVersion.split('.')[0].replace('v', ''));
      
      if (toMajor > fromMajor) {
        diff.breakingChanges.push({
          changeId: `breaking-${Date.now()}`,
          description: `Major version change from ${change.previousVersion} to ${change.currentVersion}`,
          severity: 'high'
        });
        diff.impact = 'significant';
      }
    }

    this.eventRecorder?.record('MockSemanticDiffAnalyzer', 'analyze-completed', diff);
    return diff;
  }

  private determineImpact(change: RepositoryChange): ImpactLevel {
    switch (change.changeType) {
      case 'security-advisory':
        return 'critical';
      case 'version-release':
        return 'moderate';
      case 'deprecation':
        return 'moderate';
      default:
        return 'minimal';
    }
  }

  /**
   * Create a context for pattern matching from semantic diff.
   */
  createPatternMatchContext(change: RepositoryChange, diff: SemanticDiff): PatternMatchContext {
    return {
      versionChange: change.previousVersion ? {
        from: change.previousVersion,
        to: change.currentVersion
      } : undefined,
      apiChanges: diff.apiChanges?.map(c => ({
        type: c.type,
        element: c.element,
        breaking: c.breaking
      })),
      deprecations: diff.deprecations.map(d => ({
        element: d.description,
        replacement: d.replacement
      })),
      schemaChanges: diff.schemaChanges,
      rawContent: change.details
    };
  }
}

// ============================================================================
// Mock Pattern Matcher
// ============================================================================

/**
 * Mock pattern matcher for testing.
 */
export class MockPatternMatcher {
  private patterns: Map<string, EvolutionaryPattern> = new Map();
  private matchResults: Map<string, PatternMatch[]> = new Map();
  private eventRecorder?: TestEventRecorder;

  constructor(eventRecorder?: TestEventRecorder) {
    this.eventRecorder = eventRecorder;
  }

  /**
   * Register a pattern.
   */
  registerPattern(pattern: EvolutionaryPattern): void {
    this.patterns.set(pattern.patternId, pattern);
    this.eventRecorder?.record('MockPatternMatcher', 'pattern-registered', { patternId: pattern.patternId });
  }

  /**
   * Pre-configure match results for a change.
   */
  setMatchResults(changeId: string, matches: PatternMatch[]): void {
    this.matchResults.set(changeId, matches);
  }

  /**
   * Match patterns against context.
   */
  async matchPatterns(context: PatternMatchContext, changeId?: string): Promise<PatternMatch[]> {
    this.eventRecorder?.record('MockPatternMatcher', 'match-started', { changeId, context });

    // Check for pre-configured results
    if (changeId && this.matchResults.has(changeId)) {
      const results = this.matchResults.get(changeId)!;
      this.eventRecorder?.record('MockPatternMatcher', 'match-completed', { changeId, matches: results });
      return results;
    }

    // Generate default matches based on context
    const matches: PatternMatch[] = [];

    // Check for version change pattern
    if (context.versionChange) {
      const from = context.versionChange.from;
      const to = context.versionChange.to;
      const fromMajor = parseInt(from.split('.')[0].replace('v', ''));
      const toMajor = parseInt(to.split('.')[0].replace('v', ''));

      if (toMajor > fromMajor) {
        matches.push({
          patternId: 'pattern-external-dependency-update',
          confidence: 0.9,
          evidence: [`Major version change: ${from} → ${to}`],
          recommendedStrategies: ['update-adapter-contract']
        });
      }
    }

    // Check for security advisory pattern
    if (context.securityAdvisories && context.securityAdvisories.length > 0) {
      const critical = context.securityAdvisories.filter(a => a.severity === 'critical' || a.severity === 'high');
      if (critical.length > 0) {
        matches.push({
          patternId: 'pattern-security-vulnerability-response',
          confidence: 0.95,
          evidence: [`${critical.length} critical/high security advisories`],
          recommendedStrategies: ['emergency-patch']
        });
      }
    }

    // Check for deprecation pattern
    if (context.deprecations && context.deprecations.length > 0) {
      matches.push({
        patternId: 'pattern-api-deprecation-cascade',
        confidence: 0.8,
        evidence: [`${context.deprecations.length} deprecations detected`],
        recommendedStrategies: ['gradual-migration']
      });
    }

    this.eventRecorder?.record('MockPatternMatcher', 'match-completed', { changeId, matches });
    return matches;
  }

  /**
   * Get registered patterns.
   */
  getPatterns(): EvolutionaryPattern[] {
    return Array.from(this.patterns.values());
  }
}

// ============================================================================
// Mock Adapter Modification Generator
// ============================================================================

/**
 * Mock adapter modification generator for testing.
 */
export class MockAdapterModificationGenerator {
  private proposals: Map<string, ChangeProposal> = new Map();
  private eventRecorder?: TestEventRecorder;

  constructor(eventRecorder?: TestEventRecorder) {
    this.eventRecorder = eventRecorder;
  }

  /**
   * Pre-configure a proposal for an analysis result.
   */
  setProposal(analysisId: string, proposal: ChangeProposal): void {
    this.proposals.set(analysisId, proposal);
  }

  /**
   * Generate modification proposal.
   */
  async generateProposal(analysis: AnalysisResult): Promise<ChangeProposal> {
    this.eventRecorder?.record('MockAdapterModificationGenerator', 'generate-started', { analysisId: analysis.analysisId });

    // Check for pre-configured proposal
    if (this.proposals.has(analysis.analysisId)) {
      const proposal = this.proposals.get(analysis.analysisId)!;
      this.eventRecorder?.record('MockAdapterModificationGenerator', 'generate-completed', proposal);
      return proposal;
    }

    // Generate default mock proposal
    const proposal: ChangeProposal = {
      proposalId: `proposal-${analysis.analysisId}`,
      title: `Auto-generated proposal for ${analysis.analysisId}`,
      description: `Proposal generated based on ${analysis.matchedPatterns.length} matched patterns`,
      fileChanges: this.generateMockFileChanges(analysis),
      rollbackProcedure: 'git revert HEAD',
      status: 'draft',
      generatedByAgentId: 'mock-generator',
      generatedAt: new Date().toISOString()
    };

    this.eventRecorder?.record('MockAdapterModificationGenerator', 'generate-completed', proposal);
    return proposal;
  }

  private generateMockFileChanges(analysis: AnalysisResult): FileChange[] {
    const changes: FileChange[] = [];
    
    for (const adapter of analysis.impactAssessment.affectedAdapters) {
      changes.push({
        filePath: `src/adapters/${adapter.protocol}-adapter.ts`,
        type: 'modify',
        newContent: `// Updated for ${analysis.analysisId}\n`,
        rationale: `Update ${adapter.protocol} adapter for compatibility`
      });
    }

    // Add at least one change if no adapters affected
    if (changes.length === 0) {
      changes.push({
        filePath: 'src/adapters/protocol-capabilities.ts',
        type: 'modify',
        newContent: '// Capability update\n',
        rationale: 'Update capability matrix'
      });
    }

    return changes;
  }

  /**
   * Validate a proposal.
   */
  async validateProposal(proposal: ChangeProposal): Promise<ValidationResult> {
    this.eventRecorder?.record('MockAdapterModificationGenerator', 'validate-started', { proposalId: proposal.proposalId });

    const result: ValidationResult = {
      validationId: `validation-${proposal.proposalId}`,
      proposalId: proposal.proposalId,
      valid: true,
      contractCompliance: {
        protocolTypesCompliant: true,
        unifiedAdapterCompliant: true,
        typeErrors: [],
        interfaceMismatches: []
      },
      issues: [],
      validatedByAgentId: 'mock-validator',
      validatedAt: new Date().toISOString()
    };

    this.eventRecorder?.record('MockAdapterModificationGenerator', 'validate-completed', result);
    return result;
  }
}

// ============================================================================
// Mock Adaptation Pipeline
// ============================================================================

/**
 * Mock adaptation pipeline for testing.
 */
export class MockAdaptationPipeline extends EventEmitter {
  private currentStage: PipelineStage = 'monitoring';
  private status: PipelineStatus = 'active';
  private eventRecorder?: TestEventRecorder;

  constructor(eventRecorder?: TestEventRecorder) {
    super();
    this.eventRecorder = eventRecorder;
  }

  /**
   * Get current stage.
   */
  getStage(): PipelineStage {
    return this.currentStage;
  }

  /**
   * Get pipeline status.
   */
  getStatus(): PipelineStatus {
    return this.status;
  }

  /**
   * Transition to a new stage.
   */
  async transitionTo(stage: PipelineStage): Promise<void> {
    const previousStage = this.currentStage;
    this.currentStage = stage;
    
    this.eventRecorder?.record('MockAdaptationPipeline', 'stage-transition', {
      from: previousStage,
      to: stage
    });

    this.emit('stage-transition', { from: previousStage, to: stage });
  }

  /**
   * Process a change through the pipeline.
   */
  async processChange(change: RepositoryChange): Promise<void> {
    this.eventRecorder?.record('MockAdaptationPipeline', 'process-started', { changeId: change.changeId });

    await this.transitionTo('analyzing');
    await this.simulateDelay(10);
    
    await this.transitionTo('generating');
    await this.simulateDelay(10);
    
    await this.transitionTo('validating');
    await this.simulateDelay(10);

    await this.transitionTo('awaiting-review');
    this.eventRecorder?.record('MockAdaptationPipeline', 'awaiting-review', { changeId: change.changeId });
  }

  /**
   * Approve and deploy a change.
   */
  async approveAndDeploy(): Promise<void> {
    await this.transitionTo('deploying');
    await this.simulateDelay(10);
    
    await this.transitionTo('completed');
    this.status = 'completed';
    this.eventRecorder?.record('MockAdaptationPipeline', 'completed', {});
  }

  /**
   * Reject a change.
   */
  async reject(reason: string): Promise<void> {
    this.status = 'failed';
    this.currentStage = 'failed';
    this.eventRecorder?.record('MockAdaptationPipeline', 'rejected', { reason });
    this.emit('rejected', { reason });
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Test fixture factory for creating test data.
 */
export class TestFixtureFactory {
  /**
   * Create a mock watched repository.
   */
  static createWatchedRepository(
    overrides: Partial<WatchedRepository> = {}
  ): WatchedRepository {
    return {
      repositoryId: `repo-${Date.now()}`,
      name: 'test-repository',
      type: 'git',
      url: 'https://github.com/test/test-repo',
      protocol: 'mcp',
      branch: 'main',
      pollIntervalMs: 60000,
      active: true,
      ...overrides
    };
  }

  /**
   * Create a mock repository change.
   */
  static createRepositoryChange(
    overrides: Partial<RepositoryChange> = {}
  ): RepositoryChange {
    return {
      changeId: `change-${Date.now()}`,
      repositoryId: 'test-repo',
      changeType: 'version-release',
      previousVersion: '1.0.0',
      currentVersion: '2.0.0',
      detectedAt: new Date().toISOString(),
      summary: 'Test version release',
      status: 'detected',
      ...overrides
    };
  }

  /**
   * Create a mock semantic diff.
   */
  static createSemanticDiff(
    overrides: Partial<SemanticDiff> = {}
  ): SemanticDiff {
    return {
      diffId: `diff-${Date.now()}`,
      sourceId: 'test-repo',
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      impact: 'moderate',
      breakingChanges: [],
      additions: [],
      deprecations: [],
      removals: [],
      analyzedAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create a mock analysis result.
   */
  static createAnalysisResult(
    overrides: Partial<AnalysisResult> = {}
  ): AnalysisResult {
    return {
      analysisId: `analysis-${Date.now()}`,
      semanticDiff: TestFixtureFactory.createSemanticDiff(),
      matchedPatterns: [],
      impactAssessment: {
        overallImpact: 'moderate',
        affectedAdapters: [],
        estimatedEffortHours: 2,
        riskLevel: 'medium',
        dependenciesAffected: [],
        testCoverageNeeded: []
      },
      recommendedActions: [],
      confidence: 0.8,
      analyzedAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create a mock change proposal.
   */
  static createChangeProposal(
    overrides: Partial<ChangeProposal> = {}
  ): ChangeProposal {
    return {
      proposalId: `proposal-${Date.now()}`,
      title: 'Test Proposal',
      description: 'Test proposal description',
      fileChanges: [],
      rollbackProcedure: 'git revert HEAD',
      status: 'draft',
      generatedByAgentId: 'test-generator',
      generatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create a mock evolutionary pattern.
   */
  static createEvolutionaryPattern(
    overrides: Partial<EvolutionaryPattern> = {}
  ): EvolutionaryPattern {
    return {
      patternId: `pattern-${Date.now()}`,
      patternName: 'Test Pattern',
      category: 'dependency-management',
      description: 'Test pattern description',
      version: '1.0.0',
      detectionHeuristics: [],
      triggerConditions: [],
      anticipatoryStructures: [],
      remediationStrategies: [],
      severity: 'medium',
      frequency: 'monthly',
      automationLevel: 'semi-automatic',
      confidence: 0.8,
      examples: [],
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create a mock pattern match.
   */
  static createPatternMatch(
    overrides: Partial<PatternMatch> = {}
  ): PatternMatch {
    return {
      patternId: 'pattern-external-dependency-update',
      confidence: 0.85,
      evidence: ['Test evidence'],
      recommendedStrategies: ['update-adapter-contract'],
      ...overrides
    };
  }

  /**
   * Create a version change context.
   */
  static createVersionChangeContext(
    fromVersion: string,
    toVersion: string
  ): PatternMatchContext {
    return {
      versionChange: { from: fromVersion, to: toVersion }
    };
  }

  /**
   * Create a security advisory context.
   */
  static createSecurityAdvisoryContext(
    cveId: string,
    severity: 'critical' | 'high' | 'medium' | 'low'
  ): PatternMatchContext {
    return {
      securityAdvisories: [{
        id: cveId,
        severity,
        description: `Security vulnerability ${cveId}`
      }]
    };
  }
}

// ============================================================================
// Test Assertions
// ============================================================================

/**
 * Custom assertion helpers for integration tests.
 */
export class TestAssertions {
  /**
   * Assert that an event was recorded.
   */
  static assertEventRecorded(
    recorder: TestEventRecorder,
    source: string,
    type: string
  ): void {
    const events = recorder.getEventsBySource(source);
    const found = events.find(e => e.type === type);
    if (!found) {
      throw new Error(`Expected event '${type}' from '${source}' was not recorded`);
    }
  }

  /**
   * Assert event sequence.
   */
  static assertEventSequence(
    recorder: TestEventRecorder,
    sequence: Array<{ source?: string; type: string }>
  ): void {
    if (!recorder.assertEventSequence(sequence)) {
      const recorded = recorder.getEvents().map(e => `${e.source}:${e.type}`).join(' -> ');
      const expected = sequence.map(s => `${s.source || '*'}:${s.type}`).join(' -> ');
      throw new Error(`Event sequence mismatch.\nExpected: ${expected}\nRecorded: ${recorded}`);
    }
  }

  /**
   * Assert pipeline stage.
   */
  static assertPipelineStage(pipeline: MockAdaptationPipeline, expectedStage: PipelineStage): void {
    const actualStage = pipeline.getStage();
    if (actualStage !== expectedStage) {
      throw new Error(`Expected pipeline stage '${expectedStage}', but got '${actualStage}'`);
    }
  }

  /**
   * Assert pattern matched.
   */
  static assertPatternMatched(matches: PatternMatch[], patternId: string): PatternMatch {
    const match = matches.find(m => m.patternId === patternId);
    if (!match) {
      throw new Error(`Expected pattern '${patternId}' to match, but it was not found`);
    }
    return match;
  }

  /**
   * Assert confidence threshold.
   */
  static assertConfidenceAbove(match: PatternMatch, threshold: number): void {
    if (match.confidence < threshold) {
      throw new Error(
        `Expected confidence above ${threshold}, but got ${match.confidence} for pattern ${match.patternId}`
      );
    }
  }

  /**
   * Assert change proposal valid.
   */
  static assertProposalValid(validation: ValidationResult): void {
    if (!validation.valid) {
      const issues = validation.issues.map(i => `${i.severity}: ${i.message}`).join(', ');
      throw new Error(`Proposal validation failed: ${issues}`);
    }
  }

  /**
   * Assert file change present.
   */
  static assertFileChangePresent(
    proposal: ChangeProposal,
    filePath: string,
    changeType?: 'create' | 'modify' | 'delete'
  ): void {
    const change = proposal.fileChanges.find(c => c.filePath === filePath);
    if (!change) {
      throw new Error(`Expected file change for '${filePath}' not found in proposal`);
    }
    if (changeType && change.type !== changeType) {
      throw new Error(`Expected change type '${changeType}', but got '${change.type}' for ${filePath}`);
    }
  }
}

// ============================================================================
// Integration Test Harness
// ============================================================================

/**
 * Complete integration test harness.
 */
export interface IntegrationTestContext {
  eventRecorder: TestEventRecorder;
  repositoryMonitor: MockRepositoryMonitor;
  semanticDiffAnalyzer: MockSemanticDiffAnalyzer;
  patternMatcher: MockPatternMatcher;
  modificationGenerator: MockAdapterModificationGenerator;
  pipeline: MockAdaptationPipeline;
}

/**
 * Create a complete integration test context.
 */
export function createTestContext(): IntegrationTestContext {
  const eventRecorder = new TestEventRecorder();
  
  return {
    eventRecorder,
    repositoryMonitor: new MockRepositoryMonitor(eventRecorder),
    semanticDiffAnalyzer: new MockSemanticDiffAnalyzer(eventRecorder),
    patternMatcher: new MockPatternMatcher(eventRecorder),
    modificationGenerator: new MockAdapterModificationGenerator(eventRecorder),
    pipeline: new MockAdaptationPipeline(eventRecorder)
  };
}

/**
 * Reset all components in a test context.
 */
export function resetTestContext(context: IntegrationTestContext): void {
  context.eventRecorder.clear();
  context.repositoryMonitor.clearPendingChanges();
}

// ============================================================================
// Default Exports
// ============================================================================

export default {
  TestEventRecorder,
  MockRepositoryMonitor,
  MockSemanticDiffAnalyzer,
  MockPatternMatcher,
  MockAdapterModificationGenerator,
  MockAdaptationPipeline,
  TestFixtureFactory,
  TestAssertions,
  createTestContext,
  resetTestContext
};
