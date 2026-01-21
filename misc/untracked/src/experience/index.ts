/**
 * Experience Module
 *
 * Provides memory management, context condensation, and meta-cognitive capabilities.
 *
 * @module experience
 */

// Memory Management
export * from './MemoryMerger';
export * from './MemorySanitizer';

// Knowledge Integration
export * from './KnowledgeIntegrator';

// Skill Accumulation
export * from './SkillAccumulator';

// OODA Recording
export * from './OODARecorder';

// Command Modes
export * from './EmojiCommandMode';

// Context Condensation (NEW - OpenHands pattern)
export {
  // Types
  type CondenserMessage,
  type CondensationResult,
  type CondenserConfig,
  type LLMSummarizer,
  type Condenser,
  type CondenserType,
  type CondenserFactoryOptions,
  // Condensers
  WindowCondenser,
  ImportanceCondenser,
  SummarizingCondenser,
  AmortizedForgettingCondenser,
  PipelineCondenser,
  NoOpCondenser,
  // Factory
  createCondenser,
  createDefaultCondenser,
} from './ContextCondenser';

// Stuck Detection (NEW - OpenHands pattern)
export {
  // Types
  type StuckLoopType,
  type StuckSeverity,
  type ActionRecord,
  type StuckAnalysis,
  type StuckDetectorConfig,
  // Classes
  StuckDetector,
  OODAStuckAdapter,
  // Config
  DEFAULT_STUCK_CONFIG,
} from './StuckDetector';
