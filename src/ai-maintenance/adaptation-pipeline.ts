/**
 * Adaptation Pipeline for AI-Led Adaptive Maintenance
 * 
 * Orchestrates the full adaptation workflow from change detection through
 * staged review and deployment. Implements the 5-stage pipeline:
 * Detect → Analyze → Generate → Validate → Deploy
 * 
 * @module ai-maintenance/adaptation-pipeline
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import {
  AdaptationPipeline,
  PipelineStage,
  PipelineStatus,
  StageTransition,
  RepositoryChange,
  AnalysisResult,
  ChangeProposal,
  ValidationResult,
  DeploymentResult,
  PipelineError,
  PatternMatch,
  SemanticDiff,
  ImpactAssessment,
  RecommendedAction,
  ComplianceCheck,
  TestRunResult,
  DeploymentStage,
  ProposalStatus,
} from './types';
import { RepositoryMonitor, createProtocolRepository } from './repository-monitor';
import { SemanticDiffAnalyzer, createSemanticDiffAnalyzer, ExtendedAnalysisResult } from './semantic-diff-analyzer';
import { AdapterModificationGenerator, createModificationGenerator, GenerationResult } from './adapter-modification-generator';
import { matchPatterns, PatternMatchContext } from './evolutionary-patterns';
import { AgentFramework } from '../adapters/protocol-types';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the adaptation pipeline
 */
export interface PipelineConfig {
  /** Auto-approve proposals below this impact score */
  autoApprovalThreshold: number;
  /** Require human approval for proposals above this impact score */
  humanApprovalThreshold: number;
  /** Maximum concurrent pipelines */
  maxConcurrentPipelines: number;
  /** Pipeline timeout in milliseconds */
  pipelineTimeoutMs: number;
  /** Enable dry-run mode (no actual deployments) */
  dryRun: boolean;
  /** Deployment strategy */
  deploymentStrategy: 'direct' | 'canary' | 'blue-green';
  /** Canary percentage (if using canary deployment) */
  canaryPercentage: number;
  /** Enable automatic rollback on failure */
  autoRollback: boolean;
  /** Notification webhook URL */
  notificationWebhook?: string;
  /** Git configuration */
  git: GitConfig;
}

/**
 * Git configuration for deployments
 */
export interface GitConfig {
  /** Remote name */
  remote: string;
  /** Target branch for PRs */
  targetBranch: string;
  /** Branch prefix for generated changes */
  branchPrefix: string;
  /** Commit message template */
  commitTemplate: string;
  /** Create PR instead of direct push */
  createPullRequest: boolean;
}

/**
 * Pipeline event types
 */
export interface PipelineEvents {
  'pipeline:created': (pipeline: AdaptationPipeline) => void;
  'pipeline:stage-changed': (pipeline: AdaptationPipeline, transition: StageTransition) => void;
  'pipeline:completed': (pipeline: AdaptationPipeline) => void;
  'pipeline:failed': (pipeline: AdaptationPipeline, error: PipelineError) => void;
  'pipeline:approval-required': (pipeline: AdaptationPipeline, proposal: ChangeProposal) => void;
  'change:detected': (change: RepositoryChange) => void;
  'analysis:completed': (result: AnalysisResult) => void;
  'proposal:generated': (proposal: ChangeProposal) => void;
  'validation:completed': (result: ValidationResult) => void;
  'deployment:completed': (result: DeploymentResult) => void;
}

/**
 * Human review decision
 */
export interface ReviewDecision {
  approved: boolean;
  reviewerId: string;
  comments?: string;
  modifications?: string[];
  timestamp: string;
}

/**
 * Pipeline orchestrator state
 */
export interface OrchestratorState {
  activePipelines: Map<string, AdaptationPipeline>;
  pendingApprovals: Map<string, ChangeProposal>;
  completedPipelines: AdaptationPipeline[];
  statistics: PipelineStatistics;
}

/**
 * Pipeline statistics
 */
