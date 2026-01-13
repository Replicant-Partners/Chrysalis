/**
 * Chrysalis Core Module
 * 
 * Central exports for core infrastructure:
 * - Configuration management
 * - Error handling and boundaries
 * - Type definitions
 * 
 * @module core
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md
 */

// Configuration
export {
  getConfig,
  initializeConfig,
  validateConfig,
  exportConfig,
  type ChrysalisConfig,
  type EnvironmentConfig,
  type LLMConfig,
  type MemoryConfig,
  type ServiceConfig,
  type ObservabilityConfig,
} from './config';

// Error handling
export {
  // Error classes
  ChrysalisError,
  MorphError,
  MemoryError,
  LLMError,
  MCPError,
  ConfigError,
  ServiceError,
  
  // Error codes
  ErrorCodes,
  type ErrorCode,
  
  // Error boundary
  ErrorBoundary,
  type ErrorBoundaryConfig,
  
  // Utilities
  isChrysalisError,
  isRecoverable,
  getErrorCode,
  withErrorBoundary,
  createErrorFromResponse,
} from './errors';