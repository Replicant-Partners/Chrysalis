/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures when external services are unavailable.
 * Used to wrap MCP client calls and other external dependencies.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service unavailable, requests fail fast with fallback
 * - HALF_OPEN: Testing if service recovered
 * 
 * @see IMPLEMENTATION_PLAN.md Phase 0.3
 * @see COMPREHENSIVE_CODE_REVIEW.md HIGH-ARCH-001
 */

import { createLogger } from '../shared/logger';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Timeout for individual operations in ms */
  timeout: number;
  /** Time before attempting recovery in ms */
  resetTime: number;
  /** Name for logging/metrics */
  name: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  totalCalls: number;
  fallbackCalls: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker<T> {
  private failures = 0;
  private successes = 0;
  private lastFailure: number | null = null;
  private lastSuccess: number | null = null;
  private state: CircuitState = 'closed';
  private totalCalls = 0;
  private fallbackCalls = 0;
  
  private readonly config: CircuitBreakerConfig;
  private log = createLogger('circuit-breaker');
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      timeout: config.timeout ?? 5000,
      resetTime: config.resetTime ?? 30000,
      name: config.name ?? 'default'
    };
  }
  
  /**
   * Execute operation with circuit breaker protection
   * 
   * @param operation - The async operation to execute
   * @param fallback - Fallback function if circuit is open or operation fails
   * @returns Result from operation or fallback
   */
  async execute(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    this.totalCalls++;
    
    // Check if circuit is open
    if (this.state === 'open') {
      if (this.shouldAttemptRecovery()) {
        this.state = 'half-open';
      } else {
        this.fallbackCalls++;
        return this.executeFallback(fallback, 'Circuit open');
      }
    }
    
    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      this.fallbackCalls++;
      return this.executeFallback(fallback, this.getErrorMessage(error));
    }
  }
  
  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new CircuitBreakerError(
          `Operation timed out after ${this.config.timeout}ms`,
          this.config.name,
          this.state
        ));
      }, this.config.timeout);
      
      operation()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  /**
   * Execute fallback with error context
   */
  private async executeFallback(
    fallback: () => T | Promise<T>,
    reason: string
  ): Promise<T> {
    this.log.warn('using fallback', { circuit: this.config.name, reason });
    return fallback();
  }
  
  /**
   * Check if we should attempt recovery (reset time elapsed)
   */
  private shouldAttemptRecovery(): boolean {
    if (this.lastFailure === null) return true;
    return Date.now() - this.lastFailure > this.config.resetTime;
  }
  
  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccess = Date.now();
    
    if (this.state === 'half-open') {
      // Recovery successful, close circuit
      this.state = 'closed';
      this.failures = 0;
      this.log.info('circuit closed after recovery', { circuit: this.config.name });
    }
  }
  
  /**
   * Handle failed operation
   */
  private onFailure(error: unknown): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.state === 'half-open') {
      // Recovery failed, reopen circuit
      this.state = 'open';
      this.log.warn('circuit reopened after failed recovery', { circuit: this.config.name });
    } else if (this.failures >= this.config.failureThreshold) {
      // Threshold reached, open circuit
      this.state = 'open';
      this.log.warn('circuit opened after failures', {
        circuit: this.config.name,
        failures: this.failures
      });
    }
  }
  
  /**
   * Get error message from unknown error
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
  
  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      totalCalls: this.totalCalls,
      fallbackCalls: this.fallbackCalls
    };
  }
  
  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Force circuit state (for testing)
   */
  forceState(state: CircuitState): void {
    this.state = state;
    if (state === 'closed') {
      this.failures = 0;
    }
  }
  
  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.totalCalls = 0;
    this.fallbackCalls = 0;
  }
}

/**
 * Create a circuit breaker with common defaults for MCP operations
 */
export function createMCPCircuitBreaker<T>(name: string): CircuitBreaker<T> {
  return new CircuitBreaker<T>({
    name,
    failureThreshold: 3,
    timeout: 5000,   // 5 second timeout
    resetTime: 30000 // 30 second reset
  });
}

/**
 * Create a circuit breaker for embedding operations (longer timeout)
 */
export function createEmbeddingCircuitBreaker<T>(name: string): CircuitBreaker<T> {
  return new CircuitBreaker<T>({
    name,
    failureThreshold: 2,
    timeout: 30000,  // 30 second timeout for model loading
    resetTime: 60000 // 1 minute reset
  });
}
