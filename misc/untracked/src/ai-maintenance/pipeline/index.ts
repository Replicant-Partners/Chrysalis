/**
 * Adaptation Pipeline Module
 * 
 * Orchestrates the full adaptation workflow from change detection through
 * staged review and deployment. Implements the 5-stage pipeline:
 * Detect → Analyze → Generate → Validate → Deploy
 * 
 * @module ai-maintenance/pipeline
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
} from './types';

export { AdaptationPipelineOrchestrator } from './orchestrator';

export {
  createPipelineOrchestrator,
  createAndStartOrchestrator,
} from './factory';

export {
  AnalysisStageExecutor,
  GenerationStageExecutor,
  ValidationStageExecutor,
  DeploymentStageExecutor,
} from './stages';
