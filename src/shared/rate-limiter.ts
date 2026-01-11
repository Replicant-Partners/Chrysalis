/**
 * Rate Limiter Utility
 * 
 * Provides rate limiting functionality to prevent DoS attacks
 * and enforce API usage limits.
 * 
 * Features:
 * - Sliding window rate limiting
 * - Per-key tracking
 * - Automatic cleanup of expired entries
 * - Configurable limits and windows
 * 
 * @module shared/rate-limiter
 * @version 1.0.0
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Cleanup interval in milliseconds (default: windowMs * 2) */
  cleanupIntervalMs?: number;
  /** Key prefix for namespacing */
  keyPrefix?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in window */
  remaining: number;
  /** Total limit */
  limit: number;
  /** Time until limit resets (ms) */
  resetIn: number;
  /** Timestamp when limit resets */
  resetAt: number;
}

/**
 * Request record for tracking
 */
interface RequestRecord {
  timestamps: number[];
  lastCleanup: number;
}

// ============================================================================
// Rate Limiter Class
// ============================================================================

/**
 * Sliding window rate limiter.
 * 
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000 // 1 minute
 * });
 * 
 * // Check if request is allowed
 * const result = limiter.checkLimit('user-123');
 * if (!result.allowed) {
 *   throw new Error(`Rate limit exceeded. Reset in ${result.resetIn}ms`);
 * }
 * 
 * // Record the request
 * limiter.recordRequest('user-123');
 * ```
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private requests: Map<string, RequestRecord> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: RateLimiterConfig) {
    this.config = {
      cleanupIntervalMs: config.windowMs * 2,
      keyPrefix: '',
      ...config
    };

    // Start cleanup timer
    this.startCleanup();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Check if a request is within rate limits (does not record the request)
   */
  checkLimit(key: string): RateLimitResult {
    const fullKey = this.getFullKey(key);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const record = this.requests.get(fullKey);
    if (!record) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        limit: this.config.maxRequests,
        resetIn: this.config.windowMs,
        resetAt: now + this.config.windowMs
      };
    }

    // Count requests in current window
    const validTimestamps = record.timestamps.filter(ts => ts > windowStart);
    const count = validTimestamps.length;
    const remaining = Math.max(0, this.config.maxRequests - count);
    
    // Calculate reset time
    const oldestInWindow = validTimestamps.length > 0 ? validTimestamps[0] : now;
    const resetAt = oldestInWindow + this.config.windowMs;
    const resetIn = Math.max(0, resetAt - now);

    return {
      allowed: count < this.config.maxRequests,
      remaining,
      limit: this.config.maxRequests,
      resetIn,
      resetAt
    };
  }

  /**
   * Check limit and record request if allowed
   */
  tryRequest(key: string): RateLimitResult {
    const result = this.checkLimit(key);
    if (result.allowed) {
      this.recordRequest(key);
      result.remaining = Math.max(0, result.remaining - 1);
    }
    return result;
  }

  /**
   * Record a request (use after checkLimit if request was made)
   */
  recordRequest(key: string): void {
    const fullKey = this.getFullKey(key);
    const now = Date.now();

    let record = this.requests.get(fullKey);
    if (!record) {
      record = { timestamps: [], lastCleanup: now };
      this.requests.set(fullKey, record);
    }

    record.timestamps.push(now);

    // Inline cleanup if too many timestamps
    if (record.timestamps.length > this.config.maxRequests * 2) {
      const windowStart = now - this.config.windowMs;
      record.timestamps = record.timestamps.filter(ts => ts > windowStart);
      record.lastCleanup = now;
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    const fullKey = this.getFullKey(key);
    this.requests.delete(fullKey);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }

  /**
   * Get current request count for a key
   */
  getCount(key: string): number {
    const fullKey = this.getFullKey(key);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const record = this.requests.get(fullKey);
    if (!record) return 0;

    return record.timestamps.filter(ts => ts > windowStart).length;
  }

  /**
   * Get all tracked keys
   */
  getKeys(): string[] {
    return Array.from(this.requests.keys()).map(k => 
      this.config.keyPrefix ? k.slice(this.config.keyPrefix.length + 1) : k
    );
  }

  /**
   * Stop the cleanup timer (call when done with rate limiter)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.requests.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getFullKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    // Don't prevent process exit in Node.js
    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, record] of this.requests) {
      // Remove timestamps outside window
      record.timestamps = record.timestamps.filter(ts => ts > windowStart);
      record.lastCleanup = now;

      // Remove empty records
      if (record.timestamps.length === 0) {
        this.requests.delete(key);
      }
    }
  }
}

// ============================================================================
// Middleware Helpers
// ============================================================================

/**
 * Create rate limit headers for HTTP responses
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'Retry-After': result.allowed ? '' : String(Math.ceil(result.resetIn / 1000))
  };
}

/**
 * Rate limit error class
 */
export class RateLimitExceededError extends Error {
  readonly result: RateLimitResult;
  readonly key: string;

  constructor(key: string, result: RateLimitResult) {
    super(`Rate limit exceeded for ${key}. Reset in ${Math.ceil(result.resetIn / 1000)} seconds.`);
    this.name = 'RateLimitExceededError';
    this.result = result;
    this.key = key;
    
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }

  /**
   * Get headers to include in error response
   */
  getHeaders(): Record<string, string> {
    return createRateLimitHeaders(this.result);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a rate limiter with common presets
 */
export function createRateLimiter(
  preset: 'strict' | 'standard' | 'relaxed' | RateLimiterConfig
): RateLimiter {
  if (typeof preset === 'object') {
    return new RateLimiter(preset);
  }

  const presets: Record<string, RateLimiterConfig> = {
    strict: {
      maxRequests: 10,
      windowMs: 60000 // 10 requests per minute
    },
    standard: {
      maxRequests: 100,
      windowMs: 60000 // 100 requests per minute
    },
    relaxed: {
      maxRequests: 1000,
      windowMs: 60000 // 1000 requests per minute
    }
  };

  return new RateLimiter(presets[preset]);
}

// ============================================================================
// Exports
// ============================================================================

export default RateLimiter;
