/**
 * Base Unified Adapter Implementation
 * 
 * Abstract base class providing common functionality for all protocol-specific
 * unified adapters. Implements the UnifiedAdapter interface with shared utilities
 * for health tracking, version management, and lifecycle operations.
 * 
 * @module adapters/base-unified-adapter
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { AgentFramework, PROTOCOL_METADATA } from './protocol-types';
import {
  UniversalMessage,
  UniversalPayload,
  UniversalMessageType,
  UniversalError,
  TraceContext,
  createMessage,
  createError
} from './protocol-messages';
import {
  ProtocolCapability,
  ProtocolFeature,
  CapabilityLevel,
  getProtocolCapability,
  supportsFeature
} from './protocol-capabilities';
import {
  ProtocolVersionInfo,
  VersionCompatibility,
  getEffectiveVersionInfo,
  checkVersionCompatibility,
  getProtocolHealth
} from './protocol-registry';
import {
  UnifiedAdapter,
  AdapterHealth,
  AdapterStatus,
  AdapterPattern,
  ConversionOptions,
  InvocationOptions
} from './unified-adapter';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Base adapter configuration.
 */
export interface BaseAdapterConfig {
  /** Protocol identifier */
  protocol: AgentFramework;
  /** Adapter version */
  version?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Default timeout for operations (ms) */
  defaultTimeoutMs?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay base (ms) */
  retryDelayMs?: number;
}

/**
 * Operation metrics for health tracking.
 */
export interface OperationMetrics {
  /** Total operations count */
  totalOperations: number;
  /** Successful operations count */
  successCount: number;
  /** Failed operations count */
  errorCount: number;
  /** Total latency (ms) */
  totalLatencyMs: number;
  /** Recent errors (within last hour) */
  recentErrors: number;
  /** Last successful operation timestamp */
  lastSuccessAt?: string;
  /** Last error timestamp */
  lastErrorAt?: string;
  /** Last error details */
  lastError?: UniversalError;
}

// ============================================================================
// Abstract Base Adapter
// ============================================================================

/**
 * Abstract base class for unified protocol adapters.
 * 
 * Provides common functionality including:
 * - Health tracking and metrics
 * - Version management
 * - Lifecycle management (init/shutdown)
 * - Error handling utilities
 * - Event emission for observability
 * 
 * Subclasses must implement protocol-specific conversion and invocation logic.
 */
export abstract class BaseUnifiedAdapter extends EventEmitter implements UnifiedAdapter {
  // Identity
  readonly protocol: AgentFramework;
  readonly pattern: AdapterPattern = 'unified';
  readonly version: string;
  
  // Configuration
  protected readonly config: BaseAdapterConfig;
  
  // State
  protected ready = false;
  protected metrics: OperationMetrics = {
    totalOperations: 0,
    successCount: 0,
    errorCount: 0,
    totalLatencyMs: 0,
    recentErrors: 0
  };
  
  constructor(config: BaseAdapterConfig) {
    super();
    this.config = config;
    this.protocol = config.protocol;
    this.version = config.version || getEffectiveVersionInfo(config.protocol).adapterVersion;
  }
  
  // ============================================================================
  // Capability Discovery
  // ============================================================================
  
  /**
   * Get protocol capabilities.
   */
  getCapabilities(): ProtocolCapability {
    return getProtocolCapability(this.protocol);
  }
  
  /**
   * Check if feature is supported.
   */
  supportsFeature(feature: ProtocolFeature): boolean {
    return supportsFeature(this.protocol, feature);
  }
  
  /**
   * Get feature implementation level.
   */
  getFeatureLevel(feature: ProtocolFeature): CapabilityLevel {
    const cap = this.getCapabilities();
    const featureDecl = cap.features.find(f => f.feature === feature);
    return featureDecl?.level ?? 'unsupported';
  }
  
  // ============================================================================
  // Version Information
  // ============================================================================
  
