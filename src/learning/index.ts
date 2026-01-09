/**
 * Learning Module
 * 
 * Agent learning pipeline for Chrysalis - manages conversation memory,
 * document extraction, and skill learning.
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