/**
 * Configuration Module
 * 
 * Centralized configuration exports for Chrysalis
 * 
 * @module config
 */

export {
  OLLAMA_MODELS,
  DEFAULT_ADA_MODEL,
  OLLAMA_CONFIG,
  getOllamaModel,
  getRecommendedModels,
  getModelsByCapability,
  formatModelForGateway,
  type OllamaModelConfig,
} from './ollama-models';