export interface PipelineStatistics {
  totalPipelinesRun: number;
  successfulPipelines: number;
  failedPipelines: number;
  averageDurationMs: number;
  autoApprovedCount: number;
  humanApprovedCount: number;
  rejectedCount: number;
  rollbackCount: number;
}

// ============================================================================
// Pipeline Orchestrator Implementation
// ============================================================================

/**
 * Orchestrates the full adaptation pipeline
 */
export class AdaptationPipelineOrchestrator extends EventEmitter {
  private config: PipelineConfig;
  private state: OrchestratorState;
  private repositoryMonitor: RepositoryMonitor;
  private semanticAnalyzer: SemanticDiffAnalyzer;
  private modificationGenerator: AdapterModificationGenerator;
  private pipelineIdCounter = 0;

  constructor(config: Partial<PipelineConfig> = {}) {
    super();
    
    this.config = {
      autoApprovalThreshold: 0.3,
      humanApprovalThreshold: 0.7,
      maxConcurrentPipelines: 3,
      pipelineTimeoutMs: 30 * 60 * 1000, // 30 minutes
      dryRun: false,
      deploymentStrategy: 'direct',
      canaryPercentage: 10,
      autoRollback: true,
      git: {
        remote: 'origin',
        targetBranch: 'main',
        branchPrefix: 'ai-adapt/',
        commitTemplate: 'chore(adapters): {{title}}\n\n{{description}}\n\nGenerated by AI-Led Adaptive Maintenance System',
        createPullRequest: true,
      },
      ...config,
    };

    this.state = {
      activePipelines: new Map(),
      pendingApprovals: new Map(),
      completedPipelines: [],
      statistics: {
        totalPipelinesRun: 0,
        successfulPipelines: 0,
        failedPipelines: 0,
        averageDurationMs: 0,
        autoApprovedCount: 0,
        humanApprovedCount: 0,
        rejectedCount: 0,
        rollbackCount: 0,
      },
    };

    // Initialize components
    this.repositoryMonitor = new RepositoryMonitor();
    this.semanticAnalyzer = createSemanticDiffAnalyzer();
    this.modificationGenerator = createModificationGenerator();

    // Set up repository monitor event handling
    this.repositoryMonitor.on('change', (change: RepositoryChange) => {
      this.handleRepositoryChange(change);
    });
  }

  /**
   * Start the pipeline orchestrator
   */
  start(): void {
    this.repositoryMonitor.start();
  }

  /**
   * Stop the pipeline orchestrator
   */
  stop(): void {
    this.repositoryMonitor.stop();
  }

  /**
   * Add a repository to monitor
   */
  addRepository(protocol: AgentFramework): void {
    const repo = createProtocolRepository(protocol);
    if (repo) {
      this.repositoryMonitor.addRepository(repo);
    }
  }

  /**
   * Handle a detected repository change
   */
  private async handleRepositoryChange(change: RepositoryChange): Promise<void> {
    this.emit('change:detected', change);

    // Check concurrent pipeline limit
    if (this.state.activePipelines.size >= this.config.maxConcurrentPipelines) {
      console.warn(`Max concurrent pipelines (${this.config.maxConcurrentPipelines}) reached, queuing change`);
      return;
    }

    // Create and run pipeline
    const pipeline = await this.createPipeline(change);
    await this.runPipeline(pipeline);
  }

  /**
   * Create a new adaptation pipeline
   */
  private async createPipeline(change: RepositoryChange): Promise<AdaptationPipeline> {
    const pipelineId = `pipeline-${Date.now()}-${++this.pipelineIdCounter}`;
    
    const pipeline: AdaptationPipeline = {
      pipelineId,
      triggeringChange: change,
      currentStage: 'monitoring',
      stageHistory: [],
      status: 'active',
      startedAt: new Date().toISOString(),
    };

    this.state.activePipelines.set(pipelineId, pipeline);
    this.state.statistics.totalPipelinesRun++;
    
    this.emit('pipeline:created', pipeline);
    
    return pipeline;
  }

