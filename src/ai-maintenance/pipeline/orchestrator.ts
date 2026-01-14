/**
 * Adaptation Pipeline Orchestrator
 * 
 * Orchestrates the full adaptation workflow from change detection through
 * staged review and deployment. Implements the 5-stage pipeline:
 * Detect → Analyze → Generate → Validate → Deploy
 * 
 * @module ai-maintenance/pipeline/orchestrator
 */

import { EventEmitter } from 'events';
import {
  AdaptationPipeline,
  PipelineStage,
  StageTransition,
  RepositoryChange,
  AnalysisResult,
  ChangeProposal,
  ValidationResult,
  DeploymentResult,
  PipelineError,
  ImpactAssessment,
} from '../types';
import { RepositoryMonitor, createProtocolRepository } from '../repository-monitor';
import { createSemanticDiffAnalyzer } from '../semantic-diff-analyzer';
import { createModificationGenerator } from '../adapter-modification-generator';
import { AgentFramework } from '../../adapters/protocol-types';
import {
  PipelineConfig,
  ReviewDecision,
  OrchestratorState,
  PipelineStatistics,
  DEFAULT_PIPELINE_CONFIG,
  createInitialState,
} from './types';
import {
  AnalysisStageExecutor,
  GenerationStageExecutor,
  ValidationStageExecutor,
  DeploymentStageExecutor,
} from './stages';

/**
 * Orchestrates the full adaptation pipeline
 */
export class AdaptationPipelineOrchestrator extends EventEmitter {
  private config: PipelineConfig;
  private state: OrchestratorState;
  private repositoryMonitor: RepositoryMonitor;
  private analysisExecutor: AnalysisStageExecutor;
  private generationExecutor: GenerationStageExecutor;
  private validationExecutor: ValidationStageExecutor;
  private deploymentExecutor: DeploymentStageExecutor;
  private pipelineIdCounter = 0;

  constructor(config: Partial<PipelineConfig> = {}) {
    super();
    
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.state = createInitialState();

    const semanticAnalyzer = createSemanticDiffAnalyzer();
    const modificationGenerator = createModificationGenerator();

    this.repositoryMonitor = new RepositoryMonitor();
    this.analysisExecutor = new AnalysisStageExecutor(semanticAnalyzer);
    this.generationExecutor = new GenerationStageExecutor(semanticAnalyzer, modificationGenerator);
    this.validationExecutor = new ValidationStageExecutor(this.config);
    this.deploymentExecutor = new DeploymentStageExecutor(this.config);

    this.repositoryMonitor.on('change', (change: RepositoryChange) => {
      this.handleRepositoryChange(change);
    });
  }

  start(): void {
    this.repositoryMonitor.start();
  }

  stop(): void {
    this.repositoryMonitor.stop();
  }

  addRepository(protocol: AgentFramework): void {
    const repo = createProtocolRepository(protocol);
    if (repo) {
      this.repositoryMonitor.addRepository(repo);
    }
  }

  private async handleRepositoryChange(change: RepositoryChange): Promise<void> {
    this.emit('change:detected', change);

    if (this.state.activePipelines.size >= this.config.maxConcurrentPipelines) {
      console.warn(`Max concurrent pipelines (${this.config.maxConcurrentPipelines}) reached, queuing change`);
      return;
    }

    const pipeline = await this.createPipeline(change);
    await this.runPipeline(pipeline);
  }

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

  private async executePipelineStages(pipeline: AdaptationPipeline): Promise<void> {
    const analysis = await this.executeAndEmitAnalysis(pipeline);
    const proposal = await this.executeAndEmitGeneration(pipeline, analysis);
    const validation = await this.executeAndEmitValidation(pipeline, proposal);

    const approvalResult = await this.handleApprovalRequirements(
      pipeline,
      analysis,
      proposal,
      validation
    );
    
    if (approvalResult.awaitingApproval) {
      return;
    }

    await this.executeDeploymentAndComplete(pipeline, proposal);
  }

  private async executeAndEmitAnalysis(pipeline: AdaptationPipeline): Promise<AnalysisResult> {
    await this.transitionStage(pipeline, 'analyzing');
    const analysis = await this.analysisExecutor.execute(pipeline);
    pipeline.analysis = analysis;
    this.emit('analysis:completed', analysis);
    return analysis;
  }

  private async executeAndEmitGeneration(
    pipeline: AdaptationPipeline,
    analysis: AnalysisResult
  ): Promise<ChangeProposal> {
    await this.transitionStage(pipeline, 'generating');
    const proposal = await this.generationExecutor.execute(pipeline, analysis);
    pipeline.proposal = proposal;
    this.emit('proposal:generated', proposal);
    return proposal;
  }

  private async executeAndEmitValidation(
    pipeline: AdaptationPipeline,
    proposal: ChangeProposal
  ): Promise<ValidationResult> {
    await this.transitionStage(pipeline, 'validating');
    const validation = await this.validationExecutor.execute(pipeline, proposal);
    pipeline.validation = validation;
    this.emit('validation:completed', validation);
    return validation;
  }

