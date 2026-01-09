/**
 * Learning Module
 *
 * Agent learning pipeline for Chrysalis - manages conversation memory,
 * document extraction, skill learning, and builder embedding integration.
 *
 * @module learning
 */

// Main pipeline
export { AgentLearningPipeline, default } from './AgentLearningPipeline';
export type {
  LearningEvent,
  LearningEventHandler,
  DocumentInput,
  ActionObservation,
  LearningPipelineConfig,
} from './AgentLearningPipeline';
export { DEFAULT_PIPELINE_CONFIG } from './AgentLearningPipeline';

// Conversation memory
export { ConversationMemoryManager } from './ConversationMemoryManager';
export type {
  ChatMessageInput,
  ConversationContext,
  ConversationSession,
  ConversationMemoryConfig,
} from './ConversationMemoryManager';
export { DEFAULT_CONVERSATION_MEMORY_CONFIG } from './ConversationMemoryManager';

// Legend embedding loader (bridges builder pipelines to MemU)
export { LegendEmbeddingLoader } from './LegendEmbeddingLoader';
export type {
  KnowledgeEmbedding,
  SkillEmbedding,
  LegendEmbeddingFile,
  LoadingOptions,
  LoadingResult,
  LoadingStats,
} from './LegendEmbeddingLoader';