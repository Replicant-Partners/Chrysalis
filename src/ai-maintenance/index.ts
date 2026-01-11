/**
 * AI-Led Adaptive Maintenance System
 * 
 * Main module exports for the autonomous monitoring, analysis, and adaptation
 * system that maintains protocol adapters and codebase health.
 * 
 * @module ai-maintenance
 * @version 1.0.0
 */

// ============================================================================
// Core Types
// ============================================================================

export * from './types';

// ============================================================================
// Evolutionary Patterns Registry
// ============================================================================

export {
  // Registry functions
  patternRegistry,
  getAllPatterns,
  getPattern,
  matchPatterns,
  registerPattern,
  getPatternsByCategory,
  
  // Individual patterns
  PATTERN_EXTERNAL_DEPENDENCY_UPDATE,
  PATTERN_API_DEPRECATION_CASCADE,
  PATTERN_SCHEMA_MIGRATION,
  PATTERN_PROTOCOL_EXTENSION,
  PATTERN_SECURITY_VULNERABILITY_RESPONSE,
  PATTERN_PERFORMANCE_DEGRADATION,
  
  // Context type
  type PatternMatchContext
} from './evolutionary-patterns';

// ============================================================================
// Repository Monitor
// ============================================================================

export {
  RepositoryMonitor,
  createProtocolRepository,
  type RepositoryMonitorConfig,
  type RepositoryMonitorEvents
} from './repository-monitor';

// ============================================================================
// Semantic Diff Analyzer
// ============================================================================

export {
  SemanticDiffAnalyzer,
  createSemanticDiffAnalyzer,
  analyzeRepositoryChange,
  type APISignature,
  type ParameterSignature,
  type SchemaDefinition,
  type SchemaField,
  type APISurfaceComparison,
  type APIModification,
  type APIChangeDetail,
  type SchemaComparison,
  type FieldModification,
  type SemanticDiffConfig,
  type BehavioralChange,
  type FileContentChange,
  type ExtendedAnalysisResult,
} from './semantic-diff-analyzer';

// ============================================================================
// Adapter Modification Generator
// ============================================================================

export {
  AdapterModificationGenerator,
  createModificationGenerator,
  generateAdapterProposal,
  CODE_TEMPLATES,
  type GeneratorConfig,
  type CodeStyleConfig,
  type GenerationContext,
  type CodeTemplate,
  type TemplateVariable,
  type GenerationResult,
  type GenerationError,
  type GenerationStats,
} from './adapter-modification-generator';

// ============================================================================
// Adaptation Pipeline
// ============================================================================

export {
  AdaptationPipelineOrchestrator,
  createPipelineOrchestrator,
  createAndStartOrchestrator,
  type PipelineConfig,
  type GitConfig,
  type PipelineEvents,
  type ReviewDecision,
  type OrchestratorState,
  type PipelineStatistics,
} from './adaptation-pipeline';

// ============================================================================
// Cross-cutting AI Adaptation Integration
// ============================================================================

export {
  // Controllers and Managers
  CrossCuttingController,
  PatternDetectionInstrumentor,
  ChangePropagationSystem,
  SelfModificationInterface,
  
  // Global instances
  crossCuttingController,
  patternDetectionInstrumentor,
  changePropagationSystem,
  selfModificationInterface,
  
  // Types
  type PatternType,
  type AdaptationConcern,
  type InstrumentationPoint,
  type PropagationChannel,
  type ModificationLevel,
  type ProposalType,
  type InstrumentationConfig,
  type InstrumentationData,
  type PropagationMessage,
  type ModificationRequest,
  type ModificationChange,
  type RollbackPlan,
  type RollbackStep,
  type AdaptiveHealth,
  type ModificationProposal,
} from './cross-cutting-integration';

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Re-export for convenience
};