  private calculateImpactScore(impactAssessment: ImpactAssessment): number {
    const impactScoreMap: Record<string, number> = {
      critical: 1.0,
      significant: 0.8,
      moderate: 0.5,
      minimal: 0.2,
      none: 0.0,
    };
    return impactScoreMap[impactAssessment.overallImpact] ?? 0.0;
  }

  private determineApprovalType(
    impactScore: number,
    validationPassed: boolean
  ): 'human-required' | 'auto-approved' | 'proceed-with-caution' {
    if (impactScore > this.config.humanApprovalThreshold) {
      return 'human-required';
    }
    if (impactScore <= this.config.autoApprovalThreshold && validationPassed) {
      return 'auto-approved';
    }
    return 'proceed-with-caution';
  }

  private async handleApprovalRequirements(
    pipeline: AdaptationPipeline,
    analysis: AnalysisResult,
    proposal: ChangeProposal,
    validation: ValidationResult
  ): Promise<{ awaitingApproval: boolean; approvalType: string }> {
    const impactScore = this.calculateImpactScore(analysis.impactAssessment);
    const approvalType = this.determineApprovalType(impactScore, validation.valid);

    switch (approvalType) {
      case 'human-required':
        await this.transitionStage(pipeline, 'awaiting-review');
        this.state.pendingApprovals.set(pipeline.pipelineId, proposal);
        this.emit('pipeline:approval-required', pipeline, proposal);
        return { awaitingApproval: true, approvalType };

      case 'auto-approved':
        this.state.statistics.autoApprovedCount++;
        return { awaitingApproval: false, approvalType };

      default:
        return { awaitingApproval: false, approvalType };
    }
  }

  private async executeDeploymentAndComplete(
    pipeline: AdaptationPipeline,
    proposal: ChangeProposal
  ): Promise<void> {
    await this.transitionStage(pipeline, 'deploying');
    const deployment = await this.deploymentExecutor.execute(pipeline, proposal);
    pipeline.deployment = deployment;
    this.emit('deployment:completed', deployment);

    await this.transitionStage(pipeline, 'completed');
    await this.completePipeline(pipeline);
  }

  private async transitionStage(pipeline: AdaptationPipeline, toStage: PipelineStage): Promise<void> {
    const transition: StageTransition = {
      fromStage: pipeline.currentStage,
      toStage,
      timestamp: new Date().toISOString(),
      triggeredBy: 'orchestrator',
    };

    pipeline.stageHistory.push(transition);
    pipeline.currentStage = toStage;
    
    this.state.activePipelines.set(pipeline.pipelineId, pipeline);
    
    this.emit('pipeline:stage-changed', pipeline, transition);
  }

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

    if (this.config.autoRollback && pipeline.deployment) {
      await this.rollback(pipeline);
    }

    this.emit('pipeline:failed', pipeline, pipelineError);
  }

  private async completePipeline(pipeline: AdaptationPipeline): Promise<void> {
    pipeline.status = 'completed';
    pipeline.completedAt = new Date().toISOString();

    this.state.activePipelines.delete(pipeline.pipelineId);
    this.state.completedPipelines.push(pipeline);
    this.state.statistics.successfulPipelines++;

    const duration = new Date(pipeline.completedAt).getTime() - new Date(pipeline.startedAt).getTime();
    const totalDuration = this.state.statistics.averageDurationMs * (this.state.statistics.totalPipelinesRun - 1) + duration;
    this.state.statistics.averageDurationMs = totalDuration / this.state.statistics.totalPipelinesRun;

    this.emit('pipeline:completed', pipeline);
  }

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
      
      if (pipeline.proposal && decision.comments) {
        pipeline.proposal.reviewNotes = pipeline.proposal.reviewNotes || [];
        pipeline.proposal.reviewNotes.push(decision.comments);
      }

      await this.transitionStage(pipeline, 'deploying');
      const deployment = await this.deploymentExecutor.execute(pipeline, pipeline.proposal!);
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

  async rollback(pipeline: AdaptationPipeline): Promise<void> {
    if (!pipeline.deployment || !pipeline.deployment.rollbackAvailable) {
      throw new Error('Rollback not available for this pipeline');
    }

    this.state.statistics.rollbackCount++;
    
    console.log(`Rolling back deployment ${pipeline.deployment.deploymentId}`);
    
    pipeline.deployment.status = 'rolled-back';
    
    if (pipeline.proposal) {
      pipeline.proposal.status = 'rolled-back';
    }
  }

  getStatistics(): PipelineStatistics {
    return { ...this.state.statistics };
  }

  getPendingApprovals(): ChangeProposal[] {
    return Array.from(this.state.pendingApprovals.values());
  }

  getActivePipelines(): AdaptationPipeline[] {
    return Array.from(this.state.activePipelines.values());
  }
}