  /**
   * Run the full pipeline
   */
  private async runPipeline(pipeline: AdaptationPipeline): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Pipeline timeout')), this.config.pipelineTimeoutMs);
    });

    try {
      await Promise.race([
        this.executePipelineStages(pipeline),
        timeoutPromise,
      ]);
    } catch (error) {
      await this.handlePipelineFailure(pipeline, error);
    }
  }

  /**
   * Execute pipeline stages sequentially
   */
  private async executePipelineStages(pipeline: AdaptationPipeline): Promise<void> {
    // Stage 1: Analyze
    await this.transitionStage(pipeline, 'analyzing');
    const analysis = await this.executeAnalysisStage(pipeline);
    pipeline.analysis = analysis;
    this.emit('analysis:completed', analysis);

    // Stage 2: Generate
    await this.transitionStage(pipeline, 'generating');
    const proposal = await this.executeGenerationStage(pipeline, analysis);
    pipeline.proposal = proposal;
    this.emit('proposal:generated', proposal);

    // Stage 3: Validate
    await this.transitionStage(pipeline, 'validating');
    const validation = await this.executeValidationStage(pipeline, proposal);
    pipeline.validation = validation;
    this.emit('validation:completed', validation);

    // Check if approval is needed
    const impactScore = analysis.impactAssessment.overallImpact === 'critical' ? 1.0 :
                       analysis.impactAssessment.overallImpact === 'significant' ? 0.8 :
                       analysis.impactAssessment.overallImpact === 'moderate' ? 0.5 :
                       analysis.impactAssessment.overallImpact === 'minimal' ? 0.2 : 0;

    if (impactScore > this.config.humanApprovalThreshold) {
      // Requires human approval
      await this.transitionStage(pipeline, 'awaiting-review');
      this.state.pendingApprovals.set(pipeline.pipelineId, proposal);
      this.emit('pipeline:approval-required', pipeline, proposal);
      return; // Wait for manual approval
    } else if (impactScore <= this.config.autoApprovalThreshold && validation.valid) {
      // Auto-approve
      this.state.statistics.autoApprovedCount++;
    }

    // Stage 4: Deploy
    await this.transitionStage(pipeline, 'deploying');
    const deployment = await this.executeDeploymentStage(pipeline, proposal);
    pipeline.deployment = deployment;
    this.emit('deployment:completed', deployment);

    // Complete
    await this.transitionStage(pipeline, 'completed');
    await this.completePipeline(pipeline);
  }

  /**
   * Execute analysis stage
   */
  private async executeAnalysisStage(pipeline: AdaptationPipeline): Promise<AnalysisResult> {
    const change = pipeline.triggeringChange;

    // Run semantic diff analysis
    const extendedAnalysis = await this.semanticAnalyzer.analyzeChange(change);

    // Build pattern match context from change and analysis
    const matchContext: PatternMatchContext = {
      // Version change information
      versionChange: change.previousVersion && change.currentVersion ? {
        from: change.previousVersion,
        to: change.currentVersion,
      } : undefined,
      // API changes from semantic analysis - map to simple string elements
      apiChanges: extendedAnalysis.apiSurfaceChanges ? [
        ...extendedAnalysis.apiSurfaceChanges.removed.map(item => ({
          type: 'removed',
          element: item.name, // APISignature.name is string
          breaking: true,
        })),
        ...extendedAnalysis.apiSurfaceChanges.modified.map(item => ({
          type: 'modified',
          element: item.after.name, // APIModification.after.name is string
          breaking: item.isBreaking,
        })),
      ] : undefined,
      // Schema changes from semantic diff (not schemaComparison)
      schemaChanges: extendedAnalysis.semanticDiff.schemaChanges?.map(sc => ({
        type: sc.type,
        fieldPath: sc.fieldPath,
        requiredChange: sc.requiredChange,
      })),
      // Additional context
      additional: {
        repositoryId: change.repositoryId,
        changeType: change.changeType,
        changedPaths: change.changedPaths,
        detectedAt: change.detectedAt,
      },
    };
    const patterns = matchPatterns(matchContext);

    // Build impact assessment
    const impactAssessment = this.buildImpactAssessment(extendedAnalysis, patterns);

    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(extendedAnalysis, patterns);

    return {
      analysisId: `analysis-${pipeline.pipelineId}`,
      semanticDiff: extendedAnalysis.semanticDiff,
      matchedPatterns: patterns,
      impactAssessment,
      recommendedActions,
      confidence: this.calculateAnalysisConfidence(extendedAnalysis, patterns),
      analyzedAt: new Date().toISOString(),
      agentId: 'semantic-diff-analyzer-v1',
    };
  }

  /**
   * Execute generation stage
   */
  private async executeGenerationStage(
    pipeline: AdaptationPipeline,
    analysis: AnalysisResult
  ): Promise<ChangeProposal> {
    const change = pipeline.triggeringChange;
    
    // Determine affected protocol
    const protocol = this.getProtocolFromRepository(change.repositoryId);

    // Get adapter files for the protocol
    const adapterFiles = await this.getAdapterFiles(protocol);

    // Get existing content
    const existingContent = await this.getExistingContent(adapterFiles);

    // Create extended analysis result for generator
    const extendedAnalysis = await this.semanticAnalyzer.analyzeChange(change);

    // Generate proposal
    const result = await this.modificationGenerator.generateProposal({
      protocol,
      analysis: extendedAnalysis,
      patterns: analysis.matchedPatterns,
      adapterFiles,
      existingContent,
    });

    if (!result.success || !result.proposal) {
      throw new Error('Failed to generate change proposal: ' + result.errors.map(e => e.message).join(', '));
    }

    return result.proposal;
  }

  /**
   * Execute validation stage
   */
  private async executeValidationStage(
    pipeline: AdaptationPipeline,
    proposal: ChangeProposal
  ): Promise<ValidationResult> {
    const issues: Array<{ severity: 'error' | 'warning' | 'info'; type: string; message: string }> = [];

    // Check type compliance
    const complianceCheck = await this.checkTypeCompliance(proposal);
    if (!complianceCheck.protocolTypesCompliant) {
      issues.push({
        severity: 'error',
        type: 'type-error',
        message: `Protocol types non-compliant: ${complianceCheck.typeErrors.join(', ')}`,
      });
    }

    // Run tests if available
    const testResults = this.config.dryRun ? [] : await this.runTests(proposal);
    const failedTests = testResults.filter(t => t.failed > 0);
    if (failedTests.length > 0) {
      issues.push({
        severity: 'error',
        type: 'test-failure',
        message: `${failedTests.length} test suite(s) failed`,
      });
    }

    // Security scan (placeholder)
    const securityScan = {
      passed: true,
      vulnerabilities: [],
      scanner: 'placeholder',
      scannedAt: new Date().toISOString(),
    };

    // Determine if valid
    const hasErrors = issues.some(i => i.severity === 'error');

    return {
      validationId: `validation-${pipeline.pipelineId}`,
      proposalId: proposal.proposalId,
      valid: !hasErrors,
      contractCompliance: complianceCheck,
      testResults,
      securityScan,
      issues,
      validatedByAgentId: 'validation-agent-v1',
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Execute deployment stage
   */
  private async executeDeploymentStage(
    pipeline: AdaptationPipeline,
    proposal: ChangeProposal
  ): Promise<DeploymentResult> {
    const stages: DeploymentStage[] = [];
    const strategy = this.config.deploymentStrategy;

    if (this.config.dryRun) {
      return {
        deploymentId: `deployment-${pipeline.pipelineId}`,
        proposalId: proposal.proposalId,
        status: 'success',
        strategy: 'direct',
        stages: [{
          name: 'dry-run',
          status: 'success',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          output: 'Dry run - no changes applied',
        }],
        deployedAt: new Date().toISOString(),
        rollbackAvailable: false,
      };
    }

    // Stage 1: Create branch
    stages.push(await this.executeDeploymentStep('create-branch', async () => {
      const branchName = `${this.config.git.branchPrefix}${proposal.proposalId}`;
      // In real implementation, would use git operations
      return `Branch ${branchName} created`;
    }));

    // Stage 2: Apply changes
    stages.push(await this.executeDeploymentStep('apply-changes', async () => {
      // Apply file changes
      for (const change of proposal.fileChanges) {
        // In real implementation, would write to filesystem
        console.log(`Would apply change to ${change.filePath}`);
      }
      return `${proposal.fileChanges.length} file(s) modified`;
    }));

    // Stage 3: Commit
    stages.push(await this.executeDeploymentStep('commit', async () => {
      const message = this.config.git.commitTemplate
        .replace('{{title}}', proposal.title)
        .replace('{{description}}', proposal.description);
      return `Committed with message: ${message.split('\n')[0]}`;
    }));

    // Stage 4: Create PR or push
    if (this.config.git.createPullRequest) {
      stages.push(await this.executeDeploymentStep('create-pr', async () => {
        // In real implementation, would create GitHub PR
        return `PR created for ${proposal.title}`;
      }));
    } else {
      stages.push(await this.executeDeploymentStep('push', async () => {
        return `Pushed to ${this.config.git.targetBranch}`;
      }));
    }

    // Check if any stage failed
    const failedStage = stages.find(s => s.status === 'failed');

    return {
      deploymentId: `deployment-${pipeline.pipelineId}`,
      proposalId: proposal.proposalId,
      status: failedStage ? 'failed' : 'success',
      strategy,
      stages,
      pullRequestUrl: this.config.git.createPullRequest ? `https://github.com/org/repo/pull/123` : undefined,
      deployedAt: new Date().toISOString(),
      rollbackAvailable: true,
    };
  }

  /**
   * Execute a single deployment step
   */
  private async executeDeploymentStep(
    name: string,
    action: () => Promise<string>
  ): Promise<DeploymentStage> {
    const startedAt = new Date().toISOString();
    
    try {
      const output = await action();
      return {
        name,
        status: 'success',
        startedAt,
        completedAt: new Date().toISOString(),
        output,
      };
    } catch (error) {
      return {
        name,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Transition pipeline to a new stage
   */
  private async transitionStage(pipeline: AdaptationPipeline, toStage: PipelineStage): Promise<void> {
    const transition: StageTransition = {
      fromStage: pipeline.currentStage,
      toStage,
      timestamp: new Date().toISOString(),
      triggeredBy: 'orchestrator',
    };

    pipeline.stageHistory.push(transition);
    pipeline.currentStage = toStage;
    
    // Update the pipeline in state
    this.state.activePipelines.set(pipeline.pipelineId, pipeline);
    
    this.emit('pipeline:stage-changed', pipeline, transition);
  }

  /**
   * Handle pipeline failure
   */
  private async handlePipelineFailure(pipeline: AdaptationPipeline, error: unknown): Promise<void> {
    const pipelineError: PipelineError = {
      code: 'PIPELINE_FAILED',
      message: error instanceof Error ? error.message : String(error),
      stage: pipeline.currentStage,
      stack: error instanceof Error ? error.stack : undefined,
      retryable: false,
    };

    pipeline.error = pipelineError;
    pipeline.status = 'failed';
    pipeline.completedAt = new Date().toISOString();

    this.state.activePipelines.delete(pipeline.pipelineId);
    this.state.completedPipelines.push(pipeline);
    this.state.statistics.failedPipelines++;

    // Auto-rollback if enabled and deployment was attempted
    if (this.config.autoRollback && pipeline.deployment) {
      await this.rollback(pipeline);
    }

    this.emit('pipeline:failed', pipeline, pipelineError);
  }

  /**
   * Complete a successful pipeline
   */
  private async completePipeline(pipeline: AdaptationPipeline): Promise<void> {
    pipeline.status = 'completed';
    pipeline.completedAt = new Date().toISOString();

    this.state.activePipelines.delete(pipeline.pipelineId);
    this.state.completedPipelines.push(pipeline);
    this.state.statistics.successfulPipelines++;

    // Update average duration
    const duration = new Date(pipeline.completedAt).getTime() - new Date(pipeline.startedAt).getTime();
    const totalDuration = this.state.statistics.averageDurationMs * (this.state.statistics.totalPipelinesRun - 1) + duration;
    this.state.statistics.averageDurationMs = totalDuration / this.state.statistics.totalPipelinesRun;

    this.emit('pipeline:completed', pipeline);
  }

  /**
   * Submit a human review decision
   */
  async submitReview(pipelineId: string, decision: ReviewDecision): Promise<void> {
    const pipeline = this.state.activePipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    if (pipeline.currentStage !== 'awaiting-review') {
      throw new Error(`Pipeline ${pipelineId} is not awaiting review`);
    }

    this.state.pendingApprovals.delete(pipelineId);

    if (decision.approved) {
      this.state.statistics.humanApprovedCount++;
      
      // Add review notes to proposal
      if (pipeline.proposal && decision.comments) {
        pipeline.proposal.reviewNotes = pipeline.proposal.reviewNotes || [];
        pipeline.proposal.reviewNotes.push(decision.comments);
      }

      // Continue to deployment
      await this.transitionStage(pipeline, 'deploying');
      const deployment = await this.executeDeploymentStage(pipeline, pipeline.proposal!);
      pipeline.deployment = deployment;
      this.emit('deployment:completed', deployment);

      await this.transitionStage(pipeline, 'completed');
      await this.completePipeline(pipeline);
    } else {
      this.state.statistics.rejectedCount++;
      pipeline.status = 'cancelled';
      pipeline.completedAt = new Date().toISOString();
      
      this.state.activePipelines.delete(pipelineId);
      this.state.completedPipelines.push(pipeline);
    }
  }

  /**
   * Rollback a deployment
   */
  async rollback(pipeline: AdaptationPipeline): Promise<void> {
    if (!pipeline.deployment || !pipeline.deployment.rollbackAvailable) {
      throw new Error('Rollback not available for this pipeline');
    }

    this.state.statistics.rollbackCount++;
    
    // In real implementation, would revert git changes
    console.log(`Rolling back deployment ${pipeline.deployment.deploymentId}`);
    
    pipeline.deployment.status = 'rolled-back';
    
    if (pipeline.proposal) {
      pipeline.proposal.status = 'rolled-back';
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private buildImpactAssessment(analysis: ExtendedAnalysisResult, patterns: PatternMatch[]): ImpactAssessment {
    // Calculate overall impact level
    let overallImpact: 'none' | 'minimal' | 'moderate' | 'significant' | 'critical' = 'none';
    const breakingCount = analysis.semanticDiff.breakingChanges.length;
    
    if (breakingCount > 5) overallImpact = 'critical';
    else if (breakingCount > 2) overallImpact = 'significant';
    else if (breakingCount > 0) overallImpact = 'moderate';
    else if (analysis.apiSurfaceChanges.modified.length > 0) overallImpact = 'minimal';

    return {
      overallImpact,
      affectedAdapters: analysis.affectedAdapters.map(adapter => ({
        protocol: adapter as AgentFramework,
        impact: overallImpact,
        requiredChanges: analysis.recommendedActions,
        filesAffected: [],
      })),
      estimatedEffortHours: breakingCount * 2 + patterns.length,
      riskLevel: breakingCount > 2 ? 'high' : breakingCount > 0 ? 'medium' : 'low',
      dependenciesAffected: [],
      testCoverageNeeded: ['unit', 'integration'],
    };
  }

  private generateRecommendedActions(analysis: ExtendedAnalysisResult, patterns: PatternMatch[]): RecommendedAction[] {
    const actions: RecommendedAction[] = [];
    let priority = 1;

    // Add actions from analysis
    analysis.recommendedActions.forEach(action => {
      actions.push({
        actionId: `action-${priority}`,
        type: 'modify-file',
        priority: priority++,
        description: action,
        automatable: true,
        estimatedMinutes: 15,
      });
    });

    // Add pattern-specific actions
    patterns.forEach(pattern => {
      pattern.recommendedStrategies.forEach(strategy => {
        actions.push({
          actionId: `pattern-action-${priority}`,
          type: 'modify-file',
          priority: priority++,
          description: `Apply strategy: ${strategy} for pattern ${pattern.patternId}`,
          automatable: true,
          estimatedMinutes: 30,
        });
      });
    });

    return actions;
  }

  private calculateAnalysisConfidence(analysis: ExtendedAnalysisResult, patterns: PatternMatch[]): number {
    // Base confidence on pattern match quality and analysis completeness
    const patternConfidence = patterns.length > 0 
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length 
      : 0.5;
    
    const analysisConfidence = analysis.impactScore < 0.5 ? 0.9 : 0.7;
    
    return (patternConfidence + analysisConfidence) / 2;
  }

  private getProtocolFromRepository(repositoryId: string): AgentFramework {
    const repoToProtocol: Record<string, AgentFramework> = {
      'modelcontextprotocol/typescript-sdk': 'mcp',
      'anthropics/anthropic-sdk-npm': 'mcp',
      'google/a2a-sdk': 'a2a',
      'agent-network-protocol/anp-sdk': 'anp',
      'langchain-ai/langchainjs': 'langchain',
      'microsoft/semantic-kernel': 'semantic-kernel',
      'openai/openai-node': 'openai',
    };
    
    return repoToProtocol[repositoryId] || 'usa';
  }

  private async getAdapterFiles(protocol: AgentFramework): Promise<string[]> {
    // In real implementation, would scan filesystem
    return [
      `src/adapters/${protocol}-adapter.ts`,
      `src/adapters/${protocol}-client.ts`,
    ];
  }

  private async getExistingContent(files: string[]): Promise<Map<string, string>> {
    const content = new Map<string, string>();
    // In real implementation, would read from filesystem
    for (const file of files) {
      content.set(file, '// Existing adapter content');
    }
    return content;
  }

  private async checkTypeCompliance(proposal: ChangeProposal): Promise<ComplianceCheck> {
    // In real implementation, would run TypeScript compiler
    return {
      protocolTypesCompliant: true,
      unifiedAdapterCompliant: true,
      typeErrors: [],
      interfaceMismatches: [],
    };
  }

  private async runTests(proposal: ChangeProposal): Promise<TestRunResult[]> {
    // In real implementation, would run Jest/test runner
    return [{
      suiteName: 'adapter-tests',
      passed: 10,
      failed: 0,
      skipped: 2,
      durationMs: 5000,
    }];
  }

  /**
   * Get current pipeline statistics
   */
  getStatistics(): PipelineStatistics {
    return { ...this.state.statistics };
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals(): ChangeProposal[] {
    return Array.from(this.state.pendingApprovals.values());
  }

  /**
   * Get active pipelines
   */
  getActivePipelines(): AdaptationPipeline[] {
    return Array.from(this.state.activePipelines.values());
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a pre-configured pipeline orchestrator
 */
export function createPipelineOrchestrator(
  config?: Partial<PipelineConfig>
): AdaptationPipelineOrchestrator {
  return new AdaptationPipelineOrchestrator(config);
}

/**
 * Create and start a pipeline orchestrator with default protocol monitors
 */
export function createAndStartOrchestrator(
  protocols: AgentFramework[],
  config?: Partial<PipelineConfig>
): AdaptationPipelineOrchestrator {
  const orchestrator = createPipelineOrchestrator(config);
  
  protocols.forEach(protocol => {
    orchestrator.addRepository(protocol);
  });
  
  orchestrator.start();
  
  return orchestrator;
}