  /**
   * Get protocol version info.
   */
  getVersionInfo(): ProtocolVersionInfo {
    return getEffectiveVersionInfo(this.protocol);
  }
  
  /**
   * Check version compatibility.
   */
  checkCompatibility(version: string): VersionCompatibility {
    return checkVersionCompatibility(this.protocol, version);
  }
  
  // ============================================================================
  // Abstract Methods (Must be implemented by subclasses)
  // ============================================================================
  
  /**
   * Convert protocol-specific payload to universal message.
   * 
   * Must be implemented by protocol-specific adapters.
   */
  abstract toUniversalMessage(
    protocolPayload: unknown,
    messageType: UniversalMessageType,
    options?: ConversionOptions
  ): Promise<UniversalMessage>;
  
  /**
   * Convert universal message to protocol-specific format.
   * 
   * Must be implemented by protocol-specific adapters.
   */
  abstract fromUniversalMessage(
    message: UniversalMessage,
    options?: ConversionOptions
  ): Promise<unknown>;
  
  /**
   * Invoke a protocol operation.
   * 
   * Must be implemented by protocol-specific adapters.
   */
  abstract invokeOperation(
    operation: UniversalMessageType,
    params: UniversalPayload,
    options?: InvocationOptions
  ): Promise<UniversalMessage>;
  
  // ============================================================================
  // Health & Status
  // ============================================================================
  
  /**
   * Get adapter health status.
   */
  async getHealth(): Promise<AdapterHealth> {
    const avgLatency = this.metrics.totalOperations > 0
      ? this.metrics.totalLatencyMs / this.metrics.totalOperations
      : undefined;
    
    return {
      protocol: this.protocol,
      status: this.calculateStatus(),
      healthScore: this.calculateHealthScore(),
      isConnected: this.ready,
      lastSuccess: this.metrics.lastSuccessAt,
      lastError: this.metrics.lastError,
      avgLatencyMs: avgLatency,
      recentErrors: this.metrics.recentErrors,
      protocolHealth: getProtocolHealth(this.protocol)
    };
  }
  
  /**
   * Check if adapter is ready.
   */
  isReady(): boolean {
    return this.ready;
  }
  
  /**
   * Calculate adapter status.
   */
  protected calculateStatus(): AdapterStatus {
    if (!this.ready) return 'disconnected';
    if (this.metrics.recentErrors > 10) return 'error';
    if (this.metrics.recentErrors > 0 || this.metrics.lastError) return 'degraded';
    return 'healthy';
  }
  
