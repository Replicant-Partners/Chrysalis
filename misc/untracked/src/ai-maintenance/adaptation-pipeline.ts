/**
 * Adaptation Pipeline for AI-Led Adaptive Maintenance
 * 
 * Orchestrates the full adaptation workflow from change detection through
 * staged review and deployment. Implements the 5-stage pipeline:
 * Detect → Analyze → Generate → Validate → Deploy
 * 
 * @module ai-maintenance/adaptation-pipeline
 * @version 2.0.0
 * 
 * This module is a facade that re-exports from the modular pipeline/ subdirectory.
 * For new code, prefer importing directly from './pipeline' or its submodules.
 */

export {
  PipelineConfig,
  GitConfig,
  PipelineEvents,
  ReviewDecision,
  OrchestratorState,
  PipelineStatistics,
  DEFAULT_PIPELINE_CONFIG,
  createInitialState,
  AdaptationPipelineOrchestrator,
  createPipelineOrchestrator,
  createAndStartOrchestrator,
  AnalysisStageExecutor,
  GenerationStageExecutor,
  ValidationStageExecutor,
  DeploymentStageExecutor,
} from './pipeline';