  /**
   * Calculate health score (0-100).
   */
  protected calculateHealthScore(): number {
    let score = 100;
    
    if (!this.ready) score -= 50;
    if (this.metrics.lastError) score -= 10;
    if (this.metrics.recentErrors > 0) score -= Math.min(this.metrics.recentErrors * 2, 30);
    
    // Factor in success rate
    if (this.metrics.totalOperations > 0) {
      const successRate = this.metrics.successCount / this.metrics.totalOperations;
      score = Math.min(score, Math.round(successRate * 100));
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  // ============================================================================
  // Lifecycle Management
  // ============================================================================
  
  /**
   * Initialize the adapter.
   */
  async initialize(): Promise<void> {
    this.log('Initializing adapter');
    await this.doInitialize();
    this.ready = true;
    this.emit('initialized', { protocol: this.protocol });
    this.log('Adapter initialized');
  }
  
  /**
   * Shutdown the adapter.
   */
  async shutdown(): Promise<void> {
    this.log('Shutting down adapter');
    this.ready = false;
    await this.doShutdown();
    this.emit('shutdown', { protocol: this.protocol });
    this.log('Adapter shutdown complete');
  }
  
  /**
   * Reset adapter state.
   */
  async reset(): Promise<void> {
    this.metrics = {
      totalOperations: 0,
      successCount: 0,
      errorCount: 0,
      totalLatencyMs: 0,
      recentErrors: 0
    };
    await this.doReset();
    this.emit('reset', { protocol: this.protocol });
  }
  
  /**
   * Protocol-specific initialization logic.
   * Override in subclasses if needed.
   */
  protected async doInitialize(): Promise<void> {
    // Default: no-op
  }
  
  /**
   * Protocol-specific shutdown logic.
   * Override in subclasses if needed.
   */
  protected async doShutdown(): Promise<void> {
    // Default: no-op
  }
  
  /**
   * Protocol-specific reset logic.
   * Override in subclasses if needed.
   */
  protected async doReset(): Promise<void> {
    // Default: no-op
  }
  
  // ============================================================================
  // Metrics and Error Handling
  // ============================================================================
  
  /**
   * Record a successful operation.
   */
  protected recordSuccess(latencyMs: number): void {
    this.metrics.totalOperations++;
    this.metrics.successCount++;
    this.metrics.totalLatencyMs += latencyMs;
    this.metrics.lastSuccessAt = new Date().toISOString();
    
    this.emit('operation-success', {
      protocol: this.protocol,
      latencyMs
    });
  }
  
  /**
   * Record a failed operation.
   */
  protected recordError(error: unknown, operation?: string): UniversalError {
    this.metrics.totalOperations++;
    this.metrics.errorCount++;
    this.metrics.recentErrors++;
    this.metrics.lastErrorAt = new Date().toISOString();
    
    const universalError: UniversalError = {
      code: this.extractErrorCode(error),
      message: error instanceof Error ? error.message : String(error),
      retryable: this.isRetryable(error),
      sourceProtocol: this.protocol,
      stack: error instanceof Error ? error.stack : undefined,
      details: {
        operation,
        timestamp: this.metrics.lastErrorAt
      }
    };
    
    this.metrics.lastError = universalError;
    
    this.emit('operation-error', {
      protocol: this.protocol,
      error: universalError
    });
    
    return universalError;
  }
  
  /**
   * Extract error code from error object.
   */
  protected extractErrorCode(error: unknown): string {
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      if (typeof e.code === 'string') return e.code;
      if (typeof e.errorCode === 'string') return e.errorCode;
    }
    return 'ADAPTER_ERROR';
  }
  
  /**
   * Determine if an error is retryable.
   */
  protected isRetryable(error: unknown): boolean {
    // Network errors are typically retryable
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('econnrefused')
      );
    }
    return false;
  }
  
  /**
   * Create an error message.
   */
  protected createErrorMessage(
    code: string,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      retryable?: boolean;
      correlationId?: string;
      trace?: TraceContext;
    }
  ): UniversalMessage {
    return createError(this.protocol, code, message, options);
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  /**
   * Execute an operation with timeout.
   */
  protected async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = this.config.defaultTimeoutMs || 30000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  /**
   * Execute operation with retry logic.
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries || 3,
    delayMs: number = this.config.retryDelayMs || 1000
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries && this.isRetryable(error)) {
          const delay = delayMs * Math.pow(2, attempt); // Exponential backoff
          this.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Delay execution.
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Generate a unique message ID.
   */
  protected generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
  
  /**
   * Debug logging.
   */
  protected log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'debug',
        scope: `adapter:${this.protocol}`,
        message,
        meta: args && args.length ? args : undefined
      };
      // Emit via shared logger if present; fallback to console
      try {
        const { createLogger } = require('../shared/logger');
        createLogger(`adapter:${this.protocol}`).debug(message, { meta: entry.meta });
      } catch {
        console.log(JSON.stringify(entry));
      }
    }
  }
  
  /**
   * Create a trace context.
   */
  protected createTraceContext(parentTrace?: TraceContext): TraceContext {
    return {
      traceId: parentTrace?.traceId || this.generateId(),
      spanId: this.generateId().substring(0, 16),
      parentSpanId: parentTrace?.spanId,
      sampled: parentTrace?.sampled ?? true
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default BaseUnifiedAdapter;
